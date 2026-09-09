function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// VAPID 공개키는 배포 후 안 바뀌는 값이라, 설정 화면에 들어오자마자 미리
// 받아둬서 실제로 토글을 켤 때는 이 네트워크 왕복을 안 기다리게 함(토글
// 반응이 느리게 느껴지던 원인 중 하나 — 매번 새로 fetch하고 있었음)
let vapidKeyPromise: Promise<string> | null = null;
function getVapidPublicKey(): Promise<string> {
  if (!vapidKeyPromise) {
    vapidKeyPromise = fetch("/api/push/vapid-public-key")
      .then((res) => {
        if (!res.ok) throw new Error("vapid key fetch failed");
        return res.json() as Promise<{ publicKey: string }>;
      })
      .then((d) => d.publicKey)
      .catch((e) => {
        vapidKeyPromise = null; // 실패하면 다음 시도 때 다시 받도록
        throw e;
      });
  }
  return vapidKeyPromise;
}

export function preloadPushDeps() {
  if (!isPushSupported()) return;
  navigator.serviceWorker.ready.then(() => getVapidPublicKey().catch(() => {}));
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { ok: false, error: "이 브라우저는 알림을 지원하지 않아요." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "알림 권한이 꺼져 있어요. 브라우저/기기 설정에서 알림을 허용해주세요." };
  }

  const reg = await navigator.serviceWorker.ready;
  let publicKey: string;
  try {
    publicKey = await getVapidPublicKey();
  } catch {
    return { ok: false, error: "알림 설정 중 오류가 발생했어요." };
  }

  let sub: PushSubscription;
  try {
    sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
  } catch {
    // 브라우저/OS 쪽 제약(구독 개수 제한, 일시적인 푸시 서비스 오류 등)으로
    // subscribe() 자체가 실패할 수 있음 — 감싸지 않으면 조용히 실패해서
    // 사용자는 아무 에러도 못 보고 토글만 다시 꺼지는 것처럼 보임
    return { ok: false, error: "알림 등록에 실패했어요. 잠시 후 다시 시도해주세요." };
  }

  let subscribeRes: Response;
  try {
    subscribeRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch {
    // 서버 저장에 실패했는데 브라우저 쪽 구독만 남아있으면, 다음에 설정
    // 화면을 열었을 때 isPushSubscribed()가 이 구독을 보고 "켜짐"으로
    // 잘못 표시함(서버엔 없는데 켜진 것처럼 보여서 알림이 계속 안 감) —
    // 그래서 저장이 끝까지 안 됐으면 브라우저 구독도 같이 되돌림
    await sub.unsubscribe().catch(() => {});
    return { ok: false, error: "서버에 알림 설정을 저장하지 못했어요. 네트워크를 확인해주세요." };
  }
  if (!subscribeRes.ok) {
    await sub.unsubscribe().catch(() => {});
    return { ok: false, error: "서버에 알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  return { ok: true };
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}
