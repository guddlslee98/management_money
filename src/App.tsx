import { useEffect } from 'react'
import { Route, Routes } from 'react-router'
import { startAutoBackup } from './app/autoBackup'
import { bootstrap } from './app/bootstrap'
import { PwaUpdatePrompt } from './app/pwa'
import { AppLayout } from './components/layout/AppLayout'
import AccountsPage from './features/accounts/AccountsPage'
import BackupPage from './features/backup/BackupPage'
import BudgetsPage from './features/budgets/BudgetsPage'
import CategoriesPage from './features/categories/CategoriesPage'
import HomePage from './features/home/HomePage'
import ImportPage from './features/import/ImportPage'
import MorePage from './features/more/MorePage'
import RecurringPage from './features/recurring/RecurringPage'
import ReportsPage from './features/reports/ReportsPage'
import SettingsPage from './features/settings/SettingsPage'
import TransactionFormPage from './features/transactions/TransactionFormPage'
import TransactionsPage from './features/transactions/TransactionsPage'

export default function App() {
  useEffect(() => {
    void bootstrap().then(() => startAutoBackup())
  }, [])

  return (
    <>
      <PwaUpdatePrompt />
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
    </>
  )
}
