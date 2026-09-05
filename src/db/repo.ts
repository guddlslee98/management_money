import { compareMonth, currentMonthKey, isDateKey, toMonthKey, todayKey, type DateKey, type MonthKey } from '../domain/dates'
import { BUDGET_DEFAULT_MONTH } from '../domain/budget'
import { buildRecurringTransaction, dueOccurrences } from '../domain/recurring'
import { db, type MoneyDB } from './db'
import {
  newId,
  type Account,
  type Budget,
  type Category,
  type ClassifyRule,
  type RecurringRule,
  type Setting,
  type Transaction,
} from './types'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export type NewTransaction = Omit<Transaction, 'id' | 'month' | 'createdAt' | 'updatedAt' | 'source' | 'importHash' | 'recurringRuleId' | 'recurringMonth'> &
  Partial<Pick<Transaction, 'id' | 'source' | 'importHash' | 'recurringRuleId' | 'recurringMonth'>>

export function validateTransaction(input: Pick<Transaction, 'type' | 'date' | 'amount' | 'accountId' | 'toAccountId'>): void {
  if (!isDateKey(input.date)) throw new ValidationError('날짜 형식이 올바르지 않습니다')
  if (!Number.isInteger(input.amount) || input.amount < 0) throw new ValidationError('금액은 0 이상의 정수여야 합니다')
  if (input.type === 'transfer') {
    if (!input.accountId || !input.toAccountId) throw new ValidationError('이체는 출금 계좌와 입금 계좌가 모두 필요합니다')
    if (input.accountId === input.toAccountId) throw new ValidationError('출금 계좌와 입금 계좌가 같을 수 없습니다')
  }
}

export function validateRecurringRule(rule: Pick<RecurringRule, 'type' | 'amount' | 'dayOfMonth' | 'accountId' | 'toAccountId' | 'startMonth' | 'endMonth'>): void {
  if (!Number.isInteger(rule.amount) || rule.amount < 0) throw new ValidationError('금액은 0 이상의 정수여야 합니다')
  if (!Number.isInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31) throw new ValidationError('반복일은 1~31 사이여야 합니다')
  if (!/^\d{4}-\d{2}$/.test(rule.startMonth)) throw new ValidationError('시작 월 형식이 올바르지 않습니다')
  if (rule.endMonth !== null && (!/^\d{4}-\d{2}$/.test(rule.endMonth) || compareMonth(rule.endMonth, rule.startMonth) < 0)) throw new ValidationError('종료 월은 시작 월 이후여야 합니다')
  if (rule.type === 'transfer' && (!rule.accountId || !rule.toAccountId || rule.accountId === rule.toAccountId))
    throw new ValidationError('이체는 서로 다른 출금·입금 계좌가 필요합니다')
}

function buildTransaction(input: NewTransaction, now: number): Transaction {
  const tx: Transaction = {
    id: input.id ?? newId(),
    type: input.type,
    date: input.date,
    month: toMonthKey(input.date),
    amount: input.amount,
    categoryId: input.type === 'transfer' ? null : input.categoryId,
    accountId: input.accountId ?? null,
    toAccountId: input.type === 'transfer' ? input.toAccountId ?? null : null,
    payee: input.payee ?? '',
    memo: input.memo ?? '',
    isRefund: input.type === 'transfer' ? false : Boolean(input.isRefund),
    source: input.source ?? 'manual',
    importHash: input.importHash ?? null,
    recurringRuleId: input.recurringRuleId ?? null,
    recurringMonth: input.recurringMonth ?? null,
    createdAt: now,
    updatedAt: now,
  }
  validateTransaction(tx)
  return tx
}

const byDateDesc = (a: Transaction, b: Transaction) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)

export interface SeedDefaults {
  categories: Category[]
  rules: Array<Pick<ClassifyRule, 'pattern' | 'categoryId' | 'priority'>>
}

export const SEED_VERSION = 1

export interface BackupData {
  app: 'management-money'
  version: number
  exportedAt: string
  transactions: Transaction[]
  categories: Category[]
  accounts: Account[]
  budgets: Budget[]
  recurringRules: RecurringRule[]
  classifyRules: ClassifyRule[]
  settings: Setting[]
}

