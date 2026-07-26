"use client";
import { createContext, useContext, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { logUsage } from "@/lib/usage";

export type AiFlags = { canUseAi: boolean; shortcutsEnabled: boolean };

const Ctx = createContext<AiFlags>({ canUseAi: false, shortcutsEnabled: false });

export function AiFlagsProvider({ value, children }: { value: AiFlags; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAiFlags(): AiFlags {
  return useContext(Ctx);
}

// هوك تسجيل مبوّب: بيسجّل بس لو الأكشنز السريعة مفعّلة عالمياً (quick_shortcuts_enabled)
export function useLogUsage() {
  const { shortcutsEnabled } = useContext(Ctx);
  return useCallback(
    (eventType: "action" | "filter", eventKey: string, context: string) => {
      if (!shortcutsEnabled) return;
      logUsage(createClient(), eventType, eventKey, context);
    },
    [shortcutsEnabled]
  );
}
