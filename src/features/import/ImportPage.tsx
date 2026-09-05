import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Page } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/ui'
import { ruleRepo, txRepo, type NewTransaction } from '../../db/repo'
import type { Account } from '../../db/types'
import { suggestPattern } from '../../domain/classify'
import { toMonthKey } from '../../domain/dates'
import { suggestCategories } from '../../domain/import/categoryMap'
import { computeHashes, markDuplicates } from '../../domain/import/dedupe'
import type { ParsedFile, Table } from '../../domain/import/parse'
import { applyMapping, detectProfile, getProfile, type ColumnMapping, type ProfileHint, type ProfileId } from '../../domain/import/profiles'
import { useAccounts, useCategories, useCategoryMap, useClassifyRules } from '../../hooks/data'
import { loadSavedMapping, saveMapping } from './mappingStorage'
import { StepIndicator } from './StepIndicator'
import { DoneStep, type ImportResult } from './steps/DoneStep'
import { FileStep } from './steps/FileStep'
import { MappingStep } from './steps/MappingStep'
import { PreviewStep } from './steps/PreviewStep'

type Step = 1 | 2 | 3 | 4
type BulkMode = 'default' | 'none' | 'withDuplicates'

interface LoadedFile {
  name: string
  parsed: ParsedFile
  table: Table
  detectedId: ProfileId
  confidence: number
}

const EMPTY_ROWS: never[] = []
const EMPTY_SET: Set<string> = new Set()
const BULK_CHUNK = 500

function guessAccount(accounts: Account[], hint: ProfileHint): string | null {
  const active = accounts.filter((a) => !a.isArchived)
  const byType = (t: Account['type']) => active.find((a) => a.type === t)?.id ?? null
  if (hint === 'card') return byType('card') ?? active[0]?.id ?? null
  return byType('bank') ?? active[0]?.id ?? null
}

function guessCounterAccount(accounts: Account[], accountId: string | null): string | null {
  const active = accounts.filter((a) => !a.isArchived && a.id !== accountId)
  const own = accounts.find((a) => a.id === accountId)
  const prefer: Account['type'] = own?.type === 'card' ? 'bank' : 'card'
  return active.find((a) => a.type === prefer)?.id ?? active[0]?.id ?? null
}

