import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useInstallPrompt } from '../../app/pwa'
import { seedSampleData } from '../../app/sampleData'
import { APP_VERSION } from '../../app/version'
import { Page } from '../../components/layout/AppLayout'
import { Button, Card, CardTitle, Input, Label, PageHeader, Segmented, Sheet } from '../../components/ui'
import { DEFAULT_RULES } from '../../data/default-categories'
import { repos, ruleRepo, settingsRepo } from '../../db/repo'
import { getThemeMode, setThemeMode, type ThemeMode } from '../../lib/theme'
import { reloadApp } from '../backup/browser'

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

const errorText = (e: unknown) => (e instanceof Error && e.message ? e.message : '알 수 없는 오류가 발생했어요')

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="설정" back="/more" />
      <Page>
        <ThemeCard />
        <InstallCard />
        <DataCard />
        <AboutCard />
      </Page>
    </>
  )
}

// ---------- 테마 ----------

export function ThemeCard() {
  const [mode, setMode] = useState<ThemeMode>(() => getThemeMode())
  const change = (m: ThemeMode) => {
    setMode(m)
    setThemeMode(m)
    void settingsRepo.set('theme', m)
  }
  return (
    <Card>
      <CardTitle>테마</CardTitle>
      <Segmented value={mode} onChange={change} options={THEME_OPTIONS} />
      <p className="mt-2 text-xs text-muted">시스템을 선택하면 기기의 라이트/다크 설정을 따라가요.</p>
    </Card>
  )
}

// ---------- 앱 설치 ----------

export function InstallCard() {
  const { canPrompt, isStandalone, isIOS, install } = useInstallPrompt()
  const [msg, setMsg] = useState<string | null>(null)

  const onInstall = async () => {
    const r = await install()
    setMsg(r === 'accepted' ? '설치를 시작했어요. 홈 화면에서 가계부를 열 수 있어요.' : r === 'dismissed' ? '설치를 취소했어요.' : '지금은 설치 프롬프트를 사용할 수 없어요.')
  }

  return (
    <Card>
      <CardTitle>앱 설치</CardTitle>
      {isStandalone ? (
        <p className="text-sm">
          <span className="text-income font-medium">설치됨</span> <span className="text-muted">— 홈 화면 앱으로 실행 중이에요.</span>
        </p>
      ) : canPrompt ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">홈 화면에 추가하면 앱처럼 전체 화면으로 열리고 오프라인에서도 동작해요.</p>
          <Button onClick={onInstall} aria-label="홈 화면에 추가">
            홈 화면에 추가
          </Button>
        </div>
      ) : isIOS ? (
        <ol className="list-decimal pl-5 space-y-1 text-sm text-muted">
          <li>
            Safari 하단의 <span className="text-text font-medium">공유</span> 버튼(⬆︎)을 누르세요.
          </li>
          <li>
            목록에서 <span className="text-text font-medium">홈 화면에 추가</span>를 선택하세요.
          </li>
          <li>
            오른쪽 위 <span className="text-text font-medium">추가</span>를 누르면 끝이에요.
          </li>
        </ol>
      ) : (
        <p className="text-sm text-muted">브라우저 메뉴(⋮)에서 &lsquo;앱 설치&rsquo; 또는 &lsquo;홈 화면에 추가&rsquo;를 선택하세요. Chrome·Edge에서는 주소창 오른쪽의 설치 아이콘을 눌러도 돼요.</p>
      )}
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </Card>
  )
}

// ---------- 데이터 ----------

type Dialog = 'rules' | 'sample' | 'wipe' | null

