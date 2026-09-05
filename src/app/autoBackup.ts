/**
 * 동기화 폴더 자동 백업 엔진 (File System Access API — 데스크톱 Chromium 전용).
 *
 * - 사용자가 고른 폴더 핸들(FileSystemDirectoryHandle)은 구조화 복제가 가능해 IndexedDB(settings 테이블)에 저장한다.
 * - Dexie 전역 'storagemutated' 이벤트(트랜잭션 커밋 후, 다른 탭 포함)로 변경을 감지해 5초 디바운스 후 기록한다.
 *   settings 테이블 변경은 무시한다(엔진 자신이 backup.* 키를 쓰므로 무한 루프 방지).
 * - 기록 파일: management-money-backup.json(최신본, 덮어쓰기) + management-money-backup-YYYY-MM-DD.json(최근 7일 보관).
 */
import Dexie, { type ObservabilitySet } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/db'
import { repos, settingsRepo } from '../db/repo'
import { dateKeyOf, todayKey, type DateKey } from '../domain/dates'
import { backupFileName, DATED_BACKUP_RE, toBackupJson } from '../features/backup/serialize'

export const BACKUP_KEYS = {
  dirHandle: 'backup.dirHandle',
  lastAutoAt: 'backup.lastAutoAt',
  lastError: 'backup.lastError',
  lastExportAt: 'backup.lastExportAt',
} as const

export const AUTO_BACKUP_LATEST_FILE = 'management-money-backup.json'
export const AUTO_BACKUP_KEEP_DAYS = 7
/** 복원 직전 스냅샷 파일명 (날짜형 백업 회전 대상에서 제외됨) */
export const preRestoreFileName = (now: Date) => `management-money-backup-pre-restore-${now.toISOString().replace(/[:.]/g, '-')}.json`
export const AUTO_BACKUP_DEBOUNCE_MS = 5000
const PERMISSION_MESSAGE = '폴더 접근 권한이 필요해요. 백업·복원 화면에서 권한을 다시 요청하세요.'

type PermissionMode = 'read' | 'readwrite'
/** lib.dom에 아직 없는 File System Access 권한 API */
interface PermissionHandle {
  queryPermission?(descriptor: { mode: PermissionMode }): Promise<PermissionState>
  requestPermission?(descriptor: { mode: PermissionMode }): Promise<PermissionState>
}
interface DirectoryPickerOptions {
  id?: string
  mode?: PermissionMode
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
}
type PickerWindow = { showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle> }

export function isAutoBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window && typeof indexedDB !== 'undefined'
}

export function getBackupDirectory(): Promise<FileSystemDirectoryHandle | null> {
  return settingsRepo.get<FileSystemDirectoryHandle | null>(BACKUP_KEYS.dirHandle, null)
}

/** 저장된 핸들의 현재 권한. 권한 API가 없는 환경(테스트 등)은 granted로 본다 */
export async function checkPermission(handle: FileSystemDirectoryHandle, mode: PermissionMode = 'readwrite'): Promise<PermissionState> {
  const h = handle as FileSystemDirectoryHandle & PermissionHandle
  if (typeof h.queryPermission !== 'function') return 'granted'
  try {
    return await h.queryPermission({ mode })
  } catch {
    return 'denied'
  }
}

/** 사용자 제스처(버튼 클릭) 안에서만 호출 가능 */
export async function requestBackupPermission(handle: FileSystemDirectoryHandle, mode: PermissionMode = 'readwrite'): Promise<PermissionState> {
  const h = handle as FileSystemDirectoryHandle & PermissionHandle
  if (typeof h.requestPermission !== 'function') return 'granted'
  return h.requestPermission({ mode })
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

/** 폴더 선택 대화상자 → 핸들 저장. 사용자가 취소하면 null */
export async function pickBackupDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as unknown as PickerWindow).showDirectoryPicker
  if (!picker) throw new Error('이 브라우저는 폴더 선택을 지원하지 않아요')
  let handle: FileSystemDirectoryHandle
  try {
    handle = await picker.call(window, { id: 'management-money-backup', mode: 'readwrite', startIn: 'documents' })
  } catch (e) {
    if (isAbort(e)) return null
    throw e
  }
  await settingsRepo.set(BACKUP_KEYS.dirHandle, handle)
  await settingsRepo.remove(BACKUP_KEYS.lastError)
  return handle
}

