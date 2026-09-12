# MathAstro 좋아요 설정

이 저장소는 운영진이 `git clone`으로 내려받아 함께 작업하는 Quarto 블로그입니다.
Firebase는 좋아요 데이터만 저장하며, 블로그 배포는 기존 GitHub Pages를 사용합니다.

## 처음 한 번 필요한 설정

1. [Firebase 콘솔](https://console.firebase.google.com/)에 Google 계정으로 로그인하고 프로젝트를 만듭니다. 블로그 전용 프로젝트를 권장합니다. Google Analytics는 필요하지 않습니다.
2. 결제 수단을 연결하지 않는 Spark 요금제로 시작할 수 있습니다. 무료 사용량을 초과하면 기능이 제한될 수 있습니다.
3. 프로젝트 개요에서 웹 앱 추가 버튼 `</>`를 누릅니다. 앱 이름은 `MathAstro`로 입력합니다. Firebase Hosting은 설정하지 않아도 됩니다.
4. 등록 후 표시되는 `firebaseConfig`에서 `apiKey`, `authDomain`, `projectId`, `appId` 값을 복사하여 `assets/firebase-config.json`에 입력합니다. 이 네 값이 들어 있는 설정 코드를 Codex에게 전달해도 됩니다. 웹 앱 설정은 공개용 식별 정보입니다. 서비스 계정 키나 `private_key`는 필요하지 않습니다.
5. Authentication 메뉴에서 시작하기를 누른 뒤 로그인 방법(Sign-in method)의 익명(Anonymous)을 활성화하고 저장합니다. 익명 계정 자동 삭제는 켜지 않습니다. 삭제되면 이전 좋아요를 취소할 수 없게 될 수 있습니다.
6. Firestore Database에서 데이터베이스 만들기를 누릅니다. Standard 에디션, 데이터베이스 ID `(default)`, 프로덕션 모드를 선택합니다. 지역은 방문자와 가까운 곳을 선택합니다. 지역은 나중에 쉽게 바꾸기 어려우므로 생성 전에 확인합니다.
7. Firestore Database의 규칙(Rules) 탭에서 `firebase/firestore.rules` 파일 내용을 붙여 넣고 게시(Publish)를 누릅니다. 이 규칙은 블로그 전용 프로젝트용이며 다른 데이터 경로의 접근을 허용하지 않습니다. 기존 프로젝트를 재사용한다면 기존 규칙을 덮어쓰기 전에 병합해야 합니다.
8. 위 설정을 마친 후 블로그 변경 파일을 GitHub에 반영해 기존 방식으로 배포합니다. Firebase 규칙 게시와 블로그 배포는 별도 작업입니다. 이 문서 작성 과정에서는 배포하지 않았습니다.

## 사용과 확인

- 모든 게시글의 본문 끝에 하트 버튼이 나타납니다. 한 번 누르면 좋아요, 다시 누르면 취소됩니다.
- 버튼을 처음 누를 때 익명 인증을 진행합니다. 별도 회원가입 창은 없습니다.
- 같은 브라우저의 로그인 정보가 유지되는 동안 게시글당 한 번만 집계됩니다. 다른 기기, 시크릿 창, 사이트 데이터 삭제 이후에는 새 방문자로 인식될 수 있습니다. 사람당 한 표를 보장하는 방식은 아닙니다.
- 다른 방문자가 누른 좋아요도 실시간으로 갱신되며 Quarto 재빌드나 GitHub Actions 실행이 필요하지 않습니다.
- Firestore Database → 데이터(Data) → `postLikes`에서 게시글 문서를 확인합니다. `path`는 글 경로, `count`는 총 좋아요 수입니다. 첫 좋아요 전에는 문서가 없어도 정상이며 화면에는 0이 표시됩니다.
- `votes` 하위 컬렉션에는 익명 사용자별 `liked` 값만 저장합니다. 일반 방문자는 본인 기록만 읽거나 변경할 수 있습니다. 운영진은 Firebase 콘솔에서 확인할 수 있습니다.
- 문서 ID는 게시글 경로를 해시한 값입니다. 제목이나 내용 수정은 집계에 영향을 주지 않지만 폴더/URL 변경 시 새 게시글로 집계됩니다. 글 이동 전에 데이터 이전이 필요합니다.
- Firebase 연결 전에는 버튼이 비활성화되고 준비 중으로 표시됩니다. 저장 실패 시 성공한 것처럼 숫자를 올리지 않으며 다시 연결 버튼을 제공합니다.

## 문제가 있을 때

- 준비 중: `assets/firebase-config.json`의 네 항목이 모두 채워졌는지 확인합니다.
- 첫 클릭 실패: Authentication의 익명 로그인이 활성화됐는지 확인합니다.
- 연결 실패 또는 권한 오류: Firestore `(default)` 데이터베이스 생성 및 규칙 게시 여부를 확인합니다.
- 정식 사이트에서 확인합니다. 파일을 직접 여는 `file://` 방식은 ES 모듈과 Firebase 테스트에 적합하지 않습니다. 로컬 확인은 `quarto preview`를 사용합니다.
- 익명 인증과 규칙은 다른 사람의 표 수정과 총합 직접 조작을 막습니다. 자동화된 대량 익명 계정 생성까지 차단하지는 않습니다. 사용량은 Firebase 콘솔에서 확인하고 필요하면 Firebase App Check를 추가합니다.

## 개발 검증

Node.js 20 이상과 Java 21 이상이 필요합니다. 운영진이 일상적으로 글을 쓸 때는 설치할 필요가 없습니다.

```sh
cd tests/firebase
npm install
npm test
```

테스트는 `demo-mathastro` 로컬 Firestore 에뮬레이터만 사용합니다. 실제 Firebase에 쓰지 않습니다.
좋아요/취소, 중복 요청, 동시 접속, 실시간 집계와 보안 규칙을 검증합니다.

## 공식 참고 자료

- [Firebase 웹 앱 등록](https://firebase.google.com/docs/web/setup)
- [익명 인증](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [원자적 트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore 무료 사용량](https://firebase.google.com/docs/firestore/pricing)
