// Device id ổn định per-install — bind vào JWT ví (SEP-45 claims.device) để phiên
// gắn "ví + thiết bị" chứ không chỉ user (checklist 2.3). KHÔNG phải fingerprinting:
// chỉ là UUID sinh cục bộ, không đọc đặc điểm máy.
const STORAGE_KEY = "fw.device-id";

export function getDeviceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing && existing.length >= 8) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, fresh);
  return fresh;
}
