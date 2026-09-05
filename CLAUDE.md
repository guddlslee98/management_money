# management_money — 가계부 PWA

월별 수입·지출·순수입과 카테고리별 지출 비율을 보여주는 **로컬 우선(local-first) 가계부** 웹앱.
서버 없음. 모든 데이터는 브라우저 IndexedDB(Dexie)에 저장되고 JSON 백업으로 내보내기/복원한다.

## 스택 (2026-09 기준, 고정 버전은 package.json)
- Vite 8 + React 19.2 + TypeScript 6 (`tsc -b`), `react-router` 8 **declarative 모드** (`BrowserRouter`/`Routes`/`NavLink`/`useSearchParams`)
- Tailwind CSS 4 (`@tailwindcss/vite`). 커스텀 토큰: `bg-bg bg-surface bg-surface-2 text-text text-muted border-border text-accent text-income text-expense text-transfer text-warn` (라이트/다크는 `html.dark` 클래스, `src/index.css`)
- Dexie 4 + `dexie-react-hooks`(`useLiveQuery`), Recharts 3, date-fns 4, PapaParse, SheetJS(`xlsx`, 공식 CDN 타르볼)
- 테스트: Vitest 5 + jsdom + fake-indexeddb + Testing Library. 린트: oxlint. PWA: vite-plugin-pwa(autoUpdate)

## 명령
```
npm run dev          # http://localhost:5173  (다른 포트: npx vite --port 5181 --strictPort)
npm run typecheck    # tsc -b --noEmit
npm run lint         # oxlint
npm test             # vitest run
npm run build        # tsc -b && vite build (PWA sw.js 생성)
npm run e2e:smoke    # agent-browser 스모크 테스트 (scripts/e2e-smoke.sh)
```

## 구조
```
src/
  db/types.ts        도메인 타입 (Transaction, Category, Account, Budget, RecurringRule, ClassifyRule) + UNCATEGORIZED
  db/db.ts           Dexie 스키마 v1
  db/repo.ts         저장소 계층: 검증(ValidationError), CRUD, 시딩, 반복거래 생성, 백업 dump/restore
  domain/            순수 계산 로직 (부수효과 없음, 단위 테스트 필수)
    money.ts dates.ts summary.ts classify.ts recurring.ts budget.ts accounts.ts import/hash.ts
  data/default-categories.ts  기본 카테고리(대분류/소분류)와 자동분류 규칙
  hooks/data.ts      useLiveQuery 래퍼 (useCategories, useMonthTransactions, ...)  hooks/useMonth.ts (?m=YYYY-MM)
  components/ui/     Button Card Field(Input/Select/Textarea/Field) Sheet PageHeader Money MonthPicker Segmented ProgressBar CategoryBadge EmptyState
  components/layout/AppLayout.tsx  하단 탭(홈/거래/리포트/예산/더보기) + Page 컨테이너
  features/<기능>/    화면 단위 코드 (home, transactions, reports, budgets, more, accounts, categories, recurring, import, backup, settings)
  app/bootstrap.ts   시작 시 시딩 + 반복거래 생성
```

## 도메인 규칙 (반드시 지킬 것)
- 금액은 **정수 원(KRW)**, 항상 `>= 0`. 환불/반환은 `isRefund: true` (집계 시 차감). 표시는 `domain/money.ts`의 `formatKRW`.
- 날짜는 문자열 `YYYY-MM-DD`, 월은 `YYYY-MM` (`domain/dates.ts`). `Date` 객체로 월 경계를 계산하지 말 것.
- **이체(transfer)는 수입/지출 어디에도 포함하지 않는다.** 카드대금 납부는 은행→카드 이체로 기록.
- 카테고리는 2단계(대분류 `parentId: null` / 소분류). 리포트 비율은 대분류 기준, 소분류는 드릴다운. `categoryId: null` → 미분류(`UNCATEGORIZED`).
- 월 요약은 `summarizeMonth`, 추세는 `monthlyTrend`, 예산은 `budgetUsage`, 잔액은 `accountBalances`를 사용 — 화면에서 직접 합산하지 말 것.
- DB 접근은 `db/repo.ts`를 통해서만. 화면에서는 `hooks/data.ts`의 `useLiveQuery` 훅 사용.
- 가져오기 중복 감지는 `importHash` (`domain/import/hash.ts`).

## UI 컨벤션
- 모바일 우선, 한국어 UI, 본문 폭 `max-w-lg`. 페이지는 `<PageHeader/>` + `<Page/>`. 폼/선택은 `<Sheet/>`(바텀시트).
- 수입=`text-income`(초록), 지출=`text-expense`(빨강), 이체=`text-transfer`(보라). 숫자는 `tnum` 클래스.
- 라이트/다크 모두에서 읽혀야 함(토큰만 사용, 하드코딩 색상 금지 — 카테고리 색은 예외).
- 접근성: 버튼에 aria-label, 폼 필드에 label.

## 개발 도구
- **Context7**: 라이브러리 API는 기억에 의존하지 말고 문서를 확인. MCP(`.mcp.json`, 도구 `resolve-library-id`/`query-docs`) 또는 REST:
  `curl -sS "https://context7.com/api/v1/search?query=recharts"` → `curl -sS "https://context7.com/api/v1/recharts/recharts?type=txt&topic=PieChart&tokens=3000"`
- **agent-browser**: 로컬 dev 서버 E2E. 항상 고유 세션 사용:
  `export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix task)"; export AGENT_BROWSER_PROXY_BYPASS=localhost,127.0.0.1`
  `agent-browser open http://localhost:5173 && agent-browser snapshot -i && agent-browser click @e3 && agent-browser screenshot out.png && agent-browser close`
- 자세한 내용: `docs/dev-tooling.md`

## 작업 규칙
- 변경 후 `npm run typecheck && npm run lint && npm test && npm run build`가 모두 통과해야 한다.
- 순수 로직은 `domain/`에 두고 테스트를 함께 작성한다. 화면 코드에는 계산 로직을 넣지 않는다.
- 커밋 메시지는 영어 conventional commit(`feat:`, `fix:`, `docs:` …).
