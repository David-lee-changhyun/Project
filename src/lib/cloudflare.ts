import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

// 응답을 보낸 뒤에도 백그라운드 작업(예: 외부 API 호출)을 계속 실행하기 위한 Workers ExecutionContext
export async function getExecutionContext() {
  const { ctx } = await getCloudflareContext({ async: true });
  return ctx;
}

export async function getDb() {
  const env = await getEnv();
  return env.DB;
}

export async function getBucket() {
  const env = await getEnv();
  return env.MEDIA_BUCKET;
}
