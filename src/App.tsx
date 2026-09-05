import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router'
import { startAutoBackup } from './app/autoBackup'
import { bootstrap } from './app/bootstrap'
import { ChunkErrorBoundary } from './app/ChunkErrorBoundary'
import { PwaUpdatePrompt } from './app/pwa'
import { AppLayout } from './components/layout/AppLayout'
import BudgetsPage from './features/budgets/BudgetsPage'
import HomePage from './features/home/HomePage'
import MorePage from './features/more/MorePage'
import TransactionFormPage from './features/transactions/TransactionFormPage'
import TransactionsPage from './features/transactions/TransactionsPage'

// 무거운 화면(차트·엑셀 파서·백업)은 지연 로딩해 초기 번들을 줄인다
const AccountsPage = lazy(() => import('./features/accounts/AccountsPage'))
const BackupPage = lazy(() => import('./features/backup/BackupPage'))
const CategoriesPage = lazy(() => import('./features/categories/CategoriesPage'))
const ImportPage = lazy(() => import('./features/import/ImportPage'))
const RecurringPage = lazy(() => import('./features/recurring/RecurringPage'))
const ReportsPage = lazy(() => import('./features/reports/ReportsPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))

export default function App() {
  useEffect(() => {
    void bootstrap().then(() => startAutoBackup())
  }, [])

  return (
    <>
      <PwaUpdatePrompt />
      <ChunkErrorBoundary>
    <Suspense fallback={<div className="p-6 text-center text-sm text-muted">불러오는 중…</div>}>
    <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="transactions/new" element={<TransactionFormPage />} />
          <Route path="transactions/:id" element={<TransactionFormPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="more/accounts" element={<AccountsPage />} />
          <Route path="more/categories" element={<CategoriesPage />} />
          <Route path="more/recurring" element={<RecurringPage />} />
          <Route path="more/import" element={<ImportPage />} />
          <Route path="more/backup" element={<BackupPage />} />
          <Route path="more/settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </Suspense>
    </ChunkErrorBoundary>
    </>
  )
}
