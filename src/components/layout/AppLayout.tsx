import { NavLink, Outlet } from 'react-router'
import { cn } from '../../lib/cn'

const tabs = [
  { to: '/', label: '홈', icon: '🏠', end: true },
  { to: '/transactions', label: '거래', icon: '🧾' },
  { to: '/reports', label: '리포트', icon: '📊' },
  { to: '/budgets', label: '예산', icon: '🎯' },
  { to: '/more', label: '더보기', icon: '⋯' },
]

export function AppLayout() {
  return (
    <div className="min-h-dvh flex flex-col bg-bg text-text">
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-border" aria-label="주 메뉴">
        <ul className="mx-auto max-w-lg grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) => cn('flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium', isActive ? 'text-accent' : 'text-muted hover:text-text')}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

/** 페이지 본문 공통 폭 */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-lg px-4 py-4 space-y-4', className)}>{children}</div>
}
