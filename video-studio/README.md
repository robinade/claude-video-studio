# 영상 감독실 (video-studio) — 한국어판 Claude Code mod

**"어떤 영상이 필요해요?" 한 줄이면 맞는 영상 도구를 골라 계획 → 제작 → 소리 → 검사 → 완성까지 진행 보드로 보여 줘요.**
돈 드는 단계는 금액을 보여 주고 [허락]을 눌러야만 진행해요. 다 만든 영상은 mod가 직접 `qa_video`(화면 검사)와 `earshot critique`(소리 검사)로 재요.

> 이 mod는 영상 도구를 새로 만들지 않아요. 이미 설치된 영상 스킬 10종(huashu-motion, take-one, Argo, explainroo, rossark-motion-skill, reanimate, earshot, real-sound, watch, video-director)과 Kling을 **고르고, 순서대로 시키고, 검사하는** 감독 역할이에요. 마켓플레이스로 설치하면 이 도구들(Kling 제외)이 함께 설치되고, 첫 실행 때 준비물도 뒤에서 깔려요. [저장소 첫 화면의 README](../README.md#함께-설치되는-것)를 보세요.

## 한눈에 보기

| 화면 | 하는 일 |
|---|---|
| **옆 패널 「영상 감독실」** | 첫 화면은 질문 하나: "어떤 영상이 필요해요?" + 최근 프로젝트 3개 |
| **추천 카드** | 고른 도구, 이유 한 줄, 예상 시간, 비용(무료/유료 항목별), 크기(9:16 등), 한국어 목소리·글꼴 주의, 목소리 고르기 |
| **진행 보드** | 계획 ○ → 제작 ◐ → 소리 ● → 검사 → 완성 5단계, 단계별 메모·파일, 검사 배지(`qa ✓12 ⚠3 ✗0 · 소리 거의 됨 0.91`), 휴대폰 크기 접촉 시트 그림 |
| **비용 문** | Kling·ElevenLabs·OpenAI TTS·이미지 모델 호출은 허락 전엔 막혀요. 패널의 `1 허락` / `2 거절` |
| **입력창 위 띠** | `9: 🎬 영상 감독실 · 제작 중 · 5단계 중 2단계 끝 · 렌더 중 42초 · 다음: …` (멈추면 `⏸ 멈춤`) |
| **토스트** | 시작하면 "영상 감독실이 시작했어요 · 9 보드 보기". 영상 이야기였는데 시작하지 않고 턴이 끝나면 "진행 보드로 할까요? 9 또는 /video" |

## 쓰는 법

1. `/video 우리 앱 홍보 릴스 20초 9:16` (또는 띠에서 `9`, 또는 `/video` 만 쳐서 패널의 입력창에)
2. 추천 카드에서 **`1 시작`** (도구를 바꾸려면 `2 다른 도구`, 목소리는 `3`~`5`)
3. 끝. 보드와 띠에서 진행을 보고, 돈 드는 단계가 나오면 `1 허락`/`2 거절`.

채팅으로 그냥 "영상 만들어 줘"라고 해도 Claude가 `mcp__video-studio__start` 를 불러 같은 보드로 진행해요.

| 명령 | 하는 일 |
|---|---|
| `/video <요청>` | 추천 카드 열기 |
| `/video --auto <요청>` | 카드 없이 바로 무인 진행(묻지 않음, 돈 드는 단계는 자동 거절) |
| `/video-status` | 지금 프로젝트의 단계·검사 점수 |
| `/video-qa <파일>` | 영상 파일 하나를 qa_video + earshot 으로 검사 |
| `/video-open` | 결과 폴더 열기(huashu 프로젝트면 `om studio` 편집기 안내) |
| `/video-setup` | 영상 도구 준비 상황 보기 (`/video-setup run` 이면 지금 다시 준비) |

단축키는 모두 숫자예요. 한글 입력 상태에서도 먹어요. 띠는 `9`(assumption-tracker 의 `0`, prompt-enhancer 의 `e`·`s` 와 겹치지 않아요). 패널 안: `1` 시작/허락, `2` 다른 도구/거절, `3`~`5` 목소리·결과 폴더·다시 검사·새 영상, `8` 취소.

## 지시문에 들어가는 기본 규칙

- 홍보 영상은 **문제 → 원리 → 앱 이름 → CTA**. 앱 이름·"오픈" 발표를 처음에 두지 않아요.
- 한국어 글꼴은 Pretendard 로 지정해요(huashu·explainroo 기본 글꼴엔 한글이 없어요).
- 무료 목소리 Kokoro 는 한국어를 못 해요 → 카드에서 자막만 / macOS 유나 / 내 녹음 / 유료 TTS 중 골라요.
- 업로드·게시·CLAUDE.md 수정은 하지 않아요. 설치된 스킬 원본(`~/video-studio/vendor`)은 고치지 않아요.
- 결과는 모두 `~/video-studio/projects/<날짜-시각-도구>/` 에 모여요(`timeline.json`, `final.mp4`, `qa/report.md`, `qa/earshot.json`, `qa/phone_sheet.png`).

## 판정 (스스로 채점하지 않게 만든 시험)

| 시험 | 기준 | 다시 돌리기 |
|---|---|---|
| 라우팅 | 한국어 요청 40개(다른 에이전트가 쓰고 정답 표기, 작성자는 채점 때까지 안 봄)에서 맞는 도구 95% 이상 | `node --experimental-strip-types judge/routing/score.ts judge/routing/heldout.jsonl --quiet` |
| 완성 | 대표 요청 4개를 `/video --auto` 로 사람 손 없이: MP4 있음, qa_video 실패 0, earshot `close` 이상(소리 없는 루프는 해당 없음) | `bash judge/completion/run.sh` → `python3 judge/completion/verify.py ~/video-studio/projects/<폴더>...` |
| 화면 | 띠 한 줄이 80·120칸에서 한글 2칸 기준으로 넘치지 않음 | `claude plugin test .` |

결과 숫자는 [`judge/RESULTS.md`](judge/RESULTS.md) 에 있어요.

## 설치

[저장소 첫 화면의 README](../README.md#설치)를 보세요. 마켓플레이스로 설치하면 영상 도구 9종이 함께 설치되고, 첫 세션에서 준비물(`setup/prepare.sh`)이 뒤에서 돌아요. 받은 폴더를 `claude --plugin-dir <이 폴더>` 로 불러 쓸 때는 도구가 함께 설치되지 않고 자동 준비도 돌지 않아요(`/video-setup run` 으로 직접 돌릴 수 있어요).

## 문제 해결

| 증상 | 해결 |
|---|---|
| 패널이 안 보여요 | 터미널이 좁으면(110칸 미만) 저절로 열리지 않아요. `9` 나 `/video` 로 직접 열어요 |
| 검사가 "qa_video 실행 실패" | `/video-setup` 으로 준비 상황을 확인하고 `/video-setup run` 으로 다시 준비해요. `ffmpeg`·`ffprobe` 가 `~/.local/bin` 이나 `/opt/homebrew/bin` 에 있어야 해요 |
| 영상 도구 준비가 실패해요 | `~/video-studio/tools/prepare.log` 에 이유가 있어요. 인터넷이 끊겼으면 `/video-setup run` 으로 다시. 실패한 단계는 6시간 뒤 새 세션에서 저절로 다시 시도해요 |
| 소리 점수가 늘 "손볼 곳 있음" | earshot 은 코드로 합성한 소리를 "가짜 소리"로 감점해요(p_real). 실제 녹음 음원은 `real-sound` 로 |
| 돈 드는 호출이 막혀요 | 정상이에요. 보드의 `1 허락` 을 누르면 Claude 에게 허락 메시지가 가요 |
| 접촉 시트 그림이 글자로만 나와요 | 그림은 kitty 그래픽을 지원하는 터미널(Ghostty, kitty, cmux)에서만 보여요 |

## 파일

- `hooks/route.ts` 요청 → 도구 고르기(순수 함수, 판정 스크립트와 공유)
- `hooks/plan.ts` 카드의 시간·비용, Claude 에게 보내는 작업 지시문
- `hooks/register.tsx` 패널·카드·보드·띠·명령·도구·비용 문·자동 검사
- `hooks/text.ts` 한글 2칸 폭 자르기·맞추기
- `hooks/tools.ts` 영상 도구 설치 위치 찾기, 준비 진행 줄 읽기
- `setup/prepare.sh` 첫 실행 준비(ffmpeg·검사용 파이썬·earshot·explainroo·reanimate), 여러 번 돌려도 안전
- `judge/` 라우팅·완성 시험
