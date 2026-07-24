// Popup vỏ app: hiện số yêu cầu duyệt của guardian + lối mở web app.
// Popup đóng là unmount sạch → không giữ trạng thái ở đây; đọc từ storage do
// service worker ghi, và bảo SW poll-now cho số tươi.
const API_BASE = "https://app.familywallet.example";

function msg(key) {
  return chrome.i18n.getMessage(key);
}

function render(state) {
  document.getElementById("title").textContent = msg("popupTitle");
  document.getElementById("subtitle").textContent = msg("popupSubtitle");
  const openBtn = document.getElementById("open");
  const signinBtn = document.getElementById("signin");
  const countEl = document.getElementById("count");
  const hintEl = document.getElementById("hint");

  if (state.signedIn === false) {
    countEl.textContent = "—";
    countEl.classList.add("zero");
    hintEl.textContent = msg("popupSignedOut");
    openBtn.textContent = msg("popupOpenApp");
    signinBtn.hidden = false;
    signinBtn.textContent = msg("popupSignIn");
    return;
  }

  const count = state.count ?? 0;
  countEl.textContent = String(count);
  countEl.classList.toggle("zero", count === 0);
  hintEl.textContent = count > 0 ? msg("popupHasRequests") : msg("popupNoRequests");
  openBtn.textContent = count > 0 ? msg("popupReview") : msg("popupOpenApp");
  signinBtn.hidden = true;
}

document.getElementById("open").addEventListener("click", () => {
  chrome.tabs.create({ url: `${API_BASE}/guardian` });
});
document.getElementById("signin").addEventListener("click", () => {
  chrome.tabs.create({ url: `${API_BASE}/login` });
});

async function boot() {
  const state = await chrome.storage.session.get(["signedIn", "count"]);
  render(state);
  // Nhờ SW poll ngay rồi vẽ lại (popup có thể mở khi SW vừa ngủ dậy).
  chrome.runtime.sendMessage({ type: "poll-now" }, async () => {
    const fresh = await chrome.storage.session.get(["signedIn", "count"]);
    render(fresh);
  });
}

void boot();
