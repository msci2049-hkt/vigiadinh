import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", // pure utils today; switch to jsdom when component tests land
    globals: true,
  },
});
