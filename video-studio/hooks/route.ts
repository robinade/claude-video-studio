// 영상 요청 한 문장 → 만드는 도구 하나. 순수 함수라 판정 스크립트(judge/routing)와 mod 가 같은 코드를 써요.
// 규칙의 근거는 ~/video-studio/docs/02-가이드북.md 의 고르는 순서도예요.

export type ToolId =
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

export const TOOL_IDS: readonly ToolId[] = [
  'huashu-motion',
  'take-one',
  'argo',
  'explainroo',
  'rossark',
  'reanimate',
  'earshot',
  'real-sound',
  'watch',
  'kling',
  'video-director',
]

type Rule = readonly [RegExp, number]

// 띄어쓰기를 지운 소문자 문장에 맞춰요. 한국어 사용자는 띄어쓰기를 자주 빼먹어요.
const RULES: Record<ToolId, readonly Rule[]> = {
  'huashu-motion': [
    [/홍보|런칭|론칭|출시|오픈기념|프로모|promo|launch/, 3],
    [/릴스|쇼츠|숏츠|숏폼|틱톡|tiktok|reels|shorts/, 2],
    [/모션그래픽|모션그래픽스|motiongraphic|키네틱|타이포/, 4],
    [/인트로|아웃트로|오프닝|로고애니|로고모션/, 2],
    [/csv|엑셀|데이터|그래프|차트|통계|매출|가입자|숫자|지표|대시보드/, 3],
    [/자막|이름표|하단자막|로워서드|lowerthird|키워드자막|챕터카드/, 2],
    [/토킹헤드|내가찍은|찍어둔|촬영본|브이로그|인터뷰영상/, 2],
    [/박자|비트|음악에맞|bpm/, 2],
    [/광고영상|광고하나|광고만들/, 1],
    [/한국어내레이션|한국어설명|우리말|내목소리|유나|녹음한/, 2],
  ],
  'take-one': [
    [/이야기|스토리|서사|줄거리|기승전결/, 3],
    [/브랜드필름|브랜드영상|브랜드무비|필름|단편|숏필름|시네마틱|cinematic|영화같/, 4],
    [/뮤직비디오|뮤비|\bmv\b|musicvideo/, 5],
    [/감성|여운|울림|감동|드라마/, 2],
    [/연출|콘티|장면구성|씬|등장인물|주인공/, 2],
    [/최고완성도|퀄리티최고|하이엔드|칸광고|tvc|티비광고|tv광고/, 3],
  ],
  argo: [
    [/실제앱|실제화면|실제로눌|직접눌|눌러가며|클릭해가며|조작하는|조작영상|자동으로눌|자동조작/, 5],
    [/화면녹화|녹화해|녹화된|스크린레코딩|screenrecord/, 3],
    [/데모|시연|사용법|튜토리얼|온보딩|가입부터|가입과정|따라하기|walkthrough|demo/, 3],
    [/playwright|e2e|테스트코드|spec\.ts|자동화테스트/, 5],
    [/웹앱|미니앱|우리앱|내앱|우리서비스|내서비스|localhost|https?:\/\/(?!(www\.)?(youtube|youtu\.be|instagram|tiktok|vimeo))/, 1],
  ],
  explainroo: [
    [/영어|영문|english|미국|해외|글로벌|외국인/, 3],
    [/설명영상|explainer|설명하는영상|개념설명|원리설명|강의|교육영상|해설/, 4],
    [/튜토리얼|가이드영상|howto|알려주는/, 1],
    [/유튜브|youtube/, 1],
  ],
  rossark: [
    [/마스코트|캐릭터|아이콘|이모지|펫|캐릭|mascot/, 3],
    [/앱안|앱속|화면안|화면에서|로딩|대기동작|대기모션|아이들|idle|루프|loop|깜빡|숨쉬|두리번|갸웃|폴짝|반응/, 3],
    [/lottie|로티|svg|reactnative|\brn\b|swiftui|컴포넌트|css애니|웹애니메이션/, 3],
    [/정답이면|오답이면|누르면|탭하면|성공하면|실패하면|완료하면/, 2],
    [/살아움직|살아있는것처럼|움직이게/, 2],
  ],
  reanimate: [
    [/똑같이|그대로베|그대로따|그대로만들|그대로옮|느낌그대로|따라만들|베껴|복제|클론|clone|재현|흉내/, 3],
    [/처럼움직|같은애니|같은모션|그사이트처럼|저사이트|저페이지|그페이지|남의사이트|경쟁사사이트|사이트처럼|랜딩처럼/, 4],
    [/사이트|웹사이트|랜딩|홈페이지|히어로|스크롤|hover|호버|인터랙션|전환효과|트랜지션/, 2],
    [/stripe|apple\.com|linear|vercel|토스홈|\.com|\.io|\.app/, 1],
  ],
  earshot: [
    [/효과음|sfx|사운드이펙트|띠링|뾰로롱|휙|whoosh/, 4],
    [/싱크|타이밍맞|소리가늦|소리가빨|박자가안맞|어긋|컷이랑맞|컷과맞|컷에맞는지|맞는지만/, 4],
    [/음량|볼륨|loudness|lufs|소리가너무|소리크기|소리작|시끄|찢어|클리핑/, 4],
    [/소리검사|오디오검사|사운드검사|소리확인|소리점검|소리괜찮/, 4],
    [/소리|사운드|오디오|audio/, 1],
  ],
  'real-sound': [
    [/실제녹음|진짜소리|실제소리|현장음|필드레코딩|녹음된소리|리얼사운드|자연음|앰비언스/, 5],
    [/freesound|mixkit|저작권없는|무료음원|라이선스|license|음원/, 3],
    [/배경음악|bgm|사운드트랙|soundtrack|음악전체|음악깔|배경음/, 2],
    [/합성같|전자음같|기계음같|싸구려소리|가짜소리/, 3],
  ],
  watch: [
    [/분석|뜯어|해부|파헤|리뷰해|어떻게만들었|왜잘됐|왜터졌|잘된이유|성공요인|비결/, 4],
    [/컷길이|컷수|첫3초|첫삼초|훅구성|구성봐|구성분석|편집점/, 4],
    [/https?:\/\/(www\.|m\.)?(youtube|youtu\.be|instagram|tiktok|vimeo)/, 3],
    [/이영상|저영상|그영상|남의영상|다른사람영상|경쟁사영상|레퍼런스영상|참고영상|이릴스|저릴스|이쇼츠|떡상/, 2],
    [/요약|무슨내용|내용정리|보고알려/, 2],
  ],
  kling: [
    [/실사|실제사람|사람이나오|배우|모델이|인물이|여자가|남자가|아이가|할머니|할아버지|가족이/, 4],
    [/풍경|바다|산|숲|도시야경|드론|항공샷|하늘|노을|해변/, 2],
    [/진짜같|사진같|리얼한|실제같|포토리얼|photoreal|촬영없이|찍지않고|촬영안하고/, 4],
    [/ai영상|ai로영상|생성해|텍스트로영상|이미지로영상|사진을움직|사진움직|클링|kling/, 3],
  ],
  'video-director': [
    [/검사|점검|체크해|체크좀|\bqa\b|품질확인|문제없는지|괜찮은지|이상없는지|확인해줘|봐줘/, 3],
    [/완성본|만든영상|다만든|뽑은영상|렌더한|렌더된|올리기전|업로드전|게시전/, 3],
    [/\.mp4|\.mov|\.webm|파일/, 1],
    [/글자크기|글씨가작|글자가작|안읽|가독|안전영역|가려지|첫프레임|검은화면|번쩍|깜빡거|대비/, 4],
  ],
}

