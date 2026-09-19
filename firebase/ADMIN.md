# 운영진 작업 현황

## 경로와 기존 구성

- 메뉴: About → 운영진 전용 작업 현황
- 배포 후 URL: https://youngandyou.github.io/mathastro/admin/
- 원본 페이지: `admin/index.qmd`; Quarto 출력: `_site/admin/index.html`
- 기존 Firebase 프로젝트: `mathastro-e9311`, 설정: `assets/firebase-config.json`
- 기존 좋아요는 익명 Authentication + Firestore `postLikes`를 사용한다. 기존 앱 이름 `mathastro-likes`와 로컬 인증 저장 방식을 유지한다.
- 운영진은 같은 Firebase 프로젝트의 별도 앱 인스턴스 `mathastro-admin`과 탭 세션 인증을 사용한다. 운영진 로그아웃은 좋아요의 익명 계정에 영향을 주지 않는다.
- Q&A는 Firebase를 사용하지 않는다. GitHub Discussions → `scripts/sync_discussions.py` → `qna/questions.json` 흐름을 유지한다.
- Realtime Database, Cloud Functions, 새 서버는 사용하지 않는다. `.github/workflows/publish.yml`의 기존 Pages 배포를 그대로 사용한다.

## Firebase에서 처음 한 번 설정

아래 단계는 프로젝트 관리 권한이 있는 운영진이 수행한다. 비밀번호나 서비스 계정 키를 채팅이나 저장소에 올리지 않는다.

