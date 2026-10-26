// vitestのglobalSetup。テストを走らせる前に、旧名だけが残った環境変数が無いかを確かめる。
// DBを使うテストはMDC_TEST_DATABASE_URLが無いとlocalhostのdashboard_testへつなぐので、
// 旧名だけの.envのまま走らせると、別に用意したつもりのDBではなく手元の共有のDBを初期化してしまう。
import { assertNoRenamedEnvironmentVariables } from './renamed-environment-variables.js'

export default function checkRenamedEnvironmentVariables(): void {
  assertNoRenamedEnvironmentVariables(process.env)
}
