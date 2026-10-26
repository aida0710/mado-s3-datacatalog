// アプリ全体の設定の応答。
import { z } from 'zod'

// アプリ全体の設定。value は TEXT 固定で、型の解釈は呼び出し側の責務
// (boolean 以外の設定が増えてもスキーマを変えずに済ませるため)。
export const AppSettings = z.record(z.string(), z.string())
export type AppSettings = z.infer<typeof AppSettings>
