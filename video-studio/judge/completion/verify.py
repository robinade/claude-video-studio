#!/usr/bin/env python3
"""완성 시험 채점: 프로젝트 폴더마다 final.mp4·qa_video 실패 수·earshot 판정을 읽어 기준과 비교해요.
사용법: python3 verify.py <프로젝트 폴더>...   기준: MP4 있음, qa 실패 0, earshot close 이상(소리 없는 루프는 해당 없음)."""
import json, subprocess, sys
from pathlib import Path
RANK = {'launch-grade': 3, 'close': 2, 'needs work': 1, 'not launch-grade': 0}
args = sys.argv[1:]
sub = 'qa'
if args and args[0] == '--judge':
    sub, args = 'qa-judge', args[1:]
ok_all = True
for d in map(Path, args):
    mp4 = d / 'final.mp4'
    row = {'project': d.name, 'mp4': mp4.exists()}
    if mp4.exists():
        p = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', str(mp4)], capture_output=True, text=True).stdout)
        v = next(s for s in p['streams'] if s['codec_type'] == 'video')
        row.update(size=f"{v['width']}x{v['height']}", seconds=round(float(p['format']['duration']), 1), audio=any(s['codec_type'] == 'audio' for s in p['streams']))
    rep = d / sub / 'report.json'
    if rep.exists():
        checks = json.loads(rep.read_text())['checks']
        row['qa'] = {lv: sum(c['level'] == lv for c in checks) for lv in ('PASS', 'WARN', 'FAIL')}
        row['qa_fail'] = [c['check'] for c in checks if c['level'] == 'FAIL']
    ear = d / sub / 'earshot.json'
    if ear.exists():
        e = json.loads(ear.read_text()); row['earshot'] = f"{e['verdict']} {e['score']:.3f}"
    need_ear = row.get('audio', False)
    passed = row['mp4'] and 'qa' in row and row['qa']['FAIL'] == 0 and (not need_ear or RANK.get(row.get('earshot', '?').rsplit(' ', 1)[0], -1) >= 2)
    row['PASS'] = passed; ok_all &= passed
    print(json.dumps(row, ensure_ascii=False))
sys.exit(0 if ok_all else 1)
