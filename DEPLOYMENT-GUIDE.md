# 배포 가이드 (다른 컴퓨터에서 이어서 작업하기)

이 문서는 "우리 앨범" 앱을 처음부터 Cloudflare에 배포한 전체 과정과, 진행하며 겪은 문제/해결법을 정리한 기록입니다. 새 컴퓨터에서 코드를 수정하고 다시 배포하거나, 계정 정보를 잃어버렸을 때 참고하세요.

## 이미 완료된 것 (2026-09-07 기준)

- **Cloudflare 계정 Account ID**: `d10a155ef10cae9ef2d1edb392b9f03c`
- **D1 데이터베이스**: `shared-album-db` (id: `a9e48090-9612-4af6-b662-79754f9296c2`) — 리전 APAC
- **R2 버킷**: `shared-album-media`
- **워커 이름**: `shared-album`
- **workers.dev 서브도메인**: `leech-album`
- **실제 접속 주소**: https://shared-album.leech-album.workers.dev
- **가입 초대 코드**: `SIGNUP_INVITE_CODE` 시크릿으로 등록함 (값은 본인만 기억 — 코드에는 저장되지 않음)

이 정보들은 `wrangler.jsonc` 파일(D1/R2 id)과 Cloudflare 대시보드(계정 설정)에 이미 반영되어 있어서, 저장소를 다시 클론만 하면 별도로 재생성할 필요 없습니다.

---

## 새 컴퓨터에서 "코드 수정 → 재배포"만 하고 싶을 때 (가장 흔한 경우)

D1/R2는 이미 만들어져 있고 `wrangler.jsonc`에도 이미 실제 id가 커밋되어 있으므로, 아래만 하면 됩니다.

```powershell
# 1. Node.js 설치 (https://nodejs.org, LTS 버전)

# 2. 저장소 받기
git clone https://github.com/David-lee-changhyun/Project.git shared-album
cd shared-album
git checkout claude/shared-album-webapp-lwiosl

# 3. 패키지 설치 (윈도우에서 스크립트 실행 에러 나면 아래 한 줄 먼저)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
npm install

# 4. Cloudflare 타입 생성 (D1/R2 바인딩 타입 — 매번 클론할 때마다 필요)
npm run cf:typegen

# 5. Cloudflare API 토큰 발급 (아래 "토큰 발급 방법" 참고) 후 설정
$env:CLOUDFLARE_API_TOKEN="새로_발급받은_토큰"
$env:CLOUDFLARE_ACCOUNT_ID="d10a155ef10cae9ef2d1edb392b9f03c"

# 6. 코드 수정 후 재배포
npm run cf:deploy
```

배포가 끝나면 로그 마지막에 나오는 URL은 매번 동일하게 `https://shared-album.leech-album.workers.dev` 입니다.

---

## 처음부터 전부 다시 만들어야 하는 경우 (계정이 완전히 다를 때 등)

### 1. Node.js 설치
https://nodejs.org 에서 LTS 버전 다운로드 → 설치 마법사 계속 "다음"

### 2. 저장소 클론 + 패키지 설치
```powershell
git clone https://github.com/David-lee-changhyun/Project.git shared-album
cd shared-album
git checkout claude/shared-album-webapp-lwiosl
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned   # 윈도우 npm 실행 에러 방지
npm install
```

### 3. Cloudflare API 토큰 발급
1. https://dash.cloudflare.com/profile/api-tokens (또는 "Manage Account → Account API Tokens") 접속
2. **Create Token** → **Create Custom Token** (또는 그냥 **Write all resources** 템플릿 선택해도 됨 — 간단하지만 넓은 권한이라 쓰고 나서 삭제 권장)
3. 커스텀으로 만들 경우 권한:
   - `Account` → `D1` → `Edit`
   - `Account` → `Workers R2 Storage` → `Edit`
   - `Account` → `Workers Scripts` → `Edit`
4. Client IP filtering은 비워둠
5. **Continue to summary → Create Token** → 토큰 문자열 복사 (한 번만 보여줌)
6. 같은 화면의 **Account ID**도 복사해두기

### 4. 토큰을 터미널에 설정
```powershell
$env:CLOUDFLARE_API_TOKEN="복사한_토큰"
$env:CLOUDFLARE_ACCOUNT_ID="복사한_Account_ID"
```

### 5. D1 데이터베이스 생성
```powershell
npx wrangler d1 create shared-album-db
```
- "Would you like Wrangler to add it on your behalf?" → **n**
- 출력된 `database_id` 값을 복사해서 `wrangler.jsonc`의 `d1_databases[0].database_id`에 붙여넣기 (직접 편집하거나 아래처럼 자동 치환):
```powershell
(Get-Content wrangler.jsonc) -replace 'REPLACE_WITH_YOUR_D1_DATABASE_ID', '방금_복사한_id' | Set-Content wrangler.jsonc
```

