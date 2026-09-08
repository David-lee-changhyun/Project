import { AwsClient } from "aws4fetch";
import { getEnv } from "@/lib/cloudflare";

// wrangler.jsonc의 r2_buckets.bucket_name과 동일 (비밀값이 아니라서 그냥 상수로 둠)
const R2_BUCKET_NAME = "shared-album-media";
const PRESIGN_EXPIRES_SECONDS = 3600; // 큰 동영상이 느린 회선에서도 끝까지 올라갈 수 있게 넉넉히

// 브라우저가 우리 서버(Worker)를 거치지 않고 R2에 직접 PUT할 수 있는 임시
// 서명 URL을 만듦. 기존엔 "브라우저 -> Worker -> R2" 두 번 왕복이었는데,
// 이러면 "브라우저 -> R2" 한 번으로 끝나서 업로드가 훨씬 빨라짐
export async function presignR2Put(key: string): Promise<string> {
  const env = await getEnv();
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const path = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${path}`);
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_EXPIRES_SECONDS));

  // Content-Type은 서명 대상에 넣지 않음 — 클라이언트가 실제 PUT 때 보내는
  // Content-Type 값과 한 글자라도 다르면 서명 불일치로 실패하는 걸 피하기 위함.
  // (서명에 없는 헤더는 R2가 그냥 무시하고 받아줌, 서명된 host만 검증됨)
  const signed = await client.sign(url.toString(), {
    method: "PUT",
    aws: { signQuery: true },
  });
  return signed.url;
}
