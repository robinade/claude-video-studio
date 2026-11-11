import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { EarResult, Project, QaResult, Stage, StageKey, StageStatus, VideoToolId, VoiceChoice } from '../types'
import { DEFAULT_ENV, TAG, TOOLS, VOICE_LABEL, koreanWarnings, minutesText, sizeFor, slugFor, voiceOptions, workPrompt } from './plan.ts'
import type { ToolEnv } from './plan.ts'
import { isVideoIntent, route } from './route.ts'
import { clipWidth, displayWidth, padWidth } from './text.ts'
import { STEP_LABEL, installPath, parsePrepLine, prepSummary, scriptDirs, shouldPrepare } from './tools.ts'
import type { Prep, PrepStatus } from './tools.ts'

const PLUGIN = 'video-studio'
const PANE = 'video-studio'
const TITLE = '영상 감독실'
// 0 은 assumption-tracker, e·s 는 prompt-enhancer 띠가 써요. 한글 입력 중에도 먹게 숫자로.
const BAND_KEY = '9'

const projects = atom({ plugin: 'video-studio', key: 'projects' } as const, [] as Project[], { shape: 'projects-1' })
const activeId = atom({ plugin: 'video-studio', key: 'activeId' } as const, '')
const lastToastAt = atom({ plugin: 'video-studio', key: 'lastToastAt' } as const, 0)
const tick = atom({ plugin: 'video-studio', key: 'tick' } as const, 0)
const suggestion = atom({ plugin: 'video-studio', key: 'suggestion' } as const, null as { text: string; at: number } | null)
const draft = atom({ plugin: 'video-studio', key: 'draft' } as const, '')
// 영상 도구 첫 실행 준비(setup/prepare.sh)의 진행 상황.
const prep = atom({ plugin: 'video-studio', key: 'prep' } as const, { running: false, steps: {} } as Prep)

const STORE_KEY = 'projects-1'
// 첫 화면을 보여 달라는 표시(진행 중 프로젝트를 자동으로 이어 받지 않게).
const HOME_VIEW = '-'

export const STAGES: readonly { key: StageKey; label: string }[] = [
  { key: 'plan', label: '계획' },
  { key: 'make', label: '제작' },
  { key: 'sound', label: '소리' },
  { key: 'check', label: '검사' },
  { key: 'done', label: '완성' },
]

const ICON: Record<StageStatus, string> = { todo: '○', doing: '◐', done: '●', fail: '✗', skip: '–' }
const COLOR: Record<StageStatus, string | undefined> = {
  todo: undefined,
  doing: 'yellow',
  done: 'green',
  fail: 'red',
  skip: undefined,
}

const freshStages = (): Record<StageKey, Stage> => ({
  plan: { status: 'todo' },
  make: { status: 'todo' },
  sound: { status: 'todo' },
  check: { status: 'todo' },
  done: { status: 'todo' },
})

// ---------------------------------------------------------------- 순수 도우미 (테스트가 직접 불러요)

export const stageIndex = (p: Pick<Project, 'stages'>) => {
  let n = 0
  for (const s of STAGES) if (['done', 'skip'].includes(p.stages[s.key].status)) n++
  return n
}

export const currentStage = (p: Pick<Project, 'stages'>) =>
  STAGES.find(s => p.stages[s.key].status === 'doing') ?? STAGES.find(s => p.stages[s.key].status === 'todo')

export const bar = (pct: number, cells = 10) => {
  const full = Math.max(0, Math.min(cells, Math.round((pct / 100) * cells)))
  return '▓'.repeat(full) + '░'.repeat(cells - full)
}

export const qaBadge = (qa?: QaResult) => (qa ? `qa ✓${qa.pass} ⚠${qa.warn} ✗${qa.fail}` : '')

const VERDICT_KO: Record<string, string> = {
  'launch-grade': '런칭급',
  close: '거의 됨',
  'needs work': '손볼 곳 있음',
  'not launch-grade': '많이 부족',
}
export const earBadge = (ear?: EarResult, skipped?: string) =>
  ear ? `소리 ${VERDICT_KO[ear.verdict] ?? ear.verdict} ${ear.score.toFixed(2)}` : skipped ? `소리 검사 생략` : ''

/** 경과 초와 예상 초로 보는 진행률. 예상이 없으면 undefined. */
export const progressPct = (p: Project, now: number) => {
  if (!p.progress) return undefined
  if (typeof p.progress.pct === 'number') return p.progress.pct
  return undefined
}

/** 입력창 위 띠 한 줄. 폭은 화면 칸 기준(한글 2칸)으로 잘라요. */
export const bandLine = (p: Project, now: number, cols: number) => {
  const parts: string[] = ['🎬 영상 감독실']
  if (p.phase === 'card') parts.push(`추천 ${TOOLS[p.tool].name} · 누르면 시작`)
  else if (p.phase === 'running') {
    const cur = currentStage(p)
    if (p.paused) parts.push(`⏸ 멈춤 (${cur?.label ?? '진행'} 단계) · "계속해"라고 보내면 이어요`)
    else parts.push(`${cur?.label ?? '진행'} 중 · 5단계 중 ${stageIndex(p)}단계 끝`)
    if (p.progress) {
      const secs = Math.max(0, Math.round((now - p.progress.since) / 1000))
      const pct = progressPct(p, now)
      parts.push(`${pct !== undefined ? `${bar(pct, 8)} ${pct}% ` : ''}${p.progress.label} ${secs}초`)
    }
    if (p.qaRunning) parts.push('자동 검사 중')
    const pending = p.spends.find(s => s.status === 'pending')
    if (pending) parts.push(`💰 허락 필요: ${pending.item} ${pending.amount}`)
    else if (p.nextAction) parts.push(`다음: ${p.nextAction}`)
  } else if (p.phase === 'done') {
    parts.push('완성')
    const q = [qaBadge(p.qa), earBadge(p.ear, p.earSkipped)].filter(Boolean).join(' · ')
    if (q) parts.push(q)
  } else parts.push('멈춤 · 보드에서 확인')
  // 터미널은 단축키 버튼 앞에 "9: " 를 그려요(3칸). 그만큼 빼고 잘라요.
  return clipWidth(parts.join(' · '), Math.max(10, cols - 4))
}

