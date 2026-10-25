import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { API_ERROR_CODES } from './shared/api-error-codes.js'

const API_ROOT = new URL('.', import.meta.url).pathname
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist'])
// 手で書いたエラーの本文 (`json({ error: ... })` や、ストリームの行の `write({ error: ... })`) は
// apiError を通らず code が抜ける。
const HAND_WRITTEN_ERROR_BODY = /\b(?:json|write)\(\s*\{\s*error\b/g

function apiSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (SKIPPED_DIRECTORIES.has(entry.name)) return []
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return apiSourceFiles(path)
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('APIのエラー応答', () => {
  it('エラーの本文はすべて apiError で作り、code を付けている', () => {
    const handWritten = apiSourceFiles(API_ROOT).flatMap(path => {
      const source = readFileSync(path, 'utf8')
      return [...source.matchAll(HAND_WRITTEN_ERROR_BODY)].map(match =>
        `${relative(API_ROOT, path)}:${source.slice(0, match.index).split('\n').length}`)
    })
    expect(handWritten).toEqual([])
  })

  it('code は重複のない snake_case', () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length)
    for (const code of API_ERROR_CODES) expect(code).toMatch(/^[a-z]+(?:_[a-z]+)*$/)
  })
})
