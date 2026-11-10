#!/bin/bash
# 채점용 재측정: mod·Claude 가 낸 숫자 대신, 완성본을 처음부터 다시 재요(qa-judge/ 에 저장).
# 사용법: bash recheck.sh <프로젝트 폴더>...   그다음 python3 verify.py --judge <폴더>...
Q=~/video-studio/vendor/video-director/video-director/scripts/qa_video.py
export PATH=~/.local/bin:/opt/homebrew/bin:$PATH
for d in "$@"; do
  o="$d/qa-judge"; rm -rf "$o"; mkdir -p "$o"
  extra=(); [ -f "$d/timeline.json" ] && extra+=(--beats "$d/timeline.json"); [[ "$d" == *rossark* ]] && extra+=(--loop)
  python3 "$Q" "$d/final.mp4" --out "$o" "${extra[@]}" > "$o/qa.log" 2>&1
  if [ -n "$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$d/final.mp4")" ]; then
    earshot critique "$d/final.mp4" --json --out "$o/earshot.json" > "$o/earshot.log" 2>&1
  fi
  echo "재측정 끝: $(basename $d)"
done
