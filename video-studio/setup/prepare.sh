#!/bin/bash
# 영상 감독실: 영상 도구 스킬들이 실제로 돌아가는 데 필요한 준비물을 깔아요.
# 스킬 자체는 플러그인 의존성으로 이미 설치돼 있어요. 여기서는 그 바깥의 것(파이썬 환경, 모델, npm 패키지)을 챙겨요.
# 여러 번 돌려도 안전해요: 이미 된 건 건너뛰어요. 영상 감독실이 세션을 시작할 때 뒤에서 한 번 돌려요.
#
# 출력: 사람이 읽는 기록은 $VS_TOOLS/prepare.log, 영상 감독실이 읽는 줄은 표준 출력에 "@ <단계> <doing|done|skip|fail> <메모>".
# 환경 변수: VS_TOOLS(설치 폴더, 기본 ~/video-studio/tools), EARSHOT_ROOT, EXPLAINROO_ROOT, REANIMATE_ROOT(각 도구 플러그인 폴더).
set -u
TOOLS="${VS_TOOLS:-$HOME/video-studio/tools}"
LOG="$TOOLS/prepare.log"
mkdir -p "$TOOLS" "$HOME/video-studio/projects" "$HOME/.local/bin"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# 창이 여러 개면 한 곳에서만 돌아요. 3시간 넘은 잠금은 끊긴 것으로 보고 치워요.
LOCK="$TOOLS/.prepare.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +180 2>/dev/null)" ]; then rm -rf "$LOCK"; mkdir "$LOCK"
  else echo "@ all busy 다른 창에서 준비 중이에요"; exit 0; fi
fi
trap 'rm -rf "$LOCK"' EXIT
echo "==== $(date '+%Y-%m-%d %H:%M:%S') 준비 시작" >>"$LOG"

say() { echo "@ $1 $2 $3"; echo "[$1] $2 $3" >>"$LOG"; }
STATE=""
mark() { STATE="$STATE\"$1\":\"$2\","; }
run() { "$@" >>"$LOG" 2>&1; }

# 3.10 이상인 파이썬(earshot 이 3.10+). 3.12 를 먼저 찾아요.
find_python() {
  for c in python3.12 python3.11 python3.13 python3.10 python3; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info[:2] >= (3, 10) else 1)' 2>/dev/null; then
      command -v "$c"; return 0
    fi
  done
  return 1
}
node_at_least() { command -v node >/dev/null 2>&1 && node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>$1||(a===$1&&b>=$2)?0:1)"; }

# 1. ffmpeg·ffprobe: 모든 검사와 여러 도구가 써요.
step_ffmpeg() {
  if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then say ffmpeg skip "이미 있어요"; mark ffmpeg ok; return; fi
  if command -v brew >/dev/null 2>&1; then
    say ffmpeg doing "ffmpeg 설치 (brew)"
    if run brew install ffmpeg; then say ffmpeg done "설치했어요"; mark ffmpeg ok; return; fi
  fi
  say ffmpeg fail "ffmpeg 를 직접 설치해 주세요 (macOS: brew install ffmpeg)"; mark ffmpeg fail
}

# 2. 자동 검사(video-director 의 qa_video·check_timeline)가 쓰는 numpy·Pillow
step_py() {
  local V="$TOOLS/py"
  if [ -x "$V/bin/python" ] && "$V/bin/python" -c 'import numpy, PIL' 2>/dev/null; then say py skip "이미 있어요"; mark py ok; return; fi
  local P; P=$(find_python) || { say py fail "파이썬 3.10 이상이 필요해요"; mark py fail; return; }
  say py doing "검사용 파이썬 패키지(numpy·Pillow) 설치"
  rm -rf "$V"
  if run "$P" -m venv "$V" && run "$V/bin/python" -m pip install -q --upgrade pip && run "$V/bin/python" -m pip install -q numpy Pillow; then
    say py done "준비됐어요"; mark py ok
  else say py fail "설치 실패 (기록: $LOG)"; mark py fail; fi
}

