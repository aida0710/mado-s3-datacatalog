import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_KEYS, settingsToCapabilities, settingsToScanEnabled, settingsToCapacityMetricsEnabled,
} from './storage.js'

const enabledSettings = Object.fromEntries([
  ...CAPABILITY_KEYS.map(key => [`cap.${key}`, 'true']),
  ['scan_enabled', 'true'], ['capacity_metrics_enabled', 'true'],
])

describe('接続設定のboolean読み取り', () => {
  it('trueとfalseを保存するとその値どおりに操作を許可する', () => {
    expect(Object.values(settingsToCapabilities(enabledSettings)).every(Boolean)).toBe(true)
    expect(settingsToCapabilities({ ...enabledSettings, 'cap.download': 'false' }).download).toBe(false)
    expect(settingsToScanEnabled(enabledSettings)).toBe(true)
    expect(settingsToCapacityMetricsEnabled(enabledSettings)).toBe(true)
    expect(settingsToScanEnabled({ scan_enabled: 'false' })).toBe(false)
    expect(settingsToCapacityMetricsEnabled({ capacity_metrics_enabled: 'false' })).toBe(false)
  })

  it.each([undefined, '', 'TRUE', '1', 'invalid'])('保存値が%sなら設定エラーになる', value => {
    for (const key of Object.keys(enabledSettings)) {
      const settings = { ...enabledSettings }
      if (value === undefined) delete settings[key]
      else settings[key] = value
      const read = key === 'scan_enabled' ? settingsToScanEnabled
        : key === 'capacity_metrics_enabled' ? settingsToCapacityMetricsEnabled : settingsToCapabilities
      expect(() => read(settings)).toThrow(key)
    }
  })
})
