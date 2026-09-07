import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

export async function getDb() {
  const env = await getEnv();
  return env.DB;
}

export async function getBucket() {
  const env = await getEnv();
  return env.MEDIA_BUCKET;
}