export function makeRepos(d: MoneyDB) {
  const transactions = {
    async add(input: NewTransaction): Promise<Transaction> {
      const tx = buildTransaction(input, Date.now())
      await d.transactions.add(tx)
      return tx
    },
    async bulkAdd(inputs: NewTransaction[]): Promise<Transaction[]> {
      const now = Date.now()
      const txs = inputs.map((i) => buildTransaction(i, now))
      await d.transactions.bulkAdd(txs)
      return txs
    },
    async update(id: string, patch: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Promise<Transaction> {
      const cur = await d.transactions.get(id)
      if (!cur) throw new ValidationError('거래를 찾을 수 없습니다')
      const next: Transaction = { ...cur, ...patch, id, updatedAt: Date.now() }
      next.month = toMonthKey(next.date)
      if (next.type === 'transfer') {
        next.categoryId = null
        next.isRefund = false
      } else {
        next.toAccountId = null
      }
      validateTransaction(next)
      await d.transactions.put(next)
      return next
    },
    remove(id: string) {
      return d.transactions.delete(id)
    },
    bulkRemove(ids: string[]) {
      return d.transactions.bulkDelete(ids)
    },
    get(id: string) {
      return d.transactions.get(id)
    },
    async byMonth(month: MonthKey): Promise<Transaction[]> {
      const rows = await d.transactions.where('month').equals(month).toArray()
      return rows.sort(byDateDesc)
    },
    async byMonths(months: MonthKey[]): Promise<Transaction[]> {
      if (months.length === 0) return []
      const rows = await d.transactions.where('month').anyOf(months).toArray()
      return rows.sort(byDateDesc)
    },
    async betweenDates(start: DateKey, end: DateKey): Promise<Transaction[]> {
      const rows = await d.transactions.where('date').between(start, end, true, true).toArray()
      return rows.sort(byDateDesc)
    },
    async all(): Promise<Transaction[]> {
      const rows = await d.transactions.toArray()
      return rows.sort(byDateDesc)
    },
    count() {
      return d.transactions.count()
    },
    byRecurringRule(ruleId: string) {
      return d.transactions.where('recurringRuleId').equals(ruleId).toArray()
    },
    /** 이미 저장된 가져오기 해시 집합 */
    async existingHashes(hashes: string[]): Promise<Set<string>> {
      if (hashes.length === 0) return new Set()
      const rows = await d.transactions.where('importHash').anyOf(hashes).toArray()
      return new Set(rows.map((r) => r.importHash).filter((h): h is string => Boolean(h)))
    },
    /** 거래처/메모 검색 (개인 규모라 전체 스캔) */
    async search(query: string, limit = 200): Promise<Transaction[]> {
      const q = query.trim().toLowerCase()
      if (!q) return []
      const rows = await d.transactions.filter((t) => t.payee.toLowerCase().includes(q) || t.memo.toLowerCase().includes(q)).toArray()
      return rows.sort(byDateDesc).slice(0, limit)
    },
    /** 최근 사용한 거래처 (자동완성용) */
    async recentPayees(limit = 30): Promise<string[]> {
      const rows = await d.transactions.orderBy('date').reverse().limit(500).toArray()
      const seen = new Set<string>()
      for (const r of rows) {
        if (r.payee) seen.add(r.payee)
        if (seen.size >= limit) break
      }
      return [...seen]
    },
  }

  const categories = {
    async all(): Promise<Category[]> {
      const rows = await d.categories.toArray()
      return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'))
    },
    get(id: string) {
      return d.categories.get(id)
    },
    async add(input: Omit<Category, 'id' | 'sortOrder' | 'isArchived'> & Partial<Pick<Category, 'id' | 'sortOrder' | 'isArchived'>>): Promise<Category> {
      const name = input.name.trim()
      if (!name) throw new ValidationError('카테고리 이름을 입력하세요')
      if (input.parentId) {
        const parent = await d.categories.get(input.parentId)
        if (!parent) throw new ValidationError('상위 카테고리를 찾을 수 없습니다')
        if (parent.parentId) throw new ValidationError('소분류 아래에는 카테고리를 만들 수 없습니다')
        if (parent.kind !== input.kind) throw new ValidationError('상위 카테고리와 종류가 다릅니다')
      }
      // IndexedDB는 null을 인덱스 키로 쓰지 못하므로 복합 인덱스 대신 filter로 형제 수를 센다
      const parentId = input.parentId ?? null
      const siblings = await d.categories.filter((c) => c.kind === input.kind && c.parentId === parentId).count()
      const cat: Category = {
        id: input.id ?? newId(),
        kind: input.kind,
        name,
        emoji: input.emoji || '🏷️',
        color: input.color || '#6b7280',
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? siblings,
        isArchived: input.isArchived ?? false,
      }
      await d.categories.add(cat)
      return cat
    },
    async update(id: string, patch: Partial<Omit<Category, 'id' | 'kind'>>): Promise<void> {
      const cur = await d.categories.get(id)
      if (!cur) throw new ValidationError('카테고리를 찾을 수 없습니다')
      if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError('카테고리 이름을 입력하세요')
      await d.categories.update(id, patch)
    },
    /** 삭제: 소분류도 함께 삭제하고, 해당 거래는 미분류로, 예산/규칙은 제거 */
    async remove(id: string): Promise<void> {
      await d.transaction('rw', [d.categories, d.transactions, d.budgets, d.classifyRules, d.recurringRules], async () => {
        const children = await d.categories.where('parentId').equals(id).toArray()
        const ids = [id, ...children.map((c) => c.id)]
        await d.transactions.where('categoryId').anyOf(ids).modify({ categoryId: null })
        await d.budgets.where('categoryId').anyOf(ids).delete()
        await d.classifyRules.where('categoryId').anyOf(ids).delete()
        // 반복 규칙이 사라진 카테고리로 계속 생성하지 않도록 미분류로 돌린다
        await d.recurringRules.filter((r) => r.categoryId !== null && ids.includes(r.categoryId)).modify({ categoryId: null })
        await d.categories.bulkDelete(ids)
      })
    },
    async reorder(ids: string[]): Promise<void> {
      await d.transaction('rw', d.categories, async () => {
        for (let i = 0; i < ids.length; i++) await d.categories.update(ids[i], { sortOrder: i })
      })
    },
  }

  const accounts = {
    async all(): Promise<Account[]> {
      const rows = await d.accounts.toArray()
      return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'))
    },
    get(id: string) {
      return d.accounts.get(id)
    },
    async add(input: Omit<Account, 'id' | 'sortOrder' | 'isArchived'> & Partial<Pick<Account, 'id' | 'sortOrder' | 'isArchived'>>): Promise<Account> {
      const name = input.name.trim()
      if (!name) throw new ValidationError('계좌 이름을 입력하세요')
      if (!Number.isInteger(input.initialBalance)) throw new ValidationError('초기 잔액은 정수여야 합니다')
      const count = await d.accounts.count()
      const acc: Account = {
        id: input.id ?? newId(),
        name,
        type: input.type,
        initialBalance: input.initialBalance,
        color: input.color || '#2563eb',
        sortOrder: input.sortOrder ?? count,
        isArchived: input.isArchived ?? false,
      }
      await d.accounts.add(acc)
      return acc
    },
    async update(id: string, patch: Partial<Omit<Account, 'id'>>): Promise<void> {
      const cur = await d.accounts.get(id)
      if (!cur) throw new ValidationError('계좌를 찾을 수 없습니다')
      await d.accounts.update(id, patch)
    },
    /** 삭제: 연결된 거래의 계좌 참조를 비운다 (거래 자체는 유지) */
    async remove(id: string): Promise<void> {
      await d.transaction('rw', [d.accounts, d.transactions, d.recurringRules], async () => {
        await d.transactions.where('accountId').equals(id).modify({ accountId: null })
        await d.transactions.where('toAccountId').equals(id).modify({ toAccountId: null })
        await d.recurringRules.filter((r) => r.accountId === id || r.toAccountId === id).modify((r) => {
          if (r.accountId === id) r.accountId = null
          if (r.toAccountId === id) r.toAccountId = null
          // 이체 규칙은 상대 계좌가 없으면 유효하지 않으므로 끈다
          if (r.type === 'transfer') r.isActive = false
        })
        await d.accounts.delete(id)
      })
    },
  }

  const budgets = {
    all(): Promise<Budget[]> {
      return d.budgets.toArray()
    },
    /** 특정 카테고리·월 예산을 설정(0 이하면 삭제). month='*'는 기본 예산 */
    async set(categoryId: string, month: MonthKey | typeof BUDGET_DEFAULT_MONTH, amount: number): Promise<void> {
      if (!Number.isInteger(amount)) throw new ValidationError('예산은 정수여야 합니다')
      const existing = await d.budgets.where('[categoryId+month]').equals([categoryId, month]).first()
      if (amount <= 0) {
        if (existing) await d.budgets.delete(existing.id)
        return
      }
      if (existing) await d.budgets.update(existing.id, { amount })
      else await d.budgets.add({ id: newId(), categoryId, month, amount })
    },
    remove(id: string) {
      return d.budgets.delete(id)
    },
  }

  const recurring = {
    async all(): Promise<RecurringRule[]> {
      const rows = await d.recurringRules.toArray()
      return rows.sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.createdAt - b.createdAt)
    },
    get(id: string) {
      return d.recurringRules.get(id)
    },
    async add(input: Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<RecurringRule, 'id'>>): Promise<RecurringRule> {
      validateRecurringRule(input)
      const now = Date.now()
      const rule: RecurringRule = { ...input, id: input.id ?? newId(), createdAt: now, updatedAt: now }
      await d.recurringRules.add(rule)
      return rule
    },
    async update(id: string, patch: Partial<Omit<RecurringRule, 'id' | 'createdAt'>>): Promise<void> {
      const cur = await d.recurringRules.get(id)
      if (!cur) throw new ValidationError('반복 규칙을 찾을 수 없습니다')
      const next = { ...cur, ...patch }
      validateRecurringRule(next)
      // 껐다가 다시 켜면 꺼져 있던 달을 소급 생성하지 않고 이번 달부터 이어간다
      if (patch.isActive === true && !cur.isActive) {
        const nowMonth = currentMonthKey()
        if (compareMonth(next.startMonth, nowMonth) < 0) next.startMonth = nowMonth
      }
      await d.recurringRules.put({ ...next, updatedAt: Date.now() })
    },
    /** 규칙 삭제. deleteGenerated=true면 생성된 거래도 삭제, 아니면 거래는 남기고 연결만 끊음 */
    async remove(id: string, deleteGenerated = false): Promise<void> {
      await d.transaction('rw', [d.recurringRules, d.transactions], async () => {
        if (deleteGenerated) await d.transactions.where('recurringRuleId').equals(id).delete()
        else await d.transactions.where('recurringRuleId').equals(id).modify({ recurringRuleId: null })
        await d.recurringRules.delete(id)
      })
    },
    /** 오늘까지 발생했어야 할 반복 거래를 생성 (멱등). 생성 건수 반환 */
    async generateDue(today: DateKey = todayKey()): Promise<number> {
      return d.transaction('rw', [d.recurringRules, d.transactions], async () => {
        // boolean은 IndexedDB 인덱스 키가 될 수 없으므로 filter 사용
        const rules = await d.recurringRules.filter((r) => r.isActive).toArray()
        let created = 0
        const now = Date.now()
        for (const rule of rules) {
          if (!rule.isActive) continue
          const existing = await d.transactions.where('recurringRuleId').equals(rule.id).toArray()
          // 사용자가 생성된 거래의 날짜를 다른 달로 옮겨도 발생 월(recurringMonth) 기준으로 멱등하게 판단한다
          const months = new Set(existing.map((t) => t.recurringMonth ?? t.month))
          const due = dueOccurrences(rule, today, months)
          if (due.length === 0) continue
          const rows = due.map((o) => buildRecurringTransaction(rule, o, now))
          try {
            for (const row of rows) validateTransaction(row)
          } catch {
            // 계좌 삭제 등으로 더 이상 유효하지 않은 규칙은 끄고 건너뛴다
            await d.recurringRules.update(rule.id, { isActive: false, updatedAt: now })
            continue
          }
          await d.transactions.bulkAdd(rows)
          created += due.length
        }
        return created
      })
    },
  }

  const classifyRules = {
    async all(): Promise<ClassifyRule[]> {
      return d.classifyRules.toArray()
    },
    async addUserRule(pattern: string, categoryId: string): Promise<ClassifyRule> {
      const p = pattern.trim()
      if (!p) throw new ValidationError('키워드를 입력하세요')
      // 같은 패턴의 사용자 규칙이 있으면 카테고리만 갱신
      const dup = await d.classifyRules.filter((r) => r.source === 'user' && r.pattern.toLowerCase() === p.toLowerCase()).first()
      if (dup) {
        await d.classifyRules.update(dup.id, { categoryId })
        return { ...dup, categoryId }
      }
      const rule: ClassifyRule = { id: newId(), pattern: p, categoryId, source: 'user', priority: 1000, createdAt: Date.now() }
      await d.classifyRules.add(rule)
      return rule
    },
    remove(id: string) {
      return d.classifyRules.delete(id)
    },
    async resetDefaults(defaults: SeedDefaults['rules']): Promise<void> {
      await d.transaction('rw', d.classifyRules, async () => {
        await d.classifyRules.where('source').equals('default').delete()
        await d.classifyRules.bulkAdd(defaults.map((r, i) => ({ id: `default.${i}`, pattern: r.pattern, categoryId: r.categoryId, source: 'default' as const, priority: r.priority, createdAt: 0 })))
      })
    },
  }

  const settings = {
    async get<T>(key: string, fallback: T): Promise<T> {
      const row = await d.settings.get(key)
      return row ? (row.value as T) : fallback
    },
    set(key: string, value: unknown) {
      return d.settings.put({ key, value })
    },
    remove(key: string) {
      return d.settings.delete(key)
    },
  }

  /** 첫 실행 시 기본 데이터 채우기 (멱등) */
  async function ensureSeeded(defaults: SeedDefaults): Promise<boolean> {
    const version = await settings.get<number>('seed.version', 0)
    if (version >= SEED_VERSION) return false
    await d.transaction('rw', [d.categories, d.classifyRules, d.accounts, d.settings], async () => {
      if ((await d.categories.count()) === 0) await d.categories.bulkAdd(defaults.categories)
      if ((await d.classifyRules.count()) === 0)
        await d.classifyRules.bulkAdd(defaults.rules.map((r, i) => ({ id: `default.${i}`, pattern: r.pattern, categoryId: r.categoryId, source: 'default' as const, priority: r.priority, createdAt: 0 })))
      if ((await d.accounts.count()) === 0) {
        await d.accounts.bulkAdd([
          { id: 'acc.cash', name: '현금', type: 'cash', initialBalance: 0, color: '#16a34a', sortOrder: 0, isArchived: false },
          { id: 'acc.bank', name: '은행 계좌', type: 'bank', initialBalance: 0, color: '#2563eb', sortOrder: 1, isArchived: false },
          { id: 'acc.card', name: '신용카드', type: 'card', initialBalance: 0, color: '#7c3aed', sortOrder: 2, isArchived: false },
        ])
      }
      await d.settings.put({ key: 'seed.version', value: SEED_VERSION })
      await d.settings.put({ key: 'installedAt', value: new Date().toISOString() })
    })
    return true
  }

  async function dumpAll(): Promise<BackupData> {
    return d.transaction('r', [d.transactions, d.categories, d.accounts, d.budgets, d.recurringRules, d.classifyRules, d.settings], async () => ({
      app: 'management-money' as const,
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: await d.transactions.toArray(),
      categories: await d.categories.toArray(),
      accounts: await d.accounts.toArray(),
      budgets: await d.budgets.toArray(),
      recurringRules: await d.recurringRules.toArray(),
      classifyRules: await d.classifyRules.toArray(),
      settings: await d.settings.toArray(),
    }))
  }

  /** 백업 복원. replace: 전부 지우고 복원, merge: 같은 id는 덮어쓰고 나머지는 추가 */
  async function restoreAll(data: BackupData, mode: 'replace' | 'merge'): Promise<void> {
    if (data.app !== 'management-money' || !Array.isArray(data.transactions)) throw new ValidationError('백업 파일 형식이 아닙니다')
    const tables = [d.transactions, d.categories, d.accounts, d.budgets, d.recurringRules, d.classifyRules, d.settings]
    await d.transaction('rw', tables, async () => {
      // 자동 백업 폴더 핸들은 기기 고유 설정이므로 덮어쓰기 복원에서도 유지한다
      const dirHandle = await d.settings.get('backup.dirHandle')
      if (mode === 'replace') for (const t of tables) await t.clear()
      if (dirHandle) await d.settings.put(dirHandle)
      await d.categories.bulkPut(data.categories ?? [])
      await d.accounts.bulkPut(data.accounts ?? [])
      // month는 date에서 다시 계산해 저장한다 (백업 파일의 값이 비거나 어긋나도 월별 조회에서 빠지지 않게)
      await d.transactions.bulkPut((data.transactions ?? []).map((t) => ({ ...t, month: toMonthKey(t.date), recurringMonth: t.recurringMonth ?? null })))
      await d.budgets.bulkPut(data.budgets ?? [])
      await d.recurringRules.bulkPut(data.recurringRules ?? [])
      await d.classifyRules.bulkPut(data.classifyRules ?? [])
      await d.settings.bulkPut((data.settings ?? []).filter((s) => s.key !== 'backup.dirHandle'))
    })
  }

  async function clearAll(): Promise<void> {
    const tables = [d.transactions, d.categories, d.accounts, d.budgets, d.recurringRules, d.classifyRules, d.settings]
    await d.transaction('rw', tables, async () => {
      for (const t of tables) await t.clear()
    })
  }

  return { transactions, categories, accounts, budgets, recurring, classifyRules, settings, ensureSeeded, dumpAll, restoreAll, clearAll }
}

export type Repos = ReturnType<typeof makeRepos>

export const repos = makeRepos(db)
export const txRepo = repos.transactions
export const categoryRepo = repos.categories
export const accountRepo = repos.accounts
export const budgetRepo = repos.budgets
export const recurringRepo = repos.recurring
export const ruleRepo = repos.classifyRules
export const settingsRepo = repos.settings
