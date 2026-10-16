import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

export default function NotFoundPage() {
  useLocale()
  return <p className="state-message">{translate('labels.notFound')}</p>
}
