import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from './locale'
import { lineageWarningMessage, pricingNoteMessage, projectionUnavailableMessage, transferWarningMessage } from './noticeMessages'

afterEach(() => setLocale('ja'))

describe('API のお知らせの文', () => {
  it('見積もりの注意は code と値から今の言語の文にし、値は画面の書式で書く', () => {
    setLocale('ja')
    expect(transferWarningMessage({ code: 'minDuration', days: 30 })).toBe('最小保存期間 30 日。30 日以内に削除しても 30 日分は課金されます。')
    expect(transferWarningMessage({ code: 'retrievalCost', usdPerGb: 0.0025 })).toBe(
      'このクラスは読み出しに $0.0025/GB かかります(置いたあと読み返す用途では月額の安さが相殺されます)。')
    expect(transferWarningMessage({ code: 'ratesUnavailable', region: null })).toContain('リージョン (不明) の単価')
    setLocale('en')
    expect(transferWarningMessage({ code: 'minDuration', days: 1 })).toBe('Minimum retention: 1 day. Deleting within 1 day still incurs charges for 1 day.')
    expect(transferWarningMessage({
      code: 'objectOverhead', overheadBytesPerObject: 40960, objectCount: 1_000_000, overheadBytes: 40960 * 1_000_000, percentOfBillable: 80,
    })).toBe('This class adds 40.0 KiB of metadata per object. An object count of 1,000,000 adds 38.1 GiB, about 80% of billable storage.')
  })

  it('DataLineage の警告と反映状態は code で訳し、項目の ID はそのまま入れる', () => {
    setLocale('ja')
    expect(lineageWarningMessage({ code: 'malformedMarquezNode', nodeId: '研究（A）、B〜C' })).toBe('形式が不正なMarquezの項目を除外しました: 研究（A）、B〜C')
    expect(projectionUnavailableMessage('registryProjectionUnavailable')).toBe('台帳からグラフの反映状態を取得できません。')
    setLocale('en')
    expect(lineageWarningMessage({ code: 'marquezSearchUnavailable' })).toBe('Marquez search is unavailable')
  })

  it('単価の注記は code で訳す', () => {
    setLocale('en')
    expect(pricingNoteMessage('wasabiManualRates')).toBe('Wasabi rates and policies (all maintained manually because Wasabi does not publish a pricing API)')
  })
})