### 6. R2 버킷 생성
```powershell
npx wrangler r2 bucket create shared-album-media
```
- **처음 한 번은 Cloudflare 대시보드에서 R2를 활성화**해야 함: 대시보드 → **R2 Object Storage** → **Get started with R2** → 결제 카드 등록 (10GB까지 무료, 실제 청구는 초과 시에만)
- "Would you like Wrangler to add it on your behalf?" → **n** (이미 `wrangler.jsonc`에 설정되어 있음)

### 7. 타입 생성 + DB 스키마 적용
```powershell
npm run cf:typegen
npm run db:migrate:remote
```
- "continue?" 프롬프트 → **Y**

### 8. 배포
```powershell
npm run cf:deploy
```
- "register a workers.dev subdomain?" → **Y**
- 원하는 서브도메인 이름 입력 (영문 소문자/숫자/하이픈만, 전 세계에서 고유해야 함)
- "Ok to proceed?" → **Y**
- 마지막에 나오는 `https://<워커이름>.<서브도메인>.workers.dev` 가 실제 주소

> ⚠️ 서브도메인을 방금 새로 등록했다면 DNS/SSL 전파에 1~5분 정도 걸려서, 그 사이엔 "보안 연결할 수 없음(SSL 오류)"가 뜰 수 있어요. 잠시 기다렸다가 새로고침하면 됩니다.

### 9. 가입 초대 코드 설정 (선택, 권장)
아무나 URL만 알면 가입 시도할 수 있는 걸 막기 위한 설정:
```powershell
npx wrangler secret put SIGNUP_INVITE_CODE
```
`Enter a secret value:` 뜨면 원하는 코드 입력 (화면에 안 보이는 게 정상) → Enter. 재배포 없이 바로 적용됩니다.

### 10. 배포 끝나면
- Cloudflare 대시보드에서 방금 만든 API 토큰 **삭제** (더 이상 필요 없음, 보안상 권장)
- 앱 URL 접속해서 `/signup`으로 본인 계정, 이후 상대방 계정 생성 (최대 2명)

---

## 겪었던 문제와 해결법 (참고용 트러블슈팅)

| 증상 | 원인 | 해결 |
|---|---|---|
| `git clone` 실패: destination path already exists | 같은 이름 폴더가 이미 있음 | 다른 폴더명으로 클론 (`git clone <url> shared-album`) |
| `npm : 이 시스템에서 스크립트를 실행할 수 없으므로...` | 윈도우 PowerShell 보안 정책 | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` 또는 `npm.cmd` 사용 |
| `wrangler d1 create` 후 바인딩 자동 추가 프롬프트 | wrangler가 기본 바인딩 이름(`shared_album_db` 등)으로 새로 추가하려 함 — 우리 설정(`DB`, `MEDIA_BUCKET`)과 이름이 다름 | 항상 **n** 선택하고 `wrangler.jsonc`는 수동으로 값만 채워넣기 |
| `wrangler r2 bucket create` → `Please enable R2 through the Cloudflare Dashboard` | 계정에서 R2를 한 번도 활성화 안 함 | 대시보드 → R2 → Get started (카드 등록, 무료 한도 내 $0) |
| `next build` 시 `Property 'DB' does not exist on type 'CloudflareEnv'` 등 다수 타입 에러 | `cloudflare-env.d.ts`가 로컬에 없음 (git에는 커밋 안 함, 매번 생성해야 함) | `npm run cf:typegen` 먼저 실행 |
| 배포 직후 `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` | 방금 등록한 workers.dev 서브도메인의 DNS/SSL 전파 지연 | 1~5분 대기 후 재시도 |
| Claude(AI)가 직접 배포를 못 함 | Claude가 실행되는 클라우드 환경 자체가 보안 정책상 Cloudflare API로 나가는 요청을 전부 차단함 (`api.cloudflare.com` 접속 거부) | 사용자 컴퓨터 터미널에서 직접 진행 |

---

## 프로젝트 자체에 대한 참고

- **기술 스택**: Next.js 16 (App Router) + Cloudflare Workers(`@opennextjs/cloudflare`) + D1(SQLite, 메타데이터) + R2(사진/동영상 원본)
- **주요 기능**: 이메일/비밀번호 인증(최대 2계정 + 초대 코드), 촬영일 기준 타임라인, 여러 장 선택 다운로드(zip)/삭제, 태그·장소 앨범, 커플 캘린더(D-day), 업로더별(나/상대방) 필터, PWA(홈 화면 추가), 아이폰 HEIC 사진 자동 JPEG 변환
- **디자인**: iOS(Liquid Glass) 스타일 — systemBlue 액션 컬러, 파스텔 핑크 포인트, 반투명 유리 질감 탭바/툴바
- **로컬 개발**: `npm run dev` (로컬 D1은 `npm run db:migrate:local`로 별도 관리, 실서비스 DB와 분리되어 있음)
- **일반 README**: 저장소의 `README.md`에 프로젝트 구조와 기본 설명이 더 있습니다.
