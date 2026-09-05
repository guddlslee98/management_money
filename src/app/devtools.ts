import { db } from '../db/db'
import { repos } from '../db/repo'
import { seedSampleData } from './sampleData'

/**
 * 개발 모드에서만 window.__mm 으로 DB/저장소를 노출한다.
 * E2E(agent-browser eval)나 콘솔에서 데이터를 넣고 확인할 때 사용.
 *   await __mm.seedSample({ months: 6 })
 *   await __mm.repos.transactions.count()
 *   await __mm.clearAll()
 */
export function exposeDevTools(): void {
  if (!import.meta.env.DEV) return
  ;(window as unknown as { __mm: unknown }).__mm = {
    db,
    repos,
    seedSample: seedSampleData,
    clearAll: () => repos.clearAll(),
  }
}
