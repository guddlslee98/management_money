# 개발 도구 연동 가이드 — Context7 · agent-browser

이 문서는 Claude Code로 이 저장소를 개발할 때 쓰는 두 가지 외부 개발 도구의 역할, 연결 방식, 사용법, 제한사항을 정리한다.

| 항목 | 검증 값 (2026-09-05 기준) |
| --- | --- |
| `@upstash/context7-mcp` | `4.0.5` (`npm view @upstash/context7-mcp version`) |
| `agent-browser` | `0.36.0` (`agent-browser --version`) |
| Claude Code | `2.1.261` (`claude --version`) |
| 연결 파일 | `.mcp.json` (프로젝트 스코프 MCP), `scripts/e2e-smoke.sh`, `package.json` → `npm run e2e:smoke` |

---

## 1. 한눈에 보기

| 도구 | 무엇인가 | 이 저장소에서의 용도 |
| --- | --- | --- |
| **Context7** (Upstash) | 라이브러리·프레임워크의 **최신 공식 문서와 코드 예제**를 LLM에 바로 주입해 주는 MCP 서버/REST API. 학습 데이터가 오래됐거나 버전이 바뀐 API(예: Vite 8, React 19, Dexie 4, vite-plugin-pwa)에 대해 정확한 답을 얻기 위해 쓴다. | Claude Code가 코드를 작성/수정할 때 문서를 조회하는 용도 (`.mcp.json`의 `context7` 서버) |
| **agent-browser** (Vercel Labs) | AI 에이전트용 **헤드리스 브라우저 자동화 CLI**. Chrome을 CDP로 제어하고, 접근성 트리 스냅샷을 `@e1`, `@e2` 같은 짧은 ref로 돌려줘 적은 토큰으로 페이지를 조작할 수 있다. MCP 서버 모드도 내장. | (1) Claude Code가 dev 서버 화면을 직접 열어 확인하는 용도 (`.mcp.json`의 `agent-browser` 서버), (2) `scripts/e2e-smoke.sh` 스모크 테스트 |

---

## 2. Context7

