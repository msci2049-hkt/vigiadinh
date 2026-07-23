import "@testing-library/jest-dom/vitest";
import { beforeAll } from "vitest";
import i18n from "@/lib/i18n";

// jsdom's navigator.language is en-US; pin tests to vi so text assertions are stable.
// Namespaces are lazy-loaded at runtime (dynamic-import backend) — preload ALL of
// them up front so component tests are deterministic and never observe a frame of
// raw keys while a namespace is still resolving.
beforeAll(async () => {
  await i18n.changeLanguage("vi");
  await i18n.loadNamespaces(["common", "auth", "dashboard", "errors", "admin"]);
});
