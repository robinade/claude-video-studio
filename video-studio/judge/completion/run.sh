#!/bin/bash
# 완성 시험: 대표 요청 4개를 사람 손 없이(/video --auto) 돌려요. 사용법: bash run.sh [이름...]
# 결과: ~/video-studio/projects/<날짜-시각-도구>/ , 실행 기록: logs/<이름>.txt, 걸린 시간: logs/<이름>.time
cd "$(dirname "$0")"; mkdir -p logs
MOD="$(cd ../.. && pwd)"
names=("$@"); [ ${#names[@]} -eq 0 ] && names=(reel demo explainer mascot)
for n in "${names[@]}"; do
  req=$(awk -F'\t' -v n="$n" '$1==n{print $2}' requests.tsv)
  ( start=$(date +%s)
    mkdir -p "logs/work-$n" && cd "logs/work-$n"
    timeout 5400 "${CLAUDE:-claude}" -p --permission-mode bypassPermissions --plugin-dir "$MOD" "/video --auto $req" < /dev/null > "../$n.txt" 2>&1
    echo "exit=$? seconds=$(( $(date +%s) - start ))" > "../$n.time" ) &
  sleep 5
done
wait
