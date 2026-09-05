#!/usr/bin/env bash
# agent-browser 기반 스모크 테스트: dev 서버를 띄우고 핵심 화면이 렌더링되는지 확인한다.
# 사전 조건: npm i -g agent-browser (없으면 npx -y agent-browser 로 대체), Chromium 설치(agent-browser install)
# 사용 명령/플래그는 agent-browser 0.36.0 기준으로 검증됨 (`agent-browser --help`, `agent-browser skills get core --full`)
set -euo pipefail
PORT="${PORT:-5173}"
OUT="${OUT:-e2e-artifacts}"
mkdir -p "$OUT"

# 전역 설치가 없으면 npx 로 대체한다 (첫 실행 시 패키지를 내려받으므로 느릴 수 있음).
if ! command -v agent-browser >/dev/null 2>&1; then
  agent-browser() { npx -y agent-browser "$@"; }
fi

# 작업 트리별로 안정적인 세션 이름을 만들어 다른 agent-browser 세션(브라우저/쿠키/탭)과 격리한다.
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix smoke)"
# 프록시 환경(HTTP_PROXY/HTTPS_PROXY)에서도 localhost 는 프록시를 거치지 않도록 한다.
export AGENT_BROWSER_PROXY_BYPASS="${AGENT_BROWSER_PROXY_BYPASS:-localhost,127.0.0.1}"

npx vite --port "$PORT" --strictPort > "$OUT/vite.log" 2>&1 &
VITE_PID=$!
cleanup() { agent-browser close >/dev/null 2>&1 || true; kill "$VITE_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

fail() { echo "✗ $1"; exit 1; }

ready=0
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT" >/dev/null; then ready=1; break; fi
  sleep 1
done
[ "$ready" = 1 ] || fail "dev 서버가 30초 안에 뜨지 않음 (로그: $OUT/vite.log)"

expect_text() { # expect_text <text> <label>
  if agent-browser get text body | grep -q "$1"; then echo "✓ $2"; else fail "$2 (expected text: $1)"; fi
}

agent-browser open "http://localhost:$PORT/"
agent-browser wait --load networkidle
expect_text "이번 달" "홈 화면 헤더 렌더링"
expect_text "더보기" "하단 탭 렌더링"
agent-browser screenshot "$OUT/home.png"
echo "스모크 테스트 통과 — 스크린샷: $OUT/"