# 3. earshot 명령과 소리 모델(약 1.1GB): 소리 검사·효과음
step_earshot() {
  if command -v earshot >/dev/null 2>&1; then say earshot skip "이미 있어요"; mark earshot ok; return; fi
  if [ -z "${EARSHOT_ROOT:-}" ] || [ ! -f "$EARSHOT_ROOT/pyproject.toml" ]; then say earshot fail "earshot 플러그인을 찾지 못했어요"; mark earshot fail; return; fi
  local P; P=$(find_python) || { say earshot fail "파이썬 3.10 이상이 필요해요"; mark earshot fail; return; }
  local E="$TOOLS/earshot"
  say earshot doing "소리 검사 도구 earshot 설치 (모델 포함 약 1.5GB, 몇 분 걸려요)"
  rm -rf "$E"
  # 플러그인 폴더는 업데이트 때 바뀌어서, 고정된 곳에 복사해 그 자리에 설치해요(모델도 이 안에 받아요).
  if run cp -R "$EARSHOT_ROOT" "$E" && run "$P" -m venv "$E/.venv" \
    && run "$E/.venv/bin/python" -m pip install -q --upgrade pip \
    && run "$E/.venv/bin/python" -m pip install -q torch --index-url https://download.pytorch.org/whl/cpu \
    && run "$E/.venv/bin/python" -m pip install -q -e "$E[mcp]"; then
    ln -sf "$E/.venv/bin/earshot" "$HOME/.local/bin/earshot"
    say earshot doing "소리 모델 받는 중 (약 1.1GB)"
    if run "$E/.venv/bin/earshot" doctor --fetch; then say earshot done "준비됐어요"; mark earshot ok
    else say earshot done "명령은 준비됐어요. 모델은 처음 쓸 때 받아요"; mark earshot ok; fi
  else say earshot fail "설치 실패 (기록: $LOG)"; mark earshot fail; fi
}

# 4. explainroo: 스킬이 ~/.explainroo 의 명령을 찾아요. npm 패키지와 목소리 모델까지.
step_explainroo() {
  local E="${EXPLAINROO_HOME:-$HOME/.explainroo}"
  if [ -f "$E/bin/explainroo.js" ] && [ -d "$E/node_modules" ]; then say explainroo skip "이미 있어요"; mark explainroo ok; return; fi
  if ! node_at_least 20 11; then say explainroo fail "Node.js 20.11 이상이 필요해요"; mark explainroo fail; return; fi
  if [ ! -f "$E/bin/explainroo.js" ]; then
    if [ -z "${EXPLAINROO_ROOT:-}" ] || [ ! -f "$EXPLAINROO_ROOT/bin/explainroo.js" ]; then say explainroo fail "explainroo 플러그인을 찾지 못했어요"; mark explainroo fail; return; fi
    if [ -e "$E" ]; then say explainroo fail "$E 가 이미 있는데 explainroo 가 아니에요"; mark explainroo fail; return; fi
    run cp -R "$EXPLAINROO_ROOT" "$E" || { say explainroo fail "복사 실패"; mark explainroo fail; return; }
  fi
  say explainroo doing "설명 영상 도구 explainroo 설치 (npm 패키지·목소리 모델, 몇 분 걸려요)"
  # 받는 도중 연결이 끊기는 일이 잦아서(ECONNRESET) 한 번 더 시도해요.
  local ok_npm=false
  for _ in 1 2; do
    if (cd "$E" && run npm install --no-audit --no-fund); then ok_npm=true; break; fi
    sleep 5
  done
  if $ok_npm && (cd "$E" && run node bin/explainroo.js doctor --fetch); then
    say explainroo done "준비됐어요"; mark explainroo ok
  else say explainroo fail "설치 실패 (기록: $LOG)"; mark explainroo fail; fi
}

# 5. reanimate: 스크립트를 bun 으로 돌려요. bun 이 없으면 brew 로 깔고, 의존성·Chromium 을 받아요.
step_reanimate() {
  local S="${REANIMATE_ROOT:-}/skills/reanimate/scripts"
  if [ -z "${REANIMATE_ROOT:-}" ] || [ ! -f "$S/setup.sh" ]; then say reanimate fail "reanimate 플러그인을 찾지 못했어요"; mark reanimate fail; return; fi
  if [ -d "$S/node_modules/playwright" ] && [ -x "$S/node_modules/ffmpeg-static/ffmpeg" ]; then say reanimate skip "이미 있어요"; mark reanimate ok; return; fi
  if ! command -v bun >/dev/null 2>&1; then
    if command -v brew >/dev/null 2>&1; then say reanimate doing "bun 설치 (brew)"; run brew install oven-sh/bun/bun; fi
  fi
  if ! command -v bun >/dev/null 2>&1; then say reanimate fail "bun 이 필요해요 (https://bun.sh)"; mark reanimate fail; return; fi
  say reanimate doing "애니메이션 복제 도구 reanimate 준비 (Chromium·ffmpeg 약 250MB)"
  # 오래된 bun 은 이 저장소의 잠금 파일을 못 읽어요. 그때는 최신 bun 으로 한 번만 설치해요.
  if [ ! -d "$S/node_modules/playwright" ]; then
    (cd "$S" && run bun install --silent) || (cd "$S" && run npx -y bun@latest install --silent)
  fi
  if run bash "$S/setup.sh"; then say reanimate done "준비됐어요"; mark reanimate ok
  else say reanimate fail "준비 실패 (기록: $LOG)"; mark reanimate fail; fi
}

step_ffmpeg
step_py
step_earshot
step_explainroo
step_reanimate

OK=true
case "$STATE" in *'"fail"'*) OK=false ;; esac
printf '{"version":1,"at":"%s","ok":%s,"steps":{%s}}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$OK" "${STATE%,}" >"$TOOLS/prepared.json"
echo "@ all done $OK"
