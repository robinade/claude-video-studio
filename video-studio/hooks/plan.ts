// 추천 카드에 쓰는 숫자(시간·비용)와, [시작]을 누르면 Claude 에게 보내는 작업 지시문.
// 순수 함수라 무인 완성 시험(judge/completion)도 같은 지시문을 써요.
import type { ToolId } from './route.ts'

export type VoiceChoice = 'none' | 'yuna' | 'record' | 'paid-tts' | 'kokoro-en'

export type ToolInfo = {
  name: string
  skill: string
  minutes: readonly [number, number]
  /** 무료/유료 항목. 유료는 금액을 같이 적어요. */
  costs: readonly { item: string; amount: string; paid: boolean }[]
  makes: string
}

export const TOOLS: Record<ToolId, ToolInfo> = {
  'huashu-motion': {
    name: 'huashu-motion',
    skill: 'huashu-motion',
    minutes: [15, 40],
    costs: [
      { item: '모션그래픽·작곡·렌더', amount: '무료', paid: false },
      { item: '한국어 목소리(macOS 유나)', amount: '무료', paid: false },
    ],
    makes: '코드로 그린 모션그래픽 MP4',
  },
  'take-one': {
    name: 'take-one',
    skill: 'take-one',
    minutes: [60, 120],
    costs: [
      { item: '코드로 만드는 장면', amount: '무료', paid: false },
      { item: '이미지 모델(고를 때만)', amount: '장당 약 50~150원', paid: true },
      { item: '영상 모델 Kling(고를 때만)', amount: '5초 클립당 크레딧 35~100', paid: true },
    ],
    makes: '연출된 광고·필름 MP4',
  },
  argo: {
    name: 'Argo',
    skill: 'argo-guide:argo-guide',
    minutes: [10, 25],
    costs: [
      { item: '자동 조작·녹화', amount: '무료', paid: false },
      { item: '영어 목소리(Kokoro)', amount: '무료', paid: false },
      { item: '한국어 목소리(OpenAI TTS, 고를 때만)', amount: '30초에 약 10~30원', paid: true },
    ],
    makes: '실제 앱을 눌러 가며 녹화한 데모 MP4',
  },
  explainroo: {
    name: 'explainroo',
    skill: 'explainroo',
    minutes: [15, 40],
    costs: [
      { item: '대본·그림·자막·썸네일', amount: '무료', paid: false },
      { item: '영어 목소리(Kokoro)', amount: '무료', paid: false },
    ],
    makes: '설명 영상 MP4 + 자막·썸네일',
  },
  rossark: {
    name: 'rossark-motion-skill',
    skill: 'rossark-motion-skill',
    minutes: [15, 45],
    costs: [{ item: '움직임 코드·미리보기 영상', amount: '무료', paid: false }],
    makes: '앱에 넣는 애니메이션 코드 + 미리보기 MP4',
  },
  reanimate: {
    name: 'reanimate',
    skill: 'reanimate',
    minutes: [30, 90],
    costs: [{ item: '녹화·비교·복제', amount: '무료', paid: false }],
    makes: '복제한 애니메이션 코드 + 원본 비교 영상',
  },
  earshot: {
    name: 'earshot',
    skill: 'earshot',
    minutes: [3, 10],
    costs: [{ item: '듣기·효과음·검사', amount: '무료', paid: false }],
    makes: '소리 타임라인·점수표, 효과음 넣은 MP4',
  },
  'real-sound': {
    name: 'real-sound',
    skill: 'real-sound',
    minutes: [20, 45],
    costs: [
      { item: '음원 찾기·편집·믹스', amount: '무료', paid: false },
      { item: '음원 라이선스', amount: '무료 음원만(출처 표기)', paid: false },
    ],
    makes: '실제 녹음 음원으로 깐 사운드트랙 + 크레딧',
  },
  watch: {
    name: 'watch',
    skill: 'watch',
    minutes: [2, 6],
    costs: [{ item: '내려받기·장면·자막 분석', amount: '무료', paid: false }],
    makes: '컷·훅·구성 분석 메모',
  },
  kling: {
    name: 'Kling',
    skill: 'kling',
    minutes: [5, 15],
    costs: [{ item: '실사 영상 생성', amount: '5초 클립당 크레딧 35~100', paid: true }],
    makes: '실사 장면 클립',
  },
  'video-director': {
    name: 'video-director',
    skill: 'video-director',
    minutes: [1, 4],
    costs: [{ item: '측정 검사', amount: '무료', paid: false }],
    makes: '검사 보고서 + 휴대폰 크기 접촉 시트',
  },
}

