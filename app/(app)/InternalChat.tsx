"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

type Room = { id: string; key: string; name: string; color: string; unread: number };
type Msg = {
  id: string; room_id: string; sender_id: string; body: string;
  customer_id: string | null; attachment_path: string | null; created_at: string;
};
type Me = { id: string; name: string; team: string; sound: boolean };

const TEAM_AR: Record<string, string> = { sales: "المبيعات", support: "الدعم", admin: "الإدارة", ops: "العمليات", operations: "العمليات" };

function playBlip() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 660; o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.start(); o.stop(ctx.currentTime + 0.26);
    setTimeout(() => ctx.close(), 400);
  } catch { /* ignore */ }
}

export default function InternalChat({ me }: { me: Me }) {
  const supabase = createClient();
  const router = useRouter();
  const tr = useT();

  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [linked, setLinked] = useState<{ id: string; name: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickQ, setPickQ] = useState("");
  const [pickRes, setPickRes] = useState<{ id: string; name: string }[]>([]);
  const [sound, setSound] = useState(me.sound);
  const [toastMsg, setToastMsg] = useState<{ text: string; roomId: string } | null>(null);

  const profNames = useRef<Map<string, { name: string; team: string }>>(new Map());
  const custNames = useRef<Map<string, string>>(new Map());
  const signed = useRef<Map<string, string>>(new Map());
  const msgsEnd = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  const openRef = useRef(open);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { openRef.current = open; }, [open]);

  const totalUnread = rooms.reduce((a, r) => a + (r.unread || 0), 0);

  // ---- تحميل أولي: الغرف + أسماء الفريق ----
  const loadRooms = useCallback(async () => {
    const { data } = await supabase.rpc("my_rooms");
    setRooms((data as Room[]) || []);
    return (data as Room[]) || [];
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,team");
      (profs as any[] || []).forEach((p) => profNames.current.set(p.id, { name: p.full_name || "—", team: (p.team || "").toLowerCase() }));
      await loadRooms();
    })();
  }, [supabase, loadRooms]);

  // ---- Realtime على الرسائل ----
  useEffect(() => {
    const ch = supabase
      .channel("internal-chat-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_messages" }, async (payload) => {
        const m = payload.new as Msg;
        // الغرفة المفتوحة حالياً → أضف + علّم مقروء
        if (openRef.current && m.room_id === activeIdRef.current) {
          await ensureMeta([m]);
          setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          markRead(m.room_id);
          if (m.sender_id !== me.id && sound) playBlip();
        } else {
          // غرفة تانية → زوّد البادچ + توست + صوت (لو مش أنا)
          setRooms((prev) => prev.map((r) => r.id === m.room_id ? { ...r, unread: (r.unread || 0) + (m.sender_id !== me.id ? 1 : 0) } : r));
          if (m.sender_id !== me.id) {
            const sn = profNames.current.get(m.sender_id)?.name || tr("chatTeammate");
            let hint = "";
            if (m.customer_id) {
              const cn = await custName(m.customer_id);
              hint = cn ? " · " + tr("chatAbout") + " " + cn : "";
            }
            setToastMsg({ text: `${tr("chatNewMsgFrom")} ${sn}${hint}`, roomId: m.room_id });
            if (sound) playBlip();
            setTimeout(() => setToastMsg((t) => (t && t.roomId === m.room_id ? null : t)), 6000);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, me.id, sound, tr]);

  // ---- أدوات ----
  async function custName(id: string): Promise<string> {
    if (custNames.current.has(id)) return custNames.current.get(id)!;
    const { data } = await supabase.from("customers").select("name").eq("id", id).maybeSingle();
    const n = (data as any)?.name || "";
    custNames.current.set(id, n);
    return n;
  }
  async function signedUrl(path: string): Promise<string> {
    if (signed.current.has(path)) return signed.current.get(path)!;
    const { data } = await supabase.storage.from("internal-chat").createSignedUrl(path, 3600);
    const u = data?.signedUrl || "";
    signed.current.set(path, u);
    return u;
  }
  // جهّز أسماء العملاء + روابط المرفقات لمجموعة رسائل
  async function ensureMeta(list: Msg[]) {
    const cids = Array.from(new Set(list.map((m) => m.customer_id).filter((x): x is string => !!x && !custNames.current.has(x))));
    if (cids.length) {
      const { data } = await supabase.from("customers").select("id,name").in("id", cids);
      (data as any[] || []).forEach((c) => custNames.current.set(c.id, c.name || ""));
    }
    await Promise.all(list.filter((m) => m.attachment_path && !signed.current.has(m.attachment_path!)).map((m) => signedUrl(m.attachment_path!)));
  }

  async function markRead(roomId: string) {
    await supabase.from("internal_reads").upsert({ user_id: me.id, room_id: roomId, last_read_at: new Date().toISOString() }, { onConflict: "user_id,room_id" });
    setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, unread: 0 } : r));
  }

  async function openRoom(roomId: string) {
    setActiveId(roomId);
    setMsgs([]);
    const { data } = await supabase.from("internal_messages")
      .select("id,room_id,sender_id,body,customer_id,attachment_path,created_at")
      .eq("room_id", roomId).order("created_at", { ascending: true }).limit(80);
    const list = (data as Msg[]) || [];
    await ensureMeta(list);
    setMsgs(list);
    markRead(roomId);
    setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "auto" }), 60);
  }

  useEffect(() => { if (msgs.length) setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 40); }, [msgs.length]);

  async function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      const rs = await loadRooms();
      if (rs.length && !activeId) openRoom(rs[0].id);
      else if (activeId) openRoom(activeId);
    }
  }

  // ---- بحث عميل للربط ----
  useEffect(() => {
    if (!pickOpen) return;
    const q = pickQ.trim();
    if (q.length < 2) { setPickRes([]); return; }
    const h = setTimeout(async () => {
      const { data } = await supabase.from("customers").select("id,name").ilike("name", `%${q}%`).limit(6);
      setPickRes((data as any[] || []).map((c) => ({ id: c.id, name: c.name })));
    }, 250);
    return () => clearTimeout(h);
  }, [pickQ, pickOpen, supabase]);

  async function send() {
    const body = text.trim();
    if ((!body && !file) || !activeId || sending) return;
    setSending(true);
    let attachment_path: string | null = null;
    if (file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${activeId}/${me.id}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("internal-chat").upload(path, file, { upsert: false });
      if (up.error) { setSending(false); alert(tr("chatUploadFailed")); return; }
      attachment_path = path;
    }
    const { error } = await supabase.from("internal_messages").insert({
      room_id: activeId, sender_id: me.id, body, customer_id: linked?.id || null, attachment_path,
    });
    setSending(false);
    if (error) { alert(tr("chatSendFailed") + error.message); return; }
    setText(""); setLinked(null); setFile(null); setPickOpen(false);
    // الرسالة هترجع عبر Realtime وتتضاف تلقائياً
  }

  async function toggleSound() {
    const v = !sound; setSound(v);
    await supabase.from("profiles").update({ chat_sound: v }).eq("id", me.id);
  }

  function fmtTime(iso: string) {
    try { return new Intl.DateTimeFormat("ar-EG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date(iso)); } catch { return ""; }
  }

  const active = rooms.find((r) => r.id === activeId);

  return (
    <>
      {/* توست داخلي (قابل للضغط) */}
      {toastMsg && !open && (
        <button className="chat-toast" onClick={() => { setToastMsg(null); setOpen(true); openRoom(toastMsg.roomId); }}>
          <span className="ct-ico"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1a8.38 8.38 0 0 1-.9-3.9 8.5 8.5 0 0 1 8.4-8.9 8.5 8.5 0 0 1 8.6 8.4z" /></svg></span>
          <span className="ct-txt">{toastMsg.text}</span>
        </button>
      )}

      {/* الزر العائم */}
      {!open && (
        <button className="chat-fab" onClick={toggle} aria-label={tr("chatTitle")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1a8.38 8.38 0 0 1-.9-3.9 8.5 8.5 0 0 1 8.4-8.9 8.5 8.5 0 0 1 8.6 8.4z" /></svg>
          {totalUnread > 0 && <span className="chat-bdg num">{totalUnread > 99 ? "99+" : totalUnread}</span>}
        </button>
      )}

      {/* النافذة */}
      {open && (
        <div className="chat-pop">
          <div className="chat-ph">
            <span className="chat-hico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1a8.38 8.38 0 0 1-.9-3.9 8.5 8.5 0 0 1 8.4-8.9 8.5 8.5 0 0 1 8.6 8.4z" /></svg></span>
            <span className="chat-tt">{tr("chatTitle")}</span>
            <button className="chat-icobtn" onClick={toggleSound} title={sound ? tr("chatSoundOn") : tr("chatMuted")}>
              {sound ? (
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6M17 9l6 6" /></svg>
              )}
            </button>
            <button className="chat-x" onClick={() => setOpen(false)} aria-label="close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          </div>

          {/* الغرف */}
          <div className="chat-rooms">
            {rooms.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)", padding: "4px 2px" }}>{tr("chatNoRooms")}</span>}
            {rooms.map((r) => (
              <button key={r.id} className={"chat-room" + (r.id === activeId ? " on" : "")} onClick={() => openRoom(r.id)}>
                <span className="d" style={{ background: r.color || "var(--brand)" }} />{r.name}
                {r.unread > 0 && <span className="chat-rbdg num">{r.unread}</span>}
              </button>
            ))}
          </div>

          {/* الرسائل */}
          <div className="chat-msgs">
            {active && msgs.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, marginTop: 20 }}>{tr("chatEmpty")}</div>}
            {msgs.map((m) => {
              const mine = m.sender_id === me.id;
              const sp = profNames.current.get(m.sender_id);
              const who = mine ? tr("chatYou") : `${sp?.name || tr("chatTeammate")}${sp?.team ? " · " + (TEAM_AR[sp.team] || sp.team) : ""}`;
              const cn = m.customer_id ? custNames.current.get(m.customer_id) : "";
              const url = m.attachment_path ? signed.current.get(m.attachment_path) : "";
              return (
                <div key={m.id} className={"chat-m " + (mine ? "out" : "in")}>
                  <div className="chat-who">{who}</div>
                  <div className="chat-bub">
                    {m.customer_id && (
                      <button className="chat-cchip" onClick={() => { setOpen(false); router.push(`/customers/${m.customer_id}`); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        {tr("chatAbout")} {cn || "…"}
                      </button>
                    )}
                    {m.body}
                    {url && (
                      <a className="chat-att" href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" />
                      </a>
                    )}
                  </div>
                  <div className="chat-time num">{fmtTime(m.created_at)}</div>
                </div>
              );
            })}
            <div ref={msgsEnd} />
          </div>

          {/* شريط الكتابة */}
          {active && (
            <div className="chat-comp">
              {pickOpen && (
                <div className="chat-pick">
                  <input className="chat-pickinp" autoFocus placeholder={tr("chatSearchCustomer")} value={pickQ} onChange={(e) => setPickQ(e.target.value)} />
                  {pickRes.map((c) => (
                    <button key={c.id} className="chat-pickrow" onClick={() => { setLinked({ id: c.id, name: c.name }); setPickOpen(false); setPickQ(""); }}>{c.name}</button>
                  ))}
                </div>
              )}
              {(linked || file) && (
                <div className="chat-linkrow">
                  {linked && <span className="chat-linked">{tr("chatAbout")} {linked.name}<span className="rm" onClick={() => setLinked(null)}>✕</span></span>}
                  {file && <span className="chat-linked" style={{ background: "var(--brand-soft)", color: "var(--brand-d)" }}>🖼️ {file.name}<span className="rm" onClick={() => setFile(null)}>✕</span></span>}
                </div>
              )}
              <div className="chat-cbar">
                <button className="chat-ib" title={tr("chatLinkCustomer")} onClick={() => setPickOpen((v) => !v)}>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </button>
                <label className="chat-ib" title={tr("chatAttach")}>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.4 11.05l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-2.8-2.8l7.8-7.8" /></svg>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                <input className="chat-inp" placeholder={tr("chatPlaceholder")} value={text}
                  onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
                <button className="chat-send" onClick={send} disabled={sending} aria-label={tr("chatSend")}>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
