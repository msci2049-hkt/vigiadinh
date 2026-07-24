// Service worker phù du (MV3) — cột hay sập nhất (skill vi-extension-mv3 §2).
// Nhiệm vụ VỎ APP (đường A): đếm yêu cầu duyệt của guardian → BADGE ĐỎ trên
// toolbar. Guardian ngồi máy tính cả ngày; số đỏ hiện ngay thì 30 giây xử lý
// xong thay vì 4 tiếng mới mở app điện thoại.
//
// KHÔNG giữ state trong biến toàn cục (SW ngủ ~30s) → chrome.storage.
// KHÔNG setInterval (SW ngủ) → chrome.alarms.
// KHÔNG remote code (MV3 cấm) → mọi JS trong gói.

const API_BASE = "https://app.familywallet.example";
const POLL_ALARM = "guardian-poll";
const POLL_MINUTES = 1;

async function pollGuardianRequests() {
  try {
    // host_permissions cùng domain → fetch mang cookie session (credentials).
    const [approvals, knocks] = await Promise.all([
      fetch(`${API_BASE}/api/recovery/guardian`, { credentials: "include" }),
      fetch(`${API_BASE}/api/recovery/guardian/device-requests`, { credentials: "include" }),
    ]);
    if (approvals.status === 401 || knocks.status === 401) {
      // Chưa đăng nhập trong tab nào → xoá badge, đừng đoán.
      await setBadge(0);
      await chrome.storage.session.set({ signedIn: false });
      return;
    }
    const approveItems = approvals.ok ? ((await approvals.json()).data ?? []) : [];
    const knockItems = knocks.ok ? ((await knocks.json()).data ?? []) : [];
    const count = approveItems.length + knockItems.length;
    await setBadge(count);
    await chrome.storage.session.set({ signedIn: true, count });
  } catch {
    // Lỗi mạng: giữ badge cũ, không nhảy số bậy.
  }
}

async function setBadge(count) {
  const text = count > 0 ? String(count) : "";
  await chrome.action.setBadgeText({ text });
  if (count > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_MINUTES });
  void pollGuardianRequests();
});

chrome.runtime.onStartup.addListener(() => {
  void pollGuardianRequests();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) void pollGuardianRequests();
});

// Popup mở → poll ngay cho tươi (không đợi tick alarm kế).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "poll-now") {
    pollGuardianRequests().then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  return false;
});
