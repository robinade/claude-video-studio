import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { bandLine, newProject, parseEar, parseQa, PAID_BASH, PAID_TOOL, pickActive, RENDER_BASH } from './register'
import { displayWidth } from './text'
import { PREP_VERSION, installPath, parsePrepLine, prepSummary, scriptDirs, shouldPrepare } from './tools'

const SURFACES = ['terminal', 'desktop'] as const

const PANE = {
  component: 'Pane',
  requestId: 'video-studio',
  props: { title: '영상 감독실', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

// 엔진 아래 세상: 저장소·프롬프트·프로세스(가짜 qa_video·earshot 결과).
const world = async (
  $: Engine,
  on: On,
  surface: (typeof SURFACES)[number],
  opts: { files?: string[]; reads?: Record<string, string> } = {},
) => {
  mock.clock(on)
  const store: Record<string, unknown> = {}
  const submitted: string[] = []
  const ran: string[][] = []
  const files = new Set<string>([...(opts.files ?? []), ...Object.keys(opts.reads ?? {})])
  on('store.get', async ($, e) => ({ value: store[e.key] }))
  on('store.set', async ($, e) => ((store[e.key] = e.value), { value: undefined }))
  on('prompt.submit', async ($, e) => (submitted.push(e.text), { text: e.text }))
  on('tool.register', async ($, e) => ({ value: { tool: `mcp__video-studio__${e.name}` } }))
  on('command.register', async ($, e) => ({ value: { command: e.name } }))
  on('session.start', async ($, e) => ({ cwd: e.cwd }))
  on('prompt.compose', async () => ({ sections: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('env.get', async () => ({ value: '/Users/tester' }))
  on('session.id', async () => ({ value: 'sess-1' }))
  on('fs.exists', async ($, e) => ({ value: files.has(e.path) || /final\.mp4$/.test(e.path) }))
  on('fs.read', async ($, e) => ({
    value: opts.reads?.[e.path] !== undefined
      ? opts.reads[e.path]
      : /report\.json$/.test(e.path)
      ? JSON.stringify({ checks: [{ level: 'PASS', check: 'frame 0', detail: 'ok' }, { level: 'WARN', check: 'pops', detail: 'x' }] })
      : JSON.stringify({ verdict: 'close', score: 0.91, critical_issues: 0, actions: [] }),
  }))
  on('process.run', async ($, e) => {
    ran.push([...e.argv])
    const a = e.argv.join(' ')
    if (/qa_video\.py/.test(a)) files.add(`${e.argv[e.argv.indexOf('--out') + 1]}/report.json`)
    if (/earshot critique/.test(a)) files.add(`${e.argv[e.argv.indexOf('--out') + 1]}`)
    if (/ffmpeg/.test(a)) files.add(a.match(/'([^']+phone_sheet\.png)'/)?.[1] ?? '')
    return { value: { exitCode: 0, stdout: /ffprobe/.test(a) ? 'audio\n' : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', async () => ({ result: 'ran' }))
  await $.session.start({ cwd: '/work/app', surface, isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'video-studio', surface, ...PANE })
  return { store, submitted, ran, ui }
}

for (const surface of SURFACES) {
  test(`첫 화면은 질문 하나, 입력하면 추천 카드, 시작하면 지시문 (${surface})`, async ($, on) => {
    const { submitted, ui } = await world($, on, surface)
    expect((await ui.find({ type: 'Text', text: /^어떤 영상이 필요해요\?$/ }))?.text).toBe('어떤 영상이 필요해요?')
    // 버튼·메뉴를 늘어놓지 않아요: 최근 프로젝트가 없으면 버튼 0개.
    expect((await ui.findAll({ type: 'Button' })).length).toBe(0)

    await ui.input({ key: 'ask', text: '토스 미니앱 「할 일 메모」 홍보 릴스 20초 만들어줘' })
    expect((await ui.find({ type: 'Text', text: /^추천 huashu-motion$/ }))).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Pretendard/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /무료/ })).toBeDefined()
    expect((await ui.find({ key: 'start' }))?.props.hotkey).toBe('1')

    await ui.press({ key: 'start' })
    expect(submitted.length).toBe(1)
    expect(submitted[0]).toContain('[영상 감독실] 프로젝트')
    expect(submitted[0]).toContain('문제 → 원리 → 앱 이름 → CTA')
    expect(submitted[0]).toContain('huashu-motion')
    expect(await ui.find({ type: 'Text', text: /계획/ })).toBeDefined()
    await ui.unmount()
  })

  test(`보고 도구가 보드를 바꾸고, 검사 단계에서 자동 검사가 돌아요 (${surface})`, async ($, on) => {
    const { ran, ui } = await world($, on, surface)
    await $.tool.call({ tool: 'mcp__video-studio__start', request: '앱 홍보 릴스 20초' })
    await $.tool.call({ tool: 'mcp__video-studio__report', stage: 'make', status: 'doing', note: '장면 4개 그리는 중', progress_label: '렌더 중' })
    expect(await ui.find({ type: 'Text', text: /렌더 중/ })).toBeDefined()
    const r = await $.tool.call({
      tool: 'mcp__video-studio__report',
      stage: 'check',
      status: 'doing',
      artifact: '/Users/tester/video-studio/projects/x/final.mp4',
    })
    expect(JSON.stringify(r)).toContain('통과 1 · 주의 1 · 실패 0')
    expect(JSON.stringify(r)).toContain('close')
    expect(ran.some(a => a.join(' ').includes('qa_video.py'))).toBe(true)
    expect(ran.some(a => a.join(' ').includes('earshot critique'))).toBe(true)
    expect(await ui.find({ type: 'Text', text: /qa ✓1 ⚠1 ✗0/ })).toBeDefined()
    await ui.unmount()
  })

  test(`비용 문: 허락 전 Kling 호출은 막고, 허락하면 지나가요 (${surface})`, async ($, on) => {
    const { submitted, ui } = await world($, on, surface)
    await $.tool.call({ tool: 'mcp__video-studio__start', request: '실사 배우가 카페에서 웃는 장면 5초' })
    const blocked = await $.tool.call({ tool: 'mcp__kling__text_to_video' } as never)
    expect(JSON.stringify(blocked)).toContain('비용 문')
    await $.tool.call({ tool: 'mcp__video-studio__ask_spend', item: 'Kling 5초 클립 1개', amount: '크레딧 100', why: '실사 장면' })
    expect(await ui.find({ type: 'Text', text: /Kling 5초 클립 1개 · 크레딧 100/ })).toBeDefined()
    await ui.press({ key: 'allow-1' })
    expect(submitted.at(-1)).toContain('[영상 감독실] 허락')
    const passed = await $.tool.call({ tool: 'mcp__kling__text_to_video' } as never)
    expect(JSON.stringify(passed)).not.toContain('비용 문')
    await ui.unmount()
  })
}

test('영상 이야기인데 Claude 가 시작하지 않고 턴이 끝나면 그때 토스트로 제안해요', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', async ($, e) => (toasts.push(e.text), { value: undefined }))
  on('turn.complete', async () => ({ text: '' }))
  await world($, on, 'terminal')
  await $.prompt.submit({ text: '우리 앱 데모 영상 하나 만들어 줘' } as never)
  expect(toasts.length).toBe(0)
  await $.turn.complete({ reason: 'answer', answer: '', durationMs: 1, isAborted: false, turnId: 't1' } as never)
  expect(toasts.some(t => t.includes('진행 보드로 할까요?'))).toBe(true)
})

test('이미 시작했으면 "진행할까요?" 대신 "시작했어요", 멈추면 보드가 ⏸', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', async ($, e) => (toasts.push(e.text), { value: undefined }))
  on('turn.complete', async () => ({ text: '' }))
  const { ui } = await world($, on, 'terminal')
  await $.prompt.submit({ text: '할 일 메모 앱 홍보 릴스 만들어 줘' } as never)
  await $.tool.call({ tool: 'mcp__video-studio__start', request: '할 일 메모 앱 홍보 릴스 만들어 줘' })
  await $.turn.complete({ reason: 'aborted', answer: '', durationMs: 1, isAborted: true, turnId: 't1' } as never)
  expect(toasts.some(t => t.includes('시작했어요'))).toBe(true)
  expect(toasts.some(t => t.includes('할까요?'))).toBe(false)
  expect(await ui.find({ type: 'Text', text: /⏸ 멈춤: 중간에 멈췄어요/ })).toBeDefined()
  await ui.unmount()
})

test('띠 한 줄은 한글 2칸 기준으로 폭 안에 들어가요 (80·120칸)', () => {
  const p = newProject('토스 미니앱 「할 일 메모」 홍보 릴스 20초, 아주 아주 긴 요청 문장을 일부러 길게 적어 봐요', 0, '/Users/t', false)
  const running = {
    ...p,
    phase: 'running' as const,
    stages: { ...p.stages, plan: { status: 'done' as const }, make: { status: 'doing' as const } },
    progress: { label: '렌더 중', since: 0 },
    nextAction: '편집기에서 3번 장면의 글자 크기를 확인해 주세요 그리고 아주 긴 다음 할 일',
  }
  for (const cols of [80, 120]) {
    for (const x of [p, running]) {
      const line = bandLine(x, 42_000, cols)
      // 터미널이 앞에 그리는 "9: " 3칸까지 더해도 폭 안.
      expect(displayWidth(line) + 3 <= cols).toBe(true)
      expect(line.includes('9 열기')).toBe(false)
    }
  }
  expect(bandLine(running, 42_000, 120)).toContain('제작 중 · 5단계 중 1단계 끝')
  expect(bandLine(running, 42_000, 120)).toContain('렌더 중 42초')
})

test('qa_video·earshot 결과 읽기', () => {
  const qa = parseQa(JSON.stringify({ checks: [{ level: 'FAIL', check: 'hook text', detail: 'too small' }, { level: 'PASS', check: 'a', detail: '' }] }), 'r.md')
  expect([qa.pass, qa.warn, qa.fail]).toEqual([1, 0, 1])
  expect(qa.failures[0]).toBe('hook text: too small')
  const ear = parseEar(JSON.stringify({ verdict: 'needs work', score: 0.8, critical_issues: 1, actions: [{ weight: 'critical', action: 'realness' }] }))
  expect(ear).toEqual({ verdict: 'needs work', score: 0.8, critical: 1, top: 'realness' })
})

test('돈 드는 호출과 렌더 명령을 알아봐요', () => {
  expect(PAID_TOOL.test('mcp__kling__image_to_video')).toBe(true)
  expect(PAID_TOOL.test('mcp__kling__query_tasks')).toBe(false)
  expect(PAID_BASH.test('curl https://api.elevenlabs.io/v1/text-to-speech')).toBe(true)
  expect(PAID_BASH.test('say -v Yuna 안녕')).toBe(false)
  expect(RENDER_BASH.test('~/.claude/skills/huashu-motion/bin/om render scene.html -o out.mp4')).toBe(true)
  expect(RENDER_BASH.test('ls -la')).toBe(false)
})

test('다른 창(세션)의 진행 중 프로젝트는 이어받지 않아요', () => {
  const mine = { ...newProject('릴스', 1, '/h', true), id: 'a', phase: 'running' as const, sessionId: 's1' }
  const other = { ...newProject('데모', 2, '/h', true), id: 'b', phase: 'running' as const, sessionId: 's2' }
  expect(pickActive([mine, other], '', 's1')?.id).toBe('a')
  expect(pickActive([mine, other], '', 's3')).toBe(undefined)
  expect(pickActive([mine, other], 'b', 's1')?.id).toBe('b')
  expect(pickActive([mine, other], '-', 's1')).toBe(undefined)
})

test('보고에 project 를 주면 지금 창과 상관없이 그 프로젝트에 붙어요', async ($, on) => {
  const { ui } = await world($, on, 'terminal')
  await $.tool.call({ tool: 'mcp__video-studio__start', request: '앱 홍보 릴스 20초' })
  await $.tool.call({ tool: 'mcp__video-studio__start', request: '영어 설명 영상 30초 English explainer' })
  const r = await $.tool.call({ tool: 'mcp__video-studio__report', stage: 'make', status: 'doing', note: '첫 프로젝트 보고', project: 'nope' } as never)
  expect(JSON.stringify(r)).toContain('보드에 올렸어요')
  await ui.unmount()
})

// ---- 영상 도구 설치 위치·첫 실행 준비
const INSTALLED = '/Users/tester/plugins/installed_plugins.json'
const installed = (names: Record<string, string>) =>
  JSON.stringify({ version: 2, plugins: Object.fromEntries(Object.entries(names).map(([n, p]) => [`${n}@claude-video-studio`, [{ scope: 'user', installPath: p }]])) })
const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 5))
}

test('도구 위치 찾기·준비 줄 읽기', () => {
  const inst = JSON.parse(installed({ 'video-director': '/cache/vd' }))
  expect(installPath(inst, 'video-director')).toBe('/cache/vd')
  expect(installPath(inst, 'earshot')).toBe(undefined)
  expect(installPath(undefined, 'earshot')).toBe(undefined)
  expect(scriptDirs('/h', '/cache/vd')[0]).toBe('/cache/vd/video-director/scripts')
  expect(scriptDirs('/h').at(-1)).toBe('/h/video-studio/vendor/video-director/video-director/scripts')
  expect(parsePrepLine('@ earshot doing 소리 검사 도구 설치 (약 1.5GB)')).toEqual({ step: 'earshot', status: 'doing', msg: '소리 검사 도구 설치 (약 1.5GB)' })
  expect(parsePrepLine('Collecting torch')).toBe(undefined)
  expect(prepSummary({ py: { status: 'done', msg: '' }, ffmpeg: { status: 'skip', msg: '' }, earshot: { status: 'fail', msg: '' } })).toBe('새로 설치 1 · 이미 있음 1 · 실패 1')
  const now = Date.parse('2026-11-11T12:00:00Z')
  expect(shouldPrepare(undefined, now)).toBe(true)
  expect(shouldPrepare({ version: PREP_VERSION, ok: true, at: '2026-11-11T11:00:00Z' }, now)).toBe(false)
  expect(shouldPrepare({ version: PREP_VERSION, ok: false, at: '2026-11-11T11:00:00Z' }, now)).toBe(false)
  expect(shouldPrepare({ version: PREP_VERSION, ok: false, at: '2026-11-11T01:00:00Z' }, now)).toBe(true)
  expect(shouldPrepare({ version: PREP_VERSION - 1, ok: true, at: '2026-11-11T11:00:00Z' }, now)).toBe(true)
})

test('마켓플레이스로 설치했으면 첫 세션에 영상 도구 준비를 뒤에서 돌리고 패널에 보여 줘요', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', async ($, e) => (toasts.push(e.text), { value: undefined }))
  const spawned: { argv: string[]; env?: Record<string, string> }[] = []
  let release: () => void = () => undefined
  const gate = new Promise<void>(r => (release = r))
  on('process.spawn', async function* ($, e) {
    spawned.push({ argv: [...e.argv], env: e.env })
    yield { stream: 'stdout' as const, text: '@ py doing 검사용 파이썬 패키지(numpy·Pillow) 설치\n' }
    await gate
    yield { stream: 'stdout' as const, text: '@ py done 준비됐어요\n@ earshot skip 이미 있어요\n@ all done true\n' }
    return { value: { code: 0, signal: null } }
  } as never)
  const { ui } = await world($, on, 'terminal', {
    reads: { [INSTALLED]: installed({ 'video-studio': '/cache/vs', earshot: '/cache/earshot', reanimate: '/cache/re' }) },
  })
  await flush()
  expect(spawned.length).toBe(1)
  expect(spawned[0].argv.join(' ')).toContain('setup/prepare.sh')
  expect(spawned[0].env?.EARSHOT_ROOT).toBe('/cache/earshot')
  expect(spawned[0].env?.REANIMATE_ROOT).toBe('/cache/re')
  expect(spawned[0].env?.VS_TOOLS).toBe('/Users/tester/video-studio/tools')
  expect(await ui.find({ type: 'Text', text: /영상 도구 준비 중: 검사용 파이썬/ })).toBeDefined()
  release()
  await flush()
  expect(toasts.some(t => t.includes('영상 도구 준비 끝') && t.includes('새로 설치 1 · 이미 있음 1 · 실패 0'))).toBe(true)
  expect(await ui.find({ type: 'Text', text: /영상 도구 준비 중/ })).toBe(undefined)
  await ui.unmount()
})

test('--plugin-dir 로 띄웠으면(설치 기록 없음) 자동 준비를 돌리지 않아요', async ($, on) => {
  const spawned: string[][] = []
  on('process.spawn', async function* ($, e) {
    spawned.push([...e.argv])
    return { value: { code: 0, signal: null } }
  } as never)
  const { ui } = await world($, on, 'terminal')
  await flush()
  expect(spawned.length).toBe(0)
  await ui.unmount()
})

test('자동 검사는 마켓플레이스로 설치한 video-director 의 qa_video.py 를 써요', async ($, on) => {
  const { ran, ui } = await world($, on, 'terminal', {
    reads: { [INSTALLED]: installed({ 'video-director': '/cache/vd' }) },
    files: ['/cache/vd/video-director/scripts/qa_video.py'],
  })
  await $.tool.call({ tool: 'mcp__video-studio__start', request: '앱 홍보 릴스 20초' })
  await $.tool.call({ tool: 'mcp__video-studio__report', stage: 'check', status: 'doing', artifact: '/Users/tester/video-studio/projects/x/final.mp4' })
  expect(ran.some(a => a.includes('/cache/vd/video-director/scripts/qa_video.py'))).toBe(true)
  await ui.unmount()
})
