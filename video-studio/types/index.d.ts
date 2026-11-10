export type VideoToolId =
  | 'huashu-motion'
  | 'take-one'
  | 'argo'
  | 'explainroo'
  | 'rossark'
  | 'reanimate'
  | 'earshot'
  | 'real-sound'
  | 'watch'
  | 'kling'
  | 'video-director'

export type StageKey = 'plan' | 'make' | 'sound' | 'check' | 'done'
export type StageStatus = 'todo' | 'doing' | 'done' | 'fail' | 'skip'
export type Stage = { status: StageStatus; note?: string; artifact?: string }

/** 내레이션을 어떻게 할지. 한국어는 무료 기본 목소리(Kokoro)가 없어서 고르게 해요. */
export type VoiceChoice = 'none' | 'yuna' | 'record' | 'paid-tts' | 'kokoro-en'

export type Spend = {
  id: number
  item: string
  amount: string
  why: string
  status: 'pending' | 'allowed' | 'denied'
}

export type QaResult = {
  pass: number
  warn: number
  fail: number
  failures: string[]
  report: string
  sheet?: string
}

export type EarResult = {
  verdict: string
  score: number
  critical: number
  top?: string
}

export type Project = {
  id: string
  request: string
  tool: VideoToolId
  alternates: VideoToolId[]
  reason: string
  aspect: '9:16' | '16:9' | '1:1'
  seconds: number
  lang: 'ko' | 'en'
  needsVoice: boolean
  voice: VoiceChoice
  dir: string
  phase: 'card' | 'running' | 'done' | 'failed'
  stages: Record<StageKey, Stage>
  progress?: { pct?: number; label: string; since: number }
  nextAction?: string
  spends: Spend[]
  video?: string
  qa?: QaResult
  ear?: EarResult
  earSkipped?: string
  qaRunning?: boolean
  createdAt: number
  auto: boolean
  /** 만든 Claude Code 세션. 다른 창의 프로젝트를 이어받지 않게. */
  sessionId?: string
  /** 턴이 끝났는데 아직 완성 전이면 그 이유(보드에 ⏸ 로). */
  paused?: string
}

declare module 'claude-code' {
  interface PluginState {
    'video-studio': {
      projects: Shaped<Project[]>
      activeId: string
      lastToastAt: number
      /** 렌더 중 경과 시간을 다시 그리려고 1초마다 바뀌는 값. */
      tick: number
      /** 영상 이야기로 보인 마지막 요청(띠에서 9 한 번으로 카드를 열 때 씀). */
      suggestion: { text: string; at: number } | null
      /** 첫 화면 입력창에 쓰던 글. */
      draft: string
    }
  }
}
