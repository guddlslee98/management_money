/* oxlint-disable react/only-export-components -- PWA 설치 훅과 갱신 토스트를 한 파일에 둔다 */
/**
 * PWA 관련: 서비스워커 갱신 토스트 + 홈 화면 설치 프롬프트.
 * vite.config.ts의 registerType: 'autoUpdate' 기준 — 새 SW가 활성화되면 즉시 새로고침하는 대신
 * onNeedReload로 가로채 "새 버전이 있어요" 토스트를 띄우고 사용자가 누를 때 새로고침한다.
 */
import { useCallback, useEffect, useReducer } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../components/ui'

// ---------- 설치 프롬프트 ----------

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/** beforeinstallprompt는 React가 마운트되기 전에 올 수 있어 모듈 수준에서 잡아둔다 */
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches) || nav.standalone === true
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export interface InstallPromptState {
  /** Chromium: beforeinstallprompt를 잡아둔 상태 → 버튼으로 설치 가능 */
  canPrompt: boolean
  isStandalone: boolean
  isIOS: boolean
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export function useInstallPrompt(): InstallPromptState {
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    listeners.add(rerender)
    return () => {
      listeners.delete(rerender)
    }
  }, [])

  const install = useCallback(async () => {
    const p = deferredPrompt
    if (!p) return 'unavailable' as const
    await p.prompt()
    const { outcome } = await p.userChoice
    if (outcome === 'accepted') deferredPrompt = null
    notify()
    return outcome
  }, [])

  return { canPrompt: deferredPrompt !== null, isStandalone: isStandaloneDisplay(), isIOS: isIOSDevice(), install }
}

// ---------- 서비스워커 갱신 토스트 ----------

const OFFLINE_TOAST_MS = 4000

export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    // autoUpdate 모드: 새 SW가 제어권을 잡으면 기본은 즉시 reload → 토스트로 대체
    onNeedReload() {
      setNeedRefresh(true)
    },
    onRegisterError(e) {
      console.error('service worker registration failed', e)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), OFFLINE_TOAST_MS)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!offlineReady && !needRefresh) return null

  const reload = async () => {
    await updateServiceWorker(true)
    window.location.reload()
  }

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none bottom-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-lg">
        <span className="flex-1">{needRefresh ? '새 버전이 있어요' : '오프라인에서도 사용할 수 있어요'}</span>
        {needRefresh ? (
          <Button size="sm" onClick={reload} aria-label="새 버전으로 새로고침">
            새로고침
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setOfflineReady(false)} aria-label="닫기">
            ✕
          </Button>
        )}
      </div>
    </div>
  )
}
