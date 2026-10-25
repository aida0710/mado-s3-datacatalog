import { useId } from 'react'
import { formatLocalDateTimeInput } from '@mado/design-system/datetime-input'
import {
  TOKEN_EXPIRY_PRESET_DAYS,
  changeTokenExpiryOption,
  type TokenExpiryOption,
  type TokenExpirySelection,
  type TokenExpiryUnit,
} from '@mado/design-system/token-expiry'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

// 時刻をどのタイムゾーンで入れるかの案内に出す、このブラウザのタイムゾーン。
const BROWSER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * アクセストークンの期限の選択 (デザインシステムの token-expiry、mado ML Tracking と同じ選び方)。
 * 7・30・90・365日、無期限、分・時間・日での長さ、カレンダーでの日時のどれかを選ぶ。
 */
export function TokenExpiryFields({ value, onChange, disabled }: {
  value: TokenExpirySelection
  onChange: (value: TokenExpirySelection) => void
  disabled: boolean
}) {
  useLocale()
  const optionId = useId()
  const durationId = useId()
  const unitId = useId()
  const dateTimeId = useId()
  return (
    <>
      <div className="field">
        <label htmlFor={optionId}>{translate('accessTokens.expiresAt')}</label>
        <select
          id={optionId}
          value={value.option}
          disabled={disabled}
          onChange={event => onChange(changeTokenExpiryOption(value, event.target.value as TokenExpiryOption))}
        >
          {TOKEN_EXPIRY_PRESET_DAYS.map(days => (
            <option key={days} value={String(days)}>{translate('accessTokens.expiryDays', { value0: days })}</option>
          ))}
          <option value="never">{translate('accessTokens.noExpiry')}</option>
          <option value="custom">{translate('accessTokens.expiryCustom')}</option>
          <option value="calendar">{translate('accessTokens.expiryCalendar')}</option>
        </select>
      </div>
      {value.option === 'calendar' && (
        <div className="field">
          <label htmlFor={dateTimeId}>{translate('accessTokens.expiryDateTime')}</label>
          <input
            id={dateTimeId}
            type="datetime-local"
            min={formatLocalDateTimeInput(new Date())}
            required
            disabled={disabled}
            value={value.dateTime}
            aria-describedby={`${dateTimeId}-hint`}
            onChange={event => onChange({ ...value, dateTime: event.target.value })}
          />
          <small id={`${dateTimeId}-hint`} className="muted">
            {translate('accessTokens.expiryTimeZone', { value0: BROWSER_TIME_ZONE })}
          </small>
        </div>
      )}
      {value.option === 'custom' && (
        <div className="token-expiry-duration">
          <div className="field">
            <label htmlFor={durationId}>{translate('accessTokens.expiryDuration')}</label>
            <input
              id={durationId}
              type="number"
              min="0"
              step="any"
              required
              disabled={disabled}
              value={value.duration}
              onChange={event => onChange({ ...value, duration: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor={unitId}>{translate('accessTokens.expiryUnit')}</label>
            <select
              id={unitId}
              value={value.unit}
              disabled={disabled}
              onChange={event => onChange({ ...value, unit: event.target.value as TokenExpiryUnit })}
            >
              <option value="minutes">{translate('accessTokens.expiryMinutes')}</option>
              <option value="hours">{translate('accessTokens.expiryHours')}</option>
              <option value="days">{translate('accessTokens.expiryUnitDays')}</option>
            </select>
          </div>
        </div>
      )}
    </>
  )
}