export const VOICE_LABEL: Record<VoiceChoice, string> = {
  none: '자막만 (목소리 없음)',
  yuna: 'macOS 유나 목소리 (무료)',
  record: '내 녹음 파일',
  'paid-tts': '유료 TTS (OpenAI)',
  'kokoro-en': '영어 Kokoro (무료)',
}

/** 이 도구·언어에서 고를 수 있는 목소리. 첫째가 기본값이에요. */
export const voiceOptions = (tool: ToolId, lang: 'ko' | 'en'): VoiceChoice[] => {
  if (lang === 'en') return tool === 'huashu-motion' ? ['none', 'kokoro-en'] : ['kokoro-en', 'none']
  if (tool === 'huashu-motion') return ['none', 'yuna', 'record']
  return ['none', 'record', 'paid-tts']
}

/** 카드에서 미리 알려 줄 한국어 함정. */
export const koreanWarnings = (tool: ToolId, lang: 'ko' | 'en', needsVoice: boolean): string[] => {
  const out: string[] = []
  if (lang === 'ko' && (tool === 'huashu-motion' || tool === 'explainroo' || tool === 'take-one'))
    out.push('기본 글꼴에 한글이 없어요 → Pretendard 로 지정해 두었어요.')
  if (lang === 'ko' && needsVoice && (tool === 'argo' || tool === 'explainroo' || tool === 'take-one'))
    out.push('무료 목소리(Kokoro)는 한국어를 못 해요 → 아래에서 자막만·내 녹음·유료 TTS 중 골라요.')
  if (lang === 'ko' && needsVoice && tool === 'huashu-motion')
    out.push('한국어 목소리는 macOS 유나(무료) 또는 내 녹음이에요. 기계 음성이 싫으면 자막만도 돼요.')
  if (tool === 'kling' || tool === 'take-one') out.push('돈 드는 생성은 금액을 보여 드리고 [허락]을 눌러야만 진행해요.')
  return out
}

export const minutesText = (tool: ToolId) => {
  const [a, b] = TOOLS[tool].minutes
  return `약 ${a}~${b}분`
}