// 같은 점수면 이 순서로 골라요(가이드북의 기본 추천 순서).
const PRIORITY: readonly ToolId[] = [
  'huashu-motion',
  'argo',
  'explainroo',
  'rossark',
  'video-director',
  'earshot',
  'watch',
  'reanimate',
  'real-sound',
  'take-one',
  'kling',
]

export type RouteResult = {
  tool: ToolId
  /** 1등과 2등 점수 차이로 본 확신. 0~1. */
  confidence: number
  scores: Record<ToolId, number>
  alternates: ToolId[]
  /** 판단 근거 한 줄(한국어). */
  reason: string
  lang: 'ko' | 'en'
  aspect: '9:16' | '16:9' | '1:1'
  seconds: number
  needsVoice: boolean
}

export const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, '')

const has = (t: string, re: RegExp) => re.test(t)

export const detectLang = (raw: string): 'ko' | 'en' => {
  const t = normalize(raw)
  if (/영어|영문|english|inenglish|미국사람|해외|외국인|글로벌/.test(t) && !/한국어로|한글로|우리말로/.test(t)) return 'en'
  // 문장 자체가 영어면 영어 영상으로 봐요.
  const hangul = (raw.match(/[가-힣]/g) ?? []).length
  const latin = (raw.match(/[a-zA-Z]/g) ?? []).length
  return hangul === 0 && latin > 12 ? 'en' : 'ko'
}

