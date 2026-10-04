from __future__ import annotations
import os
import subprocess
import sys
from pathlib import Path
from flask import Flask, jsonify, request

app = Flask(__name__)

# Root directory of the PWA project
ROOT = Path(__file__).resolve().parents[1]

# Path to your FADR automation script
SCRIPT = ROOT / "scripts" / "shenanigans_studio_fadr.py"


# ───────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────

def body():
    """Return JSON body or empty dict."""
    return request.get_json(silent=True) or {}


def bad(message: str, status: int = 400):
    """Return a standardized error response."""
    return jsonify(success=False, error=message), status


@app.errorhandler(Exception)
def unexpected(e):
    """Catch-all error handler."""
    app.logger.exception("Unhandled error")
    return bad(str(e), 500)


# ───────────────────────────────────────────────
# Health Check
# ───────────────────────────────────────────────

@app.post("/health")
def health():
    return jsonify(success=True, status="ok")


# ───────────────────────────────────────────────
# Song Processing Endpoint
# ───────────────────────────────────────────────

@app.post("/process-song")
def process_song():
    d = body()

    # Required fields
    missing = [k for k in ("source", "title", "out") if not d.get(k)]
    if missing:
        return bad("Missing required fields: " + ", ".join(missing))

    # Validate source file
    source = Path(d["source"]).expanduser()
    if not source.is_file():
        return bad(f"Source file not found: {source}")

    # Build command
    cmd = [
        sys.executable,
        str(SCRIPT),
        "--source", str(source),
        "--title", str(d["title"]),
        "--out", str(d["out"])
    ]

    # Optional flags
    for key, flag in (("artist", "--artist"), ("bpm", "--bpm"), ("scene", "--scene")):
        if d.get(key) is not None:
            cmd.extend([flag, str(d[key])])

    # Run FADR automation script
    timeout_seconds = int(os.getenv("PROCESS_TIMEOUT_SECONDS", "1800"))

    try:
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds
        )
    except subprocess.TimeoutExpired:
        return bad("Song processing timed out", 504)

    # Non-zero exit code
    if r.returncode:
        return (
            jsonify(
                success=False,
                error="Song processing failed",
                exit_code=r.returncode,
                stdout=r.stdout,
                stderr=r.stderr
            ),
            500
        )

    # Success
    return jsonify(success=True, stdout=r.stdout)


# ───────────────────────────────────────────────
# Server Startup
# ───────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001)