export const newProject = (text: string, now: number, home: string, auto: boolean): Project => {
  const r = route(text)
  const tool = r.tool as VideoToolId
  const voice = voiceOptions(r.tool, r.lang)[0] as VoiceChoice
  return {
    id: slugFor(now, r.tool),
    request: text.trim(),
    tool,
    alternates: r.alternates as VideoToolId[],
    reason: r.reason,
    aspect: r.aspect,
    seconds: r.seconds,
    lang: r.lang,
    needsVoice: r.needsVoice,
    voice,
    dir: `${home}/video-studio/projects/${slugFor(now, r.tool)}`,
    phase: 'card',
    stages: freshStages(),
    spends: [],
    createdAt: now,
    auto,
  }
}

/** 다른 도구로 바꾸기: 후보를 차례로 돌아요. */
export const cycleTool = (p: Project): Project => {
  const order = [p.tool, ...p.alternates.filter(a => a !== p.tool)]
  const all = [...new Set([...order, 'huashu-motion', 'argo', 'explainroo'] as VideoToolId[])]
  const next: VideoToolId = all[(all.indexOf(p.tool) + 1) % all.length] ?? 'huashu-motion'
  const voice = voiceOptions(next, p.lang)[0] as VoiceChoice
  return {
    ...p,
    tool: next,
    voice,
    alternates: all.filter(a => a !== next),
    reason: `직접 고른 도구예요. ${TOOLS[next].makes}을(를) 만들어요.`,
    id: p.id.replace(/-[a-z-]+$/, `-${next}`),
    dir: p.dir.replace(/-[a-z-]+$/, `-${next}`),
  }
}

export const qaSummary = (qa: QaResult, ear: EarResult | undefined, earSkipped: string | undefined) => {
  const lines = [`qa_video: 통과 ${qa.pass} · 주의 ${qa.warn} · 실패 ${qa.fail} (보고서 ${qa.report})`]
  for (const f of qa.failures.slice(0, 6)) lines.push(`  실패: ${f}`)
  if (ear) lines.push(`earshot critique: ${ear.verdict} (점수 ${ear.score.toFixed(3)}, 심각 ${ear.critical})${ear.top ? ` · 가장 큰 문제: ${ear.top}` : ''}`)
  else if (earSkipped) lines.push(`earshot critique: 생략 (${earSkipped})`)
  return lines.join('\n')
}

/** qa_video 의 report.json → 숫자. */
export const parseQa = (json: string, report: string): QaResult => {
  const d = JSON.parse(json) as { checks?: { level: string; check: string; detail: string }[] }
  const checks = d.checks ?? []
  const n = (lv: string) => checks.filter(c => c.level === lv).length
  return {
    pass: n('PASS'),
    warn: n('WARN'),
    fail: n('FAIL'),
    failures: checks.filter(c => c.level === 'FAIL').map(c => `${c.check}: ${c.detail}`.slice(0, 220)),
    report,
  }
}

export const parseEar = (json: string): EarResult => {
  const d = JSON.parse(json) as {
    verdict?: string
    score?: number
    critical_issues?: number
    actions?: { weight: string; action: string }[]
  }
  const top = d.actions?.find(a => a.weight === 'critical') ?? d.actions?.[0]
  return {
    verdict: d.verdict ?? '?',
    score: typeof d.score === 'number' ? d.score : 0,
    critical: d.critical_issues ?? 0,
    top: top ? top.action.slice(0, 200) : undefined,
  }
}

const VERDICT_RANK: Record<string, number> = { 'launch-grade': 3, close: 2, 'needs work': 1, 'not launch-grade': 0 }
export const earAtLeastClose = (ear?: EarResult) => (ear ? (VERDICT_RANK[ear.verdict] ?? -1) >= 2 : false)

// 돈 드는 호출: 허락 없이 부르면 막아요.
export const PAID_TOOL = /^mcp__kling__(text_to_video|image_to_video|text_to_image|image_to_image|omni_ref_video|motion_control)$/
export const PAID_BASH =
  /api\.elevenlabs\.io|elevenlabs|api\.openai\.com\/v1\/(audio|images)|openai\.audio\.speech|tts-1|gpt-4o-mini-tts|fal\.run|queue\.fal|api\.replicate\.com/i
export const RENDER_BASH =
  /\bom\s+(render|export)|bin\/om\s+(render|export)|explainroo(\.js)?\s+(render|make|build|video)|\bargo\s+(pipeline|record|export|run)|npx\s+(-y\s+)?(@argo-video\/cli|argo)|remotion\s+render|hyperframes[^\n]*render|ffmpeg\b[^\n]*\.(mp4|mov|webm)\b/

// ---------------------------------------------------------------- 상태 바꾸기

const save = async ($: EngineInterface) => {
  const list = await read($, projects)
  await $.store.set(STORE_KEY, list.slice(-20))
}

// 세션을 새로 열거나 이어 열면(--resume) 고른 프로젝트 표시는 사라져요. 그때는 가장 최근에 진행 중이던 프로젝트를 이어 받아요.
export const pickActive = (list: readonly Project[], id: string, sessionId: string) =>
  id ? list.find(p => p.id === id) : [...list].reverse().find(p => p.phase === 'running' && p.sessionId === sessionId)

const active = async ($: EngineInterface) =>
  pickActive(await read($, projects), await read($, activeId), await $.session.id())

/** 도구 호출이 project 를 주면 그 프로젝트, 아니면 지금 프로젝트. */
const target = async ($: EngineInterface, project: unknown) => {
  const list = await read($, projects)
  if (typeof project === 'string' && project) {
    const p = list.find(x => x.id === project)
    if (p) {
      await update($, activeId, () => p.id)
      return p
    }
  }
  return active($)
}

const patch = async ($: EngineInterface, id: string, fn: (p: Project) => Project) => {
  await update($, projects, list => list.map(p => (p.id === id ? fn(p) : p)))
  await save($)
}

const setStage = (p: Project, key: StageKey, stage: Stage): Project => ({
  ...p,
  stages: { ...p.stages, [key]: { ...p.stages[key], ...stage } },
})

const home = async ($: EngineInterface) => (await $.env.get('HOME')) ?? '.'

const readJson = async ($: EngineInterface, path: string): Promise<unknown> => {
  try {
    if (!(await $.fs.exists(path))) return undefined
    return JSON.parse(String(await $.fs.read(path)))
  } catch {
    return undefined
  }
}

