import { LanguagePicker } from '../LanguagePicker'
import { ProductLogo } from './ProductLogo'

/** Keep language selection beside the brand before authentication is complete. */
export function LoginHeader() {
  return (
    <header className="login-mark login-header">
      <ProductLogo />
      <LanguagePicker />
    </header>
  )
}
