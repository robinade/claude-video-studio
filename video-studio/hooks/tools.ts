// 영상 도구가 어디에 깔렸는지 찾기, 그리고 첫 실행 준비(setup/prepare.sh)의 출력 읽기.
// 순수 함수라 테스트가 직접 불러요.

/** 이 mod 와 영상 도구 9종이 함께 들어 있는 마켓플레이스 이름. */
export const MARKET = 'claude-video-studio'
/** setup/prepare.sh 가 쓰는 준비 표시(prepared.json)의 판. 준비 단계를 바꾸면 올려요. */
export const PREP_VERSION = 1

/** installed_plugins.json 에서 `<name>@claude-video-studio` 의 설치 폴더. 없으면 undefined. */
export const installPath = (installed: unknown, name: string): string | undefined => {
  const plugins = (installed as { plugins?: Record<string, { installPath?: unknown }[]> } | undefined)?.plugins
  const rows = plugins?.[`${name}@${MARKET}`]
  if (!Array.isArray(rows)) return undefined
  const row = rows.find(r => typeof r?.installPath === 'string')
  return row ? (row.installPath as string) : undefined
}

/** video-director 검사 스크립트(qa_video.py·check_timeline.py) 폴더 후보, 앞에서부터 찾아요. */
export const scriptDirs = (home: string, vdRoot?: string) => [
  ...(vdRoot ? [`${vdRoot}/video-director/scripts`] : []),
  `${home}/.claude/skills/video-director/scripts`,
  `${home}/video-studio/vendor/video-director/video-director/scripts`,
]

export type PrepStatus = 'doing' | 'done' | 'skip' | 'fail'
export type PrepStep = { status: PrepStatus; msg: string }
export type Prep = {
  running: boolean
  steps: Record<string, PrepStep>
  /** 지금 하는 단계 */
  current?: string
  endedAt?: number
  ok?: boolean
}

export const STEP_LABEL: Record<string, string> = {
  ffmpeg: 'ffmpeg',
  py: '검사용 파이썬',
  earshot: 'earshot',
  explainroo: 'explainroo',
  reanimate: 'reanimate',
}

/** "@ earshot doing 소리 검사 도구 …" → { step, status, msg }. 준비 줄이 아니면 undefined. */
export const parsePrepLine = (line: string) => {
  const m = /^@ (\S+) (doing|done|skip|fail|busy) ?(.*)$/.exec(line.trim())
  return m ? { step: m[1], status: m[2], msg: m[3] ?? '' } : undefined
}

/** 준비 결과 한 줄: "새로 설치 2 · 이미 있음 3 · 실패 0" */
export const prepSummary = (steps: Record<string, PrepStep>) => {
  const v = Object.values(steps)
  const n = (s: PrepStatus) => v.filter(x => x.status === s).length
  return `새로 설치 ${n('done')} · 이미 있음 ${n('skip')} · 실패 ${n('fail')}`
}

/** 준비를 자동으로 다시 돌릴까: 표시가 없거나 판이 바뀌었으면 돌려요. 실패가 있었으면 6시간 뒤에 다시 시도해요. */
export const shouldPrepare = (marker: unknown, now: number) => {
  const m = marker as { version?: unknown; ok?: unknown; at?: unknown } | undefined
  if (!m || typeof m !== 'object' || m.version !== PREP_VERSION) return true
  if (m.ok === true) return false
  const at = Date.parse(String(m.at ?? ''))
  return !Number.isFinite(at) || now - at > 6 * 3600_000
}
