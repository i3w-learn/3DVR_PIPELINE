#!/usr/bin/env python3
"""Listen to every clip with a speech recogniser, and say which to check first.

    check_clips.py <lang>

Nobody on the build team can hear whether a thousand Marathi clips are right.
A recogniser can at least tell whether a clip says roughly what its text says:
each clip is transcribed (Whisper on Apple's MLX, offline, free, under a second a clip) and compared with the line it
was made from. A low score means the voice dropped or mangled something — or
just that the recogniser spells differently — so the output is a reading list
for a native speaker, worst first, not a verdict.

Odia is not a language Whisper knows. For Odia the only check is length: a
clip much shorter than its text was probably cut short.
"""
import json, pathlib, re, subprocess, sys, difflib

lang = sys.argv[1]
root = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((root / 'raw' / 'audio' / f'{lang}.json').read_text())
clips = root / 'app' / 'assets' / 'audio' / lang

def bare(text): return re.sub(r'[\W_]+', '', text.lower(), flags=re.UNICODE)
def seconds(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True)
    return float(out.stdout or 0)

rows = []
if lang == 'or':
    for name, entry in sorted(manifest.items()):
        d = seconds(clips / name) - 0.45              # the padding at each end
        per_char = d / max(1, len(bare(entry['spoken'])))
        rows.append((per_char, name, entry['spoken'], f'{d:.1f}s'))
    typical = sorted(r[0] for r in rows)[len(rows) // 2]
    rows = [(r[0] / typical, *r[1:]) for r in rows]   # 1.0 = a normal pace; far below = words missing
else:
    import mlx_whisper      # plain Whisper on the CPU took twenty seconds a clip; this takes one
    for n, (name, entry) in enumerate(sorted(manifest.items()), 1):
        heard = mlx_whisper.transcribe(str(clips / name), path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language=lang)['text'].strip()
        score = difflib.SequenceMatcher(None, bare(entry['spoken']), bare(heard)).ratio()
        rows.append((score, name, entry['spoken'], heard))
        if n % 100 == 0: print(f'  … {n} / {len(manifest)}', flush=True)

rows.sort()
report = root / 'raw' / 'audio' / f'review-{lang}.tsv'
report.write_text('score\tclip\ttext spoken\theard\n' + ''.join(f'{s:.2f}\t{n}\t{t}\t{h}\n' for s, n, t, h in rows))
low = [r for r in rows if r[0] < 0.6]
print(f'{len(rows)} clips checked in {lang}. {len(low)} score under 0.60 — listen to those first: {report.relative_to(root)}')
for s, n, t, h in rows[:12]: print(f'  {s:.2f}  {n}\n        said : {t}\n        heard: {h}')