export async function disconnectBackupDirectory(): Promise<void> {
  await settingsRepo.remove(BACKUP_KEYS.dirHandle)
  await settingsRepo.remove(BACKUP_KEYS.lastAutoAt)
  await settingsRepo.remove(BACKUP_KEYS.lastError)
}

// ---------- 파일 기록 ----------

export async function writeTextFile(dir: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  try {
    await w.write(text)
    await w.close()
  } catch (e) {
    await w.abort().catch(() => {})
    throw e
  }
}

/** 날짜별 파일 중 최신 keep개만 남기고 지울 이름들 (ISO 날짜는 사전순 = 시간순) */
export function selectBackupsToRemove(names: string[], keep: number = AUTO_BACKUP_KEEP_DAYS): string[] {
  return names
    .filter((n) => DATED_BACKUP_RE.test(n))
    .sort()
    .reverse()
    .slice(Math.max(0, keep))
}

async function listFileNames(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = []
  for await (const [name, h] of dir.entries()) if (h.kind === 'file') names.push(name)
  return names
}

/** 최신본 + 오늘 날짜 파일을 쓰고 오래된 날짜 파일을 정리한다 */
export async function writeBackupFiles(dir: FileSystemDirectoryHandle, json: string, today: DateKey, keep: number = AUTO_BACKUP_KEEP_DAYS): Promise<{ written: string[]; removed: string[] }> {
  const dated = backupFileName(today)
  await writeTextFile(dir, AUTO_BACKUP_LATEST_FILE, json)
  await writeTextFile(dir, dated, json)
  const removed = selectBackupsToRemove(await listFileNames(dir), keep)
  for (const name of removed) await dir.removeEntry(name).catch(() => {})
  return { written: [AUTO_BACKUP_LATEST_FILE, dated], removed }
}

function describeError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return '폴더에 쓸 권한이 없어요. 권한을 다시 요청하세요.'
    if (e.name === 'NotFoundError') return '백업 폴더를 찾을 수 없어요 (이동되거나 삭제됨). 폴더를 다시 선택하세요.'
  }
  return e instanceof Error && e.message ? e.message : '알 수 없는 오류'
}

export type AutoBackupResult = 'ok' | 'no-handle' | 'no-permission'

let inFlight: Promise<AutoBackupResult> = Promise.resolve('no-handle')

/**
 * 지금 즉시 백업 파일을 기록한다 (직렬화: 동시에 불려도 순서대로 실행).
 * dir 생략 시 저장된 핸들 사용. 실패하면 settings 'backup.lastError'에 기록 후 throw.
 */
export function writeBackupNow(opts: { dir?: FileSystemDirectoryHandle | null; today?: DateKey } = {}): Promise<AutoBackupResult> {
  const run = async (): Promise<AutoBackupResult> => {
    const dir = opts.dir === undefined ? await getBackupDirectory() : opts.dir
    if (!dir) return 'no-handle'
    if ((await checkPermission(dir)) !== 'granted') {
      await settingsRepo.set(BACKUP_KEYS.lastError, PERMISSION_MESSAGE)
      return 'no-permission'
    }
    try {
      const json = toBackupJson(await repos.dumpAll())
      await writeBackupFiles(dir, json, opts.today ?? todayKey())
      await settingsRepo.set(BACKUP_KEYS.lastAutoAt, new Date().toISOString())
      await settingsRepo.remove(BACKUP_KEYS.lastError)
      return 'ok'
    } catch (e) {
      console.error('auto backup failed', e)
      await settingsRepo.set(BACKUP_KEYS.lastError, describeError(e))
      throw e
    }
  }
  inFlight = inFlight.catch(() => 'no-handle' as const).then(run)
  return inFlight
}

// ---------- 변경 감지 엔진 ----------

export interface AutoBackupOptions {
  debounceMs?: number
  /** 테스트용: 저장된 핸들 대신 사용할 폴더 */
  resolveDirectory?: () => Promise<FileSystemDirectoryHandle | null>
  /** 테스트용: 지원 여부 검사를 건너뜀 */
  force?: boolean
}

