import time
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

X32_IP   = '192.168.1.200'   # <-- SET YOUR X32 RACK IP HERE
X32_PORT = 10023

try:
    import reapy
    REAPER_OK = True
except ImportError:
    REAPER_OK = False
    print('[WARN] reapy not installed — REAPER control disabled')

try:
    from pythonosc import udp_client as osc_client
    _x32 = osc_client.SimpleUDPClient(X32_IP, X32_PORT)
    X32_OK = True
except ImportError:
    X32_OK = False
    print('[WARN] python-osc not installed — X32 control disabled')

def reaper_call(fn):
    if not REAPER_OK:
        return None
    try:
        with reapy.inside_reaper():
            return fn()
    except Exception as e:
        print(f'[REAPER] {e}')

def get_transport():
    if not REAPER_OK:
        return {'playing': False, 'paused': False, 'position': '0:00', 'bpm': '---'}
    try:
        with reapy.inside_reaper():
            proj    = reapy.Project()
            pos_sec = proj.play_position
            m, s    = int(pos_sec // 60), int(pos_sec % 60)
            return {
                'playing':  proj.is_playing,
                'paused':   proj.is_paused,
                'position': f'{m}:{s:02d}',
                'bpm':      round(proj.bpm, 1)
            }
    except Exception as e:
        return {'playing': False, 'paused': False, 'position': '0:00', 'bpm': '---', 'error': str(e)}

def x32_scene(n):
    if not X32_OK:
        return False
    try:
        _x32.send_message('/load', f'scene_{int(n):03d}')
        return True
    except Exception as e:
        print(f'[X32] {e}')
        return False

state = {'current_song': None}

@app.route('/status')
def status():
    t = get_transport()
    return jsonify({**t,
        'current_song': state['current_song'],
        'reaper_ok': REAPER_OK,
        'x32_ok':    X32_OK})

@app.route('/transport/play',  methods=['POST'])
def play():
    reaper_call(lambda: reapy.Project().play())
    return jsonify({'ok': True})

@app.route('/transport/stop',  methods=['POST'])
def stop():
    reaper_call(lambda: reapy.Project().stop())
    return jsonify({'ok': True})

@app.route('/transport/pause', methods=['POST'])
def pause():
    reaper_call(lambda: reapy.Project().pause())
    return jsonify({'ok': True})

@app.route('/transport/record', methods=['POST'])
def record():
    reaper_call(lambda: reapy.Project().record())
    return jsonify({'ok': True})

@app.route('/song/cue', methods=['POST'])
def song_cue():
    data  = request.get_json() or {}
    title = data.get('title', '')
    scene = data.get('x32_scene')
    state['current_song'] = data

    def jump():
        proj = reapy.Project()
        proj.stop()
        for mk in proj.markers:
            if title.lower() in mk.name.lower():
                proj.cursor_position = mk.position
                return
        for rg in proj.regions:
            if title.lower() in rg.name.lower():
                proj.cursor_position = rg.start
                return

    if REAPER_OK:
        reaper_call(jump)
    load_fx_preset(title)  # auto-restore FX preset
    if scene:
        x32_scene(scene)

    return jsonify({'ok': True, 'song': title, 'x32_scene': scene})

@app.route('/x32/scene/<int:n>', methods=['POST'])
def recall_scene(n):
    return jsonify({'ok': x32_scene(n), 'scene': n})


# ── FX Preset Recall ──────────────────────────────────────────────────────────
import os, json, re

FX_DIR = os.path.join(os.path.dirname(__file__), '..', 'fx_presets')
os.makedirs(FX_DIR, exist_ok=True)

def song_slug(title):
    return re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')

def save_fx_preset(title):
    if not REAPER_OK:
        return False
    preset = {}
    try:
        with reapy.inside_reaper():
            proj = reapy.Project()
            for track in proj.tracks:
                track_name = track.name or f'Track_{track.index}'
                preset[track_name] = []
                for fx in track.fxs:
                    fx_data = {
                        'name':    fx.name,
                        'enabled': fx.is_enabled,
                        'params':  {p.name: p.value for p in fx.params}
                    }
                    preset[track_name].append(fx_data)
        path = os.path.join(FX_DIR, song_slug(title) + '.json')
        with open(path, 'w') as f:
            json.dump(preset, f, indent=2)
        print(f'[FX] Saved preset for "{title}" → {path}')
        return True
    except Exception as e:
        print(f'[FX] Save error: {e}')
        return False

def load_fx_preset(title):
    if not REAPER_OK:
        return False
    path = os.path.join(FX_DIR, song_slug(title) + '.json')
    if not os.path.exists(path):
        print(f'[FX] No preset for "{title}" — skipping')
        return False
    try:
        with open(path) as f:
            preset = json.load(f)
        with reapy.inside_reaper():
            proj = reapy.Project()
            for track in proj.tracks:
                track_name = track.name or f'Track_{track.index}'
                if track_name not in preset:
                    continue
                for i, fx in enumerate(track.fxs):
                    if i >= len(preset[track_name]):
                        break
                    fx_data = preset[track_name][i]
                    fx.is_enabled = fx_data.get('enabled', True)
                    saved_params = fx_data.get('params', {})
                    for param in fx.params:
                        if param.name in saved_params:
                            try:
                                param.value = float(saved_params[param.name])
                            except Exception:
                                pass
        print(f'[FX] Loaded preset for "{title}"')
        return True
    except Exception as e:
        print(f'[FX] Load error: {e}')
        return False

@app.route('/song/fx/save', methods=['POST'])
def fx_save():
    data  = request.get_json() or {}
    title = data.get('title', state.get('current_song', {}).get('title', ''))
    if not title:
        return jsonify({'ok': False, 'error': 'No song title'})
    ok = save_fx_preset(title)
    return jsonify({'ok': ok, 'title': title, 'slug': song_slug(title)})

@app.route('/song/fx/load', methods=['POST'])
def fx_load():
    data  = request.get_json() or {}
    title = data.get('title', state.get('current_song', {}).get('title', ''))
    ok = load_fx_preset(title)
    return jsonify({'ok': ok, 'title': title})

@app.route('/song/fx/list', methods=['GET'])
def fx_list():
    files = [f.replace('.json','') for f in os.listdir(FX_DIR) if f.endswith('.json')]
    return jsonify({'presets': files})


# ── X32 Meter Subscription + SSE ─────────────────────────────────────────────
import struct, threading
from flask import Response
from pythonosc import dispatcher as osc_disp, server as osc_srv

meter_state = {'ch': [0.0] * 32, 'bus': [0.0] * 16, 'lr': [0.0, 0.0]}
_meter_lock = threading.Lock()

def _handle_meter_blob(address, *args):
    if not args:
        return
    blob = args[0]
    if not isinstance(blob, (bytes, bytearray)):
        return
    count = len(blob) // 4
    vals  = list(struct.unpack(f'<{count}f', blob[:count * 4]))
    with _meter_lock:
        if 'meters/1' in str(address):
            meter_state['ch'] = (vals + [0.0] * 32)[:32]
        elif 'meters/6' in str(address):
            meter_state['bus'] = (vals + [0.0] * 16)[:16]

def _meter_renew_loop():
    import time
    while True:
        try:
            if X32_OK:
                _x32.send_message('/xremote', [])
                _x32.send_message('/meters', ['/meters/1', 0])
                _x32.send_message('/meters', ['/meters/6', 0])
        except Exception:
            pass
        time.sleep(8)

def _start_meter_server():
    try:
        d = osc_disp.Dispatcher()
        d.set_default_handler(_handle_meter_blob)
        srv = osc_srv.ThreadingOSCUDPServer(('0.0.0.0', 10024), d)
        threading.Thread(target=_meter_renew_loop, daemon=True).start()
        print('[METERS] OSC receiver on :10024')
        srv.serve_forever()
    except Exception as e:
        print(f'[METERS] Could not start: {e}')

threading.Thread(target=_start_meter_server, daemon=True).start()

@app.route('/meters/stream')
def meters_stream():
    import json, time
    def generate():
        while True:
            with _meter_lock:
                payload = json.dumps({
                    'ch':  [round(v, 4) for v in meter_state['ch'][:16]],
                    'bus': [round(v, 4) for v in meter_state['bus'][:8]],
                    'lr':  [round(v, 4) for v in meter_state['lr']]
                })
            yield f'data: {payload}\n\n'
            time.sleep(0.1)
    return Response(generate(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache',
                             'X-Accel-Buffering': 'no',
                             'Access-Control-Allow-Origin': '*'})

@app.route('/meters/current')
def meters_current():
    with _meter_lock:
        return jsonify(meter_state)

if __name__ == '__main__':
    print('')
    print('  ShenanigansStudio Show API')
    print(f'  REAPER : {"ENABLED" if REAPER_OK else "DISABLED (pip install reapy-boost)"}')
    print(f'  X32    : {"ENABLED - " + X32_IP if X32_OK else "DISABLED (pip install python-osc)"}')
    print('  URL    : http://0.0.0.0:5000')
    print('')
    app.run(host='0.0.0.0', port=5000, debug=False)


