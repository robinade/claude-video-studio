#!/bin/bash
# 시간 제한으로 멈춘 무인 실행을 같은 대화로 이어서 끝내요. 사용법: bash resume.sh <이름> <세션id> <프로젝트폴더>
cd "$(dirname "$0")"; MOD="$(cd ../.. && pwd)"; n=$1; sid=$2; dir=$3
cd "logs/work-$n"; start=$(date +%s)
timeout 2400 "${CLAUDE:-claude}" -p --resume "$sid" --permission-mode bypassPermissions --plugin-dir "$MOD" \
  "[영상 감독실] 시간 제한으로 멈췄던 무인 작업을 이어요. 최신 final.mp4 를 다시 잰 결과가 $dir/qa-latest/report.md 에 있어요. 남은 FAIL 만 고쳐 다시 렌더하고 mcp__video-studio__report(stage=check, status=doing, artifact=$dir/final.mp4)로 자동 검사를 받은 뒤, 통과하면 report(stage=done)로 끝내요. 묻지 말고 끝까지 진행해요." \
  < /dev/null > "../$n-resume.txt" 2>&1
echo "exit=$? seconds=$(( $(date +%s) - start ))" > "../$n-resume.time"
