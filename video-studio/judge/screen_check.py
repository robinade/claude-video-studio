#!/usr/bin/env python3
"""화면 시험: tmux 캡처 파일의 줄마다 화면 폭(한글 2칸)이 터미널 폭을 넘거나, 깨진 글자(�)가 있으면 실패.
사용법: python3 screen_check.py <캡처파일> <폭> [반드시 보여야 할 글귀...]"""
import sys, unicodedata
path, cols, *must = sys.argv[1], int(sys.argv[2]), *sys.argv[3:]
def w(s):
    n = 0
    for ch in s:
        if unicodedata.combining(ch): continue
        n += 2 if unicodedata.east_asian_width(ch) in 'WF' or 0x1F300 <= ord(ch) <= 0x1FAFF else 1
    return n
lines = open(path, encoding='utf-8', errors='replace').read().split('\n')
bad = [(i, w(l)) for i, l in enumerate(lines) if w(l.rstrip()) > cols or '�' in l]
miss = [m for m in must if not any(m in l for l in lines)]
print(f"{path}: 줄 {len(lines)} · 폭 넘침·깨짐 {len(bad)} · 빠진 글귀 {miss}")
sys.exit(1 if bad or miss else 0)
