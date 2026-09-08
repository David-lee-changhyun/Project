// cloudflare-env.d.ts는 `npm run cf:typegen`으로 매번 새로 생성되고 git에는
// 안 올라가는 파일이라, wrangler.jsonc에 없는 값(= wrangler secret put으로만
// 등록하는 비밀값)은 여기서 같은 이름의 인터페이스를 선언해 병합해줌
interface CloudflareEnv {
  // R2 S3 호환 API용 자격 증명 — 브라우저가 우리 서버를 거치지 않고
  // R2에 직접 업로드(presigned URL)할 수 있게 해줌
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}
