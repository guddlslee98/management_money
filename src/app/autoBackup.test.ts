import { beforeEach, describe, expect, it } from 'vitest'
import { repos, settingsRepo } from '../db/repo'
import { parseBackupJson } from '../features/backup/serialize'
import { AUTO_BACKUP_LATEST_FILE, BACKUP_KEYS, selectBackupsToRemove, writeBackupFiles, writeBackupNow } from './autoBackup'

/** File System Access API 흉내: 메모리 파일 맵 */
class FakeWritable {
  chunks: string[] = []
  private onClose: (text: string) => void
  constructor(onClose: (text: string) => void) {
    this.onClose = onClose
  }
  async write(data: string) {
    this.chunks.push(data)
  }
  async close() {
    this.onClose(this.chunks.join(''))
  }
  async abort() {}
}
class FakeDir {
  kind = 'directory' as const
  files = new Map<string, string>()
  name: string
  constructor(name = 'Backups') {
    this.name = name
  }
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    if (!this.files.has(name)) {
      if (!opts?.create) throw new DOMException('not found', 'NotFoundError')
      this.files.set(name, '')
    }
    return { kind: 'file' as const, name, createWritable: async () => new FakeWritable((t) => this.files.set(name, t)) }
  }
  async removeEntry(name: string) {
    this.files.delete(name)
  }
  async *entries() {
    for (const name of this.files.keys()) yield [name, { kind: 'file' as const, name }] as [string, { kind: 'file'; name: string }]
  }
}
const asHandle = (d: FakeDir) => d as unknown as FileSystemDirectoryHandle

describe('selectBackupsToRemove', () => {
  it('keeps the newest N dated files and ignores other files', () => {
    const names = ['management-money-backup.json', 'notes.txt', ...['2026-09-01', '2026-09-03', '2026-09-02', '2026-08-30'].map((d) => `management-money-backup-${d}.json`)]
    expect(selectBackupsToRemove(names, 2)).toEqual(['management-money-backup-2026-09-01.json', 'management-money-backup-2026-08-30.json'])
    expect(selectBackupsToRemove(names, 7)).toEqual([])
  })
})

describe('writeBackupFiles', () => {
  it('writes latest + dated file and prunes beyond keep', async () => {
    const dir = new FakeDir()
    for (let d = 1; d <= 8; d++) dir.files.set(`management-money-backup-2026-08-${String(d).padStart(2, '0')}.json`, 'old')
    const r = await writeBackupFiles(asHandle(dir), '{"x":1}', '2026-09-05', 7)
    expect(r.written).toEqual([AUTO_BACKUP_LATEST_FILE, 'management-money-backup-2026-09-05.json'])
    expect(dir.files.get(AUTO_BACKUP_LATEST_FILE)).toBe('{"x":1}')
    expect(dir.files.get('management-money-backup-2026-09-05.json')).toBe('{"x":1}')
    // 8개 기존 + 오늘 1개 = 9개 중 최신 7개만 남김
    expect(r.removed).toEqual(['management-money-backup-2026-08-02.json', 'management-money-backup-2026-08-01.json'])
    expect([...dir.files.keys()].filter((n) => n.startsWith('management-money-backup-')).length).toBe(7)
  })
})

describe('writeBackupNow', () => {
  beforeEach(async () => {
    await repos.clearAll()
    await repos.ensureSeeded({ categories: [], rules: [] })
  })

  it('returns no-handle without a stored directory', async () => {
    expect(await writeBackupNow()).toBe('no-handle')
  })

  it('dumps the database into the directory and records lastAutoAt', async () => {
    await repos.transactions.add({ type: 'expense', date: '2026-09-03', amount: 1000, categoryId: null, accountId: 'acc.cash', toAccountId: null, payee: '테스트', memo: '', isRefund: false })
    const dir = new FakeDir()
    expect(await writeBackupNow({ dir: asHandle(dir), today: '2026-09-05' })).toBe('ok')
    const data = parseBackupJson(dir.files.get(AUTO_BACKUP_LATEST_FILE) ?? '')
    expect(data.transactions.map((t) => t.payee)).toEqual(['테스트'])
    expect(data.accounts.length).toBe(3)
    expect(await settingsRepo.get<string | null>(BACKUP_KEYS.lastAutoAt, null)).toMatch(/^\d{4}-/)
    expect(await settingsRepo.get<string | null>(BACKUP_KEYS.lastError, null)).toBeNull()
  })

  it('records lastError when writing fails', async () => {
    const dir = new FakeDir()
    dir.getFileHandle = async () => {
      throw new DOMException('denied', 'NotAllowedError')
    }
    await expect(writeBackupNow({ dir: asHandle(dir) })).rejects.toBeInstanceOf(DOMException)
    expect(await settingsRepo.get<string | null>(BACKUP_KEYS.lastError, null)).toContain('권한')
  })
})
