#!/usr/bin/env python3
"""fadr_sync.py - reads Fadr analysis JSON files and syncs BPM/key to Supabase.

Usage:
    python src/fadr_sync.py                   sync all JSONs in fadr_output/
    python src/fadr_sync.py --dry-run         preview without writing
    python src/fadr_sync.py --overwrite       overwrite existing BPM/key values
    python src/fadr_sync.py --dir "C:/path"   custom Fadr output folder
"""
import os, sys, re, json, argparse
from pathlib import Path
from difflib import SequenceMatcher

def load_env():
    env = {}
    for f in ['.env', 'pwa/.env', 'pwa/.env.local']:
        if os.path.exists(f):
            for line in open(f):
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, _, v = line.partition('=')
                    env[k.strip()] = v.strip().strip('"').strip("'")
    return env

env = load_env()
SUPA_URL = env.get('PUBLIC_SUPABASE_URL') or env.get('SUPABASE_URL') or os.getenv('SUPABASE_URL', '')
SUPA_KEY = env.get('PUBLIC_SUPABASE_ANON_KEY') or env.get('SUPABASE_KEY') or os.getenv('SUPABASE_KEY', '')

if not SUPA_URL or not SUPA_KEY:
    print('ERROR: Supabase credentials not found in pwa/.env')
    print('  Need: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY')
    sys.exit(1)

try:
    from supabase import create_client
    db = create_client(SUPA_URL, SUPA_KEY)
except ImportError:
    print('ERROR: supabase-py not installed. Run: pip install supabase')
    sys.exit(1)

parser = argparse.ArgumentParser()
parser.add_argument('--dry-run',   action='store_true')
parser.add_argument('--overwrite', action='store_true')
parser.add_argument('--dir',       default='fadr_output')
args = parser.parse_args()

FADR_DIR = Path(args.dir)
if not FADR_DIR.exists():
    print('ERROR: Fadr output folder not found: ' + str(FADR_DIR))
    sys.exit(1)

print('Loading songs from Supabase...')
songs = db.table('songs').select('id,title,recording_bpm,drummer_click_bpm,key').execute().data or []
print('  ' + str(len(songs)) + ' songs loaded\n')

def slug(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

def sim(a, b):
    return SequenceMatcher(None, slug(a), slug(b)).ratio()

def best_match(title, thresh=0.72):
    best, score = None, 0
    for s in songs:
        r = sim(title, s['title'])
        if r > score:
            best, score = s, r
    return (best, score) if score >= thresh else (None, score)

KEY_MAP = {
    'Am': 'A minor', 'Bm': 'B minor', 'Cm': 'C minor', 'Dm': 'D minor',
    'Em': 'E minor', 'Fm': 'F minor', 'Gm': 'G minor', 'F#m': 'F# minor',
    'Bbm': 'Bb minor', 'Ebm': 'Eb minor', 'Abm': 'Ab minor', 'Dbm': 'Db minor',
    'A': 'A major', 'B': 'B major', 'C': 'C major', 'D': 'D major',
    'E': 'E major', 'F': 'F major', 'G': 'G major', 'F#': 'F# major',
    'Bb': 'Bb major', 'Eb': 'Eb major', 'Ab': 'Ab major', 'Db': 'Db major',
    'C#': 'C# major',
}

def norm_key(k):
    if not k:
        return None
    k = str(k).strip()
    return KEY_MAP.get(k, k)

def norm_bpm(b):
    try:
        return int(round(float(b)))
    except Exception:
        return None

json_files = list(FADR_DIR.rglob('*.json'))
print('Found ' + str(len(json_files)) + ' JSON file(s) in ' + str(FADR_DIR) + '\n')

updated = skipped = unmatched = 0

for jf in json_files:
    try:
        data = json.loads(jf.read_text(encoding='utf-8'))
    except Exception as e:
        print('  WARN ' + jf.name + ': parse error - ' + str(e))
        continue

    title = (data.get('title') or data.get('song') or
             data.get('name') or jf.stem.replace('_', ' ').replace('-', ' '))
    bpm = norm_bpm(data.get('bpm') or data.get('tempo') or data.get('bpm_mean'))
    key = norm_key(data.get('key') or data.get('key_signature') or data.get('musical_key'))

    if not bpm and not key:
        print('  SKIP ' + jf.name + ': no BPM or key data')
        skipped += 1
        continue

    match, score = best_match(title)
    if not match:
        print('  NO MATCH for "' + title + '" (best: ' + str(round(score, 2)) + ')')
        unmatched += 1
        continue

    update = {}
    if bpm and (not match['recording_bpm'] or args.overwrite):
        update['recording_bpm'] = bpm
    if bpm and (not match['drummer_click_bpm'] or args.overwrite):
        update['drummer_click_bpm'] = bpm
    if key and (not match['key'] or args.overwrite):
        update['key'] = key

    tag = str(update) if update else '(already populated - use --overwrite)'
    print('  OK "' + title + '" -> "' + match['title'] + '" (' + str(round(score, 2)) + ')  ' + tag)

    if update and not args.dry_run:
        db.table('songs').update(update).eq('id', match['id']).execute()
    if update:
        updated += 1

prefix = '[DRY RUN] ' if args.dry_run else ''
print('\n' + prefix + 'Summary:')
print('  ' + str(updated) + ' songs ' + ('would be ' if args.dry_run else '') + 'updated')
print('  ' + str(skipped) + ' skipped (no data)')
print('  ' + str(unmatched) + ' unmatched')
if args.dry_run:
    print('\n  Run without --dry-run to apply changes')

