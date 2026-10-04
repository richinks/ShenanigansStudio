-- =============================================================================
-- Shenanigans Studio — Supabase Migration 001
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Or via CLI: supabase db push
-- =============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- =============================================================================
-- TABLE: songs
-- Master setlist of 62 songs with tempo, artist, and processing status.
-- Populated from fadr_extract.py TARGET_SONGS.
-- =============================================================================

create table if not exists public.songs (
  id           uuid primary key default uuid_generate_v4(),
  title        text        not null,
  artist       text        not null,
  bpm          integer,
  priority     text        not null default 'active'
                           check (priority in ('active','wip','retired')),
  fadr_asset_id text       unique,           -- set once FADR processes this song
  key          text,                         -- musical key returned by FADR
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.songs is
  'Master setlist. Priority: active = performing now, wip = in progress, retired = dropped.';

-- ─── Seed: Priority 1 — Active (39 songs) ────────────────────────────────────
insert into public.songs (title, artist, bpm, priority) values
  ('Everlong',                          'Foo Fighters',              158, 'active'),
  ('Fly Like an Eagle',                 'Steve Miller Band',         100, 'active'),
  ('Georgy Porgy',                      'Toto',                       97, 'active'),
  ('Get Down On It',                    'Kool and the Gang',         111, 'active'),
  ('Heartbreaker',                      'Pat Benatar',               156, 'active'),
  ('Hells Bells',                       'AC/DC',                     107, 'active'),
  ('Here Comes My Girl',                'Tom Petty',                 105, 'active'),
  ('Hold On Loosely',                   '38 Special',                127, 'active'),
  ('Hold the Line',                     'Toto',                       96, 'active'),
  ('Home at Last',                      'Steely Dan',                 64, 'active'),
  ('I Think About You All the Time',    'Deftones',                  136, 'active'),
  ('Immigrant Song',                    'Led Zeppelin',              113, 'active'),
  ('Jessies Girl',                      'Rick Springfield',          132, 'active'),
  ('Jesus Just Left Chicago',           'ZZ Top',                     72, 'active'),
  ('Jumpin Jack Flash',                 'Rolling Stones',            137, 'active'),
  ('Just What I Needed',                'The Cars',                  127, 'active'),
  ('Keep On Rockin in the Free World',  'Neil Young',                132, 'active'),
  ('Kiss Me',                           'Sixpence None the Richer',   96, 'active'),
  ('Linger',                            'The Cranberries',            96, 'active'),
  ('Long Train Runnin',                 'Doobie Brothers',           117, 'active'),
  ('Magic Man',                         'Heart',                     103, 'active'),
  ('Mary Janes Last Dance',             'Tom Petty',                  85, 'active'),
  ('Mr Brightside',                     'The Killers',               148, 'active'),
  ('Ohio',                              'Neil Young',                 78, 'active'),
  ('Peg',                               'Steely Dan',                117, 'active'),
  ('Plush',                             'Stone Temple Pilots',        72, 'active'),
  ('Pretzel Logic',                     'Steely Dan',                 96, 'active'),
  ('Promises in the Dark',              'Pat Benatar',               158, 'active'),
  ('Ramble On',                         'Led Zeppelin',               99, 'active'),
  ('Ready for Love',                    'Bad Company',               129, 'active'),
  ('Rebel Yell',                        'Billy Idol',                166, 'active'),
  ('Rhiannon',                          'Fleetwood Mac',             129, 'active'),
  ('Summer of 69',                      'Bryan Adams',               140, 'active'),
  ('Sweet Emotion',                     'Aerosmith',                  99, 'active'),
  ('Sweet Home Alabama',                'Lynyrd Skynyrd',             98, 'active'),
  ('Twist and Shout',                   'The Beatles',               125, 'active'),
  ('Wont Back Down',                    'Tom Petty',                 114, 'active'),
  ('Yellow Ledbetter',                  'Pearl Jam',                  71, 'active'),
  ('Zombie',                            'The Cranberries',            84, 'active')
on conflict do nothing;

-- ─── Seed: Priority 2 — WIP (23 songs) ───────────────────────────────────────
insert into public.songs (title, artist, bpm, priority) values
  ('Brain Damage / Eclipse',            'Pink Floyd',                 67, 'wip'),
  ('Eminence Front',                    'The Who',                    98, 'wip'),
  ('Everybody Wants to Rule the World', 'Tears for Fears',           112, 'wip'),
  ('Green Onions',                      'Booker T',                  136, 'wip'),
  ('House of the Rising Sun',           'The Animals',               117, 'wip'),
  ('I Feel Fine',                       'The Beatles',                90, 'wip'),
  ('Im Your Captain',                   'Grand Funk Railroad',        99, 'wip'),
  ('Island in the Sun',                 'Weezer',                    115, 'wip'),
  ('Jailbreak',                         'Thin Lizzy',                145, 'wip'),
  ('Just Got Paid',                     'ZZ Top',                    100, 'wip'),
  ('Kashmir',                           'Led Zeppelin',               81, 'wip'),
  ('Listen to Her Heart',               'Tom Petty',                 125, 'wip'),
  ('Movin On',                          'Bad Company',               117, 'wip'),
  ('Rock and Roll Fantasy',             'Bad Company',               110, 'wip'),
  ('Santa Monica',                      'Everclear',                 100, 'wip'),
  ('Say It Aint So',                    'Weezer',                     76, 'wip'),
  ('Smells Like Teen Spirit',           'Nirvana',                   117, 'wip'),
  ('So Lonely',                         'The Police',                156, 'wip'),
  ('Stairway to Heaven',                'Led Zeppelin',               82, 'wip'),
  ('The Boys Are Back in Town',         'Thin Lizzy',                 80, 'wip'),
  ('Time',                              'Pink Floyd',                120, 'wip'),
  ('Wish You Were Here',                'Pink Floyd',                122, 'wip'),
  ('You Shook Me All Night Long',       'AC/DC',                     127, 'wip')
on conflict do nothing;

-- =============================================================================
-- TABLE: stems
-- Tracks every FADR stem job. Written by fadr-worker, read by SvelteKit PWA.
-- Upserted on fadr_task_id (one row per FADR task).
-- =============================================================================

create table if not exists public.stems (
  id              uuid        primary key default uuid_generate_v4(),

  -- FADR identifiers
  fadr_task_id    text        not null unique,   -- FADR /tasks/:id
  fadr_asset_id   text,                          -- FADR /assets/:id (source)

  -- Song linkage (nullable — can be filled retroactively)
  song_id         uuid        references public.songs(id) on delete set null,
  song_name       text,                          -- denormalised for quick display

  -- Job config
  stem_type       text        not null default 'main'
                              check (stem_type in ('main','drum-stem')),

  -- Lifecycle
  status          text        not null default 'pending'
                              check (status in
                                ('pending','processing','complete','error','timeout','cancelled')),
  error_message   text,

  -- Output — JSON array of { stemId, stemType, downloadUrl, midiDownloadUrl }
  stems_json      jsonb,

  -- Timestamps
  submitted_at    timestamptz,
  completed_at    timestamptz,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

comment on table public.stems is
  'One row per FADR stem task. Upserted by fadr-worker on fadr_task_id.';
comment on column public.stems.stems_json is
  'Array of { stemId, stemType, assetData, downloadUrl, midiDownloadUrl } from FADR output.';

-- =============================================================================
-- TABLE: sessions
-- Live performance sessions — links songs to a show date/venue.
-- =============================================================================

create table if not exists public.sessions (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null,           -- e.g. "Shenanigans Oct 4 2026"
  venue       text,
  show_date   date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Junction: which songs are in a session, and in what order
create table if not exists public.session_songs (
  id          uuid    primary key default uuid_generate_v4(),
  session_id  uuid    not null references public.sessions(id) on delete cascade,
  song_id     uuid    not null references public.songs(id)    on delete cascade,
  position    integer not null default 0,    -- set list order
  notes       text,
  unique (session_id, song_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists idx_stems_fadr_task_id   on public.stems (fadr_task_id);
create index if not exists idx_stems_status         on public.stems (status);
create index if not exists idx_stems_song_id        on public.stems (song_id);
create index if not exists idx_stems_fadr_asset_id  on public.stems (fadr_asset_id);
create index if not exists idx_songs_priority       on public.songs (priority);
create index if not exists idx_songs_artist         on public.songs (artist);
create index if not exists idx_session_songs_pos    on public.session_songs (session_id, position);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- Automatically keeps updated_at current on every row update.
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_songs_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

create or replace trigger trg_stems_updated_at
  before update on public.stems
  for each row execute function public.set_updated_at();

create or replace trigger trg_sessions_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.songs         enable row level security;
alter table public.stems         enable row level security;
alter table public.sessions      enable row level security;
alter table public.session_songs enable row level security;

-- songs — public read (the setlist is not sensitive)
create policy "songs: public read"
  on public.songs for select
  using (true);

-- songs — service role only for write
create policy "songs: service role write"
  on public.songs for all
  using     (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- stems — authenticated users can read their own project's stems
create policy "stems: authenticated read"
  on public.stems for select
  to authenticated
  using (true);

-- stems — service role only for write (fadr-worker uses service key)
create policy "stems: service role write"
  on public.stems for all
  using     (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- sessions — authenticated read/write (studio-local use)
create policy "sessions: authenticated all"
  on public.sessions for all
  to authenticated
  using (true)
  with check (true);

create policy "session_songs: authenticated all"
  on public.session_songs for all
  to authenticated
  using (true)
  with check (true);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Handy view: each song with its latest stem job status
create or replace view public.songs_with_stems as
select
  s.id,
  s.title,
  s.artist,
  s.bpm,
  s.priority,
  s.fadr_asset_id,
  s.key,
  st.fadr_task_id,
  st.status        as stem_status,
  st.stem_type,
  st.stems_json,
  st.completed_at  as stems_completed_at
from public.songs s
left join public.stems st
  on st.song_id = s.id
  and st.created_at = (
    select max(s2.created_at)
    from public.stems s2
    where s2.song_id = s.id
  );

comment on view public.songs_with_stems is
  'Each song joined to its most recent stem job. Used by the Stems workspace page.';

-- =============================================================================
-- Done.
-- Table count: songs (62 rows seeded), stems, sessions, session_songs
-- Views: songs_with_stems
-- =============================================================================
