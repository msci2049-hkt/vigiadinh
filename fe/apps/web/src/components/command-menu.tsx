import type { PanelDef } from "@repo/auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/components/family/ui";

/**
 * Minimal Cmd+K palette over the panel's nav (no extra dependency — a filtered
 * list inside a Dialog is enough for panel-sized nav; swap for `cmdk` if a
 * project ever needs fuzzy/global search).
 */
export function CommandMenu({ panel }: { panel: PanelDef }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = panel.nav.map((item) => ({
      ...item,
      label: t(item.labelKey, { defaultValue: item.labelKey }),
    }));
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all;
  }, [panel.nav, query, t]);

  function go(to: string) {
    setOpen(false);
    setQuery("");
    void navigate({ to });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        {t("panelShell.commandLabel")}
        <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[30%] p-4">
          <DialogHeader>
            <DialogTitle className="sr-only">{t("panelShell.commandLabel")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={query}
            placeholder={t("panelShell.commandPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && items[0]) go(items[0].to);
            }}
          />
          <ul className="mt-1 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <li key={item.to}>
                <button
                  type="button"
                  onClick={() => go(item.to)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  {item.label}
                </button>
              </li>
            ))}
            {items.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground text-sm">
                {t("panelShell.commandEmpty")}
              </li>
            ) : null}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
