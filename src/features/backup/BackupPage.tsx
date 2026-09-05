import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ChangeEvent } from 'react'
import { Page } from '../../components/layout/AppLayout'
import { Button, Card, CardTitle, PageHeader, Sheet } from '../../components/ui'
import { repos, settingsRepo, type BackupData } from '../../db/repo'
import { useSetting } from '../../hooks/data'
import {
  AUTO_BACKUP_KEEP_DAYS,
  AUTO_BACKUP_LATEST_FILE,
  BACKUP_KEYS,
  disconnectBackupDirectory,
  getBackupDirectory,
  pickBackupDirectory,
  requestBackupPermission,
  useAutoBackupStatus,
  writeBackupNow,
  writeTextFile,
  preRestoreFileName,
} from '../../app/autoBackup'
import { downloadTextFile, readFileText, reloadApp } from './browser'
import { formatBytes, formatDateTime } from './format'
import { BACKUP_TABLES, TABLE_LABELS, backupFileName, csvFileName, parseBackupJson, summarizeBackup, toBackupJson, transactionsToCsv, type BackupSummary } from './serialize'

const errorText = (e: unknown) => (e instanceof Error && e.message ? e.message : '알 수 없는 오류가 발생했어요')

/** 개발 모드: E2E(agent-browser eval)에서 내려받기 없이 백업 텍스트를 검증하기 위한 노출 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __mmBackup: unknown }).__mmBackup = {
    exportJson: async () => toBackupJson(await repos.dumpAll()),
    exportCsv: async () => transactionsToCsv(await repos.transactions.all(), await repos.categories.all(), await repos.accounts.all()),
    parse: parseBackupJson,
  }
}

export default function BackupPage() {
  return (
    <>
      <PageHeader title="백업·복원" back="/more" />
      <Page>
        <DataStatusCard />
        <ManualBackupCard />
        <RestoreCard />
        <AutoBackupCard />
      </Page>
    </>
  )
}

// ---------- (a) 데이터 현황 ----------

const COUNT_TABLES = BACKUP_TABLES.filter((t) => t !== 'settings')

export function DataStatusCard() {
  const counts = useLiveQuery(
    async () => ({
      transactions: await repos.transactions.count(),
      categories: (await repos.categories.all()).length,
      accounts: (await repos.accounts.all()).length,
      budgets: (await repos.budgets.all()).length,
      recurringRules: (await repos.recurring.all()).length,
      classifyRules: (await repos.classifyRules.all()).length,
      settings: 0,
    }),
    [],
  )
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [persistMsg, setPersistMsg] = useState<string | null>(null)

  useEffect(() => {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (!storage) return
    let alive = true
    storage.estimate?.().then((e) => alive && setEstimate({ usage: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => {})
    storage.persisted?.().then((p) => alive && setPersisted(p)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const requestPersist = async () => {
    try {
      const ok = await navigator.storage.persist()
      setPersisted(ok)
      setPersistMsg(ok ? '영구 저장이 설정됐어요. 브라우저가 공간을 정리할 때도 이 앱의 데이터는 지우지 않아요.' : '브라우저가 아직 승인하지 않았어요. 앱을 홈 화면에 설치하거나 자주 사용하면 승인될 수 있어요.')
    } catch {
      setPersistMsg('이 브라우저에서는 영구 저장을 요청할 수 없어요.')
    }
  }

  return (
    <Card>
      <CardTitle>데이터 현황</CardTitle>
      <dl className="grid grid-cols-3 gap-2 text-center" data-testid="data-counts">
        {COUNT_TABLES.map((t) => (
          <div key={t} className="rounded-xl bg-surface-2 p-2">
            <dt className="text-xs text-muted">{TABLE_LABELS[t]}</dt>
            <dd className="text-lg font-bold tnum">{counts ? counts[t] : '…'}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <div className="min-w-0">
          <p className="text-muted">
            저장 공간 {estimate ? <span className="tnum text-text">{formatBytes(estimate.usage)}</span> : '-'}
            {estimate && estimate.quota > 0 && <span className="tnum"> / {formatBytes(estimate.quota)}</span>}
          </p>
          <p className="text-xs text-muted">영구 저장: {persisted === null ? '확인 불가' : persisted ? '설정됨' : '미설정'}</p>
        </div>
        {persisted === false && (
          <Button size="sm" variant="secondary" onClick={requestPersist} aria-label="영구 저장 요청">
            영구 저장 요청
          </Button>
        )}
      </div>
      {persistMsg && <p className="mt-2 text-xs text-muted">{persistMsg}</p>}
    </Card>
  )
}

// ---------- (b) 수동 백업 ----------

export function ManualBackupCard() {
  const lastExportAt = useSetting<string | null>(BACKUP_KEYS.lastExportAt, null)
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: 'json' | 'csv') => {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'json') {
        downloadTextFile(backupFileName(new Date()), toBackupJson(await repos.dumpAll()), 'application/json')
        await settingsRepo.set(BACKUP_KEYS.lastExportAt, new Date().toISOString())
      } else {
        const [txs, cats, accs] = await Promise.all([repos.transactions.all(), repos.categories.all(), repos.accounts.all()])
        downloadTextFile(csvFileName(new Date()), transactionsToCsv(txs, cats, accs), 'text/csv;charset=utf-8')
      }
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardTitle>수동 백업</CardTitle>
      <p className="text-sm text-muted mb-3">JSON 백업 하나에 거래·카테고리·계좌·예산·반복 거래·분류 규칙이 모두 들어가요. 복원은 이 JSON 파일로만 할 수 있어요.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => run('json')} disabled={busy !== null} aria-label="JSON 백업 내려받기">
          JSON 백업 내려받기
        </Button>
        <Button variant="secondary" onClick={() => run('csv')} disabled={busy !== null} aria-label="거래 CSV 내려받기">
          거래 CSV 내려받기
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">마지막 JSON 백업: {formatDateTime(lastExportAt)}</p>
      {error && <p className="mt-2 text-xs text-expense">{error}</p>}
    </Card>
  )
}

// ---------- (c) 복원 ----------

type RestoreMode = 'replace' | 'merge'
interface Pending {
  fileName: string
  data: BackupData
  summary: BackupSummary
}

export function RestoreCard() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [mode, setMode] = useState<RestoreMode>('replace')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setError(null)
    setPending(null)
    if (!file) return
    try {
      const data = parseBackupJson(await readFileText(file))
      setPending({ fileName: file.name, data, summary: summarizeBackup(data) })
    } catch (err) {
      setError(errorText(err))
    }
  }

  const restore = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      // 덮어쓰기는 settings도 비우므로 자동 백업 폴더 연결을 유지한다
      const dir = await getBackupDirectory()
      // 복원 전 현재 데이터를 스냅샷으로 남긴다: 자동 백업 폴더가 있으면 그 폴더에, 없으면 내려받기
      const snapshotName = preRestoreFileName(new Date())
      const snapshot = toBackupJson(await repos.dumpAll())
      if (dir) await writeTextFile(dir, snapshotName, snapshot).catch(() => downloadTextFile(snapshotName, snapshot, 'application/json'))
      else downloadTextFile(snapshotName, snapshot, 'application/json')
      await repos.restoreAll(pending.data, mode)
      if (dir) await settingsRepo.set(BACKUP_KEYS.dirHandle, dir)
      setConfirmOpen(false)
      setDone(true)
      await writeBackupNow({ dir }).catch(() => {})
      setTimeout(reloadApp, 1000)
    } catch (err) {
      setError(errorText(err))
      setConfirmOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const s = pending?.summary
  return (
    <Card>
      <CardTitle>복원</CardTitle>
      <label htmlFor="restore-file" className="block text-xs font-medium text-muted mb-1">
        백업 파일 (.json)
      </label>
      <input
        id="restore-file"
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        disabled={busy || done}
        className="block w-full text-sm text-muted file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:text-sm file:font-medium file:text-text"
      />
      {error && <p className="mt-2 text-sm text-expense">{error}</p>}

      {pending && s && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl bg-surface-2 p-3 text-sm" data-testid="restore-summary">
            <p className="font-medium truncate">{pending.fileName}</p>
            <p className="text-xs text-muted">백업 시각: {formatDateTime(s.exportedAt)}</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              {BACKUP_TABLES.map((t) => (
                <li key={t} className="flex justify-between">
                  <span className="text-muted">{TABLE_LABELS[t]}</span>
                  <span className="tnum">{s.counts[t]}건</span>
                </li>
              ))}
            </ul>
            {s.dateRange && (
              <p className="mt-1 text-xs text-muted tnum">
                거래 기간 {s.dateRange.from} ~ {s.dateRange.to}
              </p>
            )}
          </div>

          <fieldset className="space-y-2 text-sm">
            <legend className="text-xs font-medium text-muted mb-1">복원 방식</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="restore-mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-1" />
              <span>
                <span className="font-medium">덮어쓰기</span>
                <span className="block text-xs text-muted">기존 데이터를 모두 지운 뒤 백업 내용으로 복원해요</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="restore-mode" value="merge" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-1" />
              <span>
                <span className="font-medium">병합</span>
                <span className="block text-xs text-muted">같은 항목은 백업 내용으로 갱신하고, 나머지는 추가해요</span>
              </span>
            </label>
          </fieldset>

          {done ? (
            <p className="text-sm text-income font-medium" role="status">
              복원을 완료했어요. 잠시 후 앱을 다시 불러와요…
            </p>
          ) : (
            <Button full variant={mode === 'replace' ? 'danger' : 'primary'} onClick={() => setConfirmOpen(true)} disabled={busy} aria-label="복원하기">
              복원하기
            </Button>
          )}
        </div>
      )}

      <Sheet open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title={mode === 'replace' ? '기존 데이터를 지우고 복원할까요?' : '백업을 병합할까요?'}>
        <div className="space-y-4 text-sm">
          <p>
            {mode === 'replace' ? '지금 기기에 있는 모든 데이터가 삭제되고 ' : '지금 데이터 위에 '}
            <span className="font-semibold tnum">거래 {s?.counts.transactions ?? 0}건</span>을 포함한 백업 내용이 {mode === 'replace' ? '들어가요.' : '더해져요.'} 완료 후 앱을 다시 불러와요.
          </p>
          {mode === 'replace' && <p className="text-xs text-expense">되돌릴 수 없어요. 필요하면 먼저 현재 데이터를 JSON으로 내려받으세요.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={busy} aria-label="취소">
              취소
            </Button>
            <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={restore} disabled={busy} aria-label="복원 확인">
              {busy ? '복원 중…' : '복원'}
            </Button>
          </div>
        </div>
      </Sheet>
    </Card>
  )
}

// ---------- (d) 자동 백업 폴더 ----------

const PERMISSION_LABEL: Record<PermissionState, string> = { granted: '허용됨', prompt: '권한 필요', denied: '거부됨' }

export function AutoBackupCard() {
  const { supported, handle, folderName, permission, lastAutoAt, lastError, refreshPermission } = useAutoBackupStatus()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  const act = async (fn: () => Promise<string | null>) => {
    setBusy(true)
    setMsg(null)
    try {
      setMsg(await fn())
    } catch (e) {
      setMsg(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const pick = () =>
    act(async () => {
      const h = await pickBackupDirectory()
      if (!h) return null
      const r = await writeBackupNow({ dir: h })
      return r === 'ok' ? `"${h.name}" 폴더에 첫 백업을 저장했어요.` : '폴더를 연결했어요.'
    })
  const requestPerm = () =>
    act(async () => {
      if (!handle) return null
      const p = await requestBackupPermission(handle)
      await refreshPermission()
      if (p !== 'granted') return '권한이 허용되지 않았어요.'
      await writeBackupNow({ dir: handle })
      return '권한을 허용했어요. 백업을 저장했어요.'
    })
  const backupNow = () =>
    act(async () => {
      const r = await writeBackupNow()
      if (r === 'no-permission') await refreshPermission()
      return r === 'ok' ? '백업을 저장했어요.' : r === 'no-permission' ? '폴더 권한이 필요해요.' : '연결된 폴더가 없어요.'
    })
  const disconnect = () =>
    act(async () => {
      await disconnectBackupDirectory()
      setDisconnectOpen(false)
      return '폴더 연결을 해제했어요. 폴더 안의 파일은 그대로 남아 있어요.'
    })

  return (
    <Card>
      <CardTitle>자동 백업 폴더</CardTitle>
      {!supported ? (
        <div className="space-y-2 text-sm text-muted">
          <p>이 브라우저는 폴더 자동 백업(File System Access API)을 지원하지 않아요. 데스크톱 Chrome·Edge에서 사용할 수 있어요.</p>
          <p>
            대신 위의 <span className="text-text font-medium">JSON 백업 내려받기</span>로 주기적으로 백업하세요. iPhone·iPad에서는 내려받은 파일이 <span className="text-text font-medium">파일 앱 → 다운로드</span>에 저장돼요. iCloud Drive 폴더로 옮겨 두면 다른
            기기에서도 열 수 있고, 복원할 때는 위 <span className="text-text font-medium">복원</span>에서 파일 앱의 JSON을 선택하면 돼요.
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            Google Drive·iCloud Drive·Dropbox·OneDrive가 동기화하는 폴더를 고르면 백업이 다른 기기에도 자동으로 복사돼요. 데이터가 바뀌면 5초 뒤 <span className="tnum">{AUTO_BACKUP_LATEST_FILE}</span>(최신본)과 날짜별 파일(최근 {AUTO_BACKUP_KEEP_DAYS}일)을
            저장해요.
          </p>
          {handle ? (
            <div className="rounded-xl bg-surface-2 p-3 space-y-1">
              <p>
                <span className="text-muted">폴더</span> <span className="font-medium">{folderName}</span>
              </p>
              <p>
                <span className="text-muted">권한</span>{' '}
                <span className={permission === 'granted' ? 'text-income font-medium' : permission ? 'text-warn font-medium' : ''}>{permission ? PERMISSION_LABEL[permission] : '확인 중'}</span>
              </p>
              <p>
                <span className="text-muted">마지막 자동 백업</span> <span className="tnum">{formatDateTime(lastAutoAt)}</span>
              </p>
              {lastError && <p className="text-expense text-xs">오류: {lastError}</p>}
            </div>
          ) : (
            <p className="text-muted text-xs">아직 연결된 폴더가 없어요. 브라우저를 다시 열면 폴더 권한을 한 번 더 물어볼 수 있어요.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {!handle ? (
              <Button className="col-span-2" onClick={pick} disabled={busy} aria-label="폴더 선택">
                폴더 선택
              </Button>
            ) : (
              <>
                {permission !== 'granted' && (
                  <Button onClick={requestPerm} disabled={busy} aria-label="권한 다시 요청">
                    권한 다시 요청
                  </Button>
                )}
                <Button onClick={backupNow} disabled={busy || permission !== 'granted'} variant={permission === 'granted' ? 'primary' : 'secondary'} aria-label="지금 백업">
                  지금 백업
                </Button>
                <Button variant="secondary" onClick={pick} disabled={busy} aria-label="폴더 변경">
                  폴더 변경
                </Button>
                <Button variant="ghost" onClick={() => setDisconnectOpen(true)} disabled={busy} aria-label="연결 해제">
                  연결 해제
                </Button>
              </>
            )}
          </div>
          {msg && <p className="text-xs text-muted">{msg}</p>}
          <p className="text-xs text-muted">
            다른 기기에서 복원하려면: 그 기기에서 이 화면의 <span className="text-text font-medium">복원</span>을 열고 동기화 폴더의 <span className="tnum">{AUTO_BACKUP_LATEST_FILE}</span>을 선택하세요.
          </p>
        </div>
      )}

      <Sheet open={disconnectOpen} onClose={() => setDisconnectOpen(false)} title="폴더 연결을 해제할까요?">
        <div className="space-y-4 text-sm">
          <p>자동 백업이 멈춰요. 폴더에 이미 저장된 백업 파일은 삭제되지 않아요.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setDisconnectOpen(false)} aria-label="취소">
              취소
            </Button>
            <Button variant="danger" onClick={disconnect} disabled={busy} aria-label="연결 해제 확인">
              연결 해제
            </Button>
          </div>
        </div>
      </Sheet>
    </Card>
  )
}