### 2.1 이 저장소의 연결 — `.mcp.json`

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY:-}"
      }
    }
  }
}
```

- **전송 방식**: stdio. Claude Code가 `npx -y @upstash/context7-mcp`를 자식 프로세스로 띄운다 (첫 실행 시 패키지를 내려받는다).
- **API 키는 선택**이다. 서버는 `--api-key <key>` 플래그 또는 `CONTEXT7_API_KEY` 환경변수를 읽고(`context7-mcp --help`), 소스상 `cliOptions.apiKey || process.env.CONTEXT7_API_KEY`이므로 빈 문자열이면 "키 없음"으로 동작한다. 실제로 `CONTEXT7_API_KEY=""`로 서버를 띄워 `tools/list`가 정상 응답하는 것을 확인했다.
- **`${CONTEXT7_API_KEY:-}`를 반드시 유지**할 것. Claude Code의 `.mcp.json`은 `${VAR}`와 `${VAR:-default}` 확장을 `command`/`args`/`env`/`url`/`headers`에서 지원한다. 단, **기본값 없이 `${VAR}`만 쓰고 변수가 비어 있으면 경고를 내고 `${VAR}` 문자열을 그대로 전달**하므로, 그 문자열이 API 키로 보내져 실패한다. `:-`로 빈 기본값을 주면 키가 없어도 앱/도구가 정상 동작한다. (출처: https://code.claude.com/docs/en/mcp)
- 프로젝트 스코프(`.mcp.json`)는 저장소에 커밋해 팀이 공유한다. 보안상 Claude Code는 **최초 사용 전에 승인 프롬프트**를 띄운다. 상태는 `claude mcp list`로 확인:

```text
$ claude mcp list
context7: npx -y @upstash/context7-mcp - ⏸ Pending approval (run `claude` to approve)
agent-browser: npx -y agent-browser mcp --tools core - ⏸ Pending approval (run `claude` to approve)
```

### 2.2 노출되는 MCP 도구 (v4.0.5, `tools/list`로 확인)

| 도구 이름 | 파라미터 (모두 필수) | 설명 |
| --- | --- | --- |
| `resolve-library-id` | `query`, `libraryName` | 라이브러리 이름을 Context7 ID(`/org/project`)로 변환. 후보 목록·신뢰도·버전 목록을 돌려준다. |
| `query-docs` | `libraryId`, `query` | Context7 ID로 문서/코드 예제를 조회. 질문당 3회 이하 호출 권장(서버 설명). |

Claude Code 안에서는 `mcp__context7__resolve-library-id`, `mcp__context7__query-docs` 라는 이름으로 보인다 (`mcp__<서버>__<도구>` 규칙).
사용자가 `/org/project` 또는 `/org/project/version` 형식으로 ID를 직접 주면 `resolve-library-id`를 건너뛰고 바로 `query-docs`를 호출한다.

### 2.3 Claude Code에서 쓰는 법

프롬프트에 **`use context7`** 를 붙이면 된다.

```text
vite-plugin-pwa 에서 registerType: 'autoUpdate' 로 설정할 때 서비스워커 갱신 흐름을 알려줘. use context7
```

라이브러리 ID를 알면 직접 지정해 매칭 단계를 생략할 수 있다(버전도 지정 가능).

```text
Dexie 4 에서 복합 인덱스로 월별 거래를 조회하는 코드를 써줘. use library /dexie/dexie.js
React Router 8 의 data router 설정을 보여줘. use context7 with /remix-run/react-router
```

매번 붙이기 싫으면 `CLAUDE.md`에 규칙 한 줄을 추가한다(공식 README 예시).

```text
Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
```

참고: `npx ctx7 setup --claude`를 실행하면 OAuth 로그인 → API 키 생성 → Claude Code용 스킬/MCP를 **사용자 레벨**에 자동 설치해 준다(`/context7:docs <library> [query]` 명령 추가). 이 저장소는 `.mcp.json`만으로 동작하므로 필수는 아니다.

### 2.4 API 키 발급·설정 (선택)

키가 없어도 익명 티어로 동작하지만 **공유 레이트 리밋**이 낮다. 무료 키를 받으면 전용 쿼터가 생긴다.

1. https://context7.com/dashboard 접속 후 로그인.
2. **API Keys** 카드에서 **Create API Key** 클릭, 이름(예: `claude-code`) 입력.
3. 생성된 키(`ctx7sk-…`)는 **한 번만 표시**되므로 즉시 복사.
4. 셸 프로필(`~/.zshrc`, `~/.bashrc`) 또는 direnv `.envrc`에 등록하고 Claude Code를 재시작:

```bash
export CONTEXT7_API_KEY="ctx7sk-xxxxxxxxxxxxxxxxxxxxxxxx"
```

- `.mcp.json`은 `${CONTEXT7_API_KEY:-}`로 변수만 참조하므로 **키를 파일에 적지 않는다**. 절대 커밋하지 말 것.
- Vite의 `.env.local`은 앱 빌드용이지 Claude Code가 읽는 파일이 아니므로 거기에 넣어도 효과가 없다.
- 키 폐기는 대시보드에서 즉시·영구 적용된다.

### 2.5 대안: 원격 HTTP 전송

로컬 `npx` 실행이 싫거나 회사 정책상 원격 서버를 써야 하면 `https://mcp.context7.com/mcp`를 쓴다. 키는 **`Authorization: Bearer <key>` 헤더**로 전달한다(`--api-key` 플래그는 HTTP 전송에서 거부됨).

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "Authorization": "Bearer ${CONTEXT7_API_KEY}"
      }
    }
  }
}
```

- 이 형태는 `CONTEXT7_API_KEY`가 **설정된 환경 전용**이다(비어 있으면 `${CONTEXT7_API_KEY}` 문자열이 그대로 전송됨). 키 없이 쓰려면 `headers` 블록을 빼면 되고(익명, `initialize` 200 응답 확인), 세션 안에서 `/mcp` → 로그인으로 OAuth 인증도 가능하다.
- CLI 한 줄로 추가하려면 (사용자 스코프 예시, 공식 문서 그대로):

```bash
claude mcp add --scope user --header "Authorization: Bearer $CONTEXT7_API_KEY" --transport http context7 https://mcp.context7.com/mcp
# 로컬(stdio) 버전
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp --api-key "$CONTEXT7_API_KEY"
```

### 2.6 REST API로 직접 조회 (스크립트·셸에서)

```bash
# 라이브러리 검색 (v2, 공식 레퍼런스)
curl -sS "https://context7.com/api/v2/libs/search?libraryName=vite&query=dev%20server%20port"
# 문서 조회 (v2) — type=txt|json, fast=true 면 재랭킹 생략
curl -sS "https://context7.com/api/v2/context?libraryId=/vitejs/vite&query=server%20port&type=txt" \
  -H "Authorization: Bearer $CONTEXT7_API_KEY"   # 키가 없으면 이 줄 생략

