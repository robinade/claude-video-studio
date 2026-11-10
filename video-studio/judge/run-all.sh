#!/bin/bash
# 판정 한 번에: 자동 테스트 + 라우팅(연습·채점) . 완성 시험은 오래 걸려서 따로: bash judge/completion/run.sh
cd "$(dirname "$0")/.."
set -e
"${CLAUDE:-claude}" plugin validate . | tail -1
"${CLAUDE:-claude}" plugin test . | tail -3
node --experimental-strip-types judge/routing/score.ts judge/routing/dev.jsonl 2>/dev/null | head -1
node --experimental-strip-types judge/routing/score.ts judge/routing/heldout.jsonl --quiet 2>/dev/null | head -1
