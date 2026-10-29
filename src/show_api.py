from __future__ import annotations
import os,sys,threading
from pathlib import Path
from typing import Any,Callable
from flask import Flask,jsonify,request
from flask_cors import CORS
ROOT=Path(__file__).resolve().parents[1]
SCRIPTS=ROOT/"scripts"
if str(SCRIPTS) not in sys.path: sys.path.insert(0,str(SCRIPTS))
from show_project_assembler import build_show_project
app=Flask(__name__);CORS(app)
ASSETS_ROOT=Path(os.getenv("SHOW_ASSETS_ROOT",str(ROOT/"reaper-projects"))).resolve()
SHOW_OUTPUT=Path(os.getenv("SHOW_PROJECT_PATH",str(ROOT/"shows"/"Dirty Diaperz Live Show.RPP"))).resolve()
try: import reapy
except ImportError: reapy=None
LOCK=threading.RLock();STATE_LOCK=threading.RLock();state={"current_song":None,"last_build":None}
def rc(fn:Callable[[],Any]):
    if reapy is None:return False,"reapy is not installed"
    try:
        with LOCK:
            with reapy.inside_reaper():return True,fn()
    except Exception as e:return False,f"{type(e).__name__}: {e}"
def transport():
    def read():
        p=reapy.Project();sec=max(0.0,float(p.play_position));s=int(reapy.reascript_api.GetPlayState())
        return {"playing":bool(s&1),"paused":bool(s&2),"recording":bool(s&4),"position":f"{int(sec//60)}:{int(sec%60):02d}","bpm":round(float(p.bpm),1),"reaper_ok":True}
    ok,r=rc(read)
    return r if ok else {"playing":False,"paused":False,"recording":False,"position":"0:00","bpm":"---","reaper_ok":False,"reaper_error":r}
def act(name):
    ok,r=rc(lambda:getattr(reapy.Project(),name)())
    return (jsonify({"ok":ok,"action":name,**({} if ok else {"error":r})}),200 if ok else 503)
@app.get("/health")
def health():
    t=transport();return jsonify({"ok":True,"show_api_ok":True,"reaper_ok":t.get("reaper_ok",False),"reaper_error":t.get("reaper_error"),"assets_root":str(ASSETS_ROOT),"show_project":str(SHOW_OUTPUT)})
@app.get("/status")
def status():
    with STATE_LOCK:c=state["current_song"];b=state["last_build"]
    return jsonify({**transport(),"show_api_ok":True,"current_song":c,"last_build":b})
@app.post("/transport/play")
def play():return act("play")
@app.post("/transport/pause")
def pause():return act("pause")
@app.post("/transport/stop")
def stop():return act("stop")
@app.post("/transport/record")
def record():return act("record")
@app.post("/show/build")
def build():
    try:r=build_show_project(request.get_json(silent=True) or {},ASSETS_ROOT,SHOW_OUTPUT)
    except Exception as e:return jsonify({"ok":False,"error":f"{type(e).__name__}: {e}"}),400
    with STATE_LOCK:state["last_build"]=r
    return jsonify(r)
def cue(song_id,title):
    def jump():
        p=reapy.Project()
        for m in p.markers:
            parts=(m.name or "").split("|",3)
            if len(parts)==4 and parts[0]=="LIVE" and (parts[2]==song_id or parts[3].casefold()==title.casefold()):
                p.stop();p.cursor_position=float(m.position);return {"marker":m.name,"position":float(m.position)}
        raise LookupError(f"No LIVE marker found for {title}")
    ok,r=rc(jump)
    if not ok:raise RuntimeError(r)
    return r
@app.post("/song/cue")
def song_cue():
    d=request.get_json(silent=True) or {};sid=str(d.get("song_id") or "");title=str(d.get("title") or "").strip()
    try:m=cue(sid,title)
    except Exception as e:return jsonify({"ok":False,"error":str(e)}),404
    selected={"song_id":sid,"title":title,"click_bpm":d.get("click_bpm"),**m}
    with STATE_LOCK:state["current_song"]=selected
    return jsonify({"ok":True,"song":selected})
@app.post("/x32/scene/<int:number>")
def no_scene(number):return jsonify({"ok":False,"error":"X32 scene recall disabled","scene":number}),409
if __name__=="__main__":
    print(f"Show API http://127.0.0.1:5000\nAssets {ASSETS_ROOT}\nShow {SHOW_OUTPUT}")
    app.run(host="0.0.0.0",port=5000,debug=False,threaded=True,use_reloader=False)
