// 라우팅 시험: node --experimental-strip-types judge/routing/score.ts <set.jsonl> [--quiet]
// 정답률과 틀린 문장을 보여 줘요. --quiet 이면 틀린 문장 내용은 숨기고 숫자만(채점용 세트를 작성자가 안 보게).
import { readFileSync } from 'node:fs'
import { route } from '../../hooks/route.ts'

const [file, flag] = process.argv.slice(2)
if (!file) {
  console.error('사용법: score.ts <set.jsonl> [--quiet]')
  process.exit(2)
}
const quiet = flag === '--quiet'
const rows = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(l => JSON.parse(l) as { id: string; text: string; label: string; tricky?: boolean })

let ok = 0
let trickyOk = 0
let tricky = 0
const confusion = new Map<string, number>()
for (const r of rows) {
  const got = route(r.text).tool
  const hit = got === r.label
  if (hit) ok++
  if (r.tricky) {
    tricky++
    if (hit) trickyOk++
  }
  if (!hit) {
    const k = `${r.label} → ${got}`
    confusion.set(k, (confusion.get(k) ?? 0) + 1)
    if (!quiet) console.log(`✗ ${r.id} [${r.label} → ${got}] ${r.text}`)
  }
}
const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : '0.0')
console.log(`정답 ${ok}/${rows.length} (${pct(ok, rows.length)}%) · 까다로운 문장 ${trickyOk}/${tricky}`)
for (const [k, n] of [...confusion].sort((a, b) => b[1] - a[1])) console.log(`  오답 ${k}: ${n}`)
process.exit(ok / rows.length >= 0.95 ? 0 : 1)