export const detectAspect = (raw: string): '9:16' | '16:9' | '1:1' => {
  const t = normalize(raw)
  if (/16:9|가로|유튜브|youtube|와이드|발표|피티|ppt/.test(t) && !/쇼츠|shorts|세로/.test(t)) return '16:9'
  if (/1:1|정사각|피드용/.test(t)) return '1:1'
  if (/9:16|세로|릴스|쇼츠|숏츠|틱톡|tiktok|reels|shorts|스토리|인스타|미니앱|앱인토스|모바일/.test(t)) return '9:16'
  return '9:16'
}

export const detectSeconds = (raw: string, tool: ToolId): number => {
  const t = normalize(raw)
  const min = t.match(/(\d+(?:\.\d+)?)분/)
  const sec = t.match(/(\d+)초/)
  if (sec) return Math.min(600, Number(sec[1]))
  if (min) return Math.min(600, Math.round(Number(min[1]) * 60))
  const base: Record<ToolId, number> = {
    'huashu-motion': 20,
    'take-one': 30,
    argo: 30,
    explainroo: 60,
    rossark: 3,
    reanimate: 5,
    earshot: 0,
    'real-sound': 0,
    watch: 0,
    kling: 5,
    'video-director': 0,
  }
  return base[tool]
}

const REASON: Record<ToolId, string> = {
  'huashu-motion': '짧은 홍보·모션그래픽·데이터·자막 영상은 코드로 그려 음악 박자에 맞추는 huashu-motion 이 가장 빨라요.',
  'take-one': '이야기와 연출이 중요한 광고·브랜드 필름은 감독·작가·심사자를 나눠 맡는 take-one 이 맞아요.',
  argo: '실제 앱을 자동으로 눌러 가며 녹화해야 해서 Argo(브라우저 자동 조작 녹화)가 맞아요.',
  explainroo: '영어 설명 영상은 대본·목소리·그림·자막을 한 번에 만드는 explainroo 가 가장 편해요.',
  rossark: '앱 안에 들어갈 캐릭터·마스코트 움직임이라 rossark-motion-skill 이 맞아요.',
  reanimate: '다른 사이트의 움직임을 내 코드로 옮기는 일이라 reanimate 가 맞아요(생김새는 우리 것으로).',
  earshot: '이미 있는 영상의 효과음·싱크·음량은 earshot 으로 "들어서" 숫자로 확인해요.',
  'real-sound': '실제 녹음 음원으로 사운드트랙을 까는 일이라 real-sound(라이선스 확인 포함)가 맞아요.',
  watch: '남의 영상을 보고 배우는 단계라 watch 로 컷·훅·구성을 먼저 뜯어봐요.',
  kling: '사람·풍경 같은 실사 장면은 코드로 못 그려서 Kling(유료)이 필요해요.',
  'video-director': '이미 만든 영상을 기준표로 재는 일이라 video-director 의 qa_video 검사가 맞아요.',
}