# v1 경로도 아직 동작한다 (2026-09-05 확인)
curl -sS "https://context7.com/api/v1/search?query=vite"
curl -sS "https://context7.com/api/v1/vitejs/vite?type=txt&topic=server%20port&tokens=600"
```

---

## 3. agent-browser

### 3.1 설치

```bash
npm install -g agent-browser        # 또는 brew install agent-browser
agent-browser install               # Chrome for Testing 다운로드
agent-browser install --with-deps   # Linux: 시스템 의존성(certutil 등)까지
agent-browser doctor                # 설치 진단
agent-browser skills get core --full   # 명령어·패턴 전체 가이드 (버전과 항상 일치)
```

전역 설치가 없으면 `npx -y agent-browser …`로도 실행된다(전역 설치가 있으면 npx가 그것을 재사용함). 단, Chromium은 별도로 `agent-browser install`이 필요하다.

### 3.2 이 저장소의 연결 — `.mcp.json`

```json
{
  "mcpServers": {
    "agent-browser": {
      "command": "npx",
      "args": ["-y", "agent-browser", "mcp", "--tools", "core"]
    }
  }
}
```

- `agent-browser mcp [--tools <profiles>]`가 stdio MCP 서버를 띄운다 (`agent-browser mcp --help`). 프로파일: `core`(기본), `network`, `state`, `debug`, `tabs`, `react`, `mobile`, `all`. 쉼표로 조합 가능: `--tools core,network,react`.
- `core`는 MCP 컨텍스트를 작게 유지하는 기본 프로파일로, 29개 도구가 노출된다(`tools/list`로 확인):

```text
agent_browser_tools_profiles  agent_browser_open  agent_browser_read  agent_browser_snapshot
agent_browser_click  agent_browser_fill  agent_browser_type  agent_browser_press
agent_browser_check  agent_browser_uncheck  agent_browser_select  agent_browser_scroll
agent_browser_wait_ms  agent_browser_wait_for_selector  agent_browser_wait_for_text  agent_browser_wait_for_load
agent_browser_screenshot  agent_browser_get_text  agent_browser_get_url  agent_browser_get_title
agent_browser_eval  agent_browser_close  agent_browser_back  agent_browser_forward  agent_browser_reload
agent_browser_tab_new  agent_browser_tab_list  agent_browser_tab_switch  agent_browser_tab_close
```

- 공식 예시는 전역 설치를 전제로 `"command": "agent-browser", "args": ["mcp"]`이다. 이 저장소는 전역 설치가 없는 환경도 고려해 `npx -y`를 쓴다. 모든 도구는 `extraArgs`로 CLI 플래그를 그대로 넘길 수 있다.

### 3.3 CLI 핵심 루프 (Claude Code가 dev 서버를 확인할 때)

```bash
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix dev)"
agent-browser open http://localhost:5173/
agent-browser wait --load networkidle
agent-browser snapshot -i          # 상호작용 요소만, @e1 @e2 … ref 부여
agent-browser click @e3            # 페이지가 바뀌면 반드시 다시 snapshot
agent-browser get text body
agent-browser screenshot e2e-artifacts/step.png
agent-browser close
```

### 3.4 스모크 테스트 — `npm run e2e:smoke`

`scripts/e2e-smoke.sh`가 하는 일:

1. `agent-browser session id --scope worktree --prefix smoke`로 작업 트리별 세션 이름을 만들어 `AGENT_BROWSER_SESSION`에 넣는다(다른 브라우저 세션과 격리).
2. `AGENT_BROWSER_PROXY_BYPASS=localhost,127.0.0.1`을 기본으로 둬 프록시 환경에서도 localhost로 직접 접속한다.
3. `npx vite --port $PORT --strictPort`로 dev 서버를 띄우고(`e2e-artifacts/vite.log`), 최대 30초 동안 `curl`로 준비를 기다린다. 안 뜨면 실패로 종료.
4. `agent-browser open` → `wait --load networkidle` → `wait --text "이번 달"` → 본문에 **"이번 달"/"더보기"** 가 있는지 확인 → `find role link click --name "더보기"`(탭은 아이콘+라벨이라 `find text`로는 못 찾음) → `eval --stdin`으로 `window.__mm.seedSample()` 시딩 → `errors --json`으로 페이지 JS 오류 없음 확인 → 단계별 스크린샷(`e2e-artifacts/01-home.png` …).
5. `trap`으로 종료 시 `agent-browser close`와 vite 프로세스를 정리한다.

```bash
npm run e2e:smoke                     # 기본: 포트 5173, 산출물 e2e-artifacts/
PORT=5180 OUT=/tmp/smoke npm run e2e:smoke
```

- 산출물 디렉터리 `e2e-artifacts/`는 `.gitignore`에 포함되어 있다.
- 화면을 추가할 때는 `expect_text "<텍스트>" "<라벨>"` 줄을 추가하거나, `agent-browser snapshot -i` → `click @eN` → `expect_text` 순으로 흐름을 확장하면 된다.
- 스크립트의 모든 명령/플래그(`session id --scope --prefix`, `open`, `wait --load networkidle`, `get text body`, `screenshot <path>`, `close`, `AGENT_BROWSER_SESSION`, `AGENT_BROWSER_PROXY_BYPASS`)는 agent-browser 0.36.0의 `--help`와 core 스킬 문서로 확인했다.

---

## 4. 알려진 제한사항

**Claude Code on the web(원격 샌드박스)에서**
- 헤드리스 브라우저는 **localhost만** 접근할 수 있다. 외부 사이트를 `agent-browser open`으로 여는 것은 네트워크 정책으로 차단된다.
- `agent-browser read <url>`(브라우저 없이 텍스트만 가져오는 명령)도 샌드박스의 TLS 재종단 프록시 때문에 `invalid peer certificate: UnknownIssuer`로 실패했다. `--ca-cert /root/.ccr/ca-bundle.crt`를 주면 되지만 이때는 NSS `certutil`(`libnss3-tools`, `agent-browser install --with-deps`)이 필요하다. 외부 문서는 `WebFetch`나 `curl`(프록시 CA를 이미 신뢰)로 읽는 편이 확실하다.
- `apt`로 `libnss3-tools`를 설치하려면 먼저 `apt-get update`가 필요할 수 있다.

**Context7**
- 키가 없으면 익명 공유 레이트 리밋에 걸릴 수 있다. 429가 반복되면 §2.4대로 무료 키를 발급한다.
- 문서는 커뮤니티가 등록한 저장소를 크롤링한 결과이므로 정확성을 100% 보장하지 않는다. 결과의 `Source:` URL로 교차 확인할 것.
- 첫 실행 시 `npx`가 패키지를 내려받아 MCP 시작이 느릴 수 있다. 타임아웃이 나면 `MCP_TIMEOUT=30000 claude`처럼 늘린다.
- 프로젝트 스코프 MCP는 세션에서 한 번 승인해야 활성화된다(`claude mcp list`에서 "Pending approval").

**agent-browser**
- Chromium 바이너리는 별도 설치(`agent-browser install`)가 필요하다. `agent-browser doctor`로 상태를 확인한다.
- 스냅샷의 `@eN` ref는 페이지가 바뀌는 순간 무효가 된다. 클릭/제출 후에는 다시 `snapshot`.
- 데몬은 명령이 1시간 없으면 자동 종료된다(`--idle-timeout`으로 조정). 작업이 끝나면 `agent-browser close`.
- 스모크 테스트는 홈 헤더 "이번 달", 하단 탭 "더보기", 더보기 메뉴 "계좌 관리" 문구에 의존한다. 화면 문구가 바뀌면 `expect_text`도 갱신해야 한다.
- `--strictPort`라 5173이 사용 중이면 즉시 실패한다. `PORT=…`로 바꿔 실행한다.

---

## 5. 출처

- Context7 저장소/README: https://github.com/upstash/context7
- Context7 클라이언트별 설치(Claude Code 항목): https://context7.com/docs/resources/all-clients , https://context7.com/docs/clients/claude-code
- Context7 API 키 관리: https://context7.com/docs/howto/api-keys
- Context7 REST API 레퍼런스: https://context7.com/docs/api-reference/search/search-for-libraries , https://context7.com/docs/api-reference/context/get-documentation-context
- npm `@upstash/context7-mcp`: https://www.npmjs.com/package/@upstash/context7-mcp
- Claude Code MCP 문서(`.mcp.json`, 환경변수 확장, 스코프, OAuth): https://code.claude.com/docs/en/mcp
- agent-browser 저장소/README: https://github.com/vercel-labs/agent-browser
- 로컬 확인: `agent-browser --help`, `agent-browser mcp --help`, `agent-browser skills get core --full`, `npx -y @upstash/context7-mcp --help`
