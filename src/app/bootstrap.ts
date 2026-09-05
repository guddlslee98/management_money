import { DEFAULT_CATEGORIES, DEFAULT_RULES } from '../data/default-categories'
import { repos } from '../db/repo'

let started: Promise<void> | null = null

/** 앱 시작 시 1회: 기본 데이터 시딩 + 반복 거래 생성 */
export function bootstrap(): Promise<void> {
  if (!started) {
    started = (async () => {
      await repos.ensureSeeded({ categories: DEFAULT_CATEGORIES, rules: DEFAULT_RULES })
      await repos.recurring.generateDue()
    })().catch((e) => {
      console.error('bootstrap failed', e)
    })
  }
  return started
}
