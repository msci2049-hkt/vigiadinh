import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // sse.test renders a hook
    globals: true,
  },
});