export const slugFor = (now: number, tool: ToolId) => {
  const d = new Date(now)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${tool}`
}

export const sizeFor = (aspect: '9:16' | '16:9' | '1:1') =>
  aspect === '9:16' ? '1080×1920' : aspect === '16:9' ? '1920×1080' : '1080×1080'

const MAKE_STEPS: Record<ToolId, (p: PlanInput) => string> = {
  'huashu-motion': p =>
    `Skill 도구로 \`huashu-motion\` 스킬을 불러 그 방법대로 ${p.aspect} 영상을 만들어요. 한국어 글자는 Pretendard(없으면 Apple SD Gothic Neo)로 지정해요. 렌더 결과를 ${p.dir}/final.mp4 로 복사해요.${
      /홍보|런칭|론칭|출시|광고|릴스|쇼츠|프로모/.test(p.request)
        ? ' 홍보 영상 구성은 반드시 문제 → 원리 → 앱 이름 → CTA 순서예요. 앱 이름이나 "오픈" 발표를 처음에 두지 않아요.'
        : ''
    }`,
  'take-one': p =>
    `Skill 도구로 \`take-one\` 스킬을 불러 "Run" 방식으로 진행해요. 피치에서는 "코드만(무료)" 안을 기본으로 고르고, 이미지·영상 모델이 필요하면 먼저 mcp__video-studio__ask_spend 로 허락을 받아요. 완성본을 ${p.dir}/final.mp4 로 복사해요.`,
  argo: p =>
    `Skill 도구로 \`argo-guide:argo-guide\` 스킬을 불러 Argo 로 실제 앱을 자동 조작·녹화한 데모를 만들어요. 대상이 요청에 없으면 ${p.dir}/app/ 에 요청에 맞는 작은 데모 웹앱(정적 HTML)을 직접 만들어 \`npx -y serve\` 등으로 띄워 녹화해요. ${p.aspect === '9:16' ? '모바일 390×664(isMobile, hasTouch) 화면으로.' : '1280×720 화면으로.'} 완성본을 ${p.dir}/final.mp4 로 복사해요.`,
  explainroo: p =>
    `Skill 도구로 \`explainroo\` 스킬을 불러 설명 영상을 만들어요. 템플릿처럼 보이지 않게 실제 화면·시각 은유를 써요. 끝나면 \`explainroo check --view-width 854\` 를 돌려요. 완성본을 ${p.dir}/final.mp4 로 복사해요.`,
  rossark: p =>
    `Skill 도구로 \`rossark-motion-skill\` 스킬을 불러 웹(HTML/CSS/SVG) 마스코트 애니메이션을 ${p.dir}/web/ 에 만들어요. 마스코트 그림이 없으면 SVG 로 간단한 원본 캐릭터를 직접 그려요(다른 회사 캐릭터 금지). 그다음 헤드리스 Chrome(Playwright)으로 한 바퀴(루프 한 번)를 녹화해 ${p.dir}/final.mp4 (30fps, 끝 프레임이 첫 프레임과 이어지게)로 저장해요.`,
  reanimate: p =>
    `Skill 도구로 \`reanimate\` 스킬을 불러 원본 움직임을 녹화·측정하고 우리 코드로 복제해요. 생김새(글꼴·이미지·로고)는 우리 것으로 바꿔요. 비교 영상을 ${p.dir}/final.mp4 로 저장해요.`,
  earshot: p =>
    `Skill 도구로 \`earshot\` 스킬을 불러 요청한 영상의 소리를 \`earshot timeline\`·\`earshot sheet\`·\`earshot critique\` 로 듣고, 필요하면 \`earshot kit\` 으로 효과음을 넣어요. 결과 영상을 ${p.dir}/final.mp4 로 저장해요.`,
  'real-sound': p =>
    `Skill 도구로 \`real-sound\` 스킬을 불러 실제 녹음 음원으로 사운드트랙을 깔고 라이선스·크레딧을 ${p.dir}/CREDITS.md 에 적어요. 결과 영상을 ${p.dir}/final.mp4 로 저장해요.`,
  watch: p =>
    `Skill 도구로 \`watch\` 스킬을 불러 영상을 보고 컷 길이·첫 3초·훅·구성을 분석해 ${p.dir}/analysis.md 로 저장해요. 영상을 새로 만들지는 않아요.`,
  kling: p =>
    `Kling MCP 로 실사 장면을 만들어요. 생성 전에 반드시 mcp__video-studio__ask_spend 로 크레딧 금액을 올리고 허락을 기다려요. 받은 클립을 ${p.dir}/final.mp4 로 저장해요.`,
  'video-director': p =>
    `요청에 나온 영상 파일을 찾아 ${p.dir}/final.mp4 로 복사(원본은 그대로)한 뒤 바로 검사 단계로 가요.`,
}

export type PlanInput = {
  id: string
  request: string
  tool: ToolId
  aspect: '9:16' | '16:9' | '1:1'
  seconds: number
  lang: 'ko' | 'en'
  voice: VoiceChoice
  dir: string
  auto: boolean
}

const VOICE_RULE: Record<VoiceChoice, string> = {
  none: '내레이션 목소리는 넣지 않고, 글자(자막)로 전해요.',
  yuna: '한국어 내레이션은 macOS `say -v Yuna` 목소리로 만들어요(무료).',
  record: `사용자가 녹음 파일을 줄 거예요. 파일이 없으면 자막만으로 먼저 완성하고 next_action 에 "녹음 파일을 결과 폴더에 voice.m4a 로 넣어 주세요"를 남겨요.`,
  'paid-tts': '한국어 내레이션은 OpenAI TTS(유료)예요. 쓰기 전에 mcp__video-studio__ask_spend 로 금액을 올리고 허락을 기다려요.',
  'kokoro-en': '영어 내레이션은 무료 Kokoro 목소리로 만들어요.',
}

export const TAG = '[영상 감독실]'

