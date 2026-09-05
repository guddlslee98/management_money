# 지원하는 내보내기 파일 형식

가져오기(`/more/import`)가 인식하는 은행·카드·가계부 앱 파일의 실제 구조를 정리한다. 2026-09 기준이며,
"확인" 표시는 실제 파일을 파싱한 공개 코드/문서에서 열 이름을 확인한 것이고, "미확인"은 문서·후기에서 간접 확인했거나 추정한 것이다.
파서(`src/domain/import/profiles.ts`)는 열 이름 **포함 검색**으로 매핑하므로 순서·괄호 표기(`출금액(원)`)·줄바꿈이 달라도 대체로 동작하고,
안 맞으면 2단계(열 매핑)에서 직접 고칠 수 있다.

## 공통 처리 규칙

| 항목 | 처리 |
| --- | --- |
| 인코딩 | UTF-8 BOM 제거 → UTF-8(엄격) → 실패 시 EUC-KR(CP949). UTF-16 BOM도 인식 |
| 파일 종류 | 매직바이트로 판별: `PK` → xlsx, CFB(`D0 CF 11 E0`) → xls, 텍스트에 `<table` → HTML 표(.xls로 위장한 명세서), 나머지 → CSV/TSV(구분자 자동) |
| 암호화 xlsx | CFB 안의 `EncryptedPackage` 스트림을 감지해 "비밀번호 없이 다시 저장" 안내 (브라우저에서 복호화 불가) |
| 시트 | 행이 가장 많은 시트를 선택 (뱅크샐러드 `뱅샐현황`/`가계부 내역` 구분) |
| 헤더 행 | 앞부분(계좌번호·조회기간 등)을 건너뛰고 날짜·금액·내용·구분 키워드가 2그룹 이상 걸리는 첫 행 |
| 날짜 | `2026-09-05`, `2026.09.05 13:20:11`, `2026/09/05`, `20260905`, `26.09.05`, `2026년 9월 5일`, 엑셀 날짜 셀/일련번호 |
| 금액 | `1,234,567`, `₩1,234`, `-5,500`, `(5,500)` → 정수 원, 절댓값 저장 |
| 방향 | ① 유형 열(지출/수입/이체, 입금/출금) ② 출금·입금 분리 열 ③ 단일 금액 부호(은행: 음수=지출, 카드: 양수=지출) |
| 이체 | 유형 열이 명시적으로 `이체`이거나 거래처/적요에 `카드대금`이 있을 때만 (보수적) |
| 취소/환불 | 취소여부·취소상태·상태 열에 `취소/거절/무효` 또는 `Y` → `isRefund` |
| 합계 행 | 날짜 없이 `합계/총계/소계`가 있는 행은 건너뜀 |
| 중복 | `importHash(날짜+금액+유형+거래처)`가 이미 저장된 거래와 겹치면 기본 해제 + "중복" 표시 |

## 가계부 앱

### 뱅크샐러드 — 확인 (신뢰도 높음)
- 받는 법: 앱 [가계부] › 톱니바퀴 › **파일로 받기** → 이메일(`export-noreply@banksalad.com`)로 xlsx. 최대 1년/회. 파일 비밀번호를 설정하면 암호화됨.
- 시트 2개: `뱅샐현황`(요약, 무시), **`가계부 내역`**(거래).
- 열(10개 고정, 1행 헤더): `날짜 | 시간 | 타입 | 대분류 | 소분류 | 내용 | 금액 | 화폐 | 결제수단 | 메모`
- `타입` = `수입`/`지출`/`이체`. `금액`은 지출 음수·수입 양수(파서는 타입 열로 방향을 정하고 절댓값 사용). `날짜`는 날짜 셀 또는 `YYYY-MM-DD`, `시간`은 `HH:MM:SS`. `화폐`는 보통 `KRW`.
- 대분류/소분류는 우리 카테고리 이름과 맞춰 자동 추천(`categoryMap.ts`).
- 출처: https://help.banksalad.com/207 , https://github.com/Hoonseochoi/hoonsionFinance/blob/main/ANALYSIS_GUIDE.md , https://github.com/underkim/human_status (lib/services/transaction_import_service.dart), https://github.com/wjy5446/donmoa (providers/banksalad.py)

