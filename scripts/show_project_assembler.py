#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, re, wave
from pathlib import Path
from typing import Any

SAMPLE_RATE=48000
SONG_GAP_SECONDS=8.0
CLICK_OUTPUT=31
CUES_OUTPUT=32

def slug(v:str)->str: return re.sub(r"[^a-z0-9]+","_",v.lower()).strip("_")
def q(v:str)->str: return v.replace("\\","/").replace('"','\\"')
def wav_duration(p:Path)->float:
    with wave.open(str(p),"rb") as h: return h.getnframes()/float(h.getframerate())
def mono_hwout(n:int)->int: return 1024+n-1

def find_folder(root:Path,song:dict[str,Any])->Path|None:
    wanted={slug(str(song.get("id") or "")),slug(str(song.get("title") or ""))}-{""}
    found=[]
    if root.exists():
        for meta in root.rglob("automation-result.json"):
            try: data=json.loads(meta.read_text(encoding="utf-8"))
            except Exception: continue
            values={slug(str(data.get("title") or "")),slug(str(data.get("song_id") or "")),slug(meta.parent.name)}
            score=len(wanted & values)
            if score: found.append((score,meta.parent))
    if found: return sorted(found,key=lambda x:x[0],reverse=True)[0][1]
    return None

def resolve(root:Path,song:dict[str,Any],position:int)->dict[str,Any]:
    folder=find_folder(root,song)
    if folder is None: raise FileNotFoundError(f"No generated assets found for {song.get('title')}")
    click,cues=folder/"CLICK.wav",folder/"CUES.wav"
    if not click.is_file(): raise FileNotFoundError(f"Missing {click}")
    if not cues.is_file(): raise FileNotFoundError(f"Missing {cues}")
    duration=max(wav_duration(click),wav_duration(cues),float(song.get("duration_sec") or 0),1.0)
    return {"id":str(song.get("id") or slug(str(song.get("title") or position))),"title":str(song.get("title") or f"Song {position}"),"position":position,"click":click.resolve(),"cues":cues.resolve(),"duration":duration,"start":0.0}

def record_track(n:int)->str:
    return f'  <TRACK\n    NAME "{n:02d} INPUT {n:02d}"\n    REC 1 0 1 0 0 0 0 0\n    RECINPUT {n-1}\n    RECMON 0\n    MAINSEND 1 0\n  >\n'

def item(path:Path,start:float,length:float,name:str)->str:
    return f'    <ITEM\n      POSITION {start:.6f}\n      LENGTH {length:.6f}\n      NAME "{q(name)}"\n      <SOURCE WAVE\n        FILE "{q(str(path))}"\n      >\n    >\n'

def playback_track(name:str,output:int,songs:list[dict[str,Any]],asset:str)->str:
    body=''.join(item(s[asset],s["start"],s["duration"],f'{s["position"]:02d} {s["title"]}') for s in songs)
    return f'  <TRACK\n    NAME "{name}"\n    MAINSEND 0 0\n    HWOUT {mono_hwout(output)} 0 1 0 0 0 0 -1:U -1\n{body}  >\n'

def build_show_project(manifest:dict[str,Any],assets_root:Path,out_path:Path)->dict[str,Any]:
    raw=manifest.get("songs") or []
    if not raw: raise ValueError("Manifest contains no songs")
    songs=[resolve(assets_root,s,i+1) for i,s in enumerate(raw)]
    cursor=0.0
    markers=[]
    for s in songs:
        s["start"]=cursor
        markers.append(f'  MARKER {s["position"]} {cursor:.6f} "{q(f"LIVE|{s["position"]:02d}|{s["id"]}|{s["title"]}")}" 0 0 1\n')
        cursor+=s["duration"]+SONG_GAP_SECONDS
    content='<REAPER_PROJECT 0.1 "7.0" 0\n  SAMPLERATE 48000 0 0\n  TEMPO 120.000000 4 4\n'+''.join(markers)+''.join(record_track(n) for n in range(1,33))+playback_track("CLICK",31,songs,"click")+playback_track("CUES",32,songs,"cues")+'>\n'
    out_path.parent.mkdir(parents=True,exist_ok=True)
    out_path.write_text(content,encoding="utf-8")
    result={"ok":True,"project":str(out_path.resolve()),"setlist":manifest.get("setlist_name") or "Live Show","song_count":len(songs),"sample_rate":48000,"markers":[{"position":s["position"],"song_id":s["id"],"title":s["title"],"start":s["start"]} for s in songs]}
    out_path.with_suffix(".manifest.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
    return result

def main()->int:
    p=argparse.ArgumentParser();p.add_argument("--manifest",required=True,type=Path);p.add_argument("--assets-root",required=True,type=Path);p.add_argument("--out",required=True,type=Path);a=p.parse_args()
    print(json.dumps(build_show_project(json.loads(a.manifest.read_text(encoding="utf-8")),a.assets_root,a.out)));return 0
if __name__=="__main__": raise SystemExit(main())