/** [시작]을 누르면 Claude 에게 가는 지시문. */
export const workPrompt = (p: PlanInput): string => {
  const noSound = p.tool === 'watch' || p.tool === 'video-director'
  const checkOnly = p.tool === 'video-director' || p.tool === 'watch'
  const lines = [
    `${TAG} 프로젝트 ${p.id} 를 시작해요.`,
    `요청: ${p.request}`,
    `만드는 도구: ${TOOLS[p.tool].name} · 크기 ${p.aspect} (${sizeFor(p.aspect)})${p.seconds ? ` · 길이 약 ${p.seconds}초` : ''} · 언어 ${p.lang === 'ko' ? '한국어' : '영어'}`,
    `결과 폴더: ${p.dir} (모든 산출물은 이 폴더 안에. 설치된 스킬 원본 ~/video-studio/vendor 는 고치지 않아요.)`,
    '',
    '진행 규칙:',
    `- 단계마다 시작할 때와 끝날 때 mcp__video-studio__report 도구로 알려요(project: "${p.id}", stage: plan·make·sound·check·done, status: doing·done·fail·skip, 한 줄 note, 만든 파일 artifact). project 는 매번 꼭 넣어요(창이 여러 개여도 이 프로젝트에 붙게). 이 보고가 사용자의 진행 보드예요.`,
    '- 렌더처럼 오래 걸리는 일은 시작 전에 report 에 progress_label("렌더 중" 등)과 예상 초(expected_seconds)를 넣어요.',
    `- ${VOICE_RULE[p.voice]}`,
    `- 돈 드는 서비스(Kling, ElevenLabs, OpenAI TTS, 이미지 모델)는 mcp__video-studio__ask_spend(project: "${p.id}")로 금액을 올리고 허락 메시지가 올 때까지 쓰지 않아요. 허락 없이 부르면 막혀요.`,
    '- 업로드·게시·설정 파일(CLAUDE.md) 수정은 하지 않아요.',
    `- 검사 기준을 처음부터 지켜요(qa_video 가 재는 값이에요): 첫 3초 훅 글자 ${p.aspect === '16:9' ? '1080 높이' : '1080 폭'} 기준 84px 이상, 설명·CTA 글자 48px 이상, 글자와 바로 뒤 배경의 대비 7:1 이상(밝은 배경엔 진한 글자, 사진 위엔 진한 판), 음량 -14 LUFS(±1)·실제 최고점 -1 dBTP 이하. timeline.json 의 cuts 에는 딱 끊기는 컷만 적고(서서히 겹치는 전환은 빼요), 계획한 정적(silences)은 정말 -30 dBFS 아래로 비워요.`,
    p.auto
      ? '- 사람 손 없이 끝까지 가는 무인 모드예요. 사용자에게 묻지 말고 합리적인 기본값으로 정해서 끝까지 진행해요.'
      : '- 사용자가 확인해야 할 게 있으면 report 의 next_action 에 한 줄로 남기고, 막히지 않는 건 기본값으로 정해 계속해요.',
    '',
    '단계:',
    `1. 계획(plan): video-director 방식으로 ${p.dir}/timeline.json 을 써요(장면·시간·화면 글자와 role(hook/cta/term)·박스, meta.loop 여부). \`python3 ~/video-studio/vendor/video-director/video-director/scripts/check_timeline.py ${p.dir}/timeline.json\` 로 검사해 통과시켜요.${noSound ? ' (이 요청은 계획을 짧게 해도 돼요.)' : ''}`,
    `2. 제작(make): ${MAKE_STEPS[p.tool](p)}`,
    noSound || p.tool === 'rossark'
      ? '3. 소리(sound): 이 영상은 소리 단계가 없어요. report(stage=sound, status=skip).'
      : '3. 소리(sound): earshot 으로 효과음·음악을 다듬어요(`earshot kit init --preset launch`, `earshot timeline`). 소리 판단은 earshot 숫자로만 해요.',
    `4. 검사(check): ${p.dir}/final.mp4 가 생기면 report(stage=check, status=doing, artifact=${p.dir}/final.mp4). 그러면 영상 감독실이 qa_video 와 earshot critique 를 자동으로 돌려 결과를 도구 결과로 돌려줘요. ${
      checkOnly
        ? '이 요청은 검사만 하는 일이라 영상을 고치거나 다시 만들지 않아요. 숫자와 고칠 점을 사용자에게 알려요.'
        : 'FAIL 이 있으면 고쳐서 다시 렌더하고 다시 report 해요(최대 2번).'
    }`,
    `5. 완성(done): report(stage=done, status=done, artifact=${p.dir}/final.mp4, note=한 줄 요약).`,
    '',
    '끝나면 사용자에게 결과 파일 경로, 검사 숫자, 남은 일을 짧게 알려요.',
  ]
  return lines.join('\n')
}
