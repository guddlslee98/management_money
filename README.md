# 가계부 (management_money)

월별 **수입·지출·순수입**과 **카테고리별 지출 비율**을 한눈에 보는 로컬 우선(local-first) 가계부 PWA입니다.
서버가 없고 모든 데이터는 내 기기(브라우저 IndexedDB)에만 저장됩니다. JSON 백업으로 내보내고, 동기화 폴더(Google Drive·iCloud 등)에 자동 백업해 다른 기기로 옮길 수 있습니다.

> 조사 결과와 설계 결정은 [`docs/research-brief.md`](docs/research-brief.md), 개발 도구 사용법은 [`docs/dev-tooling.md`](docs/dev-tooling.md), 코드 규칙은 [`CLAUDE.md`](CLAUDE.md)를 보세요.

## 핵심 기능

| 화면 | 기능 |
|---|---|
| 홈 (이번 달) | 수입 · 지출 · 순수입 카드(전월 대비, 저축률), **지출 구성 도넛 + 카테고리별 금액·비율·전월 대비**, 소분류 드릴다운, 예산 요약, 최근 거래 |
| 거래 | 월별 거래 목록(날짜별 그룹, 지출/수입/이체 필터, 검색), 거래 입력·수정·삭제(지출/수입/이체, 환불, 거래처 자동완성, **키워드 자동 분류 추천**) |
| 리포트 | 6개월/12개월/올해 **수입 vs 지출 막대 + 순수입 선**, 누적 순수입, 월별 표(평균·합계), 카테고리 추이, 이번 달 vs 지난달 비교 |
| 예산 | 대분류별 월 예산(기본 예산 / 이번 달 전용), 사용률·초과 표시, 지난달 지출로 채우기 |
| 더보기 | 계좌·자산 관리(잔액·순자산), 카테고리 관리(대분류/소분류, 정렬, 보관), 반복 거래(월세·구독·급여 자동 등록), **파일 가져오기**(CSV/XLSX), 백업·복원, 설정(테마, PWA 설치) |

### 집계 규칙
- 금액은 정수 원 단위. 환불은 같은 카테고리에서 차감됩니다.
- **계좌 간 이체는 수입·지출 어디에도 포함되지 않습니다.** 카드대금 납부는 은행 → 카드 이체로 기록하세요.
- 카테고리는 대분류/소분류 2단계이며 비율은 대분류 기준, 소분류는 드릴다운으로 봅니다. 카테고리가 없는 거래는 "미분류"로 묶입니다.

## 은행·카드 자동 연동은?

사업자등록이 없는 개인 앱은 국내 실시간 자동 연동을 쓸 수 없습니다. 오픈뱅킹은 이용기관(사업자) 등록·보안점검이, 마이데이터는 자본금 5억 이상과 금융위 허가가 필요하고, CODEF 같은 유료 API도 정식 사용에는 사업자등록증이 필요합니다. 해외 어그리게이터(Plaid 등)는 한국을 지원하지 않습니다.

그래서 이 앱은 **수동 입력 + 파일 가져오기**를 채택했습니다.
- 뱅크샐러드 "파일로 받기" 엑셀(은행·카드 통합, 카테고리 포함)
- 토스뱅크·카카오뱅크·KB국민은행 거래내역 엑셀
- 삼성카드·신한카드·KB국민카드·현대카드 이용내역 엑셀
- 일반 CSV(열 매핑 직접 지정)

가져오기 마법사가 헤더로 출처를 자동 감지하고, 열 매핑 → 미리보기(자동 분류·중복 표시) → 저장 순서로 진행합니다. 암호가 걸린 엑셀은 암호를 풀어 다시 저장한 뒤 올려 주세요. 자세한 검토 내용은 [`docs/research-brief.md`](docs/research-brief.md) 2절을 보세요.

## 시작하기

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/ (PWA 서비스워커 포함)
npm run preview      # 빌드 결과 미리보기
```

검증:
```bash
npm run typecheck    # tsc
npm run lint         # oxlint
npm test             # vitest (도메인·저장소·화면 테스트)
npm run e2e:smoke    # agent-browser 로 실제 Chromium에서 스모크 테스트
```

배포: `dist/`를 HTTPS 정적 호스팅(Vercel, Netlify, GitHub Pages, Cloudflare Pages 등)에 올리면 됩니다. PWA 설치·오프라인 캐시는 HTTPS에서만 동작합니다.

## 데이터와 개인정보

- 저장 위치: 브라우저 IndexedDB (`management-money`). 서버로 전송하지 않습니다.
- 백업: 더보기 → 백업·복원에서 JSON 백업을 내려받거나, Chromium 계열 브라우저에서는 **자동 백업 폴더**를 지정해 변경 시마다 JSON을 저장합니다. 이 폴더를 Google Drive·iCloud·OneDrive 동기화 폴더로 잡으면 다른 기기에서 복원할 수 있습니다.
- 브라우저 데이터를 지우면 가계부도 지워집니다. 앱 시작 시 영구 저장(persist)을 요청하지만, 정기적인 백업을 권장합니다.

## 아키텍처

```
src/db        타입, Dexie 스키마, 저장소 계층(검증·시딩·백업)
src/domain    순수 계산 로직: 월간 집계, 추세, 분류기, 반복 거래, 예산, 잔액, 가져오기 파서
src/data      기본 카테고리(대분류/소분류)와 자동 분류 규칙
src/features  화면 단위 코드 (home, transactions, reports, budgets, accounts, categories, recurring, import, backup, settings)
src/components  공용 UI, 차트(Recharts), 피커
```

스택: Vite 8 · React 19 · TypeScript · react-router 8 · Tailwind CSS 4 · Dexie 4 · Recharts 3 · date-fns 4 · PapaParse · SheetJS · vite-plugin-pwa · Vitest 5.

## 개발 도구

- **Context7** (`.mcp.json`): 최신 라이브러리 문서를 확인하며 작성했습니다. API 키는 선택입니다.
- **agent-browser** (`.mcp.json`, `scripts/e2e-smoke.sh`): 실제 Chromium에서 화면을 열고 시딩·클릭·스크린샷으로 검증합니다.

## 알려진 한계와 다음 단계

- 급여일 기준 월(예: 25일 시작)은 아직 지원하지 않습니다(달력월만).
- 분할 거래, 카드 할부의 청구월 분산, 통계 제외 플래그는 미구현입니다.
- 자동 백업 폴더는 File System Access API를 지원하는 Chromium 계열(데스크톱)에서만 동작합니다. Safari·Firefox는 수동 백업을 사용하세요.
- Android 알림 파싱 컴패니언 앱, 이메일 첨부 자동 수집은 향후 확장 옵션입니다.
