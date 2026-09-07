# 우리 앨범 — 둘만의 공유 앨범 (PWA)

갤럭시(안드로이드)와 아이폰 모두에서 브라우저로 설치해 쓰는 프라이빗 공유 앨범입니다.
Next.js + Cloudflare Workers/Pages, Cloudflare D1(메타데이터), Cloudflare R2(사진/동영상 원본)로 구성되어 있고,
전부 Cloudflare 무료 티어로 시작할 수 있도록 설계했습니다.

## 주요 기능

- 📸 사진/동영상 업로드 (여러 장 동시 선택), EXIF 촬영일 기준 타임라인 자동 정렬
- ✅ 여러 장 선택 후 zip으로 일괄 다운로드 / 일괄 삭제
- 🗂️ 태그, 장소(위치) 기반 앨범 필터
- 📅 커플 캘린더: 기념일 D-day 카운터 + 일정 목록
- 📱 PWA: 홈 화면에 추가해서 네이티브 앱처럼 사용 (iOS/Android 모두 지원)
- 🔒 둘만 쓰는 프라이빗 앱: 최대 2개 계정 + 초대 코드로 가입 제한

## 기술 스택

| 영역 | 선택 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router) |
| 배포 | Cloudflare Workers (`@opennextjs/cloudflare`) |
| 데이터베이스 | Cloudflare D1 (SQLite, 무료 5GB) |
| 파일 저장소 | Cloudflare R2 (무료 10GB, 이후 $0.015/GB) |
| 인증 | 이메일/비밀번호 + 쿠키 세션 (D1에 세션 저장) |

## 로컬 개발

```bash
npm install
npm run cf:typegen        # wrangler.jsonc 바인딩 기준 타입 재생성 (바인딩 변경 시에만)
npm run db:migrate:local  # 로컬 D1(SQLite)에 스키마 적용
npm run dev                # http://localhost:3000
```

`npm run dev`는 `@opennextjs/cloudflare`의 로컬 바인딩 기능을 통해 로컬 D1/R2 에뮬레이션에 연결됩니다.

## Cloudflare에 배포하기

### 1. Cloudflare 로그인

```bash
npx wrangler login
```

### 2. D1 데이터베이스 생성

```bash
npx wrangler d1 create shared-album-db
```

출력된 `database_id`를 `wrangler.jsonc`의 `d1_databases[0].database_id`에 채워 넣습니다.

### 3. R2 버킷 생성

```bash
npx wrangler r2 bucket create shared-album-media
```

### 4. 원격 DB에 마이그레이션 적용

```bash
npm run db:migrate:remote
```

### 5. (선택) 가입 초대 코드 설정

둘만 가입할 수 있도록 초대 코드를 시크릿으로 등록하면, 링크가 유출되어도 아무나 가입하지 못합니다.

```bash
npx wrangler secret put SIGNUP_INVITE_CODE
```

### 6. 배포

```bash
npm run cf:deploy
```

배포 후 나오는 `*.workers.dev` 주소(또는 연결한 커스텀 도메인)로 접속해서 두 사람 계정을 각각 가입하면 끝입니다.

## 비용 참고 (무료 티어 기준)

- **D1**: 5GB 저장 / 하루 5백만 행 읽기 무료 — 사진 메타데이터만 저장하므로 사실상 무료 한도 내에서 충분합니다.
- **R2**: 10GB 저장 무료, **Egress(다운로드) 요금 없음**이 핵심 — 사진/동영상을 자주 꺼내봐도 추가 비용이 없습니다. 10GB를 넘으면 $0.015/GB·월로 매우 저렴합니다.
- **Workers**: 하루 10만 요청 무료.

두 사람이 쓰는 용도로는 R2 10GB 무료 한도 내에서 상당 기간 무료로 운영할 수 있고, 초과해도 월 몇백 원 수준입니다.

## 폴더 구조

```
migrations/            D1 SQL 마이그레이션
src/app/(auth)/         로그인/회원가입 (비로그인 전용 레이아웃)
src/app/(app)/           타임라인/앨범/캘린더 (로그인 필요, 하단 탭 레이아웃)
src/app/api/            REST API (auth, media, calendar)
src/components/         클라이언트 UI 컴포넌트
src/lib/                 인증, D1/R2 접근, 업로드 유틸
scripts/generate-icons.mjs   PWA 아이콘 생성 스크립트 (플레이스홀더)
```

## 아이콘 교체

`public/icons/`에 있는 아이콘은 스크립트로 생성한 단색 플레이스홀더입니다.
`public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`을 원하는 디자인으로 교체하세요.

## 업로드 용량 제한

Cloudflare Workers 무료 플랜의 요청 본문 크기 제한(약 100MB) 때문에, 한 파일당 업로드 상한을 200MB로 넉넉히 잡아뒀지만
실제로는 100MB 내외의 동영상까지 안정적으로 업로드됩니다. 더 큰 동영상이 필요하면 R2 Presigned URL을 이용한
직접 업로드 방식으로 확장할 수 있습니다.
