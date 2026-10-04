"""
fadr_extract.py  —  ShenanigansStudio | Fadr extraction script
Run on your Windows machine BEFORE canceling Fadr.
Extracts: stems (WAV), MIDI, key, tempo for all processed songs.

Usage:
    pip install requests
    python scripts\fadr_extract.py
"""

import json, time, requests
from pathlib import Path

# ── CONFIG ─────────────────────────────────────────────────────────────────────
API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2YTZmM2Q5Mjk1ODI2MGZiMTAzNmNiMzkiLCJlbWFpbCI6InJpY2hyZWlkanJAaG90bWFpbC5jb20iLCJzb3VuZGNsb3VkIjp7ImlkIjoxNzQ1MDI3NzYzfSwicm9sZXMiOlsidXNlciJdLCJuYW1lIjoiUmljaCBSZWlkIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmcmVlX3NvbmdzIjoxLCJkYXRlIjoiMjAyNi0wOC0wMlQxMjo1MjozNC43NDVaIiwidG9rZW5fY3JlYXRlZCI6MTc5MDg3ODY1NDAwMSwiYXBpIjp0cnVlLCJhcGlLZXlVVUlEIjoiODg2MTNjMGEtN2VkYy00YmI1LWI1ODAtMWE2OWRlNTgwNGVmIiwiaWF0IjoxNzkwODc4NjU0fQ.lDNTLVYeWO4jPXE_PPNz2Oqpd8baWOiPaear2h4vIeA"   # Fadr → Settings → API Keys
BASE_URL  = "https://api.fadr.com"
STEMS_DIR = Path(r"D:\ShenanigansStudio\stems")
MIDI_DIR  = Path(r"D:\ShenanigansStudio\midi")
META_FILE = Path(r"D:\ShenanigansStudio\song-bible\fadr_metadata.json")

# Add local MP3s if you have them (e.g. from E:\AvidDownloads\Downloads)
LOCAL_SONGS_TO_SUBMIT = {
    # "Hotel California": r"E:\AvidDownloads\Downloads\hotel_california.mp3",
}

HEADERS = {"Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"}

TARGET_SONGS = [
    # Priority 1 — Active (39)
    ("Everlong","Foo Fighters",158), ("Fly Like an Eagle","Steve Miller Band",100),
    ("Georgy Porgy","Toto",97), ("Get Down On It","Kool and the Gang",111),
    ("Heartbreaker","Pat Benatar",156), ("Hells Bells","AC/DC",107),
    ("Here Comes My Girl","Tom Petty",105), ("Hold On Loosely","38 Special",127),
    ("Hold the Line","Toto",96), ("Home at Last","Steely Dan",64),
    ("I Think About You All the Time","Deftones",136),
    ("Immigrant Song","Led Zeppelin",113), ("Jessies Girl","Rick Springfield",132),
    ("Jesus Just Left Chicago","ZZ Top",72), ("Jumpin Jack Flash","Rolling Stones",137),
    ("Just What I Needed","The Cars",127),
    ("Keep On Rockin in the Free World","Neil Young",132),
    ("Kiss Me","Sixpence None the Richer",96), ("Linger","The Cranberries",96),
    ("Long Train Runnin","Doobie Brothers",117), ("Magic Man","Heart",103),
    ("Mary Janes Last Dance","Tom Petty",85), ("Mr Brightside","The Killers",148),
    ("Ohio","Neil Young",78), ("Peg","Steely Dan",117),
    ("Plush","Stone Temple Pilots",72), ("Pretzel Logic","Steely Dan",96),
    ("Promises in the Dark","Pat Benatar",158), ("Ramble On","Led Zeppelin",99),
    ("Ready for Love","Bad Company",129), ("Rebel Yell","Billy Idol",166),
    ("Rhiannon","Fleetwood Mac",129), ("Summer of 69","Bryan Adams",140),
    ("Sweet Emotion","Aerosmith",99), ("Sweet Home Alabama","Lynyrd Skynyrd",98),
    ("Twist and Shout","The Beatles",125), ("Wont Back Down","Tom Petty",114),
    ("Yellow Ledbetter","Pearl Jam",71), ("Zombie","The Cranberries",84),
    # Priority 2 — WIP (23)
    ("Brain Damage Eclipse","Pink Floyd",67), ("Eminence Front","The Who",98),
    ("Everybody Wants to Rule the World","Tears for Fears",112),
    ("Green Onions","Booker T",136), ("House of the Rising Sun","The Animals",117),
    ("I Feel Fine","The Beatles",90), ("Im Your Captain","Grand Funk Railroad",99),
    ("Island in the Sun","Weezer",115), ("Jailbreak","Thin Lizzy",145),
    ("Just Got Paid","ZZ Top",100), ("Kashmir","Led Zeppelin",81),
    ("Listen to Her Heart","Tom Petty",125), ("Movin On","Bad Company",117),
    ("Rock and Roll Fantasy","Bad Company",110), ("Santa Monica","Everclear",100),
    ("Say It Aint So","Weezer",76), ("Smells Like Teen Spirit","Nirvana",117),
    ("So Lonely","The Police",156), ("Stairway to Heaven","Led Zeppelin",82),
    ("The Boys Are Back in Town","Thin Lizzy",80), ("Time","Pink Floyd",120),
    ("Wish You Were Here","Pink Floyd",122),
    ("You Shook Me All Night Long","AC/DC",127),
]

def api_get(path):
    r = requests.get(f"{BASE_URL}{path}", headers=HEADERS, timeout=30)
    r.raise_for_status(); return r.json()