let engineStop: (() => void) | null = null

/** 오늘 백업이 아직 없고 권한이 이미 있으면 시작 시 한 번 기록 (매일 첫 실행마다 날짜 파일 확보) */
async function backupIfStale(resolveDirectory: () => Promise<FileSystemDirectoryHandle | null>): Promise<void> {
  const dir = await resolveDirectory()
  if (!dir || (await checkPermission(dir)) !== 'granted') return
  const last = await settingsRepo.get<string | null>(BACKUP_KEYS.lastAutoAt, null)
  if (last && dateKeyOf(new Date(last)) === todayKey()) return
  await writeBackupNow({ dir }).catch(() => {})
}

/** 앱 시작 시 1회 호출. 멱등이며 반환값으로 중지할 수 있다 */
export function startAutoBackup(options: AutoBackupOptions = {}): () => void {
  if (engineStop) return engineStop
  if (!options.force && !isAutoBackupSupported()) return () => {}
  const debounceMs = options.debounceMs ?? AUTO_BACKUP_DEBOUNCE_MS
  const resolveDirectory = options.resolveDirectory ?? getBackupDirectory
  const prefix = `idb://${db.name}/`
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false

  const flush = () => {
    timer = null
    if (!dirty) return
    dirty = false
    void resolveDirectory()
      .then((dir) => writeBackupNow({ dir }))
      .catch(() => {})
  }
  const schedule = () => {
    dirty = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  }
  const onMutated = (parts: ObservabilitySet) => {
    for (const part of Object.keys(parts)) {
      if (!part.startsWith(prefix)) continue
      const table = part.slice(prefix.length).split('/')[0]
      if (table !== 'settings') {
        schedule()
        return
      }
    }
  }
  // 탭을 떠나거나 숨길 때 대기 중인 백업을 바로 기록 (best-effort)
  const onHidden = () => {
    if (document.visibilityState === 'hidden' && dirty) {
      if (timer) clearTimeout(timer)
      flush()
    }
  }

  Dexie.on('storagemutated', onMutated)
  document.addEventListener('visibilitychange', onHidden)
  void backupIfStale(resolveDirectory)

  engineStop = () => {
    Dexie.on.storagemutated.unsubscribe(onMutated)
    document.removeEventListener('visibilitychange', onHidden)
    if (timer) clearTimeout(timer)
    timer = null
    dirty = false
    engineStop = null
  }
  return engineStop
}

// ---------- 화면용 상태 훅 ----------

export interface AutoBackupStatus {
  supported: boolean
  handle: FileSystemDirectoryHandle | null
  folderName: string | null
  /** null = 폴더 없음 또는 확인 중 */
  permission: PermissionState | null
  lastAutoAt: string | null
  lastError: string | null
  refreshPermission: () => Promise<void>
}

export function useAutoBackupStatus(): AutoBackupStatus {
  const supported = isAutoBackupSupported()
  const handle = useLiveQuery(() => getBackupDirectory(), [], null)
  const lastAutoAt = useLiveQuery(() => settingsRepo.get<string | null>(BACKUP_KEYS.lastAutoAt, null), [], null)
  const lastError = useLiveQuery(() => settingsRepo.get<string | null>(BACKUP_KEYS.lastError, null), [], null)
  // 핸들별 권한 상태: 핸들이 바뀌면 자동으로 null(확인 중)로 파생된다
  const [perm, setPerm] = useState<{ handle: FileSystemDirectoryHandle | null; state: PermissionState | null }>({ handle: null, state: null })
  const permission = handle && perm.handle === handle ? perm.state : null

  const refreshPermission = useCallback(async () => {
    if (!handle) return
    const state = await checkPermission(handle)
    setPerm({ handle, state })
  }, [handle])

  useEffect(() => {
    if (!handle) return
    let alive = true
    checkPermission(handle).then((state) => {
      if (alive) setPerm({ handle, state })
    })
    return () => {
      alive = false
    }
  }, [handle])

  return { supported, handle, folderName: handle?.name ?? null, permission, lastAutoAt, lastError, refreshPermission }
}
