/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { FileLike } from '../parse'

/** 테스트용: 픽스처 파일을 File 유사 객체로 */
export function fixtureFile(name: string): FileLike {
  const b = readFileSync(fileURLToPath(new URL(name, import.meta.url)))
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
  return { name, arrayBuffer: async () => ab }
}