### 편한가계부 (Realbyte) — 미확인 (추정)
- 앱의 "엑셀 내보내기"(월/연 단위). 영문판(Money Manager) 공식 열 순서는 `Date, Account, Category, Subcategory, Note, Amount, Income/Expense, Description(, Currency)`이며 한국어판은 `날짜 | 자산 | 분류 | 소분류 | 내용 | 금액 | 수입/지출 | 메모(, 화폐)`로 추정.
- 파서는 `자산/계좌`, `분류`, `수입/지출` 열 이름으로 감지하고 `수입/지출` 값(`수입`/`지출`/`이체`)으로 방향을 정한다. 열 이름이 다르면 2단계에서 직접 지정.
- 출처: https://help.realbyteapps.com/hc/en-us/articles/360043223253 (영문 열 순서), https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=ko

## 은행

### 토스뱅크 — 확인 (신뢰도 중~높음)
- 받는 법: 토스 앱 › 고객센터/설정 › 증명서 발급 › **거래내역 확인서** › 이메일. 무료, 최대 1년·5,000건/회. xlsx는 **비밀번호(생년월일 6자리)로 암호화**되어 오므로 엑셀에서 열어 비밀번호 없이 다시 저장해야 한다. PDF만 제공되는 경우도 있음.
- 상단 6~8행 메타(성명/계좌번호/조회기간/안내) 뒤 헤더: `거래 일시 | 적요 | 거래 유형 | 거래 기관 | 계좌번호 | 거래 금액 | 거래 후 잔액 | 메모`
  (변형: `순번 | 거래 일시 | 적요 | 거래 유형 | 거래 기록사항(보낸분/받는분) | 거래 금액 | 거래 후 잔액 | 메모`)
- `거래 유형` = `입금`/`출금`/`이자입금`…, `거래 금액`은 출금 음수(정수 또는 `9,000`). 날짜 `YYYY.MM.DD HH:MM:SS` 또는 `YYYY-MM-DD HH:MM:SS`.
- 토스 앱(비은행) 소비내역 자체의 CSV 내보내기는 공식 FAQ에서 확인되지 않음 → `toss` 프로필은 위 변형 CSV용, 그 외는 일반 프로필로 처리.
- 출처: https://support.toss.im/faq/5251 , https://support.toss.im/faq/2131 , https://github.com/Yria/cocktime-scheduler/blob/main/supabase/functions/ingest-bank-email/toss.ts , https://github.com/zeta4lab/toss-bank-bookkeeping-cli , https://github.com/x77xdavid-prog/buja-wallet (src/lib/tossImport.ts)

### 카카오뱅크 — 확인 (신뢰도 높음)
- 받는 법: 앱 계좌 › 톱니바퀴(관리) › **거래내역 다운로드** › 이메일·기간 → 1~10분 후 암호화 xlsx(비밀번호 = 생년월일 6자리). 최대 1년 단위.
- 시트 `카카오뱅크 거래내역`, 헤더 11행, 데이터 12행부터, **B~H열**: `거래일시 | 구분 | 거래금액 | 거래 후 잔액 | 거래구분 | 내용 | 메모`
- `구분` = `입금`/`출금`, `거래금액`은 양수(일부 파서에서는 출금 음수) → 파서는 `구분` 열로 방향 결정. `거래구분` 예: `체크카드결제`, `이체`, `자동이체`, `이자`. 날짜 `YYYY.MM.DD HH:MM:SS`.
- 출처: https://m.kakaobank.com/FaqView/view/9413 , https://github.com/paulfecto/alfred/blob/main/scripts/expense_pipeline/services/parsers/kakaobank.py , https://github.com/hamshmas/highlight-app (src/lib/bank-rules.ts)

