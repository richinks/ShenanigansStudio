#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

from fadr_client import FadrClient, FadrError

SAMPLE_RATE = 44100
CLICK_HARDWARE_OUTPUT = 31
CUES_HARDWARE_OUTPUT = 32


def click(bpm: float, duration: float, path: Path, sr: int = SAMPLE_RATE) -> None:
    audio = np.zeros(max(1, int(duration * sr)), dtype=np.float32)
    beat_interval = 60.0 / bpm
    tone_time = np.arange(int(0.025 * sr)) / sr

    for beat_number in range(math.ceil(duration / beat_interval)):
        start = int(beat_number * beat_interval * sr)
        frequency = 1600 if beat_number % 4 == 0 else 1050
        tone = (
            0.7
            * np.sin(2 * np.pi * frequency * tone_time)
            * np.exp(-90 * tone_time)
        )
        end = min(len(audio), start + len(tone))
        audio[start:end] += tone[: end - start]

    sf.write(path, audio, sr)


def duration(path: Path) -> float:
    info = sf.info(str(path))
    return info.frames / info.samplerate


def find_file(files: list[str], token: str) -> Path | None:
    for file_name in files:
        if token in Path(file_name).stem.lower():
            return Path(file_name)
    return None


def rpp_quote(path: Path) -> str:
    return str(path.resolve()).replace("\\", "/").replace('"', '\\"')


def mono_hardware_destination(output_number: int) -> int:
    if not 1 <= output_number <= 64:
        raise ValueError("Hardware output number must be between 1 and 64")

    # REAPER uses a zero-based destination index. Bit 1024 selects mono.
    return 1024 + (output_number - 1)


def track(
    name: str,
    file_path: Path,
    length: float,
    hardware_output: int | None = None,
) -> str:
    routing = "    MAINSEND 1 0\n"

    if hardware_output is not None:
        destination = mono_hardware_destination(hardware_output)
        routing = (
            "    MAINSEND 0 0\n"
            f"    HWOUT {destination} 0 1 0 0 0 0 -1:U -1\n"
        )

    return f'''  <TRACK
    NAME "{name}"
{routing}    <ITEM
      POSITION 0
      LENGTH {length:.6f}
      <SOURCE WAVE
        FILE "{rpp_quote(file_path)}"
      >
    >
  >
'''


def scan_bpm(value: object) -> float | None:
    if isinstance(value, dict):
        for key, nested_value in value.items():
            if key.lower() in {"bpm", "tempo"} and isinstance(
                nested_value, (int, float)
            ):
                return float(nested_value)

            found = scan_bpm(nested_value)
            if found:
                return found

    if isinstance(value, list):
        for nested_value in value:
            found = scan_bpm(nested_value)
            if found:
                return found

    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--title", required=True)
    parser.add_argument("--artist", default="")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--bpm", type=float)
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    output_folder = args.out.expanduser().resolve()

    if not source.is_file():
        parser.error(f"--source does not exist: {source}")

    output_folder.mkdir(parents=True, exist_ok=True)
    original = output_folder / f"ORIGINAL{source.suffix.lower()}"
    shutil.copy2(source, original)

    try:
        result = FadrClient().process(source, output_folder / "fadr")
    except FadrError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    bpm = args.bpm or scan_bpm(result["task"])
    if not bpm or bpm <= 0:
        print("ERROR: No valid BPM returned; pass --bpm.", file=sys.stderr)
        return 3

    song_duration = duration(source)

    click_path = output_folder / "CLICK.wav"
    click(bpm, song_duration, click_path)

    cues_path = output_folder / "CUES.wav"
    sf.write(
        cues_path,
        np.zeros(int(song_duration * SAMPLE_RATE), dtype=np.float32),
        SAMPLE_RATE,
    )

    files = result["files"]
    mapping = {
        "VOCALS": find_file(files, "vocal"),
        "DRUMS": find_file(files, "drum"),
        "BASS": find_file(files, "bass"),
        "MELODIES": find_file(files, "melod"),
        "INSTRUMENTAL": find_file(files, "instrument"),
    }

    tracks: list[tuple[str, Path | None, int | None]] = [
        ("ORIGINAL", original, None),
        *[(name, file_path, None) for name, file_path in mapping.items()],
        ("CLICK", click_path, CLICK_HARDWARE_OUTPUT),
        ("CUES", cues_path, CUES_HARDWARE_OUTPUT),
    ]

    content = (
        f'<REAPER_PROJECT 0.1 "7.0" 0\n'
        f"  TEMPO {bpm:.6f} 4 4\n"
        + "".join(
            track(name, file_path, song_duration, hardware_output)
            for name, file_path, hardware_output in tracks
            if file_path is not None
        )
        + ">\n"
    )

    rpp_path = output_folder / f"{args.title}.RPP"
    rpp_path.write_text(content, encoding="utf-8")

    metadata = {
        "title": args.title,
        "artist": args.artist,
        "source": str(source),
        "bpm": bpm,
        "rpp": str(rpp_path),
        "fadr_task_id": result["task_id"],
        "files": files,
        "routing": {
            "click": {
                "track": "CLICK",
                "master_send": False,
                "hardware_output": CLICK_HARDWARE_OUTPUT,
                "mode": "mono",
            },
            "cues": {
                "track": "CUES",
                "master_send": False,
                "hardware_output": CUES_HARDWARE_OUTPUT,
                "mode": "mono",
            },
        },
    }

    (output_folder / "automation-result.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(metadata))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
