# 영상 감독실 (claude-video-studio)

**"어떤 영상이 필요해요?" 한 줄이면, 맞는 영상 도구를 골라 계획 → 제작 → 소리 → 검사 → 완성까지 진행 보드로 보여 주는 한국어 Claude Code mod.**

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Claude Code mod](https://img.shields.io/badge/Claude%20Code-mod-d97757.svg)

> English: A Korean-language Claude Code mod that acts as a video director. Describe the video you need in one line; it picks the right video skill (huashu-motion, take-one, Argo, explainroo, rossark-motion-skill, reanimate, earshot, real-sound, watch, video-director, Kling), shows a progress board (plan → make → sound → check → done), blocks paid generation until you approve the cost, and measures the finished MP4 with `qa_video` and `earshot critique`.

## 무엇을 해 주나

영상 스킬은 많은데, 요청마다 어떤 걸 써야 할지, 어디까지 됐는지, 돈은 드는지, 완성본이 괜찮은지 매번 따로 챙겨야 해요. 영상 감독실은 그걸 한곳에 모아요.

| 화면 | 하는 일 |
|---|---|
| **옆 패널 「영상 감독실」** | 첫 화면은 질문 하나: "어떤 영상이 필요해요?" + 최근 프로젝트 3개 |
| **추천 카드** | 고른 도구, 이유 한 줄, 예상 시간, 비용(무료/유료 항목별), 크기(9:16 등), 한국어 목소리·글꼴 주의 |
| **진행 보드** | 계획 → 제작 → 소리 → 검사 → 완성 5단계, 단계별 메모·파일, 검사 배지(`qa ✓12 ⚠3 ✗0 · 소리 거의 됨 0.91`) |
| **비용 문** | Kling·ElevenLabs·OpenAI TTS·이미지 모델 호출은 [허락]을 누르기 전엔 막혀요 |
| **입력창 위 띠** | `9: 🎬 영상 감독실 · 제작 중 · 5단계 중 2단계 끝 · 다음: …` |
| **자동 검사** | 완성된 MP4를 `qa_video`(글자 크기·대비·번쩍임·컷 등)와 `earshot critique`(음량·소리 싱크)로 직접 재요 |

이 mod는 영상 도구를 새로 만들지 않아요. 이미 공개된 영상 스킬들을 **고르고, 순서대로 시키고, 검사하는** 감독 역할이에요.

## 쓰는 법

```
/video 우리 앱 홍보 릴스 20초 9:16
```

추천 카드에서 `1`(시작)을 누르면 끝이에요. 채팅으로 그냥 "영상 만들어 줘"라고 해도 같은 보드로 진행해요.

| 명령 | 하는 일 |
|---|---|
| `/video <요청>` | 추천 카드 열기 |
| `/video --auto <요청>` | 카드 없이 바로 무인 진행(돈 드는 단계는 자동 거절) |
| `/video-status` | 지금 프로젝트의 단계·검사 점수 |
| `/video-qa <파일>` | 영상 파일 하나를 qa_video + earshot 으로 검사 |
| `/video-open` | 결과 폴더 열기 |

단축키는 모두 숫자라서 한글 입력 상태에서도 먹어요. 자세한 화면 설명과 판정 결과는 [`video-studio/README.md`](video-studio/README.md)에 있어요.

## 필요한 것

### 꼭 필요한 것 (자동 검사)

- **video-director**: 완성본 검사 스크립트(`qa_video.py`, `check_timeline.py`)를 이 위치에서 찾아요.
  ```bash
  mkdir -p ~/video-studio/vendor ~/video-studio/projects
  git clone https://github.com/win4r/video-director ~/video-studio/vendor/video-director
  mkdir -p ~/.claude/skills
  ln -s ~/video-studio/vendor/video-director/video-director ~/.claude/skills/video-director
  python3 -m pip install numpy Pillow
  ```
- **ffmpeg / ffprobe**: `brew install ffmpeg` (macOS)
- 결과는 모두 `~/video-studio/projects/<날짜-시각-도구>/` 에 모여요.

### 있으면 소리 검사까지

- **earshot**: [저장소 README](https://github.com/Leonxlnx/earshot)대로 설치해서 `earshot` 명령이 PATH에 있게 해요. 없으면 소리 검사만 건너뛰어요.

### 만드는 도구 (쓰고 싶은 것만)

mod가 요청에 맞는 도구를 골라 Claude에게 그 스킬을 쓰라고 시켜요. 설치된 도구만 실제로 쓸 수 있어요. 각 저장소의 설치 방법을 따라 주세요.

| 도구 | 이럴 때 고름 | 저장소 |
|---|---|---|
| huashu-motion | 앱 홍보·런칭 영상, 음악 박자 모션그래픽, 데이터 영상, 한국어 내레이션 | [alchaincyf/huashu-motion](https://github.com/alchaincyf/huashu-motion) |
| take-one | 이야기형 광고, 브랜드 필름, 뮤직비디오 | [talsiach/take-one](https://github.com/talsiach/take-one) |
| Argo | 실제 앱을 자동으로 눌러 가며 녹화한 데모 | [shreyaskarnik/argo](https://github.com/shreyaskarnik/argo) |
| explainroo | 영어 주제 설명 영상(대본·목소리·그림·자막 자동) | [vincentsch/explainroo](https://github.com/vincentsch/explainroo) |
| rossark-motion-skill | 앱 속 마스코트·아이콘 애니메이션 | [rossark0/rossark-motion-skill](https://github.com/rossark0/rossark-motion-skill) |
| reanimate | 남의 사이트·영상 애니메이션을 내 코드로 복제 | [NiazMorshed2007/reanimate](https://github.com/NiazMorshed2007/reanimate) |
| earshot · real-sound | 효과음·음량·소리 싱크, 실제 녹음 음원 사운드트랙 | [Leonxlnx/earshot](https://github.com/Leonxlnx/earshot) |
| watch | 참고 영상 분석(컷·훅·구성) | [bradautomates/claude-video](https://github.com/bradautomates/claude-video) |
| video-director | 계획표 검사, 완성본 측정 검사 | [win4r/video-director](https://github.com/win4r/video-director) |
| Kling | 실사 장면 생성(유료, 허락 후에만) | Kling MCP |

## 설치

### AI 에이전트에게 맡기기

아래를 Claude Code에 붙여 넣으면 설치부터 확인까지 해 줘요.

```
영상 감독실 Claude Code mod를 설치해 줘. 저장소는 https://github.com/robinade/claude-video-studio 야.

아래 순서대로 진행해 줘.
1. `claude plugin marketplace add robinade/claude-video-studio`를 실행해. 이미 추가돼 있다고 나오면 다음 단계로 넘어가.
2. `claude plugin install video-studio@claude-video-studio`를 실행해. 설치 범위는 기본값 user로 둬.
3. `claude plugin list`로 video-studio가 enabled인지 확인해.
4. 저장소 README의 "꼭 필요한 것"(video-director·ffmpeg)이 이 컴퓨터에 있는지 확인하고, 없으면 무엇을 설치할지 나에게 먼저 물어.

지켜 줘.
- `plugin` 명령이 "not run from this spelling"으로 거부되면 `claude`가 다른 프로그램의 래퍼라서 그래. `which -a claude`로 실제 실행 파일을 찾아 그걸로 다시 실행해.
- 설정 파일은 건드리지 마.

끝나면 설치한 버전과 건너뛰거나 실패한 단계를 알려 줘. 그리고 Claude Code를 다시 시작하면(또는 `/reload-plugins`) mod가 켜진다고 안내해 줘.
```

### 직접 입력할 명령어

터미널에서 `claude`를 실행한 뒤 입력창에:

```
/plugin marketplace add robinade/claude-video-studio
/plugin install video-studio@claude-video-studio
```

설치 없이 한 번만 써 보려면:

```bash
git clone https://github.com/robinade/claude-video-studio
claude --plugin-dir ./claude-video-studio/video-studio
```

## 함께 쓰면 좋은 mod

- [claude-mods-ko](https://github.com/robinade/claude-mods-ko): 프롬프트 다듬기, 쉬운 말 답변, 가정 기록, 아이디어 선반 등 한국어 mod 6종. 단축키가 겹치지 않게 만들었어요(영상 감독실은 `9`).

## 크레딧

- 영상 도구를 고르게 된 계기: AI LABS 영상 [「Insane GitHub Repos To Actually 10x Claude Video Editing」](https://www.youtube.com/watch?v=oTWUyW_bR-g)
- 실제 영상을 만드는 일은 위 표의 각 저장소가 해요. 각 도구의 라이선스는 해당 저장소를 따라요. 이 저장소에는 그 도구들의 코드가 들어 있지 않아요.

## 라이선스

[MIT](LICENSE)
