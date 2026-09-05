#!/usr/bin/env bash
# agent-browser 기반 E2E 스모크 테스트 (npm run e2e:smoke / npm run test:e2e:smoke)
# - vite dev 서버를 띄운 뒤 핵심 화면 렌더링, 탭 이동, dev 훅(window.__mm) 시딩, 페이지 JS 오류 여부를 확인한다.
# - 모든 명령/플래그는 agent-browser 0.36.0 기준으로 실행 검증됨
#   (`agent-browser --help`, `agent-browser skills get core --full`)
# 사전 조건: agent-browser (전역 설치 또는 npx 대체) + Chromium (`agent-browser install`; Linux CI는 `--with-deps`)
set -euo pipefail

PORT="${PORT:-5173}"
OUT="${OUT:-e2e-artifacts}"
BASE="http://localhost:$PORT"
mkdir -p "$OUT"

# 전역 설치가 없으면 npx 로 대체 (첫 실행 시 패키지 다운로드로 느릴 수 있음)
if ! command -v agent-browser >/dev/null 2>&1; then
  agent-browser() { npx -y agent-browser "$@"; }
fi

# 세션 격리: 작업 트리별 고유 세션 이름 → 다른 터미널/에이전트의 브라우저(쿠키·탭·@ref)와 섞이지 않는다.
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix smoke)"
# 프록시 환경(HTTP_PROXY/HTTPS_PROXY)에서도 localhost 는 프록시를 거치지 않는다.
export AGENT_BROWSER_PROXY_BYPASS="${AGENT_BROWSER_PROXY_BYPASS:-localhost,127.0.0.1}"
# 스크립트 종료 후 데몬이 오래 남지 않도록 (기본 1시간)
export AGENT_BROWSER_IDLE_TIMEOUT_MS="${AGENT_BROWSER_IDLE_TIMEOUT_MS:-60000}"

npx vite --port "$PORT" --strictPort > "$OUT/vite.log" 2>&1 &
VITE_PID=$!
cleanup() {
  agent-browser close >/dev/null 2>&1 || true
  kill "$VITE_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT
# 어떤 명령이든 실패하면(set -e) 스크린샷·콘솔 로그를 남긴다.
on_err() {
  echo "  ✗ 실패 (line $1)"
  agent-browser screenshot "$OUT/failure.png" >/dev/null 2>&1 || true
  agent-browser console > "$OUT/console.log" 2>/dev/null || true
}
trap 'on_err $LINENO' ERR

PASS=0
ok()   { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; on_err "$LINENO"; exit 1; }
expect_text() { # expect_text <text> <label> — 본문 텍스트에 문자열 포함
  if agent-browser get text body | grep -qF -- "$1"; then ok "$2"; else fail "$2 (expected text: $1)"; fi
}
expect_url() { # expect_url <substring> <label>
  if agent-browser get url | grep -qF -- "$1"; then ok "$2"; else fail "$2 (url: $(agent-browser get url))"; fi
}

# dev 서버 준비 대기 (최대 30초)
ready=0
for _ in $(seq 1 30); do
  if curl -sf --noproxy '*' "$BASE" >/dev/null; then ready=1; break; fi
  sleep 1
done
[ "$ready" = 1 ] || fail "dev 서버가 30초 안에 뜨지 않음 (로그: $OUT/vite.log)"

echo "1) 홈 화면"
agent-browser open "$BASE/"
agent-browser wait --load networkidle
agent-browser wait --text "이번 달"                    # 헤더가 나타날 때까지 (기본 타임아웃 25초)
expect_text "이번 달" "홈 헤더 렌더링"
expect_text "더보기"  "하단 탭 렌더링"
agent-browser snapshot -i > "$OUT/home.snapshot.txt"   # @eN ref 목록 (디버깅 산출물)
agent-browser screenshot "$OUT/01-home.png"

echo "2) 탭 이동 (더보기)"
# 탭 링크는 아이콘+라벨이라 `find text` 는 못 찾는다. 접근성 이름(role+name)으로 찾는다.
agent-browser find role link click --name "더보기"
agent-browser wait --url "**/more"
expect_url "/more" "URL 이 /more 로 변경"
expect_text "계좌 관리" "더보기 메뉴 렌더링"
agent-browser screenshot "$OUT/02-more.png"

echo "3) dev 훅으로 샘플 데이터 시딩 (window.__mm, import.meta.env.DEV 전용)"
# 전체 초기화 → 새로고침(부트스트랩이 기본 카테고리·분류 규칙·계좌를 다시 시딩) → 샘플 거래 생성
agent-browser eval --stdin <<'JS' >/dev/null
(async () => { await __mm.clearAll(); return true })()
JS
agent-browser reload
agent-browser wait --text "계좌 관리"
COUNT="$(agent-browser eval --stdin <<'JS' | tr -dc '0-9'
(async () => {
  await __mm.seedSample({ months: 2 });
  return await __mm.repos.transactions.count();
})()
JS
)"
if [ "${COUNT:-0}" -gt 0 ]; then ok "샘플 거래 ${COUNT}건 저장됨 (IndexedDB)"; else fail "샘플 거래가 저장되지 않음 (count=${COUNT:-?})"; fi
RULES="$(agent-browser eval --stdin <<'JS' | tr -dc '0-9'
(async () => await __mm.repos.classifyRules.all().then((r) => r.length))()
JS
)"
if [ "${RULES:-0}" -gt 100 ]; then ok "기본 분류 규칙 ${RULES}개 시딩됨"; else fail "기본 분류 규칙이 없음 (count=${RULES:-?})"; fi
echo "4) 홈 복귀 + 페이지 JS 오류 확인"
agent-browser find role link click --name "홈"
agent-browser wait --url "$BASE/"
expect_text "이번 달" "홈 재렌더링"
if agent-browser errors --json | grep -qF '"errors":[]'; then ok "페이지 JS 오류 없음"; else agent-browser errors > "$OUT/errors.log"; fail "페이지 JS 오류 발생 ($OUT/errors.log)"; fi
agent-browser screenshot "$OUT/03-home-seeded.png"

