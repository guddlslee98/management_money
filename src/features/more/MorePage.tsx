import { Link } from 'react-router'
import { Page } from '../../components/layout/AppLayout'
import { Card, PageHeader } from '../../components/ui'

const items = [
  { to: '/more/accounts', icon: '🏦', label: '계좌 관리', desc: '계좌·카드 잔액과 이체' },
  { to: '/more/categories', icon: '🏷️', label: '카테고리 관리', desc: '대분류·소분류 편집' },
  { to: '/more/recurring', icon: '🔁', label: '반복 거래', desc: '월세·구독·급여 자동 등록' },
  { to: '/more/import', icon: '📥', label: '파일 가져오기', desc: '은행·카드·토스·뱅크샐러드 내보내기 파일' },
  { to: '/more/backup', icon: '💾', label: '백업·복원', desc: 'JSON 백업, 동기화 폴더 자동 백업' },
  { to: '/more/settings', icon: '⚙️', label: '설정', desc: '테마, 데이터 초기화' },
]

export default function MorePage() {
  return (
    <>
      <PageHeader title="더보기" />
      <Page>
        <Card className="p-0 divide-y divide-border overflow-hidden">
          {items.map((it) => (
            <Link key={it.to} to={it.to} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <span className="text-xl w-8 text-center" aria-hidden>
                {it.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium">{it.label}</span>
                <span className="block text-xs text-muted truncate">{it.desc}</span>
              </span>
              <span className="text-muted">›</span>
            </Link>
          ))}
        </Card>
      </Page>
    </>
  )
}
