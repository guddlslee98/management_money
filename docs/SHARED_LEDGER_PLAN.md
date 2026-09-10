# 보류 중: 2인 공용 가계부(로그인 + 동기화) 계획

> 상태: **보류.** 사용자가 나중에 "공용 가계부"나 "로그인" 등을 다시 언급하면 이 문서대로 바로 착수한다.
> 배경: 배포된 앱(https://guddlslee98.github.io/management_money/)을 지인과 "각자 로컬"이 아니라
> "로그인해서 같은 하나의 가계부를 같이 쓰는" 형태로 바꾸고 싶어함. 가입 화면은 원치 않고,
> 운영자(사용자 본인)만 계정을 만들 수 있으면 됨.

## 결정된 사항 (다시 묻지 말 것)

- **가입 화면 없음.** 앱에 회원가입 UI를 만들지 않는다. 계정은 백엔드 콘솔에서 운영자가 수동으로 2개만 생성.
- **백엔드는 Firebase**(Supabase 아님). 이유: Supabase 무료 플랜은 7일 미사용 시 프로젝트가 일시정지되는
  문제가 있어 사용자가 신뢰하지 않음([Supabase 공식 문서](https://supabase.com/docs/guides/platform/free-project-pausing)).
  Firebase Spark(무료) 플랜은 비활성 기간에 따른 정지가 없고 일일 쿼터 초과 시에도 삭제되지 않음
  ([Firebase 가격 정책](https://firebase.google.com/pricing)). 하루 읽기 5만/쓰기 2만 건 한도로 2인 가계부
  사용량 대비 압도적으로 여유 있음.
- **로그인 화면이 접근 제한도 겸함.** 별도 PIN이나 Cloudflare Access는 불필요 — 계정 없는 사람은
  로그인에서 막힘. (이전에 "접근 제한은 지금(링크 비공개성)대로 충분"으로 답했으나, 로그인을 붙이면
  자연스럽게 더 강해짐.)
- **공유 범위: 딱 2명이 완전히 같은 하나의 가계부**를 본다(계정별로 분리된 데이터 아님, household 개념도
  불필요 — 그냥 두 UID를 허용 목록에 넣고 같은 데이터를 공유).
- 동기화는 실시간이 이상적이지만 완벽한 동시 편집 충돌 해결(CRDT)까지는 불필요 — "나중에 쓴 게 이긴다"
  수준으로 충분하다고 판단(가계부 입력이 초 단위로 충돌할 일은 거의 없음).

## 사용자가 미리 해야 하는 것 (다시 보낼 안내문)

1. https://console.firebase.google.com → 무료 프로젝트 생성 (Analytics는 건너뛰어도 됨)
2. Authentication → Sign-in method → **이메일/비밀번호** 활성화
3. Authentication → Users → 사용자 추가로 본인·지인 계정 2개 생성 (이메일+비밀번호) →
   생성된 **사용자 UID 2개**를 받아야 함
4. Firestore Database → 데이터베이스 만들기 (프로덕션 모드, 가능하면 asia-northeast3 서울)
5. 프로젝트 설정 → 내 앱 → 웹 앱(`</>`) 등록 → **firebaseConfig** 객체를 받아야 함

**필요한 입력 값 2가지: `firebaseConfig` 전체, 두 계정의 UID.** 이걸 받으면 바로 구현 시작.

## 구현 체크리스트 (착수 시)

- [ ] `firebase` npm 패키지 추가, `src/lib/firebase.ts`에 초기화(받은 config로)
- [ ] 로그인 전용 화면 추가 (이메일+비밀번호, 가입 링크 없음). 미로그인 시 앱 전체를 가리는 게이트로 구성
      (`src/App.tsx` 최상단에 인증 상태 체크 추가, 기존 라우트는 그대로 유지)
- [ ] Firestore 보안 규칙: `request.auth.uid in ['<uid1>', '<uid2>']`인 경우에만 read/write 허용,
      그 외 전부 거부 (컬렉션: transactions, categories, accounts, budgets, recurringRules, classifyRules)
- [ ] 동기화 계층: 기존 Dexie(IndexedDB)는 오프라인 캐시로 유지, 로그인 후 Firestore와 양방향 동기화
      (로컬 쓰기 → Firestore로 push, Firestore `onSnapshot` 실시간 리스너 → 변경분 Dexie에 merge)
      - `src/db/repo.ts`의 각 mutate 메서드(add/update/remove 등) 호출 지점에서 훅을 걸거나,
        Dexie의 `hook('creating'|'updating'|'deleting')`을 이용해 변경을 감지해 큐에 쌓고 온라인일 때 flush
      - 최초 로그인 시 로컬에 이미 있던 데이터(있다면)를 한 번 Firestore로 업로드하는 마이그레이션 단계 필요
- [ ] 오프라인 대비: 네트워크 끊겨도 기존처럼 로컬에서 그대로 동작, 재연결 시 자동 동기화
      (Firestore SDK의 오프라인 퍼시스턴스 활용 검토)
- [ ] `CLAUDE.md`, `README.md`, `docs/SUMMARY.md`의 "서버 없음/로컬 우선" 서술을
      "로그인 시 선택적으로 클라우드 동기화"로 갱신
- [ ] 테스트: 보안 규칙 검증(허용되지 않은 UID 거부), 동기화 병합 로직 단위 테스트, 로그인 폼 렌더 테스트
- [ ] agent-browser로 로그인 → 거래 입력 → 새로고침 후에도 유지 → (가능하면) 두 번째 세션에서 동일 계정
      로그인 시 같은 데이터 보이는지 확인
