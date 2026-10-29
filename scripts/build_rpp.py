from __future__ import annotations

import os
from pathlib import Path

CLICK_HARDWARE_OUTPUT = 31
CUES_HARDWARE_OUTPUT = 32


def rpp_quote(path: str | Path) -> str:
    return str(Path(path).resolve()).replace("\\", "/").replace('"', '\\"')


def mono_hardware_destination(output_number: int) -> int:
    if not 1 <= output_number <= 64:
        raise ValueError("Hardware output number must be between 1 and 64")

    # REAPER uses a zero-based destination index. Bit 1024 selects mono.
    return 1024 + (output_number - 1)


def track_block(
    name: str,
    file_path: str | Path | None,
    hardware_output: int | None = None,
) -> str:
    routing = "  MAINSEND 1 0\n"

    if hardware_output is not None:
        destination = mono_hardware_destination(hardware_output)
        routing = (
            "  MAINSEND 0 0\n"
            f"  HWOUT {destination} 0 1 0 0 0 0 -1:U -1\n"
        )

    item = ""
    if file_path:
        item = f'''  <ITEM
    POSITION 0
    <SOURCE WAVE
      FILE "{rpp_quote(file_path)}"
    >
  >
'''

    return f'''<TRACK
  NAME "{name}"
{routing}{item}>
'''


def build_rpp(
    song_name: str,
    stems_folder: str | Path,
    click_file: str | Path,
    cue_file: str | Path,
    output_folder: str | Path = "reaper-projects",
) -> str:
    output_path = Path(output_folder)
    output_path.mkdir(parents=True, exist_ok=True)
    rpp_path = output_path / f"{song_name}.RPP"

    stems_path = Path(stems_folder)
    drums = stems_path / "drums.wav"
    bass = stems_path / "bass.wav"
    vocals = stems_path / "vocals.wav"
    other = stems_path / "other.wav"

    tracks = [
        track_block("DRUMS", drums),
        track_block("BASS", bass),
        track_block("VOCALS", vocals),
        track_block("OTHER", other),
        track_block("CLICK", click_file, CLICK_HARDWARE_OUTPUT),
        track_block("CUES", cue_file, CUES_HARDWARE_OUTPUT),
        track_block("TRACKING", None),
    ]

    rpp = (
        '<REAPER_PROJECT 0.1 "7.0" 0\n'
        f'  NOTES 0 2\n    |Shenanigans Studio: {song_name}\n  >\n'
        + "".join(tracks)
        + ">\n"
    )

    rpp_path.write_text(rpp, encoding="utf-8")
    print(f"[RPP] Created REAPER project: {rpp_path}")
    print(
        "[RPP] CLICK -> mono hardware output "
        f"{CLICK_HARDWARE_OUTPUT}; CUES -> mono hardware output "
        f"{CUES_HARDWARE_OUTPUT}"
    )
    return os.fspath(rpp_path)