def api_post(path, body):
    r = requests.post(f"{BASE_URL}{path}", headers=HEADERS, json=body, timeout=30)
    r.raise_for_status(); return r.json()

def download_file(url, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536): f.write(chunk)
    print(f"    ✅ {dest.name}")

def safe_name(s):
    return "".join(c if c.isalnum() or c in " _-" else "_" for c in s).strip()

def list_all_assets():
    print("\n📋 Fetching your Fadr assets...")
    try:
        data = api_get("/assets")
        assets = data if isinstance(data, list) else data.get("assets", [])
        print(f"   Found {len(assets)} assets"); return assets
    except Exception as e:
        print(f"   ⚠️  {e}"); return []

def download_all_stems(assets):
    metadata = {}
    for asset in assets:
        asset_id   = asset.get("_id","")
        asset_name = asset.get("name", asset_id)
        meta       = asset.get("metaData",{})
        stems      = asset.get("stems",[])
        print(f"\n🎵 {asset_name}")
        song_meta  = {"fadr_id":asset_id,"name":asset_name,
                      "key":meta.get("key"),"tempo":meta.get("tempo"),"stems":[]}
        if not stems:
            print("   (no stems)"); metadata[asset_name]=song_meta; continue
        song_dir = STEMS_DIR / safe_name(asset_name)
        song_dir.mkdir(parents=True, exist_ok=True)
        for stem_id in stems:
            try:
                stem_asset = api_get(f"/assets/{stem_id}")
                stem_type  = stem_asset.get("metaData",{}).get("stemType","unknown")
                stem_name  = f"SS_{safe_name(asset_name)}_{stem_type}"
                dl  = api_get(f"/assets/download/{stem_id}/hq")
                url = dl.get("url")
                if url:
                    ext  = "wav" if "wav" in url.lower() else "mp3"
                    dest = song_dir / f"{stem_name}.{ext}"
                    download_file(url, dest)
                    song_meta["stems"].append({"type":stem_type,"file":str(dest)})
                try:
                    midi = api_get(f"/assets/download/{stem_id}/midi")
                    if midi.get("url"):
                        download_file(midi["url"],
                            MIDI_DIR/safe_name(asset_name)/f"{stem_name}.mid")
                except Exception: pass
            except Exception as e: print(f"   ⚠️  stem {stem_id}: {e}")
        metadata[asset_name] = song_meta
    return metadata

def run_drum_stem(drums_asset_id, parent_name):
    print(f"   🥁 kick/snare separation: {parent_name}...")
    task    = api_post("/assets/stem",{"_id":drums_asset_id,"stemType":"drum-stem"})
    task_id = task["task"]["_id"]
    for _ in range(60):
        time.sleep(5)
        t = api_get(f"/tasks/{task_id}")
        if t.get("task",{}).get("status",{}).get("complete"):
            print("     ✅ kick/snare/other ready"); return t
        print(".",end="",flush=True)

def submit_local_mp3(title, mp3_path):
    mp3_path = Path(mp3_path)
    print(f"\n🚀 Submitting: {title}")
    if not mp3_path.exists(): print(f"   ❌ Not found: {mp3_path}"); return
    up   = api_post("/assets/upload2",{"name":mp3_path.name,"extension":"mp3"})
    with open(mp3_path,"rb") as f:
        requests.put(up["url"],data=f,
                     headers={"Content-Type":"audio/mpeg"},timeout=120).raise_for_status()
    asset    = api_post("/assets",{"name":title,"extension":"mp3","s3Path":up["s3Path"]})
    asset_id = asset["asset"]["_id"]
    task     = api_post("/assets/stem",{"_id":asset_id,"stemType":"main"})
    task_id  = task["task"]["_id"]
    print("   Processing",end="",flush=True)
    for _ in range(120):
        time.sleep(5)
        t = api_get(f"/tasks/{task_id}")
        if t.get("task",{}).get("status",{}).get("complete"):
            print(" ✅")
            for a in t.get("task",{}).get("output",{}).get("assets",[]):
                if a.get("metaData",{}).get("stemType")=="drums":
                    run_drum_stem(a["_id"],title)
            return t
        print(".",end="",flush=True)
    print(" ⏱️ timed out — check Fadr dashboard")

if __name__ == "__main__":
    print("="*60)
    print("  ShenanigansStudio — Fadr Extraction Script")
    print("  Run this BEFORE canceling your Fadr subscription!")
    print("="*60)
    STEMS_DIR.mkdir(parents=True,exist_ok=True)
    MIDI_DIR.mkdir(parents=True,exist_ok=True)
    META_FILE.parent.mkdir(parents=True,exist_ok=True)
    assets   = list_all_assets()
    metadata = download_all_stems(assets)
    for title, path in LOCAL_SONGS_TO_SUBMIT.items():
        submit_local_mp3(title, path)
    with open(META_FILE,"w") as f: json.dump(metadata,f,indent=2)
    print(f"\n📄 Metadata saved → {META_FILE}")
    processed = [k for k,v in metadata.items() if v["stems"]]
    pending   = [s[0] for s in TARGET_SONGS
                 if not any(s[0].lower()[:10] in k.lower() for k in processed)]
    print(f"\n{'='*60}")
    print(f"✅  {len(processed)} songs with stems downloaded")
    print(f"⏳  {len(pending)} still need a source (use Moises Pro for these)")
    if pending:
        [print(f"   • {s}") for s in pending]
    else:
        print("\n🎉 All 62 songs done — safe to cancel Fadr!")
