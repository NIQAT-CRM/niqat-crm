"use client";
import { type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

type TabKey = "basic" | "sales" | "docs" | "ops" | "edu";

export default function DrawerTabs({ basic, sales, docs, ops, edu, showOps = true, showEdu = true, footer, tab, onTab, quickBar }: {
  basic: ReactNode; sales: ReactNode; docs: ReactNode; ops?: ReactNode; edu?: ReactNode; showOps?: boolean; showEdu?: boolean;
  footer?: (tab: string) => ReactNode;
  tab: TabKey; onTab: (t: TabKey) => void; quickBar?: ReactNode;
}) {
  const tr = useT();
  const TabBtn = ({ val, label }: { val: TabKey; label: string }) => (
    <button type="button" onClick={() => onTab(val)}
      className={"relative px-4 py-2.5 text-[12.5px] font-bold transition-colors duration-150 whitespace-nowrap " +
        (tab === val ? "text-brand" : "text-muted hover:text-ink")}>
      {label}
      {tab === val && <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-brand" />}
    </button>
  );
  return (
    <div className="flex flex-col flex-1">
      <div className="sticky top-0 z-10 bg-[var(--bg)]">
        {quickBar}
        <div className="flex items-center border-b border-line px-1 overflow-x-auto">
          <TabBtn val="basic" label={tr("tabBasic")} />
          <TabBtn val="sales" label={tr("tabSales")} />
          <TabBtn val="docs" label={tr("tabDocs")} />
          {showOps && <TabBtn val="ops" label={tr("tabOps")} />}
          {showEdu && <TabBtn val="edu" label={tr("eduTabTitle")} />}
        </div>
      </div>
      <div className="tab-pane flex flex-col flex-1 min-h-0" key={tab}>
        {tab === "basic" && basic}
        {tab === "sales" && sales}
        {tab === "docs" && docs}
        {tab === "ops" && ops}
        {tab === "edu" && edu}
      </div>
      {footer?.(tab)}
    </div>
  );
}