# --- 거래 입력 폼(/transactions/new)이 구현되면 아래 템플릿을 켠다. label/버튼명은 실제 화면에 맞출 것. ---
# echo "5) 거래 입력"
# agent-browser open "$BASE/transactions/new"
# agent-browser wait --text "거래 입력"
# agent-browser snapshot -i                          # @eN 확인 후 아래 find/fill 로 치환
# agent-browser find label "금액" fill "12000"
# agent-browser find label "메모" fill "smoke-test"
# agent-browser find role button click --name "저장"
# agent-browser wait --url "**/transactions"
# expect_text "smoke-test" "저장한 거래가 목록에 표시"

echo "5) 거래 입력 → 저장 → 목록 확인"
agent-browser open "$BASE/transactions/new"
agent-browser wait --text "거래 추가"
agent-browser find label "금액" fill "12000"
agent-browser find label "거래처" fill "스타벅스 강남점"
agent-browser find label "메모" fill "smoke-test"
# 거래처 키워드로 카테고리 추천 칩이 뜨면 적용한다 (규칙: 스타벅스 → 카페)
if agent-browser get text body | grep -qF "추천"; then
  agent-browser find role button click --name "적용"
  ok "거래처 키워드로 카테고리 추천·적용"
else
  fail "카테고리 추천 칩이 표시되지 않음"
fi
agent-browser screenshot "$OUT/04-form-filled.png"
agent-browser find role button click --name "저장"
agent-browser wait --url "**/transactions*"
agent-browser wait --text "스타벅스 강남점"
expect_text "스타벅스 강남점" "저장한 거래가 목록에 표시"
expect_text "-₩12,000" "지출 금액이 음수 빨간색 표기로 표시"
agent-browser screenshot "$OUT/05-transactions.png"
SAVED="$(agent-browser eval --stdin <<'JS' | tr -dc '0-9'
(async () => (await __mm.repos.transactions.search("smoke-test")).length)()
JS
)"
if [ "${SAVED:-0}" -eq 1 ]; then ok "IndexedDB에 거래 1건 저장 확인"; else fail "저장된 거래를 찾지 못함 (count=${SAVED:-?})"; fi
echo "6) 리포트 화면"
agent-browser open "$BASE/reports"
agent-browser wait --text "리포트"
expect_text "12개월" "기간 선택 렌더링"
expect_text "평균" "월별 표(평균 행) 렌더링"
agent-browser screenshot "$OUT/06-reports.png"
echo "7) 예산 화면"
agent-browser open "$BASE/budgets"
agent-browser wait --text "예산"
expect_text "총 예산" "예산 요약 카드 렌더링"
agent-browser screenshot "$OUT/07-budgets.png"
echo "8) 페이지 JS 오류 재확인"
if agent-browser errors --json | grep -qF '"errors":[]'; then ok "페이지 JS 오류 없음 (전체 시나리오)"; else agent-browser errors > "$OUT/errors.log"; fail "페이지 JS 오류 발생 ($OUT/errors.log)"; fi
echo "스모크 테스트 통과 ($PASS 검사) — 산출물: $OUT/"