/** 설치 기록(installed_plugins.json). 마켓플레이스로 설치한 영상 도구들의 폴더가 여기 있어요. */
const installedPlugins = async ($: EngineInterface) => {
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${await home($)}/.claude`
  return readJson($, `${dir}/plugins/installed_plugins.json`)
}

/** 이 컴퓨터의 도구 위치: 검사 스크립트 폴더(마켓플레이스 설치 → ~/.claude/skills → ~/video-studio/vendor 순)와 파이썬. */
const resolveTools = async ($: EngineInterface): Promise<ToolEnv & { installed: unknown }> => {
  const h = await home($)
  const installed = await installedPlugins($)
  const dirs = scriptDirs(h, installPath(installed, 'video-director'))
  let scripts = dirs[dirs.length - 1]
  for (const d of dirs)
    if (await $.fs.exists(`${d}/qa_video.py`)) {
      scripts = d
      break
    }
  const venv = `${h}/video-studio/tools/py/bin/python`
  const python = (await $.fs.exists(venv)) ? venv : DEFAULT_ENV.python
  return { scripts, python, installed }
}

/**
 * 영상 도구 첫 실행 준비: setup/prepare.sh 를 뒤에서 돌리고 띠·패널에 진행을 보여 줘요.
 * auto 는 세션 시작 때 부른 것: 이 mod 가 마켓플레이스로 설치됐고, 준비가 아직이거나 판이 바뀌었을 때만 돌아요.
 */
const prepare = async ($: EngineInterface, auto: boolean): Promise<string> => {
  if ((await read($, prep)).running) return '영상 도구를 준비하는 중이에요.'
  const h = await home($)
  const toolsDir = `${h}/video-studio/tools`
  const t = await resolveTools($)
  if (auto) {
    if ((await $.env.get('VIDEO_STUDIO_PREPARE')) === '0') return ''
    if (!installPath(t.installed, 'video-studio')) return ''
    if (!shouldPrepare(await readJson($, `${toolsDir}/prepared.json`), await $.clock.now())) return ''
  }
  const env: Record<string, string> = {
    VS_TOOLS: toolsDir,
    PATH: `${h}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  }
  for (const [k, n] of [['EARSHOT_ROOT', 'earshot'], ['EXPLAINROO_ROOT', 'explainroo'], ['REANIMATE_ROOT', 'reanimate']] as const) {
    const r = installPath(t.installed, n)
    if (r) env[k] = r
  }
  await update($, prep, () => ({ running: true, steps: {} }))
  let child
  try {
    child = $.process.spawn({ argv: ['/bin/bash', `${$.plugin.root}/setup/prepare.sh`], env })
  } catch (err) {
    await update($, prep, () => ({ running: false, steps: {}, ok: false }))
    return `영상 도구 준비를 시작하지 못했어요: ${String(err).slice(0, 200)}`
  }
  void (async () => {
    let buf = ''
    let busy = false
    try {
      for await (const { text } of child) {
        buf += text
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const m = parsePrepLine(line)
          if (!m) continue
          if (m.step === 'all') {
            if (m.status === 'busy') busy = true
            continue
          }
          await update($, prep, x => ({
            ...x,
            current: m.status === 'doing' ? m.step : x.current === m.step ? undefined : x.current,
            steps: { ...x.steps, [m.step]: { status: m.status as PrepStatus, msg: m.msg } },
          }))
        }
      }
    } catch {
      // 세션이 끝나면 준비도 멈춰요. 다음 세션에서 남은 것부터 이어요.
    }
    try {
      const steps = (await read($, prep)).steps
      const ok = !Object.values(steps).some(s => s.status === 'fail')
      const endedAt = await $.clock.now()
      await update($, prep, x => ({ ...x, running: false, current: undefined, endedAt, ok }))
      if (busy) return
      const installedNew = Object.values(steps).some(s => s.status === 'done')
      if (installedNew || !ok)
        $.ui.toast(`🎬 영상 도구 준비 ${ok ? '끝' : '일부 실패'} · ${prepSummary(steps)}${ok ? '' : ' · /video-setup 으로 자세히'}`, { timeoutMs: 8000 })
    } catch {
      // 창을 닫는 중이면 mod 가 먼저 내려가요. 그때는 알릴 곳이 없어요.
    }
  })()
  return '영상 도구 준비를 시작했어요. 입력창 위 띠에서 진행을 볼 수 있어요.'
}

/** 준비 상황 여러 줄(/video-setup). */
const prepReport = async ($: EngineInterface) => {
  const x = await read($, prep)
  const h = await home($)
  const marker = (await readJson($, `${h}/video-studio/tools/prepared.json`)) as { at?: string; steps?: Record<string, string> } | undefined
  const rows = Object.keys(STEP_LABEL).map(k => {
    const s = x.steps[k]
    const last = marker?.steps?.[k]
    const icon = s ? (s.status === 'doing' ? '◐' : s.status === 'fail' ? '✗' : '●') : last === 'ok' ? '●' : last === 'fail' ? '✗' : '○'
    return `${icon} ${STEP_LABEL[k]}${s?.msg ? ` · ${s.msg}` : last ? ` · 지난 결과 ${last === 'ok' ? '준비됨' : '실패'}` : ''}`
  })
  return [
    x.running ? '영상 도구 준비 중이에요.' : marker?.at ? `마지막 준비: ${marker.at}` : '아직 준비한 적이 없어요.',
    ...rows,
    `기록: ${h}/video-studio/tools/prepare.log`,
  ].join('\n')
}

const openPane = ($: EngineInterface, focus = true) =>
  $.ui.open(focus ? { id: PANE, title: TITLE, focus: true, columns: 64, rows: 30 } : { id: PANE, title: TITLE, columns: 64, rows: 30 })

const addProject = async ($: EngineInterface, project: Project) => {
  const p = { ...project, sessionId: await $.session.id() }
  await update($, projects, list => [...list.filter(x => x.id !== p.id), p].slice(-20))
  await update($, activeId, () => p.id)
  await save($)
}

/** [시작]: 보드로 바꾸고 Claude 에게 지시문을 보내요. */
const start = async ($: EngineInterface, id: string, deferred = false) => {
  let prompt = ''
  const env = await resolveTools($)
  await patch($, id, p => {
    prompt = workPrompt({ ...p, tool: p.tool }, env)
    return { ...setStage({ ...p, phase: 'running' }, 'plan', { status: 'doing', note: 'Claude 에게 계획을 맡겼어요' }) }
  })
  const p = (await read($, projects)).find(x => x.id === id)
  if (p) await $.process.run(['mkdir', '-p', p.dir])
  if (!prompt) return
  // 명령(command.run) 안에서는 바로 보낼 수 없어요: 그 명령이 끝나기를 기다리는 턴에 막혀요. 한 박자 뒤 타이머로 보내요.
  if (deferred) $.clock.after(50, () => void $.prompt.submit({ text: prompt }))
  else await $.prompt.submit({ text: prompt })
}