1. [Firebase Console](https://console.firebase.google.com/project/mathastro-e9311/overview)에서 **mathastro-e9311** 프로젝트를 연다.
2. **Build → Authentication → Sign-in method → Add new provider → Email/Password**에서 Email/Password를 활성화하고 저장한다. 이메일 링크 방식은 필요 없다. 기존 **Anonymous**는 켜 둔다.
3. **Authentication → Users → Add user**에서 각 운영진의 이메일과 안전한 비밀번호로 계정을 만든다. 비밀번호는 각 운영진에게 안전하게 전달한다. 생성된 계정의 **User UID**를 복사한다. 기존 운영진용 이메일 계정이 있으면 그 UID를 사용한다.
4. **Firestore Database → Data → Start collection**에서 컬렉션 ID를 `adminUsers`로 지정한다. **Document ID**에는 앞에서 복사한 UID를 정확히 입력한다. 자동 ID를 사용하지 않는다. 다음 필드를 추가한다.

   | 필드 | 타입 | 값 |
   | --- | --- | --- |
   | `name` | string | 운영진 표시 이름, 1~80자 |
   | `enabled` | boolean | `true` |
   | `canForceUnlock` | boolean | 강제 해제 담당자는 `true`, 일반 운영진은 `false` |

   다른 운영진도 `adminUsers` 안에 UID를 문서 ID로 추가한다. 적어도 한 명에게 강제 해제 권한을 준다. 두 운영진 모두 이 역할을 맡아도 된다. 계정 생성만으로는 접근 권한이 생기지 않는다. 이메일 공개 allowlist 대신 콘솔에서 관리하는 UID allowlist를 사용한다.
5. **Firestore Database → Rules**에서 현재 게시된 규칙을 먼저 백업하고 저장소의 `firebase/firestore.rules`와 비교한다. 저장소의 기존 `postLikes` 규칙은 그대로 보존했고 `adminUsers`, `adminWork/global` 규칙만 추가했다. 실제 서버에 저장소에 없는 규칙이 있다면 해당 규칙도 유지하여 병합한다. 전체 경로를 누구에게나 허용하는 규칙이 있다면 그 규칙이 새 관리 경로를 허용하지 않게 조정해야 한다. Firestore의 겹치는 allow 규칙은 OR로 평가된다. 확인 후 규칙을 게시한다.
6. `adminWork/global` 문서를 미리 만들지 않는다. 문서가 없으면 작업 가능한 상태이고 첫 작업 시작에서 생성된다.
7. 코드 변경을 `main`에 반영하면 기존 **Publish Quarto site** Actions가 사이트를 배포한다. 추가 GitHub Secrets나 Firebase Hosting 설정은 필요 없다. Firebase 규칙은 Pages workflow에서 자동 배포하지 않는다.

CLI를 이미 사용하는 운영진은 실제 운영 규칙 비교/병합을 마친 후 다음 명령으로 규칙만 배포할 수도 있다.

```sh
cd tests/firebase
pnpm install --frozen-lockfile
pnpm exec firebase login
cd ../..
tests/firebase/node_modules/.bin/firebase deploy --only firestore:rules --project mathastro-e9311
```

## 실제 사용

1. MathAstro → About → 운영진 전용 작업 현황으로 이동한다.
2. 등록된 운영진 계정으로 로그인하고 현재 작업자를 확인한다.
3. 작업 가능 상태에서 작업 내용을 입력하고 **작업 시작**을 누른다.
4. **작업 권한을 획득했습니다** 안내를 확인한 후 로컬 저장소에서 실행한다.

   ```sh
   git switch main
   git pull origin main
   ```

5. 글 또는 코드를 수정한다.
6. `git add`, `git commit`, `git push origin main`을 마친다.
7. **작업 종료**를 누른다. 다른 운영진 화면도 자동으로 갱신된다.

브라우저 종료·로그아웃·연결 끊김은 잠금을 해제하지 않는다. 3시간부터 경고를 표시하며 자동 만료는 없다. 작업을 계속할 때도 새로 로그인하여 본인 잠금을 확인할 수 있다. 다른 운영진이 강제로 해제한 경우 Git 작업을 중단하고 서로 확인한다. 이 시스템은 협업 약속을 돕는 도구이며 GitHub의 push나 로컬 Git 명령을 기술적으로 차단하지 않는다.

강제 해제 담당자는 실제 작업자에게 작업 종료 여부를 확인한 뒤 **작업 상태 강제 해제**를 누르고 확인 창을 승인한다. 확인 중 잠금이 바뀌면 요청은 실패하므로 새 상태를 다시 확인한다. 잠금 소유자의 권한이 취소되었다면 남아 있는 강제 해제 담당자가 처리한다. 담당자 모두 접근할 수 없으면 프로젝트 관리자가 Firebase Console에서 실제 작업 종료를 확인한 뒤 `adminWork/global` 문서를 삭제할 수 있다.

## 구현과 보안

- `assets/firebase-client.mjs`: 기존 공개 설정과 SDK 로딩 공통화.
- `assets/admin-auth.mjs`: 이메일/비밀번호 로그인, 탭 세션, 본인 운영진 권한 실시간 구독.
- `assets/work-store.mjs`: 서버 timestamp, 트랜잭션 획득/해제, 상태 구독, 3시간 경고 계산.
- `assets/work-status.js`, `assets/work-status.css`: 반응형 UI, 권한별 버튼, 확인 창, Git 안내 및 복사.
- `firebase/firestore.rules`: 인증 provider가 password이고 UID가 활성화된 운영진만 잠금 읽기/생성 가능. 기존 잠금 update는 누구에게도 허용하지 않음. 소유자 또는 강제 해제 담당자만 삭제 가능. 클라이언트의 운영진 권한 문서 쓰기는 모두 거부.
- 잠금에는 `locked`, `lockId`, `uid`, `email`, `worker`, `task`, `startedAt`, `updatedAt`을 저장한다. `updatedAt`은 생성 시각이며 heartbeat는 아니다. 완료 시 문서를 삭제하며 작업 이력을 저장하지 않는다.
- 잠금 획득은 동일 문서를 읽고 생성하는 트랜잭션이다. 동시 요청 시 한 요청만 성공한다. 해제 트랜잭션은 화면에서 확인한 `lockId`가 현재 잠금과 같아야 삭제하므로 이전 확인으로 새 작업을 지우지 않는다.
- 서버가 확인한 상태만 작업 시작에 사용한다. 캐시·저장 중·오프라인 상태에서는 작업 시작을 허용하지 않는다. 실패/권한 변경 시 다시 연결할 수 있다.
- 정적 HTML 및 로그인 화면은 공개되지만 실제 운영진 데이터와 작업 명령은 Security Rules로 보호된다. 공개 API key는 권한을 부여하지 않는다.
- 서버 저장 시간과 달리 경과 시간 표시는 기기 시계를 사용하므로 기기의 시간 설정에 영향을 받을 수 있다.

## 검증

Node.js 20 이상, Java 21 이상에서:

```sh
cd tests/firebase
pnpm install --frozen-lockfile
pnpm test
```

`demo-mathastro` 로컬 에뮬레이터에서 기존 좋아요와 운영진 기능의 규칙/트랜잭션 테스트를 함께 실행한다. 실제 프로젝트에 데이터를 쓰지 않는다. Q&A 회귀 검증은 저장소 루트에서 `python3 -m unittest discover -s tests`, 사이트 빌드는 `quarto render`로 수행한다.

브라우저 검증:

```sh
quarto render
cd tests/firebase
pnpm exec playwright install chromium
pnpm run test:browser
```

브라우저 테스트는 정적 빌드를 로컬 서버로 제공하고 테스트 브라우저 안에서만 Firebase 설정/연결을 에뮬레이터로 대체한다. 배포 코드에는 에뮬레이터 전환 스위치를 추가하지 않는다. 설치된 Chrome을 쓰려면 `CHROME_PATH` 환경 변수에 실행 파일 경로를 지정할 수 있다.

운영 배포 후에는 별도 기기/브라우저 두 개에서 실제 운영진 계정으로 로그인하여 시작 → 동시 시작 거부 → 실시간 표시 → 종료 → 강제 해제 확인을 최종 확인한다. 또한 기존 글의 좋아요/취소와 Q&A 페이지를 확인한다. 로컬 에뮬레이터 검증만으로 Console 설정이나 운영 배포가 완료되었다고 판단하지 않는다.

## 공식 참고

- [Firestore 트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firebase 보안 규칙](https://firebase.google.com/docs/rules/basics)
- [Authentication 세션 유지](https://firebase.google.com/docs/auth/web/auth-state-persistence)
