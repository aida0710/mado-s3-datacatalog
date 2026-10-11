import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { APP_VERSION, GIT_COMMIT, GIT_DATE, REPO_URL, commitUrl } from '../lib/buildInfo'
import { SettingsSectionHeader } from './SettingsSectionHeader'

export function About() {
  useLocale()
  // コミット日時は YYYY-MM-DD だけ見せる (ISO の先頭 10 文字)。
  const date = GIT_DATE ? GIT_DATE.slice(0, 10) : ''
  // 'dev' (git/env 無し) のときはリンクにしない。
  const hasCommit = GIT_COMMIT !== 'dev' && GIT_COMMIT !== ''

  return (
    <section className="settings-column">
      <SettingsSectionHeader title={translate("about.aboutThisApplication")} />

      <dl className="details-list">
        <div>
          <dt>{translate("about.version")}</dt>
          <dd className="mono">v{APP_VERSION}</dd>
        </div>
        <div>
          <dt>{translate("about.commit")}</dt>
          <dd className="mono">
            {hasCommit ? (
              <a href={commitUrl(GIT_COMMIT)} target="_blank" rel="noreferrer">
                {GIT_COMMIT.slice(0, 7)}
              </a>
            ) : (
              <span className="muted">{translate("about.dev")}</span>
            )}
            {date && <span className="muted">{' · '}{date}</span>}
          </dd>
        </div>
        <div>
          <dt>{translate("about.repository")}</dt>
          <dd className="mono">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              {REPO_URL.replace(/^https?:\/\//, '')}
            </a>
          </dd>
        </div>
      </dl>
    </section>
  )
}
