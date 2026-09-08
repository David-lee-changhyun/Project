import { buildPushPayload } from "@block65/webcrypto-web-push";
import { getDb } from "@/lib/cloudflare";

type PushPayload = { title: string; body: string; url: string };

// 로그인된 사용자(파트너) 소유의 모든 구독 기기에 푸시 전송. 기기별 실패는
// 서로 독립적이라 하나가 실패해도 나머지는 그대로 보냄
export async function sendPushToUser(env: CloudflareEnv, userId: string, payload: PushPayload) {
  const db = await getDb();
  const rows = await db
    .prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
    .bind(userId)
    .all<{ id: string; endpoint: string; p256dh: string; auth: string }>();
  const subs = rows.results ?? [];
  if (!subs.length) return;

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  await Promise.all(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        expirationTime: null,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        const { headers, body, method } = await buildPushPayload({ data: payload }, subscription, vapid);
        // content-length는 fetch가 body 길이로 알아서 계산해줘야 하는 헤더라,
        // 직접 넘기면 런타임에 따라 "invalid content-length header"로 거부됨
        const sendHeaders: Record<string, string> = { authorization: headers.authorization };
        if (headers.ttl) sendHeaders.ttl = headers.ttl;
        if (headers.urgency) sendHeaders.urgency = headers.urgency;
        if (headers.topic) sendHeaders.topic = headers.topic;
        sendHeaders["content-encoding"] = headers["content-encoding"];
        sendHeaders["content-type"] = headers["content-type"];
        const res = await fetch(sub.endpoint, { method, headers: sendHeaders, body });
        // 구독이 만료/취소됐으면 푸시 서비스가 404/410을 돌려줌 — 다음 업로드
        // 때마다 계속 헛수고하지 않도록 DB에서 지움
        if (res.status === 404 || res.status === 410) {
          await db.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(sub.id).run();
        }
      } catch {
        // 네트워크 오류 등은 무시 — 알림 하나 실패했다고 업로드 자체를 실패시키지 않음
      }
    })
  );
}
