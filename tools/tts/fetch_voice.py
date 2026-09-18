#!/usr/bin/env python3
"""Download one voice model in parallel pieces.

    fetch_voice.py <lang> <models-dir>

The release server gives a single connection a trickle (and sometimes stalls it
outright), but it honours byte ranges — so the 1.5 GB zip is fetched as many
small pieces at once, each retried on its own, and stitched together. A piece
that has already arrived is never fetched again, so an interrupted run resumes.
"""
import concurrent.futures as futures, pathlib, sys, time, urllib.request, zipfile

lang, models = sys.argv[1], pathlib.Path(sys.argv[2])
url = f"https://github.com/AI4Bharat/Indic-TTS/releases/download/v1-checkpoints-release/{lang}.zip"
PIECE, WORKERS = 16 * 1024 * 1024, 10
DEADLINE = 75    # seconds a piece may take; a connection slower than that is dropped and redialled

def open_range(start, end):
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}", "User-Agent": "curl/8"})
    return urllib.request.urlopen(req, timeout=40)

with open_range(0, 0) as r: total = int(r.headers["Content-Range"].split("/")[1])
parts = models / f"{lang}.parts"; parts.mkdir(parents=True, exist_ok=True)
pieces = [(i, s, min(s + PIECE, total) - 1) for i, s in enumerate(range(0, total, PIECE))]

def fetch(piece):
    i, start, end = piece
    target = parts / f"{i:05d}"
    if target.exists() and target.stat().st_size == end - start + 1: return i
    for attempt in range(40):
        try:
            # Read in small bites against a clock. The server's failure is not a
            # dropped connection but a trickle, and a trickle never times out.
            began, data = time.time(), bytearray()
            with open_range(start, end) as r:
                while chunk := r.read(256 * 1024):
                    data += chunk
                    if time.time() - began > DEADLINE: raise TimeoutError
            if len(data) == end - start + 1:
                target.write_bytes(data); return i
        except Exception:
            pass
        time.sleep(min(1 + attempt, 6))
    raise RuntimeError(f"piece {i} would not download")

done = 0
with futures.ThreadPoolExecutor(WORKERS) as pool:
    for _ in futures.as_completed([pool.submit(fetch, piece) for piece in pieces]):
        _.result(); done += 1
        if done % 10 == 0 or done == len(pieces): print(f"  {lang}: {done}/{len(pieces)} pieces", flush=True)

archive = models / f"{lang}.zip"
with archive.open("wb") as out:
    for i, *_ in pieces: out.write((parts / f"{i:05d}").read_bytes())
with zipfile.ZipFile(archive) as z: z.extractall(models)
archive.unlink()
for p in parts.iterdir(): p.unlink()
parts.rmdir()
print(f"✓ {lang} voice ready", flush=True)
