import { Component, type ErrorInfo, type ReactNode } from 'react'

const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically imported module/i
const RELOAD_FLAG = 'mm.chunk-reload'

/**
 * 지연 로딩 청크가 서비스워커 업데이트 등으로 사라졌을 때 빈 화면 대신 한 번 새로고침한다.
 * 그 밖의 오류는 다시 시도 안내를 보여준다.
 */
export class ChunkErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('route error', error, info.componentStack)
    if (CHUNK_ERROR.test(error.message)) {
      let reloaded = false
      try {
        reloaded = sessionStorage.getItem(RELOAD_FLAG) === '1'
        if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, '1')
      } catch {
        /* ignore */
      }
      if (!reloaded) window.location.reload()
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-lg p-6 text-center space-y-3">
        <p className="font-semibold">화면을 불러오지 못했어요</p>
        <p className="text-sm text-muted">네트워크 상태를 확인한 뒤 다시 시도하세요.</p>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem(RELOAD_FLAG)
            } catch {
              /* ignore */
            }
            window.location.reload()
          }}
          className="h-10 px-4 rounded-xl bg-accent text-white text-sm font-medium"
        >
          새로고침
        </button>
      </div>
    )
  }
}
