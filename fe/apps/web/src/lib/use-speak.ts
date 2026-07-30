// Đọc to bằng Web Speech API (lô R3 §6.6) — KHÔNG thư viện, không backend,
// không TTS server-side: chữ không rời khỏi máy người dùng.
//
// Bốn bẫy đã xử, đừng "dọn" mất:
// 1. getVoices() trả [] ở lần gọi đầu (Chrome nạp giọng bất đồng bộ) → nạp lúc
//    MOUNT + nghe `voiceschanged`, KHÔNG gọi getVoices() lúc bấm.
// 2. iOS đòi speak() CÙNG TICK với cử chỉ người dùng — mọi thứ (giọng, chữ)
//    phải sẵn từ trước, tuyệt đối không `await` trước speak().
// 3. cancel() trước MỖI speak() — không thì bấm 3 lần nghe 3 lượt xếp hàng.
// 4. Không có speechSynthesis → `supported=false`, caller ẨN nút.
import { useCallback, useEffect, useState } from "react";

export type Speaker = {
  supported: boolean;
  speaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
};

/** Giọng THEO locale UI; không có thì fallback en — app 3 locale, đọc tiếng
 * Anh khi màn hình là 中文 là lỗi i18n, nhưng câm hẳn còn tệ hơn. */
function pickVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const base = locale.toLowerCase().split("-")[0] ?? "en";
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ??
    null
  );
}

export function useSpeak(locale: string): Speaker {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(voices, locale);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = locale;
      }
      // Văn xuôi cho người lớn tuổi — chậm hơn mặc định một chút, KHÔNG tách ký tự.
      utterance.rate = 0.9;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(utterance);
    },
    [supported, voices, locale],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { supported, speaking, speak, stop };
}
