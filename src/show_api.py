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
    print('[WARN] reapy not installed')

try:
    from pythonosc import udp_client as osc_client
    _x32 = osc_client.SimpleUDPClient(X32_IP, X32_PORT)
    X32_OK = True
except ImportError:
    X32_OK = False
    print('[WARN] python-osc not installed')

def reaper_call(fn):
    if not REAPER_OK: return None
    try:
        with reapy.inside_reaper(): return fn()
    except Exception as e: print(f'[REAPER] {e}')

def get_transport():
    if not REAPER_OK:
        return {'playing': False, 'paused': False, 'position': '0:00', 'bpm': '—'}
    try:
        with reapy.inside_reaper():
            proj    = reapy.Project()
            pos_sec = proj.play_position
            m, s    = int(pos_sec // 60), int(pos_sec % 60)
            return {'playing': proj.is_playing, 'paused': proj.is_paused,
                    'position': f'{m}:{s:02d}', 'bpm': round(proj.bpm, 1)}
    except Exception as e:
        return {'playing': False, 'paused': False, 'position': '0:00', 'bpm': '—', 'error': str(e)}

def x32_scene(n):
    if not X32_OK: return False
    try:
        _x32.send_message('/load', f'scene_{int(n):03d}')
        return True
    except Exception as e: print(f'[X32] {e}'); return False

state = {'current_song': None}

@app.route('/status')
def status():
    t = get_transport()
    return jsonify({**t, 'current_song': state['current_song'],
                    'reaper_ok': REAPER_OK, 'x32_ok': X32_OK})

@app.route('/transport/play',  methods=['POST'])
def play():  reaper_call(lambda: reapy.Project().play());  return jsonify({'ok': True})

@app.route('/transport/stop',  methods=['POST'])
def stop():  reaper_call(lambda: reapy.Project().stop());  return jsonify({'ok': True})

@app.route('/transport/pause', methods=['POST'])
def pause(): reaper_call(lambda: reapy.Project().pause()); return jsonify({'ok': True})

@app.route('/song/cue', methods=['POST'])
def song_cue():
    data  = request.get_json() or {}
    title = data.get('title', '')
    scene = data.get('x32_scene')
    state['current_song'] = data
    def jump():
        proj = reapy.Project()
        proj.stop()
        for m in proj.markers:
            if title.lower() in m.name.lower(): proj.cursor_position = m.position; break
        for r in proj.regions:
            if title.lower() in r.name.lower(): proj.cursor_position = r.start; break
    if REAPER_OK: reaper_call(jump)
    if scene: x32_scene(scene)
    return jsonify({'ok': True, 'song': title, 'x32_scene': scene})

@app.route('/x32/scene/<int:n>', methods=['POST'])
def recall_scene(n): return jsonify({'ok': x32_scene(n), 'scene': n})

if __name__ == '__main__':
    print('ShenanigansStudio Show API')
    print(f'  REAPER: {"OK" if REAPER_OK else "DISABLED"}')
    print(f'  X32:    {"OK — " + X32_IP if X32_OK else "DISABLED"}')
    print('  URL:    http://0.0.0.0:5000')
    app.run(host='0.0.0.0', port=5000, debug=False)