### KB국민은행 — 확인 (신뢰도 높음, 변형 다수)
- 받는 법: PC 인터넷뱅킹 조회 › 거래내역조회 › 조회 후 **엑셀저장**(.xls/.xlsx/CSV). 상단에 계좌번호·조회기간 블록.
- 열 변형:
  - `거래일시 | 적요 | 기재내용 | 찾으신금액 | 맡기신금액 | 잔액 | 거래점`
  - `순번 | 거래일시 | 적요 | 보낸분/받는분 | 출금액(원) | 입금액(원) | 잔액(원) | 거래점`
  - `거래일시 | 적요 | 보낸분/받는분 | 송금메모 | 출금액 | 입금액 | 잔액 | 거래점 | 구분`
  - `No | 거래일시 | 보낸분/받는분 | 출금액(원) | 입금액(원) | 잔액(원) | 내 통장 표시 | 적요 | 처리점 | 구분`
- 출금·입금이 분리된 양수 열(`"1,234,567"`), 다른 쪽은 `0`. 날짜 `YYYY.MM.DD HH:MM:SS`. 거래처 = 기재내용/보낸분/받는분, 적요(체크카드·급여·이자 등)는 메모로.
- 인코딩: xlsx는 UTF-8(OOXML), CSV/HTML형 .xls는 **EUC-KR** 가능 → 자동 폴백.
- 출처: https://www.lido.app/kr/eunhaeng-georaenaeyeok , https://github.com/JTech-CO/just-ledger (fixtures/ingest/utf8-src/kb.csv, statement-wasm/src/parse.rs), https://github.com/dankim0310/statementConverter (server.js), https://github.com/scsc-init/homepage_init_backend (docs/api/user.md)

### 신한은행 — 확인 (신뢰도 높음)
- 받는 법: 인터넷뱅킹/SOL 조회 › 입출금 계좌 거래내역조회 › 파일 저장(엑셀).
- 열: `거래일자 | 거래시간 | 적요 | 출금(원) | 입금(원) | 내용 | 잔액(원) | 거래점` (헤더 7행째 부근)
  신형 SOL: `No | 전체선택 | 거래일시 | 적요 | 입금액 | 출금액 | 내용 | 잔액 | 거래점명` (마지막에 합계 행, 금액이 지수표기일 수 있음)
- 날짜 `YYYY-MM-DD`, 시간 `HH:MM:SS`. 거래처 = 내용, 적요 = 메모.
- 출처: https://github.com/dankim0310/statementConverter , https://github.com/DoggySummer/gagyebu (actions/processExcel.ts), https://github.com/ryujungillrqa-dev/ensign-erp

## 카드

카드 이용내역은 유형 열이 없고 금액이 모두 양수이므로 **전부 지출**로 보고, 취소 표시가 있으면 환불(`isRefund`)로 저장한다. 계좌는 카드 계좌를 기본 선택한다.

### 삼성카드 — 확인 (신뢰도 높음)
- 홈페이지 마이 › 이용내역 › 다운로드. xlsx, 암호화 없음. 시트 `■ 국내이용내역`(별도 `■ 해외이용내역`), 헤더 1행.
- 열: `카드번호 | 본인가족구분 | 승인일자 | 승인시각 | 가맹점명 | 승인금액(원) | 일시불할부구분 | 할부개월 | 승인번호 | 취소여부`
- `취소여부` = `Y`/`N`(또는 `취소`). 날짜 `YYYY.MM.DD` + `HH:MM`.
- 출처: https://github.com/paulfecto/alfred/blob/main/scripts/expense_pipeline/README.md , https://github.com/brooksserviceskim/hm-budget (js/parsers.js), https://github.com/tlxhtls/accounting (router.js)

### 신한카드 — 확인 (신뢰도 중~높음)
- 웹 [마이] › 카드이용 › 카드이용내역 › **엑셀저장** (SOL페이 앱은 카톡/이메일 공유). 일반 조회 최대 6개월.
- xlsx 시트 `카드이용내역`: `거래일 | 이용카드 | 가맹점명 | 금액 | 이용구분 | 승인번호 | 매입구분 | 취소상태`
- 이메일 명세서(.xls로 위장한 **EUC-KR HTML**): `이용일자 | 이용카드 | 이용가맹점 | 이용금액 | 할부기간/회차 | 이번달내실금액 | 수수료 | 구분/상태 | 할인/혜택금액 | 잔액 | 포인트적립율`
- `취소상태` = `취소`/`부분취소`. 날짜 `25.12.22`, `2026.05.18`, `2026.05.18 17:31`. 마지막 합계 행 제거.
- 출처: https://github.com/lulurala/money_flow (run_normalization.py), https://github.com/tlxhtls/accounting , https://smartmlab.com/2025/07/shinhancard-usage-statement/