export const route = (raw: string): RouteResult => {
  const t = normalize(raw)
  const scores = Object.fromEntries(TOOL_IDS.map(id => [id, 0])) as Record<ToolId, number>
  for (const id of TOOL_IDS) for (const [re, w] of RULES[id]) if (has(t, re)) scores[id] += w

  const lang = detectLang(raw)
  const videoUrl = /https?:\/\/(www\.|m\.)?(youtube|youtu\.be|instagram|tiktok|vimeo)/.test(t)
  const analyzeVerb = has(t, /분석|뜯어|해부|파헤|어떻게만들었|왜잘됐|왜터졌|잘된이유|비결|컷길이|컷이몇|첫3초|구성봐|구성분석|요약|무슨내용|배우고싶|참고하고싶|정리해|훅이뭔|훅분석|뭐가다른|어떤구성/)
  const othersThing = videoUrl || has(t, /남의|다른사람|경쟁사|경쟁앱|경쟁|라이벌|rival|레퍼런스|참고영상|유명한|잘나가는|잘된|떡상|저영상|이영상|그영상|이릴스|저릴스|토스|당근|카카오|배민|애플|stripe/)
  const copyVerb = has(t, /똑같이|그대로베|그대로따|그대로만들|그대로옮|그대로가져|그대로재현|그대로구현|느낌그대로|따라만들|베껴|복제|클론|재현|처럼움직|처럼만들|같은느낌으로|그느낌|같은애니|같은모션|코드로만들|코드로옮|코드로구현|이움직임|그움직임|저움직임/)
  const siteWord = has(t, /사이트|웹사이트|랜딩|홈페이지|히어로|스크롤|hover|호버|페이지|\.com|\.io|\.app/)
  const checkVerb = has(t, /검사|점검|체크해|체크좀|체크부탁|\bqa\b|문제없는지|괜찮은지|이상없는지|봐줘|확인해|점수|채점|평가해|몇점/)
  const existing = has(t, /완성본|만든영상|다만든|뽑은|렌더한|렌더된|올리기전|업로드전|게시전|\.mp4|\.mov|이영상|내영상|우리영상|편집한/)
  const soundWord = has(t, /소리|사운드|오디오|음량|볼륨|효과음|싱크|bgm|음악|lufs/)
  const makeVerb = has(t, /만들|제작|뽑아|찍어|그려|생성/)
  const explain = has(t, /설명|explainer|강의|교육|해설|원리|개념|알려주는/)
  const koVoice = has(t, /한국어|한글|우리말|국문|내목소리|유나|녹음한|더빙/)
  const inApp = has(t, /앱안|앱속|화면안|로딩|대기|아이들|idle|컴포넌트|lottie|로티|swiftui|reactnative|정답이면|오답이면|누르면|탭하면/)
  const mascot = has(t, /마스코트|캐릭터|아이콘|이모지|캐릭/)
  const promo = has(t, /홍보|런칭|론칭|출시|광고|릴스|쇼츠|틱톡|프로모/)
  const story = has(t, /이야기|스토리|서사|브랜드필름|뮤직비디오|뮤비|시네마틱|단편|드라마|감성/)
  const realPerson = has(t, /실사|실제사람|배우|사람이나오|인물이|진짜같|사진같|포토리얼|촬영없이|찍지않고/)

  const motionWord = has(t, /애니메이션|애니|모션|움직임|인터랙션|전환|트랜지션|효과/)
  // 남의 영상을 "보고 배우는" 단계면 무엇보다 watch. 영상 링크를 주며 분석을 부탁하면 "따라 만들기 전에"가 붙어도 분석이 먼저예요.
  if (analyzeVerb && (videoUrl || (othersThing && !copyVerb))) scores.watch += 6
  // 남의 사이트·앱 움직임을 내 코드로 복제.
  if (copyVerb && !videoUrl && (siteWord || othersThing || motionWord)) scores.reanimate += 6
  if (copyVerb && motionWord && has(t, /\.mov|\.mp4|화면녹화|녹화해/)) scores.reanimate += 3
  // 이미 있는 영상 검사: 소리 얘기면 earshot, 아니면 video-director.
  if (checkVerb && existing && !makeVerb) {
    if (soundWord) scores.earshot += 4
    else scores['video-director'] += 4
  }
  if (checkVerb && soundWord && !makeVerb) scores.earshot += 2
  // 설명 영상: 영어면 explainroo, 한국어 내레이션이면 huashu.
  if (explain && lang === 'en') scores.explainroo += 4
  if (explain && lang === 'ko' && koVoice) scores['huashu-motion'] += 5
  if (explain && lang === 'ko' && !koVoice && !has(t, /영어|영문/)) scores.explainroo -= 3
  // 마스코트: 앱 안이면 rossark, 홍보 영상 속이면 huashu.
  if (mascot && inApp) scores.rossark += 3
  if (mascot && promo && !inApp) scores['huashu-motion'] += 2
  // 이야기형이면 take-one 이 홍보 모션보다 먼저.
  if (story && promo) scores['take-one'] += 2
  // 실사 인물이면 Kling.
  if (realPerson) scores.kling += 3
  // 사운드트랙을 "깐다"(만든다) vs 검사.
  if (has(t, /배경음악|bgm|사운드트랙|음악/) && has(t, /실제|진짜|녹음|저작권|무료음원|freesound/)) scores['real-sound'] += 3
  // 녹화 자체가 핵심이면 argo.
  if (has(t, /녹화|눌러|조작|클릭/) && has(t, /앱|서비스|사이트|화면/) && !copyVerb) scores.argo += 2
  if (copyVerb && motionWord) scores.argo -= 3

  const ranked = [...TOOL_IDS].sort((a, b) => scores[b] - scores[a] || PRIORITY.indexOf(a) - PRIORITY.indexOf(b))
  const first: ToolId = ranked[0] ?? 'huashu-motion'
  const top: ToolId = scores[first] > 0 ? first : 'huashu-motion'
  const runner: ToolId | undefined = ranked.find(id => id !== top)
  const second = runner ? scores[runner] : 0
  const confidence = scores[top] <= 0 ? 0 : Math.max(0, Math.min(1, (scores[top] - second) / Math.max(4, scores[top])))
  const alternates = ranked.filter(id => id !== top && scores[id] > 0).slice(0, 3)
  const seconds = detectSeconds(raw, top)
  const needsVoice =
    ['argo', 'explainroo', 'take-one'].includes(top) || (top === 'huashu-motion' && has(t, /내레이션|나레이션|목소리|음성|설명|더빙/))

  return {
    tool: top,
    confidence,
    scores,
    alternates,
    reason: REASON[top],
    lang,
    aspect: detectAspect(raw),
    seconds,
    needsVoice,
  }
}

// 사용자가 보낸 말이 영상 이야기인지(토스트 제안용). 오탐보다 놓치는 쪽이 나아요.
export const isVideoIntent = (raw: string): boolean => {
  const t = normalize(raw)
  if (t.startsWith('/')) return false
  const videoNoun = /영상|동영상|릴스|쇼츠|숏츠|숏폼|틱톡|뮤직비디오|뮤비|모션그래픽|애니메이션|녹화|자막|효과음|배경음악|bgm|내레이션|나레이션|인트로영상|video|reels|shorts|promo|explainer|mp4/
  const ask = /만들|제작|뽑|찍|편집|넣어|입혀|필요|해줘|해주세요|할래|하고싶|어떻게|검사|분석|녹화/
  return videoNoun.test(t) && ask.test(t)
}