function ConfirmSheet({ open, title, onClose, onConfirm, confirmLabel, danger, busy, disabled, children }: { open: boolean; title: string; onClose: () => void; onConfirm: () => void; confirmLabel: string; danger?: boolean; busy?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title={title}>
      <div className="space-y-4 text-sm">
        {children}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy} aria-label="취소">
            취소
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy || disabled} aria-label={`${confirmLabel} 확인`}>
            {busy ? '처리 중…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

const WIPE_WORD = '삭제'

export function DataCard() {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [wipeText, setWipeText] = useState('')

  const close = () => {
    setDialog(null)
    setWipeText('')
  }
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true)
    try {
      const m = await fn()
      setMsg(m)
      close()
    } catch (e) {
      setMsg(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const resetRules = () =>
    run(async () => {
      await ruleRepo.resetDefaults(DEFAULT_RULES)
      return `기본 분류 규칙 ${DEFAULT_RULES.length}개를 복원했어요. 직접 추가한 규칙은 그대로예요.`
    })
  const addSample = () =>
    run(async () => {
      const r = await seedSampleData({ months: 3 })
      return `샘플 거래 ${r.transactions}건을 추가했어요.`
    })
  const wipe = () =>
    run(async () => {
      await repos.clearAll()
      reloadApp()
      return null
    })

  return (
    <Card>
      <CardTitle>데이터</CardTitle>
      <div className="divide-y divide-border -mx-4">
        <Row title="기본 분류 규칙 복원" desc="거래처 키워드 → 카테고리 자동 분류 규칙을 초기 상태로" action={<Button size="sm" variant="secondary" onClick={() => setDialog('rules')} aria-label="기본 분류 규칙 복원">복원</Button>} />
        <Row title="샘플 데이터 넣기" desc="최근 3개월치 데모 거래를 추가해 화면을 미리 볼 수 있어요" action={<Button size="sm" variant="secondary" onClick={() => setDialog('sample')} aria-label="샘플 데이터 넣기">추가</Button>} />
        <Row title="모든 데이터 삭제" desc="거래·카테고리·계좌·예산·설정을 전부 지워요" action={<Button size="sm" variant="danger" onClick={() => setDialog('wipe')} aria-label="모든 데이터 삭제">삭제</Button>} />
      </div>
      {msg && (
        <p className="mt-2 text-xs text-muted" role="status">
          {msg}
        </p>
      )}

      <ConfirmSheet open={dialog === 'rules'} title="기본 분류 규칙을 복원할까요?" onClose={close} onConfirm={resetRules} confirmLabel="복원" busy={busy}>
        <p>기본 규칙이 초기 상태로 돌아가요. 직접 추가한 규칙과 이미 분류된 거래는 바뀌지 않아요.</p>
      </ConfirmSheet>

      <ConfirmSheet open={dialog === 'sample'} title="샘플 데이터를 넣을까요?" onClose={close} onConfirm={addSample} confirmLabel="추가" busy={busy}>
        <p>
          최근 3개월치 <span className="font-medium">데모 거래</span>(급여·월세·구독·식비·이체·환불 등 수십 건)가 실제 데이터와 섞여 추가돼요. 화면을 살펴보는 용도이며, 나중에 개별 삭제하거나 &lsquo;모든 데이터 삭제&rsquo;로 지울 수 있어요.
        </p>
        <p className="text-xs text-warn">실제로 사용 중인 가계부라면 넣지 않는 것을 권해요.</p>
      </ConfirmSheet>

      <ConfirmSheet open={dialog === 'wipe'} title="모든 데이터를 삭제할까요?" onClose={close} onConfirm={wipe} confirmLabel="삭제" danger busy={busy} disabled={wipeText.trim() !== WIPE_WORD}>
        <p className="text-expense">이 기기의 모든 가계부 데이터가 지워지고 되돌릴 수 없어요. 먼저 백업·복원 화면에서 JSON 백업을 내려받으세요.</p>
        <div>
          <Label htmlFor="wipe-confirm">
            계속하려면 <span className="font-semibold text-text">{WIPE_WORD}</span>를 입력하세요
          </Label>
          <Input id="wipe-confirm" value={wipeText} onChange={(e) => setWipeText(e.target.value)} placeholder={WIPE_WORD} autoComplete="off" />
        </div>
      </ConfirmSheet>
    </Card>
  )
}

function Row({ title, desc, action }: { title: string; desc: string; action: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      {action}
    </div>
  )
}

// ---------- 앱 정보 ----------

export function AboutCard() {
  return (
    <Card>
      <CardTitle>앱 정보</CardTitle>
      <dl className="text-sm space-y-2">
        <div className="flex justify-between">
          <dt className="text-muted">버전</dt>
          <dd className="tnum">v{APP_VERSION}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">백업·복원</dt>
          <dd>
            <Link to="/more/backup" className="text-accent font-medium">
              백업 화면 열기 ›
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-muted">저장 위치</dt>
          <dd className="text-xs text-muted mt-0.5">모든 데이터는 이 기기의 브라우저 저장소(IndexedDB)에만 보관돼요. 서버로 보내지 않으며, 브라우저 데이터를 지우면 함께 사라지니 백업을 꼭 남겨 두세요.</dd>
        </div>
      </dl>
    </Card>
  )
}