const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/** 렌더가 끝난 MP4 를 자동 검사: qa_video + earshot critique. 결과는 보드와 Claude 둘 다에게. */
export const runChecks = async ($: EngineInterface, id: string, video: string): Promise<string> => {
  const p = (await read($, projects)).find(x => x.id === id)
  if (!p) return '프로젝트를 찾지 못했어요.'
  const h = await home($)
  const out = `${p.dir}/qa`
  await patch($, id, x => ({
    ...setStage(x, 'check', { status: 'doing', note: '자동 검사 중 (qa_video → earshot)' }),
    qaRunning: true,
    video,
  }))
  const env = { PATH: `${h}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin` }
  const timeline = `${p.dir}/timeline.json`
  const hasTimeline = await $.fs.exists(timeline)
  const loop = p.tool === 'rossark'
  const tools = await resolveTools($)
  const qaCmd = [
    tools.python,
    `${tools.scripts}/qa_video.py`,
    video,
    '--out',
    out,
    ...(hasTimeline ? ['--beats', timeline] : []),
    ...(loop ? ['--loop'] : []),
  ]
  let qa: QaResult | undefined
  let problem = ''
  try {
    await $.process.run(['mkdir', '-p', out], { env })
    const r = await $.process.run(qaCmd, { env, timeoutMs: 600_000 })
    if (await $.fs.exists(`${out}/report.json`)) {
      qa = parseQa(String(await $.fs.read(`${out}/report.json`)), `${out}/report.md`)
      await $.process.run(
        ['/bin/sh', '-c', `ffmpeg -v error -y -i ${sh(`${out}/phone_sheet.jpg`)} -vf "scale='min(1400,iw)':-2" ${sh(`${out}/phone_sheet.png`)}`],
        { env, timeoutMs: 60_000 },
      )
      if (await $.fs.exists(`${out}/phone_sheet.png`)) qa = { ...qa, sheet: `${out}/phone_sheet.png` }
    } else problem = `qa_video 가 보고서를 못 만들었어요: ${(r.stderr || r.stdout).slice(-300)}`
  } catch (err) {
    problem = `qa_video 실행 실패: ${String(err).slice(0, 300)}`
  }
  // 소리 검사: 소리가 있는 영상만.
  let ear: EarResult | undefined
  let earSkipped: string | undefined
  try {
    const probe = await $.process.run(
      ['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', video],
      { env },
    )
    if (!probe.stdout.trim()) earSkipped = '소리 없는 영상'
    else if (p.tool === 'rossark') earSkipped = '앱 안 애니메이션이라 소리 기준 없음'
    else {
      await $.process.run(['earshot', 'critique', video, '--json', '--out', `${out}/earshot.json`], {
        env,
        timeoutMs: 600_000,
      })
      if (await $.fs.exists(`${out}/earshot.json`)) ear = parseEar(String(await $.fs.read(`${out}/earshot.json`)))
      else earSkipped = 'earshot 결과 없음'
    }
  } catch (err) {
    earSkipped = `earshot 실행 실패: ${String(err).slice(0, 160)}`
  }
  const ok = !!qa && qa.fail === 0 && (ear ? earAtLeastClose(ear) : true)
  await patch($, id, x => ({
    ...setStage(x, 'check', {
      status: qa ? (ok ? 'done' : 'fail') : 'fail',
      note: qa ? [qaBadge(qa), earBadge(ear, earSkipped)].filter(Boolean).join(' · ') : problem,
      artifact: qa?.report,
    }),
    qa,
    ear,
    earSkipped,
    qaRunning: false,
  }))
  if (!qa) return `${TAG} 자동 검사를 못 했어요. ${problem}`
  return `${TAG} 자동 검사 결과\n${qaSummary(qa, ear, earSkipped)}\n${
    ok
      ? '검사를 통과했어요. 완성(done) 단계로 가요.'
      : '기준(qa 실패 0건, 소리 "close" 이상)에 못 미쳐요. 가장 큰 문제부터 고쳐 다시 렌더하고 report(stage=check)를 다시 불러요. 2번 고쳐도 안 되면 남은 문제를 note 에 적고 완성으로 가요.'
  }`
}

// ---------------------------------------------------------------- 등록