### KB국민카드 — 확인 (신뢰도 중)
- 웹 My KB › 금융정보 › 이용내역 › 엑셀. `.xls`(BIFF 또는 HTML), 헤더 7행째, 헤더 셀에 줄바꿈 포함(`국내이용\n금액\n(원)`).
- 열: `이용일 | 이용 시간 | (이용고객명 | 이용카드명) | 이용하신곳 | 국내이용금액 (원) | (해외이용금액 ($)) | 결제방법 | (가맹점정보 | 할인금액 | 적립포인트) | 상태 | (결제예정일) | 승인번호`
- 날짜 `YYYY.MM.DD` + `HH:MM`, `상태`에 `취소` 포함 시 환불.
- 출처: https://github.com/paulfecto/alfred/blob/main/scripts/expense_pipeline/README.md , https://github.com/lulurala/money_flow , https://github.com/JungDoHee/photogrammer.github.io (2025-04-22 포스트), https://github.com/tlxhtls/accounting

### 현대카드 — 확인 (신뢰도 중)
- 웹 MY ACCOUNT › 소득공제 및 서류발급 › 이용내역 › 엑셀. xlsx이지만 **비밀번호 암호화** → 재저장 필요. 헤더 9행.
- 열: `이용일 | 카드번호 | 가맹점명 | 이용 금액 | 부가세 | 관계 | 할부 | 상태` (다른 화면: `승인일 | 가맹점명 | 승인금액`, 명세서: `결제일 | 이용일 | 입금경로 | 상품명 | 이용하신곳 | 이용금액 | 원금 | 수수료 | 연체료`)
- `상태`로 취소 판정. 날짜 `YYYY.MM.DD` / `YYYY-MM-DD` / `YYYY년 MM월 DD일`.
- 출처: https://github.com/paulfecto/alfred/blob/main/scripts/expense_pipeline/README.md , https://github.com/tlxhtls/accounting , https://github.com/JungDoHee/photogrammer.github.io

## 기타 (프로필 없음, 일반 매핑으로 처리)
- 우리은행 `No. | 거래일시 | 적요 | 기재내용 | 찾으신금액 | 맡기신금액 | 거래후잔액 | 취급기관`, 하나은행 `거래일시 | 구분 | 적요 | 출금액 | 입금액 | 잔액 | 거래점`, NH농협 `순번 | 거래일시 | 출금금액 | 입금금액 | 거래후잔액 | 거래내용 | 거래기록사항 | 거래점`, 케이뱅크 `거래일시 | 거래구분 | 입금금액 | 출금금액 | 잔액 | 상대 예금주명 | 상대 은행`, 롯데카드 `이용일자 | 이용시간 | 이용카드 | 이용가맹점 | 업종 | 이용금액 | 이용구분 | 할부개월 | 승인번호` — 모두 위 별칭에 걸리므로 일반 프로필로 대부분 자동 매핑된다.
  출처: https://github.com/hamshmas/highlight-app (src/lib/bank-rules.ts), https://github.com/dankim0310/statementConverter

## 알려진 한계
- 암호화 xlsx(토스뱅크·카카오뱅크·현대카드)는 브라우저에서 열 수 없다 → 엑셀/Numbers에서 비밀번호 없이 다시 저장.
- PDF 거래내역서는 지원하지 않는다.
- 해외 결제(화폐 ≠ KRW)는 원화 환산 없이 숫자를 그대로 읽는다 → 미리보기에서 제외 권장.
- 이체의 상대 계좌는 파일에 없으므로 3단계에서 "이체 상대 계좌"를 한 번 고른다.
