import Dexie, { type Table } from 'dexie'
import type { Account, Budget, Category, ClassifyRule, RecurringRule, Setting, Transaction } from './types'

export class MoneyDB extends Dexie {
  transactions!: Table<Transaction, string>
  categories!: Table<Category, string>
  accounts!: Table<Account, string>
  budgets!: Table<Budget, string>
  recurringRules!: Table<RecurringRule, string>
  classifyRules!: Table<ClassifyRule, string>
  settings!: Table<Setting, string>

  constructor(name = 'management-money') {
    super(name)
    this.version(1).stores({
      transactions:
        'id, date, month, type, categoryId, accountId, toAccountId, importHash, recurringRuleId, [month+type], [recurringRuleId+month], [accountId+date]',
      categories: 'id, kind, parentId, [kind+parentId], sortOrder',
      accounts: 'id, type, sortOrder',
      budgets: 'id, categoryId, month, [categoryId+month]',
      recurringRules: 'id, startMonth',
      classifyRules: 'id, categoryId, source, priority',
      settings: 'key',
    })
  }
}

export const db = new MoneyDB()

/** 테스트용: 격리된 인스턴스 */
export function createTestDB(name: string): MoneyDB {
  return new MoneyDB(name)
}
