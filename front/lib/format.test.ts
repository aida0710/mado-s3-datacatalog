import { describe, expect, it } from 'vitest'
import { fmtCacheAge, fmtDateTime, fmtDurationRange, fmtSize, fmtUsd, prettyPrintJson } from './format'

describe('prettyPrintJson', () => {
  it('.json は minify されていても整形する', () => {
    expect(prettyPrintJson('a.json', '{"a":1,"b":2}')).toBe('{\n  "a": 1,\n  "b": 2\n}')
  })

  it('.jsonl / .ndjson は 1 行 1 JSON 値なので整形しない', () => {
    expect(prettyPrintJson('a.jsonl', '{"a":1}\n{"b":2}')).toBe('{"a":1}\n{"b":2}')
    expect(prettyPrintJson('a.ndjson', '{"a":1}\n{"b":2}')).toBe('{"a":1}\n{"b":2}')
  })

  it('不正な JSON はそのまま返す', () => {
    expect(prettyPrintJson('bad.json', '{oops not json')).toBe('{oops not json')
  })

  it('json 以外の拡張子はそのまま返す', () => {
    expect(prettyPrintJson('a.txt', '{"a":1}')).toBe('{"a":1}')
    expect(prettyPrintJson('README', 'hello')).toBe('hello')
  })

  it('拡張子の大小文字を問わない', () => {
    expect(prettyPrintJson('A.JSON', '{"a":1}')).toBe('{\n  "a": 1\n}')
  })
})

describe('fmtCacheAge', () => {
  const NOW = new Date('2026-08-18T16:14:00+09:00')

  it('絶対時刻は YYYY/MM/DD HH:mm', () => {
    expect(fmtCacheAge(NOW, NOW)).toMatch(/^2026\/08\/18 16:14\(/)
  })

  // 経過時間はデザインシステムの formatRelativeTime (Intl.RelativeTimeFormat、numeric: 'auto')。
  it('1 分未満は「今」', () => {
    const d = new Date(NOW.getTime() - 30_000)
    expect(fmtCacheAge(d, NOW)).toContain('(今)')
  })

  it('60 分未満は n分前', () => {
    const d = new Date(NOW.getTime() - 5 * 60_000)
    expect(fmtCacheAge(d, NOW)).toContain('(5分前)')
  })

  it('24 時間未満は n時間前', () => {
    const d = new Date(NOW.getTime() - 2 * 60 * 60_000)
    expect(fmtCacheAge(d, NOW)).toContain('(2時間前)')
  })

  it('24 時間以上は n日前、1 日は「昨日」', () => {
    expect(fmtCacheAge(new Date(NOW.getTime() - 3 * 24 * 60 * 60_000), NOW)).toContain('(3日前)')
    expect(fmtCacheAge(new Date(NOW.getTime() - 24 * 60 * 60_000), NOW)).toContain('(昨日)')
  })

  it('境界: ちょうど 60 分は 1時間前', () => {
    const d = new Date(NOW.getTime() - 60 * 60_000)
    expect(fmtCacheAge(d, NOW)).toContain('(1時間前)')
  })
})

describe('fmtCacheAge — compact', () => {
  const NOW = new Date('2026-08-18T16:14:00+09:00')

  it('同日なら日付を落として HH:mm(相対) にする', () => {
    const d = new Date(NOW.getTime() - 5 * 60_000)
    expect(fmtCacheAge(d, NOW, { compact: true })).toBe('16:09(5分前)')
  })

  it('日を跨いだら MM/DD を足す (時刻だけでは曖昧になるため)', () => {
    const d = new Date('2026-08-16T22:13:00+09:00')
    // 8/16 22:13 → 8/18 16:14 は 41 時間 = 1日前 (24 時間単位の切り捨て) なので「昨日」
    expect(fmtCacheAge(d, NOW, { compact: true })).toBe('08/16 22:13(昨日)')
  })

  it('compact でない既定は年から出す', () => {
    expect(fmtCacheAge(NOW, NOW)).toBe('2026/08/18 16:14(今)')
  })
})

describe('fmtSize', () => {
  // 1024 で割るので 2 進の単位 (デザインシステムの formatBytes)。走査で 774 TiB のような値も扱う。
  it('1024 ごとに KiB・MiB・GiB・TiB・PiB へ上げ、小数 1 桁で出す', () => {
    expect(fmtSize(512)).toBe('512 B')
    expect(fmtSize(1024)).toBe('1.0 KiB')
    expect(fmtSize(1024 ** 3)).toBe('1.0 GiB')
    expect(fmtSize(851893405098712)).toBe('774.8 TiB')
    expect(fmtSize(1024 ** 5)).toBe('1.0 PiB')
  })
})

describe('fmtUsd', () => {
  it('0 は $0', () => {
    expect(fmtUsd(0)).toBe('$0')
  })

  it('1 セント未満は潰さずに「小さい」と言う', () => {
    // $0.00 と出すと無料に見えてしまう。
    expect(fmtUsd(0.004)).toBe('<$0.01')
  })

  it('$100 未満はセントまで', () => {
    expect(fmtUsd(0.5)).toBe('$0.50')
    expect(fmtUsd(65.4321)).toBe('$65.43')
  })

  it('$100 以上は丸めて桁区切り', () => {
    // 下 2 桁には意味が無く、あると精度があるように見えてしまう。
    expect(fmtUsd(1043.27)).toBe('$1,043')
    expect(fmtUsd(3890.5)).toBe('$3,891')
  })
})

describe('fmtDurationRange', () => {
  it('90 秒未満は秒', () => {
    expect(fmtDurationRange(30, 45)).toBe('30〜45 秒')
  })

  it('90 分未満は分', () => {
    expect(fmtDurationRange(600, 900)).toBe('10〜15 分')
  })

  it('48 時間未満は時間', () => {
    expect(fmtDurationRange(3600 * 13, 3600 * 20)).toBe('13〜20 時間')
  })

  it('それ以上は日', () => {
    expect(fmtDurationRange(86400 * 3, 86400 * 4.5)).toBe('3〜4.5 日')
  })

  it('単位は上振れ側で決め、両端で揃える', () => {
    // 楽観が分、悲観が時間でも「0.9〜1.5 時間」と揃える。
    expect(fmtDurationRange(3300, 5400)).toBe('0.9〜1.5 時間')
  })

  it('両端が同じに丸まったら 1 つだけ出す', () => {
    expect(fmtDurationRange(200, 200)).toBe('3.3 分')
  })
})

describe('fmtDateTime', () => {
  it('年月日と時分を 2 桁で出す', () => {
    expect(fmtDateTime(new Date(2026, 8, 18, 3, 5))).toBe('2026/09/18 03:05')
    expect(fmtDateTime('2026-09-18T03:05:00')).toBe('2026/09/18 03:05')
  })

  it('解釈できない文字列はそのまま返す', () => {
    expect(fmtDateTime('not a date')).toBe('not a date')
  })
})