const GUIDANCE = `# 영상 감독실 (video-studio mod)
사용자가 영상을 만들거나 고치거나 검사해 달라고 하면(영상·릴스·쇼츠·데모·설명 영상·마스코트 애니메이션·효과음·배경음악 등), 작업을 시작하기 전에 mcp__video-studio__start 를 요청 원문으로 한 번 불러요. 돌려받은 지시문(도구·결과 폴더·단계)을 따르고, 단계마다 mcp__video-studio__report 로 보고해요. 이미 "${TAG} 프로젝트" 메시지로 시작한 일이면 start 를 다시 부르지 않아요. 돈 드는 서비스는 mcp__video-studio__ask_spend 로 허락을 받은 뒤에만 써요.`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get(STORE_KEY)
    if (Array.isArray(stored) && (await read($, projects)).length === 0)
      await update($, projects, () => (stored as Project[]).map(p => ({ ...p, qaRunning: false })))
    for (const c of [
      { name: 'video', description: '영상 감독실: 어떤 영상이 필요한지 말하면 도구·시간·비용 추천 카드를 보여 줘요', argumentHint: '[만들고 싶은 영상] (--auto 면 바로 시작)' },
      { name: 'video-status', description: '영상 감독실: 지금 프로젝트의 단계·검사 점수 보기' },
      { name: 'video-qa', description: '영상 감독실: 영상 파일 하나를 qa_video + earshot 으로 검사', argumentHint: '<영상 파일 경로>' },
      { name: 'video-open', description: '영상 감독실: 지금 프로젝트의 결과 폴더 열기' },
      { name: 'video-setup', description: '영상 감독실: 영상 도구 준비 상황 보기·다시 준비하기', argumentHint: '[run 이면 지금 다시 준비]' },
    ])
      await $.command.register(c)

    await $.tool.register({
      name: 'start',
      description:
        '영상 요청을 영상 감독실 프로젝트로 등록하고, 맞는 도구·결과 폴더·단계가 적힌 작업 지시문을 돌려받는다. 영상 작업을 시작하기 전에 한 번 부른다.',
      inputSchema: {
        type: 'object',
        properties: { request: { type: 'string', description: '사용자의 영상 요청 원문' } },
        required: ['request'],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'report',
      description:
        '영상 감독실 진행 보드에 단계 상태를 보고한다. stage=check 에 MP4 artifact 를 주면 qa_video·earshot 자동 검사를 돌려 결과를 돌려준다.',
      inputSchema: {
        type: 'object',
        properties: {
          stage: { type: 'string', enum: ['plan', 'make', 'sound', 'check', 'done'] },
          status: { type: 'string', enum: ['doing', 'done', 'fail', 'skip'] },
          note: { type: 'string', description: '한 줄 한국어 메모' },
          artifact: { type: 'string', description: '만든 파일의 절대 경로' },
          progress_label: { type: 'string', description: '오래 걸리는 일의 이름, 예: 렌더 중' },
          progress_pct: { type: 'number', description: '0~100, 알 때만' },
          expected_seconds: { type: 'number', description: '예상 소요 초' },
          next_action: { type: 'string', description: '사용자가 할 일 한 줄, 없으면 빈 문자열' },
          project: { type: 'string', description: '지시문에 적힌 프로젝트 id' },
        },
        required: ['stage', 'status'],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'ask_spend',
      description: '돈 드는 서비스(Kling, ElevenLabs, OpenAI TTS, 이미지 모델)를 쓰기 전에 금액과 이유를 올려 사용자 허락을 요청한다.',
      inputSchema: {
        type: 'object',
        properties: {
          item: { type: 'string', description: '무엇에 쓰나, 예: Kling 5초 클립 2개' },
          amount: { type: 'string', description: '금액, 예: 크레딧 200 (약 3,000원)' },
          why: { type: 'string', description: '왜 필요한지 한 줄' },
          project: { type: 'string', description: '지시문에 적힌 프로젝트 id' },
        },
        required: ['item', 'amount', 'why'],
      },
      isDeferred: false,
    })
    // 1초마다 띠의 경과 시간을 다시 그려요(렌더 중일 때만 값이 바뀌어요).
    $.clock.every(1000, () => {
      void (async () => {
        const p = await active($)
        if (p?.phase === 'running' && (p.progress || p.qaRunning)) await update($, tick, n => n + 1)
      })()
    })
    const started = await next(e)
    // 마켓플레이스로 설치한 뒤 처음 켜졌으면, 영상 도구 준비물(파이썬 환경·모델·패키지)을 뒤에서 깔아요.
    void prepare($, true).catch(() => undefined)
    return started
  })

  // 턴이 끝났을 때: 완성 전이면 보드를 ⏸ 멈춤으로, 영상 이야기였는데 시작하지 않았으면 그때 제안.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) return r
    const p = await active($)
    if (p && p.phase === 'running' && !p.spends.some(s => s.status === 'pending')) {
      const why = e.reason === 'aborted' ? '중간에 멈췄어요' : e.reason === 'error' ? '오류로 멈췄어요' : 'Claude 가 답을 마치고 기다려요'
      await patch($, p.id, x => ({ ...x, paused: why, progress: undefined }))
    }
    const sug = await read($, suggestion)
    const now = await $.clock.now()
    const last = await read($, lastToastAt)
    if (sug && !(p && p.phase === 'running') && (last === 0 || now - last > 5 * 60_000)) {
      await update($, lastToastAt, () => now)
      $.ui.toast(`🎬 영상 이야기 같아요 · 영상 감독실 진행 보드로 할까요? ${BAND_KEY} 또는 /video`, { timeoutMs: 8000 })
    }
    return r
  }).catch(($, e, next) => next(e))

  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    return { sections: [...out.sections, { id: `${PLUGIN}:guidance`, text: GUIDANCE, scope: 'session' }] }
  })

  // 영상 이야기가 보이면 토스트로 제안하고, 띠에서 9 한 번으로 카드를 열 수 있게 해 둬요.
  on('prompt.submit', async ($, e, next) => {
    const text = typeof e.text === 'string' ? e.text : ''
    if (text && !text.startsWith(TAG) && !text.startsWith('[') && isVideoIntent(text)) {
      const now = await $.clock.now()
      const last = await read($, lastToastAt)
      const p = await active($)
      // 여기서 바로 묻지 않아요: Claude 가 이 턴에 영상 감독실을 시작하면(start) 물을 필요가 없어요.
      // 턴이 끝났는데도 시작하지 않았을 때만 turn.complete 에서 제안해요.
      if (!(p && p.phase === 'running')) await update($, suggestion, () => ({ text, at: now }))
      void last
    }
    const cur = await active($)
    if (cur?.paused) await patch($, cur.id, x => ({ ...x, paused: undefined }))
    return next(e)
  }).catch(($, e, next) => next(e))

  // ---- Claude 가 부르는 도구
  on('tool.call', { tool: 'mcp__video-studio__start' }, async ($, e) => {
    const input = e as unknown as { request?: unknown }
    const text = String(input.request ?? '').trim()
    if (!text) return { deny: 'request 가 필요해요.' }
    const cur = await active($)
    const env = await resolveTools($)
    if (cur && cur.phase === 'running' && cur.request === text)
      return { result: `이미 진행 중인 프로젝트예요.\n${workPrompt(cur, env)}` }
    const now = await $.clock.now()
    const p = newProject(text, now, await home($), false)
    const started = { ...setStage({ ...p, phase: 'running' as const }, 'plan', { status: 'doing' as const }) }
    await addProject($, started)
    await update($, suggestion, () => null)
    await $.process.run(['mkdir', '-p', p.dir])
    void openPane($, false)
    $.ui.toast(`🎬 영상 감독실이 시작했어요 (${TOOLS[p.tool].name}) · ${BAND_KEY} 보드 보기`, { timeoutMs: 6000 })
    return {
      result: `${workPrompt(started, env)}\n\n(영상 감독실이 고른 도구: ${TOOLS[p.tool].name} — ${p.reason} 사용자가 다른 도구를 원했다면 그 도구로 바꿔도 돼요.)`,
    }
  })

  on('tool.call', { tool: 'mcp__video-studio__report' }, async ($, e) => {
    const i = e as unknown as {
      stage?: StageKey
      status?: 'doing' | 'done' | 'fail' | 'skip'
      note?: string
      artifact?: string
      progress_label?: string
      progress_pct?: number
      expected_seconds?: number
      next_action?: string
      project?: string
    }
    const p = await target($, i.project)
    if (!p) return { result: '진행 중인 영상 감독실 프로젝트가 없어요. 먼저 mcp__video-studio__start 를 불러요.' }
    if (!i.stage || !STAGES.some(s => s.key === i.stage)) return { deny: 'stage 는 plan·make·sound·check·done 중 하나예요.' }
    const now = await $.clock.now()
    const status = i.status ?? 'doing'
    await patch($, p.id, x => {
      let y = { ...setStage(x, i.stage!, { status, note: i.note?.slice(0, 200), artifact: i.artifact }), paused: undefined }
      if (i.progress_label) y = { ...y, progress: { label: i.progress_label.slice(0, 40), pct: i.progress_pct, since: now } }
      else if (status !== 'doing') y = { ...y, progress: undefined }
      if (typeof i.next_action === 'string') y = { ...y, nextAction: i.next_action.trim() ? i.next_action.slice(0, 120) : undefined }
      if (i.stage === 'done' && status === 'done') y = { ...y, phase: 'done', progress: undefined, nextAction: undefined }
      if (i.stage === 'done' && status === 'fail') y = { ...y, phase: 'failed', progress: undefined }
      if (i.artifact && /\.(mp4|mov|webm)$/i.test(i.artifact)) y = { ...y, video: i.artifact }
      return y
    })
    const video = i.artifact && /\.(mp4|mov|webm)$/i.test(i.artifact) ? i.artifact : undefined
    // 검사 단계에 영상이 오면 바로 자동 검사(같은 도구 호출 안에서 기다려요: $ 호출은 시간 예산에 안 들어가요).
    if (i.stage === 'check' && status === 'doing' && video) {
      if (!(await $.fs.exists(video))) return { result: `${video} 파일이 없어요. 렌더를 먼저 끝내요.` }
      return { result: await runChecks($, p.id, video) }
    }
    // 검사 없이 완성으로 오면 한 번은 검사해요.
    if (i.stage === 'done' && status === 'done' && video && !p.qa && (await $.fs.exists(video))) {
      const text = await runChecks($, p.id, video)
      await patch($, p.id, x => ({ ...x, phase: 'done' }))
      return { result: `${text}\n(완성 전에 검사를 한 번 돌렸어요.)` }
    }
    return { result: `보드에 올렸어요: ${i.stage} ${status}.` }
  })

  on('tool.call', { tool: 'mcp__video-studio__ask_spend' }, async ($, e) => {
    const i = e as unknown as { item?: string; amount?: string; why?: string; project?: string }
    const p = await target($, i.project)
    if (!p) return { result: '진행 중인 프로젝트가 없어요.' }
    if (p.auto) {
      await patch($, p.id, x => ({
        ...x,
        spends: [...x.spends, { id: x.spends.length + 1, item: String(i.item), amount: String(i.amount), why: String(i.why), status: 'denied' }],
      }))
      return { result: '무인 모드라 돈 드는 단계는 쓸 수 없어요. 무료 대안으로 진행해요.' }
    }
    await patch($, p.id, x => ({
      ...x,
      spends: [
        ...x.spends,
        { id: x.spends.length + 1, item: String(i.item ?? '').slice(0, 80), amount: String(i.amount ?? '').slice(0, 60), why: String(i.why ?? '').slice(0, 160), status: 'pending' },
      ],
    }))
    $.ui.toast(`💰 허락이 필요해요: ${i.item} ${i.amount} · ${BAND_KEY} 로 보드 열기`, { timeoutMs: 10000 })
    void openPane($, false)
    return {
      result: `사용자에게 허락을 요청했어요. 패널에서 [허락]을 누르면 "${TAG} 허락" 메시지가 와요. 그때까지 이 서비스를 쓰지 말고, 무료로 할 수 있는 다른 일을 하거나 턴을 끝내요.`,
    }
  })

  // ---- 비용 문: 진행 중 프로젝트에서 허락 없이 돈 드는 호출을 막아요.
  on('tool.call', async ($, e, next) => {
    const p = await active($)
    if (p && p.phase === 'running') {
      const paid = PAID_TOOL.test(String(e.tool)) || (e.tool === 'Bash' && PAID_BASH.test(e.command))
      if (paid && !p.spends.some(s => s.status === 'allowed'))
        return {
          deny: `${TAG} 비용 문: 돈 드는 호출이에요. mcp__video-studio__ask_spend 로 금액을 올리고 사용자가 [허락]을 누를 때까지 기다려요.`,
        }
      // 렌더 감지: 띠에 경과 시간을 보여 줘요.
      if (e.tool === 'Bash' && RENDER_BASH.test(e.command)) {
        const now = await $.clock.now()
        await patch($, p.id, x => (x.progress ? x : { ...x, progress: { label: '렌더 중', since: now } }))
        const r = await next(e)
        await patch($, p.id, x => (x.progress?.label === '렌더 중' ? { ...x, progress: undefined } : x))
        return r
      }
    }
    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${TAG} 비용 문을 확인하지 못해 막았어요. 다시 시도해요.` }))

  // ---- 슬래시 명령
  on('command.run', { command: 'video' }, async ($, e) => {
    let text = (e.args ?? '').trim()
    const auto = /^--auto\b/.test(text)
    if (auto) text = text.replace(/^--auto\b/, '').trim()
    if (!text) {
      await update($, activeId, () => HOME_VIEW)
      await openPane($)
      return {}
    }
    const p = newProject(text, await $.clock.now(), await home($), auto)
    await addProject($, p)
    if (auto) {
      await start($, p.id, true)
      return { text: `${TAG} ${TOOLS[p.tool].name} 로 무인 진행을 시작했어요. 결과 폴더: ${p.dir}` }
    }
    await openPane($)
    return {}
  })

  on('command.run', { command: 'video-status' }, async $ => {
    const p = await active($)
    if (!p) return { text: '진행 중인 영상 감독실 프로젝트가 없어요. /video 로 시작해요.' }
    const rows = STAGES.map(s => `${ICON[p.stages[s.key].status]} ${s.label} ${p.stages[s.key].note ?? ''}`)
    const q = [qaBadge(p.qa), earBadge(p.ear, p.earSkipped)].filter(Boolean).join(' · ')
    return { text: [`🎬 ${p.request}`, `도구 ${TOOLS[p.tool].name} · 폴더 ${p.dir}`, ...rows, q].filter(Boolean).join('\n') }
  })

  on('command.run', { command: 'video-qa' }, async ($, e) => {
    const file = (e.args ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/^~(?=\/)/, await home($))
    if (!file) return { text: '사용법: /video-qa <영상 파일 경로>' }
    if (!(await $.fs.exists(file))) return { text: `파일이 없어요: ${file}` }
    const now = await $.clock.now()
    const base = newProject(`검사: ${file.split('/').pop()}`, now, await home($), false)
    const p: Project = {
      ...base,
      tool: 'video-director',
      phase: 'running',
      id: slugFor(now, 'video-director'),
      dir: `${await home($)}/video-studio/projects/${slugFor(now, 'video-director')}`,
      stages: { plan: { status: 'skip' }, make: { status: 'skip' }, sound: { status: 'skip' }, check: { status: 'todo' }, done: { status: 'todo' } },
    }
    await addProject($, p)
    await $.process.run(['mkdir', '-p', p.dir])
    void openPane($, false)
    const text = await runChecks($, p.id, file)
    await patch($, p.id, x => setStage({ ...x, phase: 'done' }, 'done', { status: 'done', note: '검사만 했어요' }))
    return { text }
  })

  on('command.run', { command: 'video-setup' }, async ($, e) => {
    if ((e.args ?? '').trim() === 'run') {
      const msg = await prepare($, false)
      return { text: msg }
    }
    return { text: `${await prepReport($)}\n\n지금 다시 준비하려면: /video-setup run` }
  })

  on('command.run', { command: 'video-open' }, async $ => {
    const p = await active($)
    if (!p) return { text: '열 프로젝트가 없어요.' }
    await $.process.run(['mkdir', '-p', p.dir])
    await $.process.run(['open', p.dir])
    const huashu = installPath(await installedPlugins($), 'huashu-motion')
    const om = huashu ? `${huashu}/skills/huashu-motion/bin/om` : '~/.claude/skills/huashu-motion/bin/om'
    const studio = p.tool === 'huashu-motion' ? `\n프레임에 댓글 달며 고치기: 프로젝트 폴더에서 \`${om} studio\`` : ''
    return { text: `결과 폴더를 열었어요: ${p.dir}${studio}` }
  })

  // ---- 입력창 위 띠
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    const p = await active($)
    const sug = await read($, suggestion)
    const pr = await read($, prep)
    await read($, tick)
    const now = await $.clock.now()
    const cols = e.props.bodyColumns ?? 80
    const { Box, Button } = $.ui.resolve(e)
    let label = ''
    let press: (() => void) | undefined
    if (p && (p.phase !== 'done' || now - p.createdAt < 6 * 3600_000) && p.phase !== 'failed') {
      label = bandLine(p, now, cols)
      press = () => void (p.phase === 'card' ? start($, p.id).then(() => openPane($, false)) : openPane($))
    } else if (pr.running) {
      const cur = pr.current ? pr.steps[pr.current] : undefined
      label = clipWidth(`🎬 영상 감독실 · 영상 도구 준비 중${cur ? ` · ${cur.msg}` : ''}`, cols - 4)
      press = () => void openPane($)
    } else if (sug && now - sug.at < 3 * 60_000) {
      label = clipWidth(`🎬 영상 감독실로 진행할까요? "${sug.text}"`, cols - 4)
      press = () =>
        void (async () => {
          const q = await read($, suggestion)
          if (!q) return
          await addProject($, newProject(q.text, await $.clock.now(), await home($), false))
          await update($, suggestion, () => null)
          await openPane($)
        })()
    }
    if (!label || !press) return below
    return (
      <Box flexDirection="column">
        <Button key="video-studio-band" plain hotkey={BAND_KEY} label={label} onPress={press} />
        {below}
      </Box>
    )
  })

  // ---- 옆 패널
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Input = 'Input' in els ? els.Input : undefined
    const Image = 'Image' in els ? els.Image : undefined
    const cols = Math.max(30, e.props.bodyColumns ?? 60)
    const list = await read($, projects)
    const p = await active($)
    await read($, tick)
    const now = await $.clock.now()

    // 첫 화면: 행동 하나.
    if (!p) {
      const recent = [...list].reverse().slice(0, 3)
      const d = await read($, draft)
      const pr = await read($, prep)
      const prepLine = pr.running
        ? `◐ 영상 도구 준비 중${pr.current && pr.steps[pr.current] ? `: ${pr.steps[pr.current].msg}` : ''}`
        : pr.ok === false
          ? `✗ 영상 도구 일부를 준비하지 못했어요 · ${prepSummary(pr.steps)} · /video-setup`
          : ''
      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>어떤 영상이 필요해요?</Text>
          {prepLine ? <Text dimColor>{clipWidth(prepLine, cols)}</Text> : null}
          {Input ? (
            <Input
              key="ask"
              autoFocus
              placeholder="예: 우리 앱 홍보 릴스 20초"
              value={d}
              submitLabel="추천 받기"
              onInput={t => void update($, draft, () => t)}
              onSubmit={t =>
                void (async () => {
                  if (!t.trim()) return
                  await addProject($, newProject(t, await $.clock.now(), await home($), false))
                  await update($, draft, () => '')
                })()
              }
            />
          ) : (
            <Text dimColor>/video 뒤에 원하는 영상을 적어 주세요.</Text>
          )}
          {recent.length > 0 && (
            <Box flexDirection="column">
              <Text dimColor>최근 프로젝트</Text>
              {recent.map(r => (
                <Button key={`recent-${r.id}`} plain onPress={() => void update($, activeId, () => r.id)}>
                  {clipWidth(`${r.phase === 'done' ? '●' : r.phase === 'card' ? '○' : '◐'} ${r.request}`, cols - 12)}{' '}
                  <Text dimColor>{TOOLS[r.tool].name}</Text>
                </Button>
              ))}
            </Box>
          )}
        </Box>
      )
    }

    // 추천 카드.
    if (p.phase === 'card') {
      const info = TOOLS[p.tool]
      const warn = koreanWarnings(p.tool, p.lang, p.needsVoice)
      const voices = p.needsVoice ? voiceOptions(p.tool, p.lang) : []
      const costW = Math.min(30, Math.max(...info.costs.map(c => displayWidth(c.item))) + 2)
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>{clipWidth(`요청: ${p.request}`, cols)}</Text>
          <Box flexDirection="column">
            <Text bold color="cyan">
              추천 {info.name}
            </Text>
            <Text>{p.reason}</Text>
            {/* 좁은 화면에서도 시작 버튼이 잘리지 않게, 요약 한 줄과 버튼을 위에 둬요. */}
            <Text>
              {clipWidth(
                `${minutesText(p.tool)} · ${p.aspect} ${sizeFor(p.aspect)}${p.seconds ? ` · ${p.seconds}초` : ''} · ${
                  info.costs.some(c => c.paid) ? '무료 기본 (유료는 허락할 때만)' : '무료'
                }`,
                cols,
              )}
            </Text>
          </Box>
          {warn.map(w => (
            <Text color="yellow">⚠ {w}</Text>
          ))}
          {voices.length > 0 && (
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              <Text dimColor>목소리</Text>
              {voices.map((v, n) => (
                <Button
                  key={`voice-${v}`}
                  hotkey={String(n + 3)}
                  label={`${n + 3} ${VOICE_LABEL[v]}`}
                  variant={p.voice === v ? 'primary' : undefined}
                  onPress={() => void patch($, p.id, x => ({ ...x, voice: v }))}
                />
              ))}
            </Box>
          )}
          <Box flexDirection="row" gap={1}>
            <Button key="start" hotkey="1" variant="primary" label="1 시작" onPress={() => void start($, p.id)} />
            <Button key="other" hotkey="2" label="2 다른 도구" onPress={() => void patch($, p.id, cycleTool)} />
            <Button
              key="cancel"
              hotkey="8"
              label="8 취소"
              onPress={() =>
                void (async () => {
                  await update($, projects, l => l.filter(x => x.id !== p.id))
                  await update($, activeId, () => HOME_VIEW)
                  await save($)
                })()
              }
            />
          </Box>
          <Box flexDirection="column">
            <Text>
              {padWidth('결과', 6)}
              {info.makes}
            </Text>
            {info.costs.map(c => (
              <Text color={c.paid ? 'yellow' : undefined}>
                {padWidth(c === info.costs[0] ? '비용' : '', 6)}
                {padWidth(clipWidth(c.item, costW), costW)}
                {c.amount}
              </Text>
            ))}
          </Box>
        </Box>
      )
    }

    // 진행 보드.
    const pending = p.spends.filter(s => s.status === 'pending')
    const noteW = Math.max(10, cols - 10)
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>{clipWidth(`🎬 ${p.request}`, cols)}</Text>
          <Text dimColor>{clipWidth(`${TOOLS[p.tool].name} · ${p.aspect} · ${p.dir.replace(/^\/Users\/[^/]+/, '~')}`, cols)}</Text>
        </Box>
        <Box flexDirection="column">
          {STAGES.map(s => {
            const st = p.stages[s.key]
            const icon = p.paused && st.status === 'doing' ? '⏸' : ICON[st.status]
            return (
              <Text color={p.paused && st.status === 'doing' ? undefined : COLOR[st.status]}>
                {icon} {padWidth(s.label, 5)}
                <Text dimColor>{st.note ? clipWidth(st.note, noteW) : ''}</Text>
              </Text>
            )
          })}
        </Box>
        {p.progress && (
          <Text color="yellow">
            {progressPct(p, now) !== undefined ? `${bar(progressPct(p, now)!, 12)} ${progressPct(p, now)}% · ` : ''}
            {p.progress.label} {Math.round((now - p.progress.since) / 1000)}초
          </Text>
        )}
        {p.paused && <Text color="yellow">{clipWidth(`⏸ 멈춤: ${p.paused} · 이어 하려면 "계속해"라고 보내요`, cols)}</Text>}
        {p.qaRunning && <Text color="yellow">◐ 자동 검사 중: qa_video → earshot critique (약 1~2분)</Text>}
        {(p.qa || p.ear || p.earSkipped) && (
          <Box flexDirection="column">
            <Text bold>
              검사 {qaBadge(p.qa)} {p.ear || p.earSkipped ? `· ${earBadge(p.ear, p.earSkipped)}` : ''}
            </Text>
            {p.qa?.failures.slice(0, 3).map(f => (
              <Text color="red">✗ {clipWidth(f, cols - 2)}</Text>
            ))}
            {p.ear?.top && <Text dimColor>{clipWidth(`소리: ${p.ear.top}`, cols)}</Text>}
          </Box>
        )}
        {Image && p.qa?.sheet && (
          <Image key="sheet" source={{ file: p.qa.sheet, format: 'png' }} columns={Math.min(cols, 60)} rows={8} alt="휴대폰 크기 접촉 시트" />
        )}
        {pending.map(s => (
          <Box flexDirection="column">
            <Text color="yellow" bold>
              💰 {s.item} · {s.amount}
            </Text>
            <Text dimColor>{s.why}</Text>
            <Box flexDirection="row" gap={1}>
              <Button
                key={`allow-${s.id}`}
                hotkey="1"
                variant="primary"
                label="1 허락"
                onPress={() =>
                  void (async () => {
                    await patch($, p.id, x => ({ ...x, spends: x.spends.map(y => (y.id === s.id ? { ...y, status: 'allowed' as const } : y)) }))
                    await $.prompt.submit({ text: `${TAG} 허락: 사용자가 "${s.item} (${s.amount})" 사용을 허락했어요. 이어서 진행해요.` })
                  })()
                }
              />
              <Button
                key={`deny-${s.id}`}
                hotkey="2"
                label="2 거절"
                onPress={() =>
                  void (async () => {
                    await patch($, p.id, x => ({ ...x, spends: x.spends.map(y => (y.id === s.id ? { ...y, status: 'denied' as const } : y)) }))
                    await $.prompt.submit({ text: `${TAG} 거절: 사용자가 "${s.item}" 비용을 거절했어요. 무료 대안으로 진행해요.` })
                  })()
                }
              />
            </Box>
          </Box>
        ))}
        {p.nextAction && pending.length === 0 && <Text color="cyan">{clipWidth(`다음에 할 일: ${p.nextAction}`, cols)}</Text>}
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          <Button
            key="open-dir"
            hotkey="3"
            label="3 결과 폴더"
            onPress={() => void $.process.run(['/bin/sh', '-c', `mkdir -p ${sh(p.dir)} && open ${sh(p.dir)}`])}
          />
          {p.video && !p.qaRunning && (
            <Button key="recheck" hotkey="4" label="4 다시 검사" onPress={() => void runChecks($, p.id, p.video!)} />
          )}
          <Button key="new" hotkey="5" label="5 새 영상" onPress={() => void update($, activeId, () => HOME_VIEW)} />
        </Box>
      </Box>
    )
  })
}
