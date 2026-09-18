#!/usr/bin/env python3
"""Download one voice model, patiently.

    fetch_voice.py <lang> <models-dir>

The release server caps how fast one address may download, and sometimes lets
a connection fade to nothing without closing it. So the 1.5 GB zip is fetched
in pieces, a few at a time, and every byte that arrives is kept: a piece that
stalls is redialled from where it stopped, not from its beginning, and a run
that is interrupted carries on next time. More connections do not help — they
share the same cap and only make each other time out.
"""
import concurrent.futures as futures, pathlib, sys, time, urllib.request, zipfile

lang, models = sys.argv[1], pathlib.Path(sys.argv[2])
url = f"https://github.com/AI4Bharat/Indic-TTS/releases/download/v1-checkpoints-release/{lang}.zip"
PIECE, WORKERS, STALL = 16 * 1024 * 1024, 3, 25

def open_range(start, end):
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}", "User-Agent": "curl/8"})
    return urllib.request.urlopen(req, timeout=STALL)

with open_range(0, 0) as r: total = int(r.headers["Content-Range"].split("/")[1])
parts = models / f"{lang}.parts"; parts.mkdir(parents=True, exist_ok=True)
pieces = [(i, s, min(s + PIECE, total) - 1) for i, s in enumerate(range(0, total, PIECE))]

def fetch(piece):
    i, start, end = piece
    size, done, partial = end - start + 1, parts / f"{i:05d}", parts / f"{i:05d}.part"
    if done.exists() and done.stat().st_size == size: return
    for attempt in range(200):
        have = partial.stat().st_size if partial.exists() else 0
        if have >= size: break
        try:
            with open_range(start + have, end) as r, partial.open("ab") as out:
                window, arrived = time.time(), 0
                while chunk := r.read(64 * 1024):
                    out.write(chunk); arrived += len(chunk)
                    if time.time() - window > STALL:               # under ~4 KB/s for 25 s: hang up
                        if arrived < 100 * 1024: raise TimeoutError
                        window, arrived = time.time(), 0
        except Exception:
            time.sleep(min(2 + attempt, 10))
    if partial.stat().st_size != size: raise RuntimeError(f"piece {i} would not download")
    partial.rename(done)

finished = sum(1 for i, s, e in pieces if (parts / f"{i:05d}").exists())
print(f"  {lang}: {finished}/{len(pieces)} pieces already here", flush=True)
with futures.ThreadPoolExecutor(WORKERS) as pool:
    for job in futures.as_completed([pool.submit(fetch, piece) for piece in pieces]):
        job.result(); finished += 0
        now = sum(1 for p in parts.iterdir() if p.suffix != ".part")
        if now % 5 == 0: print(f"  {lang}: {now}/{len(pieces)} pieces", flush=True)

archive = models / f"{lang}.zip"
with archive.open("wb") as out:
    for i, *_ in pieces: out.write((parts / f"{i:05d}").read_bytes())
with zipfile.ZipFile(archive) as z: z.extractall(models)
archive.unlink()
for p in parts.iterdir(): p.unlink()
parts.rmdir()
print(f"✓ {lang} voice ready", flush=True)
