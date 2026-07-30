// Lô R3 §6.6 — khoá 4 bẫy Web Speech API. Mock toàn bộ speechSynthesis: jsdom
// không có TTS, và test này đo HÀNH VI GỌI (cancel trước speak, chọn giọng,
// rate) chứ không đo âm thanh.
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpeak } from "./use-speak";

type FakeVoice = { lang: string; name: string };

class FakeUtterance {
  text: string;
  voice: FakeVoice | null = null;
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function installSynth(voices: FakeVoice[]) {
  const synth = {
    cancel: vi.fn(),
    speak: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return synth;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const VOICES: FakeVoice[] = [
  { lang: "en-US", name: "en" },
  { lang: "vi-VN", name: "vi" },
  { lang: "zh-CN", name: "zh" },
];

describe("useSpeak", () => {
  it("🔴 cancel() TRƯỚC mỗi speak() — bấm 3 lần không xếp hàng 3 lượt", () => {
    const synth = installSynth(VOICES);
    const { result } = renderHook(() => useSpeak("vi"));
    act(() => result.current.speak("một"));
    act(() => result.current.speak("hai"));
    act(() => result.current.speak("ba"));
    expect(synth.cancel).toHaveBeenCalledTimes(3);
    expect(synth.speak).toHaveBeenCalledTimes(3);
    // cancel của lượt sau phải đứng TRƯỚC speak của lượt đó.
    const cancelOrder = synth.cancel.mock.invocationCallOrder;
    const speakOrder = synth.speak.mock.invocationCallOrder;
    for (let i = 0; i < 3; i++) {
      expect(cancelOrder[i]).toBeLessThan(speakOrder[i] as number);
    }
  });

  it("giọng THEO locale UI — zh ra giọng zh, không phải en", () => {
    const synth = installSynth(VOICES);
    const { result } = renderHook(() => useSpeak("zh"));
    act(() => result.current.speak("你好"));
    const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
    expect(utterance.voice?.lang).toBe("zh-CN");
  });

  it("không có giọng khớp locale → fallback en, KHÔNG câm", () => {
    const synth = installSynth([{ lang: "en-GB", name: "en" }]);
    const { result } = renderHook(() => useSpeak("vi"));
    act(() => result.current.speak("xin chào"));
    const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
    expect(utterance.voice?.lang).toBe("en-GB");
  });

  it("rate ~0.9 — đây là câu văn cho người lớn tuổi, không phải mã cần đánh vần", () => {
    const synth = installSynth(VOICES);
    const { result } = renderHook(() => useSpeak("vi"));
    act(() => result.current.speak("xin chào bác"));
    const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
    expect(utterance.rate).toBe(0.9);
  });

  it("nghe giọng qua voiceschanged lúc MOUNT — không gọi getVoices lúc bấm tay không", () => {
    const synth = installSynth(VOICES);
    renderHook(() => useSpeak("vi"));
    expect(synth.getVoices).toHaveBeenCalled();
    expect(synth.addEventListener).toHaveBeenCalledWith("voiceschanged", expect.any(Function));
  });

  it("🔴 không có speechSynthesis → supported=false, speak() im lặng không crash", () => {
    const { result } = renderHook(() => useSpeak("vi"));
    expect(result.current.supported).toBe(false);
    expect(() => act(() => result.current.speak("x"))).not.toThrow();
  });

  it("stop() gọi cancel và tắt cờ speaking", () => {
    const synth = installSynth(VOICES);
    const { result } = renderHook(() => useSpeak("vi"));
    act(() => result.current.speak("một"));
    expect(result.current.speaking).toBe(true);
    act(() => result.current.stop());
    expect(result.current.speaking).toBe(false);
    expect(synth.cancel).toHaveBeenCalledTimes(2); // 1 trước speak + 1 của stop
  });
});
