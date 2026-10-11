import { LanguagePicker } from '../LanguagePicker'
import { ProductLogo } from './ProductLogo'

/** ログイン前の画面の上部。ロゴと同じ行の右側に表示言語の切り替えを置く。 */
export function LoginHeader() {
  return (
    <header className="login-mark login-header">
      <ProductLogo />
      <LanguagePicker />
    </header>
  )
}