export default function ImportPage() {
  const navigate = useNavigate()
  const accounts = useAccounts()
  const categories = useCategories()
  const categoryMap = useCategoryMap()
  const rules = useClassifyRules()

  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<LoadedFile | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [counterAccountId, setCounterAccountId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<ProfileId>('generic')
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [mappingSource, setMappingSource] = useState<'saved' | 'profile'>('profile')
  const [mappingSaved, setMappingSaved] = useState(false)
  /** 저장된 해시 조회 결과: [해시 목록 키, 집합] */
  const [existing, setExisting] = useState<{ key: string; set: Set<string> } | null>(null)
  /** 선택 상태 = 기본 선택(bulk 모드) XOR 사용자가 직접 토글한 행 */
  const [bulk, setBulk] = useState<BulkMode>('default')
  const [toggled, setToggled] = useState<Set<number>>(() => new Set())
  const [overrides, setOverrides] = useState<Map<number, string | null>>(() => new Map())
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const resetSelection = () => {
    setBulk('default')
    setToggled(new Set())
    setOverrides(new Map())
  }

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setLoading(true)
      try {
        // SheetJS/PapaParse는 파일을 고를 때만 로드 (메인 번들 분리)
        const { parseFile, sliceTable, ImportFileError } = await import('../../domain/import/parse')
        const parsed = await parseFile(file)
        const table = sliceTable(parsed.rows)
        if (table.body.length === 0) throw new ImportFileError('empty', '거래 행을 찾지 못했습니다. 파일 내용을 확인하세요.')
        const det = detectProfile(table.headers)
        const saved = await loadSavedMapping(det.profile.id, table.headers)
        setLoaded({ name: file.name, parsed, table, detectedId: det.profile.id, confidence: det.confidence })
        setProfileId(det.profile.id)
        const initialMapping = saved ?? det.profile.mapping(table.headers)
        setMapping(initialMapping)
        setMappingSource(saved ? 'saved' : 'profile')
        setMappingSaved(false)
        setBulk('default')
        setToggled(new Set())
        setOverrides(new Map())
        setResult(null)
        // 카드 명세서로 판정되면(양수 금액=지출) 카드 계좌를 기본으로 고른다
        const acc = guessAccount(accounts, initialMapping.cardDefaultsToExpense ? 'card' : det.profile.hint)
        setAccountId(acc)
        setCounterAccountId(guessCounterAccount(accounts, acc))
      } catch (e) {
        setLoaded(null)
        setMapping(null)
        setError(e instanceof Error && e.name === 'ImportFileError' ? e.message : `파일을 읽지 못했습니다: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setLoading(false)
      }
    },
    [accounts],
  )

  const changeProfile = useCallback(
    async (id: ProfileId) => {
      if (!loaded) return
      setProfileId(id)
      const saved = await loadSavedMapping(id, loaded.table.headers)
      setMapping(saved ?? getProfile(id).mapping(loaded.table.headers))
      setMappingSource(saved ? 'saved' : 'profile')
      setMappingSaved(false)
      // 프로필이 바뀌면 행의 유형·금액이 달라지므로 이전 선택·카테고리 지정·중복 결과를 버린다
      setExisting(null)
      resetSelection()
    },
    [loaded],
  )

  const persistMapping = useCallback(async () => {
    if (!loaded || !mapping) return
    await saveMapping(profileId, loaded.table.headers, mapping)
    setMappingSaved(true)
  }, [loaded, mapping, profileId])

  // 3단계 계산: 매핑 적용 → 해시 → 중복 → 카테고리 추천 (모두 메모이즈, 5천 행도 빠름)
  const rows = useMemo(() => (step >= 3 && loaded && mapping ? applyMapping(loaded.table.body, mapping) : EMPTY_ROWS), [step, loaded, mapping])
  const hashes = useMemo(() => computeHashes(rows), [rows])
  const hashKey = useMemo(() => hashes.join(''), [hashes])
  useEffect(() => {
    if (hashes.length === 0) return
    let cancelled = false
    void txRepo.existingHashes(hashes).then((set) => {
      if (!cancelled) setExisting({ key: hashKey, set })
    })
    return () => {
      cancelled = true
    }
  }, [hashes, hashKey])
  const existingSet = existing && existing.key === hashKey ? existing.set : EMPTY_SET
  // 기존 거래와의 중복 조회가 끝나기 전에는 가져오기를 막는다 (끝나기 전엔 모든 행이 '중복 아님'으로 보임)
  const hashesReady = hashes.length === 0 || (existing !== null && existing.key === hashKey)
  const duplicates = useMemo(() => markDuplicates(hashes, existingSet), [hashes, existingSet])
  const suggestions = useMemo(() => suggestCategories(rows, categories, rules), [rows, categories, rules])
  const canTransfer = Boolean(counterAccountId) && counterAccountId !== accountId

  const selected = useMemo(() => {
    const set = new Set<number>()
    rows.forEach((r, i) => {
      if (r.errors.length) return
      if (r.type === 'transfer' && !canTransfer) return // 상대 계좌가 없으면 이체는 선택 대상에서 제외
      const base = bulk === 'none' ? false : bulk === 'withDuplicates' ? true : !duplicates[i]
      if (base !== toggled.has(r.rowIndex)) set.add(r.rowIndex)
    })
    return set
  }, [rows, duplicates, bulk, toggled, canTransfer])
  const skippedTransfers = useMemo(() => (canTransfer ? 0 : rows.filter((r) => r.type === 'transfer' && r.errors.length === 0).length), [rows, canTransfer])

  const toggle = useCallback((rowIndex: number) => {
    setToggled((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) next.delete(rowIndex)
      else next.add(rowIndex)
      return next
    })
  }, [])

  const selectAll = useCallback((mode: 'all' | 'none' | 'withDuplicates') => {
    setBulk(mode === 'all' ? 'default' : mode)
    setToggled(new Set())
  }, [])

  const setCategory = useCallback(
    async (rowIndex: number, categoryId: string | null, always: boolean) => {
      const row = rows.find((r) => r.rowIndex === rowIndex)
      if (!row) return
      setOverrides((prev) => {
        const next = new Map(prev)
        if (always && row.payee) {
          for (const r of rows) if (r.payee === row.payee && r.type === row.type) next.set(r.rowIndex, categoryId)
        } else next.set(rowIndex, categoryId)
        return next
      })
      if (always && categoryId && row.payee) {
        try {
          await ruleRepo.addUserRule(suggestPattern(row.payee) ?? row.payee, categoryId)
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    },
    [rows],
  )

  const runImport = useCallback(async () => {
    if (!loaded || !mapping || !accountId || !hashesReady) return
    setImporting(true)
    setError(null)
    try {
      const inputs: NewTransaction[] = []
      let errors = 0
      let latest: string | null = null
      rows.forEach((r, i) => {
        if (r.errors.length) {
          errors++
          return
        }
        if (!selected.has(r.rowIndex)) return
        const isTransfer = r.type === 'transfer'
        if (isTransfer && !canTransfer) return // selected 에서 이미 제외됨 (안전장치)
        const wantKind = r.type === 'income' ? 'income' : 'expense'
        const override = overrides.has(r.rowIndex) ? (overrides.get(r.rowIndex) ?? null) : undefined
        // 프로필 변경 등으로 유형이 바뀐 뒤 남은 지정값은 종류가 맞을 때만 사용한다
        const validOverride = override === undefined ? undefined : override === null ? null : categoryMap.get(override)?.kind === wantKind ? override : undefined
        const categoryId = isTransfer ? null : validOverride !== undefined ? validOverride : suggestions[i]
        const from = isTransfer && r.flow === 'in' ? counterAccountId : accountId
        const to = isTransfer ? (r.flow === 'in' ? accountId : counterAccountId) : null
        inputs.push({
          type: r.type,
          date: r.date,
          amount: r.amount,
          categoryId,
          accountId: from,
          toAccountId: to,
          payee: r.payee,
          memo: r.memo,
          isRefund: r.isRefund,
          source: 'import',
          importHash: hashes[i],
        })
        const m = toMonthKey(r.date)
        if (!latest || m > latest) latest = m
      })
      for (let i = 0; i < inputs.length; i += BULK_CHUNK) await txRepo.bulkAdd(inputs.slice(i, i + BULK_CHUNK))
      const skippedDup = rows.filter((r, i) => duplicates[i] && !selected.has(r.rowIndex) && r.errors.length === 0).length
      setResult({ added: inputs.length, duplicates: skippedDup, errors, skippedTransfers, latestMonth: latest })
      setStep(4)
    } catch (e) {
      setError(`가져오기 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
    }
  }, [loaded, mapping, accountId, counterAccountId, rows, selected, overrides, suggestions, hashes, duplicates, hashesReady, canTransfer, skippedTransfers, categoryMap])

  const restart = () => {
    setStep(1)
    setLoaded(null)
    setMapping(null)
    setResult(null)
    setError(null)
    setExisting(null)
    resetSelection()
  }

  const detected = loaded ? getProfile(loaded.detectedId) : null

  return (
    <>
      <PageHeader title="파일 가져오기" back="/more" subtitle="은행·카드·가계부 앱 내보내기 파일" />
      <Page>
        <StepIndicator current={step} />
        {step === 1 && (
          <FileStep
            loading={loading}
            error={error}
            loaded={
              loaded && detected
                ? {
                    name: loaded.name,
                    parsed: loaded.parsed,
                    rowCount: loaded.table.body.length,
                    headerCount: loaded.table.headers.length,
                    profileName: detected.name,
                    confidence: loaded.confidence,
                  }
                : null
            }
            accounts={accounts}
            accountId={accountId}
            onFile={(f) => void handleFile(f)}
            onAccountChange={(id) => {
              setAccountId(id)
              setCounterAccountId(guessCounterAccount(accounts, id))
            }}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && loaded && mapping && detected && (
          <MappingStep
            headers={loaded.table.headers}
            body={loaded.table.body}
            profileId={profileId}
            detectedName={detected.name}
            confidence={loaded.confidence}
            mapping={mapping}
            mappingSource={mappingSource}
            saved={mappingSaved}
            onProfileChange={(id) => void changeProfile(id)}
            onMappingChange={(m) => {
              setMapping(m)
              setMappingSaved(false)
              resetSelection()
            }}
            onSave={() => void persistMapping()}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <>
            {error && (
              <p role="alert" className="text-sm text-expense">
                {error}
              </p>
            )}
            <PreviewStep
              rows={rows}
              duplicates={duplicates}
              suggestions={suggestions}
              overrides={overrides}
              categories={categories}
              categoryMap={categoryMap}
              selected={selected}
              accounts={accounts}
              accountId={accountId}
              counterAccountId={counterAccountId}
              hashesReady={hashesReady}
              importing={importing}
              onToggle={toggle}
              onSelectAll={selectAll}
              onSetCategory={(i, c, a) => void setCategory(i, c, a)}
              onCounterAccountChange={setCounterAccountId}
              onBack={() => setStep(2)}
              onImport={() => void runImport()}
            />
          </>
        )}
        {step === 4 && result && (
          <DoneStep result={result} onViewTransactions={() => navigate(result.latestMonth ? `/transactions?m=${result.latestMonth}` : '/transactions')} onRestart={restart} />
        )}
      </Page>
    </>
  )
}
