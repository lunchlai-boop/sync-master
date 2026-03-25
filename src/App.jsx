import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

/* ─────────────────────────────────────────────
   FIREBASE INIT
───────────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyDnjLGARxVkm6D6e-Lz9yODXCELG2JD21o",
  authDomain: "sync-master-3098b.firebaseapp.com",
  projectId: "sync-master-3098b",
  storageBucket: "sync-master-3098b.firebasestorage.app",
  messagingSenderId: "831218337276",
  appId: "1:831218337276:web:d4b7ef7a65c806e0a51e79"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ─────────────────────────────────────────────
   UTILS
───────────────────────────────────────────── */
function genId(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => chars[b % chars.length]).join("");
}
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatDateTW(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("zh-TW", { month:"long", day:"numeric", weekday:"short" });
}
function formatMonthTW(y, m) {
  return new Date(y, m, 1).toLocaleDateString("zh-TW", { year:"numeric", month:"long" });
}

/* ─────────────────────────────────────────────
   FIRESTORE HELPERS
   Collections:
     polls/{roomId}          → { roomId, title, creatorName, adminToken, totalMembers, createdAt }
     responses/{roomId}      → { [dancerName]: { [dateStr]: ["HH:MM~HH:MM",...] } }
───────────────────────────────────────────── */
const EXPIRE_DAYS = 20;

async function loadPoll(roomId) {
  try {
    const snap = await getDoc(doc(db, "polls", roomId));
    if (!snap.exists()) return null;
    const data = snap.data();
    // Check expiry: createdAt + 20 days
    const age = Date.now() - (data.createdAt || 0);
    if (age > EXPIRE_DAYS * 24 * 60 * 60 * 1000) {
      // Auto-delete expired room
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "polls", roomId)).catch(()=>{});
      await deleteDoc(doc(db, "responses", roomId)).catch(()=>{});
      return "expired";
    }
    return data;
  } catch { return null; }
}
async function savePoll(poll) {
  await setDoc(doc(db, "polls", poll.roomId), poll);
}
async function loadResponses(roomId) {
  try {
    const snap = await getDoc(doc(db, "responses", roomId));
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}
async function saveResponses(roomId, responses, dancerName) {
  try {
    if (dancerName) {
      const dancerData = responses[dancerName];
      // Firestore doesn't allow undefined values — sanitize
      const clean = dancerData ? JSON.parse(JSON.stringify(dancerData)) : {};
      const update = { [dancerName]: clean };
      await setDoc(doc(db, "responses", roomId), update, { merge: true });
    } else {
      await setDoc(doc(db, "responses", roomId), responses);
    }
  } catch(e) {
    console.error("saveResponses error:", e, { roomId, dancerName });
    throw e; // re-throw so caller can show error
  }
}

/* ─────────────────────────────────────────────
   CSS-IN-JS  (injected once)
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#07080f;--surface:#0f1018;--s2:#171825;--s3:#1e2030;
  --border:#252740;--border2:#323560;
  --accent:#b4ff5a;--accent2:#ff5a7a;--accent3:#5ae8ff;
  --text:#e8eaff;--muted:#5a5e8a;
  --r:10px;
}
body{background:var(--bg);color:var(--text);font-family:'Noto Sans TC',sans-serif;min-height:100vh;}
/* noise */
body::after{content:'';position:fixed;inset:0;background:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");pointer-events:none;z-index:9999;}

/* layout */
.wrap{max-width:860px;margin:0 auto;padding:32px 20px;}

/* NAV */
.nav{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;border-bottom:1px solid var(--border);background:rgba(7,8,15,0.92);backdrop-filter:blur(14px);position:sticky;top:0;z-index:100;}
.logo{font-family:'DM Mono',monospace;font-size:1rem;color:var(--accent);letter-spacing:.12em;}
.logo span{color:var(--muted);}
.pill-tabs{display:flex;gap:3px;background:var(--s2);padding:3px;border-radius:8px;border:1px solid var(--border);}
.pill-tab{padding:7px 18px;border-radius:6px;border:none;background:transparent;color:var(--muted);font-family:'Noto Sans TC';font-size:.85rem;cursor:pointer;transition:.2s;}
.pill-tab.on{background:var(--accent);color:#000;font-weight:700;}

/* HERO */
.hero{padding:64px 0 48px;text-align:center;}
.hero h1{font-size:clamp(2.2rem,7vw,4rem);font-weight:900;line-height:1.05;letter-spacing:-.04em;margin-bottom:14px;}
.hero h1 em{font-style:normal;color:var(--accent);display:block;}
.hero p{color:var(--muted);font-size:.95rem;max-width:420px;margin:0 auto 36px;}

/* CARD */
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px;}
.card + .card{margin-top:16px;}
.card-title{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-family:'DM Mono',monospace;margin-bottom:16px;}

/* INPUTS */
.inp{width:100%;padding:12px 16px;background:var(--s2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:'Noto Sans TC';font-size:.95rem;outline:none;transition:.2s;}
.inp:focus{border-color:var(--accent);}
.inp::placeholder{color:var(--muted);}
.inp-row{display:flex;gap:10px;flex-wrap:wrap;}
.inp-sm{width:130px;font-family:'DM Mono',monospace;}

/* BUTTONS */
.btn{padding:12px 24px;border-radius:var(--r);border:none;font-family:'Noto Sans TC';font-weight:700;font-size:.9rem;cursor:pointer;transition:.15s;white-space:nowrap;}
.btn-accent{background:var(--accent);color:#000;}
.btn-accent:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(180,255,90,.25);}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--muted);}
.btn-outline:hover{border-color:var(--border2);color:var(--text);}
.btn-ghost{background:none;border:1px solid var(--border);color:var(--muted);padding:6px 14px;border-radius:6px;font-family:'Noto Sans TC';font-size:.8rem;cursor:pointer;transition:.2s;}
.btn-ghost:hover{border-color:var(--accent2);color:var(--accent2);}
.btn-sm{padding:9px 18px;font-size:.85rem;}

/* LINK BOX */
.link-box{display:flex;align-items:center;gap:8px;background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 14px;flex-wrap:wrap;}
.link-code{font-family:'DM Mono',monospace;font-size:.78rem;color:var(--accent3);flex:1;word-break:break-all;min-width:0;}
.copy-btn{padding:6px 14px;background:var(--s2);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:'Noto Sans TC';font-size:.8rem;cursor:pointer;transition:.2s;white-space:nowrap;}
.copy-btn:hover{border-color:var(--accent3);color:var(--accent3);}

/* CALENDAR */
.cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.cal-month{font-family:'DM Mono',monospace;font-size:1.05rem;color:var(--accent);}
.cal-arrow{width:36px;height:36px;background:var(--s2);border:1px solid var(--border);border-radius:7px;color:var(--text);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:.2s;}
.cal-arrow:hover{border-color:var(--accent);}
.weekdays{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:3px;}
.wd{text-align:center;font-size:.7rem;color:var(--muted);font-family:'DM Mono',monospace;padding:6px 0;}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.day{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--s2);border:1px solid var(--border);border-radius:7px;cursor:pointer;transition:.2s;font-size:.85rem;gap:3px;position:relative;}
.day:hover:not(.empty):not(.past){border-color:var(--accent);background:var(--s3);}
.day.sel{border-color:var(--accent);background:rgba(180,255,90,.09);}
.day.sel .dn{color:var(--accent);font-weight:700;}
.day.today{border-color:var(--accent3);}
.day.today .dn{color:var(--accent3);}
.day.has .dot{width:5px;height:5px;background:var(--accent);border-radius:50%;}
.day.empty,.day.past{opacity:.18;pointer-events:none;}

/* SLOT PANEL */
.slot-panel{margin-top:24px;background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:24px;}
.slot-panel h4{font-size:.95rem;margin-bottom:18px;}
.slot-panel h4 span{color:var(--accent);font-family:'DM Mono',monospace;}
.slot-list{display:flex;flex-direction:column;gap:7px;margin-top:10px;}
.slot-item{display:flex;align-items:center;justify-content:space-between;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:11px 15px;animation:slideIn .18s ease;}
@keyframes slideIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
.slot-time{font-family:'DM Mono',monospace;font-size:.9rem;color:var(--accent);}
.rm-btn{background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:3px 8px;border-radius:4px;transition:.2s;}
.rm-btn:hover{color:var(--accent2);}
.empty-box{text-align:center;padding:28px;color:var(--muted);font-size:.85rem;border:1px dashed var(--border);border-radius:8px;}

/* ADMIN */
.stat-row{display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap;}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 24px;flex:1;min-width:140px;}
.stat .v{font-family:'DM Mono',monospace;font-size:2.2rem;color:var(--accent);line-height:1;margin-bottom:3px;}
.stat .l{font-size:.75rem;color:var(--muted);}
.date-group{margin-bottom:24px;}
.dg-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border);}
.dg-date{font-family:'DM Mono',monospace;font-size:.9rem;color:var(--accent3);font-weight:500;}
.badge{background:var(--s2);border:1px solid var(--border);padding:2px 10px;border-radius:100px;font-size:.7rem;color:var(--muted);}
.slot-row{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;display:grid;grid-template-columns:140px 1fr 1fr;gap:18px;align-items:start;margin-bottom:8px;}
.slot-row .tc{font-family:'DM Mono',monospace;font-size:.9rem;color:var(--accent);font-weight:500;white-space:pre-line;}
.col-head{font-size:.65rem;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;}
.chips{display:flex;flex-wrap:wrap;gap:5px;}
.chip{padding:3px 11px;border-radius:100px;font-size:.78rem;}
.chip.ok{background:rgba(180,255,90,.12);color:var(--accent);border:1px solid rgba(180,255,90,.25);}
.chip.no{background:rgba(255,90,122,.08);color:var(--accent2);border:1px solid rgba(255,90,122,.18);text-decoration:line-through;opacity:.65;}
.count-pill{display:inline-flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--border);padding:5px 12px;border-radius:7px;font-size:.82rem;margin-bottom:10px;}
.count-pill .n{font-family:'DM Mono',monospace;font-size:1rem;color:var(--accent);}
.bar{height:3px;background:var(--border);border-radius:2px;margin-bottom:10px;overflow:hidden;}
.bar-fill{height:100%;background:var(--accent);border-radius:2px;transition:width .5s ease;}

/* ROOM CODE display */
.room-hero{text-align:center;padding:40px 20px;}
.room-code{font-family:'DM Mono',monospace;font-size:2.5rem;color:var(--accent);letter-spacing:.25em;background:var(--s2);border:2px solid var(--border);display:inline-block;padding:16px 32px;border-radius:12px;margin:16px 0;}

/* TOAST */
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(100px);background:var(--accent);color:#000;padding:11px 26px;border-radius:100px;font-weight:700;font-size:.85rem;z-index:9998;transition:transform .3s cubic-bezier(.34,1.56,.64,1);white-space:nowrap;pointer-events:none;}
.toast.on{transform:translateX(-50%) translateY(0);}

/* SPINNER */
.spin{display:inline-block;width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}

/* DIVIDER */
.divider{height:1px;background:var(--border);margin:24px 0;}

@media(max-width:600px){
  .slot-row{grid-template-columns:1fr;}
  .nav{padding:14px 18px;}
  .wrap{padding:20px 14px;}
}
`;

function injectCSS() {
  if (document.getElementById("ds-style")) return;
  const el = document.createElement("style");
  el.id = "ds-style";
  el.textContent = CSS;
  document.head.appendChild(el);
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
let toastTimer;
function useToast() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const show = useCallback((m) => {
    setMsg(m); setOn(true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setOn(false), 2200);
  }, []);
  return { msg, on, show };
}

/* ─────────────────────────────────────────────
   COPY HELPER
───────────────────────────────────────────── */
function useCopy(toast) {
  return (text, label = "已複製！") => {
    navigator.clipboard.writeText(text).then(() => toast.show("✓ " + label));
  };
}

/* ═══════════════════════════════════════════
   VIEW: HOME  – 發起 or 加入
═══════════════════════════════════════════ */
function HomeView({ onCreated, onJoined }) {
  const [tab, setTab] = useState("create"); // create | join
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [totalMembers, setTotalMembers] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [mode, setMode] = useState("free"); // free | fixed
  const [candidates, setCandidates] = useState([]); // [{date, start, end}]
  const [candDate, setCandDate] = useState("");
  const [candStart, setCandStart] = useState("14:00");
  const [candEnd, setCandEnd] = useState("18:00");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  function addCandidate() {
    if (!candDate) { toast.show("請選擇日期"); return; }
    if (!candStart || !candEnd) { toast.show("請填入時間"); return; }
    if (candStart >= candEnd) { toast.show("結束時間需晚於開始時間"); return; }
    const key = `${candDate}|${candStart}~${candEnd}`;
    if (candidates.find(c => `${c.date}|${c.start}~${c.end}` === key)) { toast.show("此時段已存在"); return; }
    setCandidates(prev => [...prev, { date: candDate, start: candStart, end: candEnd }]
      .sort((a,b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.start.localeCompare(b.start)));
  }
  function removeCandidate(i) { setCandidates(prev => prev.filter((_,idx)=>idx!==i)); }

  function handlePinInput(e) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setAdminPin(val);
  }

  async function handleCreate() {
    if (!title.trim() || !creator.trim()) { toast.show("請填寫統計名稱與你的名字"); return; }
    if (adminPin.length !== 6) { toast.show("請設定 6 位數字的後台密碼"); return; }
    const tm = parseInt(totalMembers);
    if (!totalMembers || isNaN(tm) || tm < 1 || tm > 999) { toast.show("請填寫有效的統計總人數（1–999）"); return; }
    if (mode === "free") {
      if (!dateEnd) { toast.show("請設定統計截止日期"); return; }
      if (dateEnd < toDateStr(new Date())) { toast.show("截止日期不能早於今天"); return; }
    }
    setLoading(true);
    const roomId = genId(8);
    const adminToken = adminPin;
    if (mode === "fixed" && candidates.length === 0) { setLoading(false); toast.show("請至少新增一個候選時段"); return; }
    const createdAt = Date.now();
    const poll = { roomId, title: title.trim(), creatorName: creator.trim(), adminToken, totalMembers: tm, dateStart: toDateStr(new Date()), dateEnd: mode==="free"?dateEnd:"", mode, candidates: mode==="fixed"?candidates:[], createdAt };
    await savePoll(poll);
    await saveResponses(roomId, {});
    setLoading(false);
    onCreated(poll);
  }

  async function handleJoin() {
    const code = joinCode.trim().toLowerCase();
    if (!code) { toast.show("請輸入房間碼"); return; }
    setLoading(true);
    const poll = await loadPoll(code);
    setLoading(false);
    if (!poll) { toast.show("找不到此房間碼，請確認後再試"); return; }
    onJoined(poll);
  }

  return (
    <>
      <div className="hero">
        <h1 style={{color:"var(--accent)"}}>時間統整大師</h1>
        <p>大家很難約？<br/>發起、填寫、看結果，即時彙整所有人的可用時段</p>
      </div>

      <div className="pill-tabs" style={{ display:"flex", justifyContent:"center", marginBottom:28 }}>
        <button className={`pill-tab ${tab==="create"?"on":""}`} onClick={()=>setTab("create")}>✦ 發起新統計</button>
        <button className={`pill-tab ${tab==="join"?"on":""}`} onClick={()=>setTab("join")}>→ 加入已有統計</button>
      </div>

      {tab === "create" && (
        <div className="card" style={{ maxWidth:480, margin:"0 auto" }}>
          <div className="card-title">建立新的排練統計</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <input className="inp" placeholder="統計名稱（例：十月公演排練）" value={title} onChange={e=>setTitle(e.target.value)} maxLength={40} />
            <input className="inp" placeholder="你的名字（發起人）" value={creator} onChange={e=>setCreator(e.target.value)} maxLength={20} />
            <div>
              <div style={{ fontSize:".78rem", color:"var(--muted)", marginBottom:6 }}>👥 統計總人數（含你自己）</div>
              <input className="inp" placeholder="例：12" value={totalMembers}
                onChange={e=>setTotalMembers(e.target.value.replace(/\D/g,"").slice(0,3))}
                inputMode="numeric" maxLength={3}
                style={{ fontFamily:"'DM Mono',monospace", fontSize:"1.1rem", textAlign:"center", letterSpacing:".1em" }} />
            </div>

            {/* MODE TOGGLE */}
            <div>
              <div style={{ fontSize:".78rem", color:"var(--muted)", marginBottom:8 }}>📋 統計模式</div>
              <div style={{ display:"flex", gap:8 }}>
                {[["free","🗓 自由填寫時段"],["fixed","📌 指定候選時段"]].map(([val,label])=>(
                  <button key={val} onClick={()=>setMode(val)} style={{
                    flex:1, padding:"10px 8px", borderRadius:8, cursor:"pointer",
                    fontFamily:"'Noto Sans TC'", fontSize:".85rem", transition:".15s",
                    background: mode===val ? "rgba(180,255,90,.15)" : "var(--s2)",
                    border: mode===val ? "1px solid var(--accent)" : "1px solid var(--border)",
                    color: mode===val ? "var(--accent)" : "var(--muted)",
                    fontWeight: mode===val ? 700 : 400
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ fontSize:".72rem", color:"var(--muted)", marginTop:6 }}>
                {mode==="free" ? "成員自行選日期、填可以的時段區間" : "發起人先設定候選日期與範圍，成員在範圍內填自己可以的時段"}
              </div>
            </div>

            {/* FREE MODE: date range */}
            {mode === "free" && (
              <div>
                <div style={{ fontSize:".78rem", color:"var(--muted)", marginBottom:6 }}>📅 統計截止日期</div>
                <input type="date" className="inp" value={dateEnd} min={toDateStr(new Date())}
                  onChange={e=>setDateEnd(e.target.value)}
                  style={{ fontFamily:"'DM Mono',monospace", fontSize:".95rem", colorScheme:"dark" }} />
                <div style={{ fontSize:".72rem", color:"var(--muted)", marginTop:5 }}>成員只能填此日期以內的日期</div>
              </div>
            )}

            {/* FIXED MODE: candidate slots */}
            {mode === "fixed" && (
              <div>
                <div style={{ fontSize:".78rem", color:"var(--muted)", marginBottom:8 }}>📌 新增候選時段</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:8 }}>
                  <input type="date" className="inp" value={candDate} min={toDateStr(new Date())}
                    onChange={e=>setCandDate(e.target.value)}
                    style={{ flex:"1 1 130px", fontFamily:"'DM Mono',monospace", fontSize:".85rem", colorScheme:"dark" }} />
                  <input type="time" className="inp inp-sm" value={candStart} onChange={e=>setCandStart(e.target.value)} />
                  <span style={{ color:"var(--muted)", fontSize:".8rem" }}>～</span>
                  <input type="time" className="inp inp-sm" value={candEnd} onChange={e=>setCandEnd(e.target.value)} />
                  <button className="btn btn-outline btn-sm" onClick={addCandidate}>＋</button>
                </div>
                {candidates.length === 0
                  ? <div style={{ fontSize:".78rem", color:"var(--muted)", padding:"10px 0" }}>尚未新增候選時段</div>
                  : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {candidates.map((c,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                          background:"var(--s2)", border:"1px solid var(--border)", borderRadius:7, padding:"8px 12px" }}>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:".82rem", color:"var(--accent)" }}>
                            {c.date} &nbsp; {c.start} → {c.end}
                          </span>
                          <button onClick={()=>removeCandidate(i)} style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:"1rem" }}>✕</button>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}
            <div>
              <div style={{ fontSize:".78rem", color:"var(--muted)", marginBottom:6 }}>
                🔐 設定後台密碼（6 位數字）
              </div>
              <input
                className="inp"
                placeholder="例：123456"
                value={adminPin}
                onChange={handlePinInput}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                onKeyDown={e=>e.key==="Enter"&&handleCreate()}
                style={{ fontFamily:"'DM Mono',monospace", letterSpacing:".3em", fontSize:"1.3rem", textAlign:"center" }}
              />
              <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:8 }}>
                {Array(6).fill(0).map((_,i)=>(
                  <div key={i} style={{
                    width:10, height:10, borderRadius:"50%",
                    background: i < adminPin.length ? "var(--accent)" : "var(--border)",
                    transition:".15s"
                  }}/>
                ))}
              </div>
              <div style={{ fontSize:".72rem", color:"var(--muted)", textAlign:"center", marginTop:8 }}>
                進入後台時需輸入此密碼，請牢記
              </div>
            </div>
            <button className="btn btn-accent" onClick={handleCreate} disabled={loading} style={{ marginTop:4 }}>
              {loading ? <><span className="spin" style={{marginRight:8}}/>建立中…</> : "建立統計 →"}
            </button>
          </div>
        </div>
      )}

      {tab === "join" && (
        <div className="card" style={{ maxWidth:480, margin:"0 auto" }}>
          <div className="card-title">輸入房間碼加入</div>
          <div style={{ display:"flex", gap:10 }}>
            <input className="inp" placeholder="8 位房間碼…" value={joinCode} onChange={e=>setJoinCode(e.target.value)}
              maxLength={10} onKeyDown={e=>e.key==="Enter"&&handleJoin()} style={{ fontFamily:"'DM Mono',monospace", letterSpacing:".1em" }}/>
            <button className="btn btn-accent btn-sm" onClick={handleJoin} disabled={loading}>
              {loading ? <span className="spin"/> : "加入"}
            </button>
          </div>
        </div>
      )}

      <div className="toast" style={{ position:"fixed" }} />
      <Toast msg={toast.msg} on={toast.on} />
    </>
  );
}

/* ═══════════════════════════════════════════
   VIEW: CREATED  – 發起成功，顯示連結
═══════════════════════════════════════════ */
function CreatedView({ poll, onEnterAdmin, onFillAsCreator }) {
  const toast = useToast();
  const copy = useCopy(toast);

  // Simulate URLs (in real deployment these would be actual URLs)
  const base = window.location.href.split("?")[0];
  const memberLink = `${base}?room=${poll.roomId}`;
  const adminLink  = `${base}?room=${poll.roomId}&admin=1`;

  return (
    <div className="wrap">
      <div className="room-hero">
        <div style={{ fontSize:".75rem", color:"var(--muted)", letterSpacing:".12em", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:12 }}>統計已建立 ✦</div>
        <h2 style={{ fontSize:"1.8rem", fontWeight:900, marginBottom:8 }}>{poll.title}</h2>
        <div style={{ color:"var(--muted)", marginBottom:24 }}>由 <strong style={{ color:"var(--text)" }}>{poll.creatorName}</strong> 發起</div>
        <div className="room-code">{poll.roomId}</div>
        <div style={{ color:"var(--muted)", fontSize:".82rem" }}>房間碼</div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-title">📣 分享給成員（填寫用）</div>
        <p style={{ fontSize:".85rem", color:"var(--muted)", marginBottom:12 }}>把以下連結傳給成員，他們可以填入自己可以排練的時段</p>
        <div className="link-box">
          <span className="link-code">{memberLink}</span>
          <button className="copy-btn" onClick={()=>copy(memberLink, "成員連結已複製！")}>複製</button>
        </div>
        <p style={{ fontSize:".75rem", color:"var(--muted)", marginTop:10 }}>沒有連結也可以直接輸入房間碼 <code style={{ background:"var(--s3)", padding:"1px 6px", borderRadius:4, fontFamily:"'DM Mono',monospace", color:"var(--accent)" }}>{poll.roomId}</code> 加入</p>
      </div>

      <div className="card" style={{ marginBottom:28, background:"rgba(180,255,90,.04)", borderColor:"rgba(180,255,90,.2)" }}>
        <div className="card-title">🔐 管理員專屬連結（後台用）</div>
        <p style={{ fontSize:".85rem", color:"var(--muted)", marginBottom:12 }}>只有持有此連結的人才能看到後台統計，<strong style={{ color:"var(--accent2)" }}>請勿分享給成員</strong></p>
        <div className="link-box" style={{ borderColor:"rgba(180,255,90,.25)" }}>
          <span className="link-code" style={{ color:"var(--accent)" }}>{adminLink}</span>
          <button className="copy-btn" onClick={()=>copy(adminLink, "管理員連結已複製！")}>複製</button>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
        <button className="btn btn-outline" onClick={onFillAsCreator}>我也要填寫時段</button>
        <button className="btn btn-accent" onClick={onEnterAdmin}>進入後台 →</button>
      </div>

      <Toast msg={toast.msg} on={toast.on} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   SUB-VIEW: FIXED MODE FILL
   Each candidate shows its date + time range.
   Member fills in their available sub-slots within that range.
═══════════════════════════════════════════ */
function FixedFillView({ poll, dancer, responses, setResponses, submitted, setSubmitted, toast }) {
  const [openIdx, setOpenIdx] = useState(null); // which candidate is expanded
  const [tStart, setTStart] = useState("14:00");
  const [tEnd, setTEnd] = useState("18:00");

  async function addSlot(c, cKey) {
    if (!tStart || !tEnd) { toast.show("請填入時間"); return; }
    if (tStart >= tEnd) { toast.show("結束時間需晚於開始時間"); return; }
    if (tStart < c.start || tEnd > c.end) {
      toast.show(`時段必須在 ${c.start}～${c.end} 範圍內`); return;
    }
    const slot = `${tStart}~${tEnd}`;
    const updated = { ...responses };
    if (!updated[dancer]) updated[dancer] = {};
    if (!updated[dancer][cKey]) updated[dancer][cKey] = [];
    if (updated[dancer][cKey].includes(slot)) { toast.show("此時段已存在"); return; }
    updated[dancer][cKey] = [...updated[dancer][cKey], slot].sort();
    setResponses(updated);
    await saveResponses(poll.roomId, updated, dancer);
    toast.show("✓ 已儲存");
  }

  async function removeSlot(cKey, slot) {
    const updated = { ...responses };
    updated[dancer][cKey] = updated[dancer][cKey].filter(s => s !== slot);
    if (!updated[dancer][cKey].length) delete updated[dancer][cKey];
    if (!Object.keys(updated[dancer]||{}).length) delete updated[dancer];
    setResponses(updated);
    await saveResponses(poll.roomId, updated, dancer);
  }

  return (
    <>
      <div style={{ fontSize:".8rem", color:"var(--muted)", marginBottom:16 }}>
        在每個候選時段內，填寫你可以參加的時間區間
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {(poll.candidates||[]).map((c, i) => {
          const cKey = `${c.date}|${c.start}~${c.end}`;
          const mySlots = (responses[dancer]||{})[cKey] || [];
          const isOpen = openIdx === i;

          return (
            <div key={i} style={{
              background:"var(--surface)", border:`1px solid ${mySlots.length?"rgba(180,255,90,.3)":"var(--border)"}`,
              borderRadius:12, overflow:"hidden", transition:".2s"
            }}>
              {/* Header row */}
              <div onClick={()=>setOpenIdx(isOpen ? null : i)} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"14px 16px", cursor:"pointer", gap:12
              }}>
                <div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:".78rem", color:"var(--accent3)", marginBottom:3 }}>
                    {formatDateTW(c.date)}
                  </div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"1rem", color:"var(--accent)", fontWeight:700 }}>
                    {c.start} ～ {c.end}
                    <span style={{ fontFamily:"'Noto Sans TC'", fontSize:".72rem", color:"var(--muted)", fontWeight:400, marginLeft:8 }}>
                      （可填範圍）
                    </span>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  {mySlots.length > 0 && (
                    <span style={{ fontSize:".75rem", color:"var(--accent)", background:"rgba(180,255,90,.12)",
                      border:"1px solid rgba(180,255,90,.25)", padding:"2px 10px", borderRadius:100 }}>
                      已填 {mySlots.length} 段
                    </span>
                  )}
                  <span style={{ color:"var(--muted)", fontSize:"1rem", transform: isOpen?"rotate(90deg)":"none", transition:".2s", display:"inline-block" }}>›</span>
                </div>
              </div>

              {/* Expanded: slot input + list */}
              {isOpen && (
                <div style={{ padding:"0 16px 16px", borderTop:"1px solid var(--border)" }}>
                  <div style={{ paddingTop:14, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:12 }}>
                    <label style={{ fontSize:".78rem", color:"var(--muted)", whiteSpace:"nowrap" }}>我可以</label>
                    <input type="time" className="inp inp-sm" value={tStart}
                      min={c.start} max={c.end}
                      onChange={e=>setTStart(e.target.value)} />
                    <span style={{ color:"var(--muted)", fontSize:".85rem" }}>～</span>
                    <input type="time" className="inp inp-sm" value={tEnd}
                      min={c.start} max={c.end}
                      onChange={e=>setTEnd(e.target.value)} />
                    <button className="btn btn-outline btn-sm" onClick={()=>addSlot(c, cKey)}>＋ 新增</button>
                  </div>
                  <div style={{ fontSize:".7rem", color:"var(--muted)", marginBottom:10 }}>
                    範圍限制：{c.start} ～ {c.end}
                  </div>
                  <div className="slot-list">
                    {mySlots.length === 0
                      ? <div className="empty-box">尚未填入可參加的時段</div>
                      : mySlots.map(s => (
                          <div className="slot-item" key={s}>
                            <span className="slot-time">{s.replace("~"," → ")}</span>
                            <button className="rm-btn" onClick={()=>removeSlot(cKey, s)}>✕</button>
                          </div>
                        ))
                    }
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      {!submitted ? (
        <div style={{ marginTop:28, textAlign:"center" }}>
          <button className="btn btn-accent" style={{ padding:"14px 40px", fontSize:"1rem" }}
            onClick={()=>setSubmitted(true)}>✓ 填寫完畢</button>
          <div style={{ fontSize:".75rem", color:"var(--muted)", marginTop:10 }}>提交後仍可返回修改</div>
        </div>
      ) : (
        <div style={{ marginTop:28, textAlign:"center", background:"rgba(180,255,90,.07)",
          border:"1px solid rgba(180,255,90,.25)", borderRadius:14, padding:"36px 24px" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:12 }}>✅</div>
          <div style={{ fontSize:"1.2rem", fontWeight:900, color:"var(--accent)", marginBottom:8 }}>已提交您的時間</div>
          <div style={{ fontSize:".9rem", color:"var(--muted)", marginBottom:20 }}>可直接關閉此視窗</div>
          <button className="btn btn-outline btn-sm" onClick={()=>setSubmitted(false)}>返回修改</button>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   VIEW: FILL  – 成員填寫時段
═══════════════════════════════════════════ */
function FillView({ poll }) {
  const STORAGE_KEY = `sync-dancer-${poll.roomId}`;
  const [dancer, setDancer] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [confirmed, setConfirmed] = useState(false);
  const [responses, setResponses] = useState({});
  const [loadingResp, setLoadingResp] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [selDate, setSelDate] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [tStart, setTStart] = useState("14:00");
  const [tEnd, setTEnd] = useState("18:00");
  const toast = useToast();
  const todayStr = toDateStr(new Date());

  useEffect(() => {
    loadResponses(poll.roomId).then(r => { setResponses(r); setLoadingResp(false); });
  }, [poll.roomId]);

  // Auto-confirm if name was remembered
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { setDancer(saved); setConfirmed(true); }
  }, []);

  async function confirmName() {
    if (!dancer.trim()) { toast.show("請輸入名字"); return; }
    const name = dancer.trim();
    setDancer(name);
    localStorage.setItem(STORAGE_KEY, name);
    setConfirmed(true);
  }

  async function addSlot() {
    if (!tStart || !tEnd) { toast.show("請填入時間"); return; }
    if (tStart >= tEnd) { toast.show("結束時間需晚於開始時間"); return; }
    const slot = `${tStart}~${tEnd}`;
    const updated = { ...responses };
    if (!updated[dancer]) updated[dancer] = {};
    if (!updated[dancer][selDate]) updated[dancer][selDate] = [];
    if (updated[dancer][selDate].includes(slot)) { toast.show("此時段已存在"); return; }
    updated[dancer][selDate] = [...updated[dancer][selDate], slot].sort();
    setResponses(updated);
    try {
      await saveResponses(poll.roomId, updated, dancer);
      toast.show("✓ 已儲存");
    } catch(e) {
      toast.show("❌ 儲存失敗，請重試");
    }
  }

  async function removeSlot(slot) {
    const updated = { ...responses };
    updated[dancer][selDate] = updated[dancer][selDate].filter(s => s !== slot);
    if (!updated[dancer][selDate].length) delete updated[dancer][selDate];
    if (!Object.keys(updated[dancer]||{}).length) delete updated[dancer];
    setResponses(updated);
    try {
      await saveResponses(poll.roomId, updated, dancer);
    } catch(e) {
      toast.show("❌ 儲存失敗，請重試");
    }
  }

  function changeMonth(dir) {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y); setSelDate(null);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const mySlots = selDate && confirmed ? ((responses[dancer]||{})[selDate]||[]) : [];

  return (
    <div className="wrap">
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:".7rem", color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>排練統計</div>
        <h2 style={{ fontSize:"1.4rem", fontWeight:900 }}>{poll.title}</h2>
        <div style={{ fontSize:".85rem", color:"var(--muted)", marginTop:4 }}>發起人：{poll.creatorName}</div>
      </div>

      {!confirmed ? (
        <div className="card" style={{ maxWidth:440 }}>
          <div className="card-title">輸入你的名字開始填寫</div>
          <div style={{ display:"flex", gap:10, marginBottom: Object.keys(responses).length ? 12 : 0 }}>
            <input className="inp" placeholder="你的名字…" value={dancer} onChange={e=>setDancer(e.target.value)}
              maxLength={20} onKeyDown={e=>e.key==="Enter"&&confirmName()} />
            <button className="btn btn-accent btn-sm" onClick={confirmName}>確認</button>
          </div>
          {!loadingResp && Object.keys(responses).length > 0 && (
            <div>
              <div style={{ fontSize:".72rem", color:"var(--muted)", marginBottom:8 }}>或選擇已填寫過的名字：</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {Object.keys(responses).map(n => (
                  <button key={n} onClick={() => { setDancer(n); localStorage.setItem(STORAGE_KEY, n); setConfirmed(true); }}
                    style={{ padding:"6px 14px", background:"var(--s2)", border:"1px solid var(--border2)",
                      borderRadius:100, color:"var(--text)", fontFamily:"'Noto Sans TC'",
                      fontSize:".82rem", cursor:"pointer", transition:".15s" }}
                    onMouseOver={e=>e.target.style.borderColor="var(--accent)"}
                    onMouseOut={e=>e.target.style.borderColor="var(--border2)"}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Name badge */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24, flexWrap:"wrap" }}>
            <div style={{ background:"var(--s2)", border:"1px solid var(--border)", borderRadius:100, padding:"7px 16px", fontSize:".85rem", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"var(--muted)" }}>📍</span>
              <strong style={{ color:"var(--accent)" }}>{dancer}</strong>
              <button className="btn-ghost" onClick={()=>{ localStorage.removeItem(STORAGE_KEY); setConfirmed(false); setSelDate(null); }}>更換</button>
            </div>
            {poll.mode !== "fixed" && (
              <span style={{ fontSize:".8rem", color:"var(--muted)" }}>
                點選日期 → 新增可出席時段
                {poll.dateEnd && <span style={{ marginLeft:8, color:"var(--accent3)" }}>（截止 {poll.dateEnd}）</span>}
              </span>
            )}
          </div>

          {loadingResp ? <div style={{ textAlign:"center", padding:40 }}><span className="spin" /></div> : poll.mode === "fixed" ? (
            /* ── FIXED MODE: fill slots within each candidate range ── */
            <FixedFillView poll={poll} dancer={dancer} responses={responses} setResponses={setResponses} submitted={submitted} setSubmitted={setSubmitted} toast={toast} />
          ) : (
            /* ── FREE MODE: calendar + slot input ── */
            <>
              <div className="card">
                <div className="cal-nav">
                  <button className="cal-arrow" onClick={()=>changeMonth(-1)}>‹</button>
                  <div className="cal-month">{formatMonthTW(year, month)}</div>
                  <button className="cal-arrow" onClick={()=>changeMonth(1)}>›</button>
                </div>
                <div className="weekdays">
                  {["日","一","二","三","四","五","六"].map(d=><div className="wd" key={d}>{d}</div>)}
                </div>
                <div className="cal-grid">
                  {Array(firstDay).fill(0).map((_,i)=><div className="day empty" key={`e${i}`}/>)}
                  {Array(daysInMonth).fill(0).map((_,i)=>{
                    const d = i+1;
                    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                    const pollStart = poll.dateStart || todayStr;
                    const pollEnd = poll.dateEnd || "9999-12-31";
                    const isOutOfRange = ds < pollStart || ds > pollEnd;
                    const hasSlots = (responses[dancer]||{})[ds]?.length > 0;
                    return (
                      <div key={ds} className={`day${isOutOfRange?" past":""}${ds===todayStr?" today":""}${ds===selDate?" sel":""}${hasSlots?" has":""}`}
                        onClick={()=>!isOutOfRange && setSelDate(ds)}>
                        <span className="dn">{d}</span>
                        {hasSlots && <div className="dot"/>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selDate && (
                <div className="slot-panel">
                  <h4>📍 <span>{formatDateTW(selDate)}</span> — 可出席時段</h4>
                  <div className="inp-row" style={{ alignItems:"center" }}>
                    <label style={{ fontSize:".8rem", color:"var(--muted)", whiteSpace:"nowrap" }}>開始</label>
                    <input type="time" className="inp inp-sm" value={tStart} onChange={e=>setTStart(e.target.value)} />
                    <label style={{ fontSize:".8rem", color:"var(--muted)", whiteSpace:"nowrap" }}>結束</label>
                    <input type="time" className="inp inp-sm" value={tEnd} onChange={e=>setTEnd(e.target.value)} />
                    <button className="btn btn-outline btn-sm" onClick={addSlot}>＋ 新增</button>
                  </div>
                  <div className="slot-list">
                    {mySlots.length === 0
                      ? <div className="empty-box">尚未新增時段，在上方填入時間後點「新增」</div>
                      : mySlots.map(s => (
                          <div className="slot-item" key={s}>
                            <span className="slot-time">{s.replace("~"," → ")}</span>
                            <button className="rm-btn" onClick={()=>removeSlot(s)}>✕</button>
                          </div>
                        ))
                    }
                  </div>
                </div>
              )}

              {/* ── SUBMIT BUTTON ── */}
              {!submitted ? (
                <div style={{ marginTop:28, textAlign:"center" }}>
                  <button className="btn btn-accent" style={{ padding:"14px 40px", fontSize:"1rem" }}
                    onClick={() => setSubmitted(true)}>
                    ✓ 填寫完畢
                  </button>
                  <div style={{ fontSize:".75rem", color:"var(--muted)", marginTop:10 }}>
                    提交後仍可返回修改
                  </div>
                </div>
              ) : (
                <div style={{
                  marginTop:28, textAlign:"center",
                  background:"rgba(180,255,90,.07)", border:"1px solid rgba(180,255,90,.25)",
                  borderRadius:14, padding:"36px 24px"
                }}>
                  <div style={{ fontSize:"2.5rem", marginBottom:12 }}>✅</div>
                  <div style={{ fontSize:"1.2rem", fontWeight:900, color:"var(--accent)", marginBottom:8 }}>
                    已提交您的時間
                  </div>
                  <div style={{ fontSize:".9rem", color:"var(--muted)", marginBottom:20 }}>
                    可直接關閉此視窗
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => setSubmitted(false)}>
                    返回修改
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      <Toast msg={toast.msg} on={toast.on} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   VIEW: ADMIN PIN GATE
═══════════════════════════════════════════ */
function AdminPinGate({ poll, onUnlock }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const toast = useToast();

  function handlePinInput(e) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(val);
  }

  function handleSubmit() {
    if (pin.length !== 6) { toast.show("請輸入 6 位數字密碼"); return; }
    if (pin === poll.adminToken) {
      onUnlock();
    } else {
      setShake(true);
      setPin("");
      toast.show("密碼錯誤，請再試一次");
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"80vh" }}>
      <div className="card" style={{ maxWidth:360, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:"2.5rem", marginBottom:16 }}>🔐</div>
        <h3 style={{ fontSize:"1.2rem", fontWeight:900, marginBottom:6 }}>後台管理員登入</h3>
        <div style={{ fontSize:".82rem", color:"var(--muted)", marginBottom:8 }}>{poll.title}</div>
        <div style={{ fontSize:".78rem", color:"var(--muted)", marginBottom:20 }}>請輸入你設定的 6 位數字密碼</div>
        <input
          className="inp"
          placeholder="• • • • • •"
          value={pin}
          onChange={handlePinInput}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
          style={{
            fontFamily:"'DM Mono',monospace", letterSpacing:".4em", fontSize:"1.5rem",
            textAlign:"center", marginBottom:12,
            animation: shake ? "shake .4s ease" : "none"
          }}
        />
        <div style={{ display:"flex", justifyContent:"center", gap:7, marginBottom:20 }}>
          {Array(6).fill(0).map((_,i)=>(
            <div key={i} style={{
              width:10, height:10, borderRadius:"50%",
              background: i < pin.length ? "var(--accent)" : "var(--border)",
              transition:".12s"
            }}/>
          ))}
        </div>
        <button className="btn btn-accent" style={{ width:"100%" }} onClick={handleSubmit}>進入後台</button>
        <Toast msg={toast.msg} on={toast.on} />
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────
   OVERLAP CALCULATION
   Input:  array of "HH:MM~HH:MM" strings per dancer
   Output: array of { start, end, dancers[] } merged overlap segments
───────────────────────────────────────────── */
function toMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMins(m) {
  return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
}

function calcOverlaps(dancerSlots, minPeople = 1) {
  // Build events: [{time, type: +1/-1, dancer}]
  const events = [];
  Object.entries(dancerSlots).forEach(([dancer, slots]) => {
    (slots || []).forEach(slot => {
      const [s, e] = slot.split("~");
      events.push({ t: toMins(s), d: 1, dancer });
      events.push({ t: toMins(e), d: -1, dancer });
    });
  });
  events.sort((a, b) => a.t - b.t || a.d - b.d);

  // Sweep line
  const segments = [];
  let active = new Set();
  let prevT = null;

  events.forEach(ev => {
    if (prevT !== null && active.size >= minPeople && ev.t > prevT) {
      segments.push({ start: prevT, end: ev.t, dancers: [...active] });
    }
    if (ev.d === 1) active.add(ev.dancer);
    else active.delete(ev.dancer);
    prevT = ev.t;
  });

  // Merge adjacent segments with same dancer set
  const merged = [];
  segments.forEach(seg => {
    const prev = merged[merged.length - 1];
    if (prev && prev.end === seg.start &&
        JSON.stringify([...prev.dancers].sort()) === JSON.stringify([...seg.dancers].sort())) {
      prev.end = seg.end;
    } else {
      merged.push({ ...seg, dancers: [...seg.dancers] });
    }
  });

  return merged;
}

/* ═══════════════════════════════════════════
   VIEW: ADMIN  – 後台統計
═══════════════════════════════════════════ */
function AdminView({ poll }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const copy = useCopy(toast);
  const base = window.location.href.split("?")[0];
  const memberLink = `${base}?room=${poll.roomId}`;

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const r = await loadResponses(poll.roomId);
      if (!cancelled) { setResponses(r); setLoading(false); }
    }
    refresh();
    const t = setInterval(refresh, 8000); // auto-refresh every 8s
    return () => { cancelled = true; clearInterval(t); };
  }, [poll.roomId]);

  const allDancers = Object.keys(responses);
  const allDates = [...new Set(allDancers.flatMap(n => Object.keys(responses[n]||{})))].sort();
  const totalDancers = allDancers.length;
  const totalMembers = poll.totalMembers || totalDancers;
  const notFilled = totalMembers - totalDancers;
  const totalSlots = allDancers.reduce((a,n)=>a+Object.values(responses[n]||{}).reduce((b,s)=>b+s.length,0),0);

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ poll, responses }, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dance-sync-${poll.roomId}.json`;
    a.click();
  }

  return (
    <div className="wrap">
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:".7rem", color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>後台管理</div>
          <h2 style={{ fontSize:"1.6rem", fontWeight:900 }}>{poll.title}</h2>
          <div style={{ fontSize:".82rem", color:"var(--muted)", marginTop:4 }}>
            房間碼 <code style={{ fontFamily:"'DM Mono',monospace", color:"var(--accent3)", background:"var(--s2)", padding:"1px 8px", borderRadius:4 }}>{poll.roomId}</code>
            {poll.dateEnd && (
              <span style={{ marginLeft:12 }}>
                📅 {poll.dateStart} ～ {poll.dateEnd}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <button className="btn btn-outline btn-sm" onClick={()=>copy(memberLink, "成員連結已複製！")}>複製成員連結</button>
          <button className="btn btn-outline btn-sm" onClick={exportJSON}>⬇ 匯出</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-row">
        <div className="stat">
          <div className="v" style={{ fontSize:"1.6rem" }}>
            <span style={{ color:"var(--accent)" }}>{totalDancers}</span>
            <span style={{ color:"var(--muted)", fontSize:"1.1rem" }}> / {totalMembers}</span>
          </div>
          <div className="l">已填寫人數</div>
          <div style={{ marginTop:8, height:3, background:"var(--border)", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", background:"var(--accent)", borderRadius:2, width:`${Math.min(100,Math.round(totalDancers/totalMembers*100))}%`, transition:"width .5s ease" }}/>
          </div>
          <div style={{ fontSize:".7rem", color:"var(--muted)", marginTop:5 }}>{Math.round(totalDancers/totalMembers*100)}% 填寫率</div>
        </div>
        <div className="stat" style={{ borderColor: notFilled > 0 ? "rgba(255,90,122,.3)" : "var(--border)" }}>
          <div className="v" style={{ color: notFilled > 0 ? "var(--accent2)" : "var(--accent)" }}>{notFilled}</div>
          <div className="l">人尚未填寫</div>
          {notFilled === 0 && <div style={{ fontSize:".72rem", color:"var(--accent)", marginTop:4 }}>🎉 全員到齊！</div>}
        </div>
        {(() => {
          // Calculate total available hours per dancer (sum of slot durations)
          const hoursByDancer = allDancers.map(n => {
            const total = Object.values(responses[n]||{}).flat().reduce((sum, slot) => {
              const [s, e] = slot.split("~");
              return sum + (toMins(e) - toMins(s));
            }, 0);
            return { name: n, mins: total };
          }).filter(d => d.mins > 0).sort((a,b) => b.mins - a.mins);

          const king = hoursByDancer[0];
          const busy = hoursByDancer[hoursByDancer.length - 1];
          const fmtHrs = m => m >= 60 ? `${(m/60).toFixed(1)}h` : `${m}m`;

          return (<>
            <div className="stat" style={{ borderColor: king ? "rgba(180,255,90,.25)" : "var(--border)" }}>
              <div style={{ fontSize:".65rem", color:"var(--accent)", letterSpacing:".1em", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>👑 閒閒沒事之王</div>
              {king
                ? <><div className="v" style={{ fontSize:"1.4rem" }}>{king.name}</div><div className="l">{fmtHrs(king.mins)} 可用時數</div></>
                : <div className="l" style={{ marginTop:4 }}>尚無資料</div>}
            </div>
            <div className="stat" style={{ borderColor: busy ? "rgba(255,90,122,.2)" : "var(--border)" }}>
              <div style={{ fontSize:".65rem", color:"var(--accent2)", letterSpacing:".1em", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>⚡ 最少時間大忙人</div>
              {busy && busy !== king
                ? <><div className="v" style={{ fontSize:"1.4rem", color:"var(--accent2)" }}>{busy.name}</div><div className="l">{fmtHrs(busy.mins)} 可用時數</div></>
                : <div className="l" style={{ marginTop:4 }}>尚無資料</div>}
            </div>
          </>);
        })()}
      </div>

      {loading && <div style={{ textAlign:"center", padding:60 }}><span className="spin"/></div>}

      {!loading && allDates.length === 0 && (
        <div style={{ textAlign:"center", padding:"60px 20px", color:"var(--muted)" }}>
          <div style={{ fontSize:"2rem", marginBottom:12 }}>📭</div>
          <div style={{ fontSize:"1.1rem", marginBottom:8, opacity:.5 }}>尚無資料</div>
          <p style={{ fontSize:".85rem" }}>分享成員連結後，等他們填寫即可</p>
          <div className="link-box" style={{ maxWidth:480, margin:"20px auto 0" }}>
            <span className="link-code">{memberLink}</span>
            <button className="copy-btn" onClick={()=>copy(memberLink, "已複製！")}>複製</button>
          </div>
        </div>
      )}

      {/* ── FIXED MODE ADMIN ── */}
      {!loading && poll.mode === "fixed" && (
        <div>
          <div style={{ fontSize:".7rem", color:"var(--accent)", letterSpacing:".12em", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:14 }}>
            📌 候選時段投票結果
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
            {(poll.candidates||[]).map((c,i) => {
              const key = `${c.date}|${c.start}~${c.end}`;
              const yes = allDancers.filter(n => (responses[n]||{})[key] === "yes");
              const no  = allDancers.filter(n => (responses[n]||{})[key] === "no");
              const pending = allDancers.filter(n => !(responses[n]||{})[key]);
              const pct = totalMembers > 0 ? Math.round(yes.length / totalMembers * 100) : 0;
              return (
                <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"16px 18px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:".78rem", color:"var(--accent3)", background:"var(--s2)", padding:"2px 8px", borderRadius:4 }}>{formatDateTW(c.date)}</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"1rem", color:"var(--accent)", fontWeight:700 }}>{c.start} → {c.end}</span>
                    <span style={{ fontSize:".75rem", color: pct===100?"var(--accent)":"var(--muted)" }}>{yes.length} / {totalMembers} 人可以</span>
                  </div>
                  <div style={{ height:3, background:"var(--border)", borderRadius:2, marginBottom:12, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:"var(--accent)", borderRadius:2, width:`${pct}%`, transition:"width .5s" }}/>
                  </div>
                  <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontSize:".65rem", color:"var(--accent)", letterSpacing:".1em", textTransform:"uppercase", marginBottom:5 }}>✓ 可以</div>
                      <div className="chips">{yes.length ? yes.map(n=><span className="chip ok" key={n}>{n}</span>) : <span style={{ fontSize:".75rem", color:"var(--muted)" }}>—</span>}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:".65rem", color:"var(--accent2)", letterSpacing:".1em", textTransform:"uppercase", marginBottom:5 }}>✗ 不行</div>
                      <div className="chips">{no.length ? no.map(n=><span className="chip no" key={n}>{n}</span>) : <span style={{ fontSize:".75rem", color:"var(--muted)" }}>—</span>}</div>
                    </div>
                    {pending.length > 0 && (
                      <div>
                        <div style={{ fontSize:".65rem", color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase", marginBottom:5 }}>？ 未回覆</div>
                        <div className="chips">{pending.map(n=><span key={n} style={{ padding:"3px 11px", borderRadius:100, fontSize:".78rem", background:"var(--s2)", color:"var(--muted)", border:"1px solid var(--border)" }}>{n}</span>)}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── GLOBAL OVERLAP SECTION (free mode only) ── */}
      {!loading && poll.mode !== "fixed" && allDates.length > 0 && (() => {
        const allOverlaps = allDates.flatMap(date => {
          const dancerSlotsOnDate = {};
          allDancers.forEach(n => {
            const s = (responses[n]||{})[date];
            if (s && s.length) dancerSlotsOnDate[n] = s;
          });
          const segs = calcOverlaps(dancerSlotsOnDate, 2);
          return segs.map(seg => ({ ...seg, date }));
        });
        const sortedAll = [...allOverlaps].sort((a,b) =>
          a.date.localeCompare(b.date) || b.dancers.length - a.dancers.length || (b.end - b.start) - (a.end - a.start)
        );
        if (sortedAll.length === 0) return (
          <div style={{ background:"rgba(255,90,122,.05)", border:"1px solid rgba(255,90,122,.18)", borderRadius:10, padding:"14px 18px", marginBottom:24, fontSize:".85rem", color:"var(--accent2)" }}>
            ⚠️ 目前尚無任何重疊時段
          </div>
        );
        return (
          <div style={{ background:"rgba(180,255,90,.05)", border:"1px solid rgba(180,255,90,.2)", borderRadius:12, padding:"18px 20px", marginBottom:28 }}>
            <div style={{ fontSize:".7rem", color:"var(--accent)", letterSpacing:".12em", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:14 }}>
              ✦ 重疊時段分析（全部日期）
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {sortedAll.map((seg, i) => {
                const duration = seg.end - seg.start;
                const pct = totalMembers > 0 ? Math.round(seg.dancers.length / totalMembers * 100) : 0;
                const absentees = allDancers.filter(n => !seg.dancers.includes(n));
                return (
                  <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"12px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:".75rem", color:"var(--accent3)", background:"var(--s2)", padding:"2px 8px", borderRadius:4 }}>
                        {formatDateTW(seg.date)}
                      </span>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"1rem", color:"var(--accent)", fontWeight:700 }}>
                        {fromMins(seg.start)} → {fromMins(seg.end)}
                      </span>
                      <span style={{ fontSize:".75rem", color:"var(--muted)", background:"var(--s2)", padding:"2px 8px", borderRadius:4 }}>
                        {Math.floor(duration/60) > 0 ? `${Math.floor(duration/60)}小時` : ""}{duration%60 > 0 ? `${duration%60}分` : ""}
                      </span>
                      <span style={{ fontSize:".75rem", color: pct===100 ? "var(--accent)" : "var(--muted)" }}>
                        {seg.dancers.length} / {totalMembers} 人
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom: absentees.length ? 6 : 0 }}>
                      {seg.dancers.map(n => <span className="chip ok" key={n}>✓ {n}</span>)}
                    </div>
                    {absentees.length > 0 && (
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:4 }}>
                        {absentees.map(n => <span className="chip no" key={n}>{n}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── GANTT PER DATE (free mode only) ── */}
      {!loading && poll.mode !== "fixed" && allDates.map(date => {
        const allSlots = [...new Set(allDancers.flatMap(n=>(responses[n]||{})[date]||[]))].sort();

        // Build per-dancer slots for this date
        const dancerSlotsOnDate = {};
        allDancers.forEach(n => {
          const s = (responses[n]||{})[date];
          if (s && s.length) dancerSlotsOnDate[n] = s;
        });

        return (
          <div className="date-group" key={date}>
            <div className="dg-head">
              <span className="dg-date">📅 {formatDateTW(date)}</span>
              <span className="badge">{allSlots.length} 個時段</span>
            </div>

            {/* ── GANTT CHART ── */}
            {(() => {
              // Compute time axis range from all slots this day
              const allMins = allSlots.flatMap(s => {
                const [a, b] = s.split("~");
                return [toMins(a), toMins(b)];
              });
              const axisMin = Math.min(...allMins);
              const axisMax = Math.max(...allMins);
              const axisDur = axisMax - axisMin || 60;

              // Generate axis tick labels (every hour, or half-hour if tight)
              const tickInterval = axisDur <= 120 ? 30 : 60;
              const firstTick = Math.ceil(axisMin / tickInterval) * tickInterval;
              const ticks = [];
              for (let t = firstTick; t <= axisMax; t += tickInterval) ticks.push(t);

              const NAME_W = 72;
              const BAR_H = 20;
              const ROW_GAP = 8;

              return (
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:".7rem", color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:10 }}>
                    個別填寫時段
                  </div>
                  <div style={{ background:"var(--s2)", border:"1px solid var(--border)", borderRadius:10, padding:"14px 16px", overflowX:"auto" }}>
                    {/* Axis ticks */}
                    <div style={{ display:"flex", marginLeft:NAME_W, marginBottom:6, position:"relative", height:16 }}>
                      {ticks.map(t => (
                        <div key={t} style={{
                          position:"absolute",
                          left: `${((t - axisMin) / axisDur) * 100}%`,
                          transform:"translateX(-50%)",
                          fontSize:".62rem", color:"var(--muted)",
                          fontFamily:"'DM Mono',monospace",
                          whiteSpace:"nowrap"
                        }}>{fromMins(t)}</div>
                      ))}
                    </div>
                    {/* Grid lines + rows */}
                    <div style={{ position:"relative" }}>
                      {/* Vertical grid lines */}
                      {ticks.map(t => (
                        <div key={t} style={{
                          position:"absolute",
                          left: `calc(${NAME_W}px + ${((t - axisMin) / axisDur) * 100}% - ${NAME_W * ((t - axisMin) / axisDur)}px)`,
                          top:0, bottom:0,
                          width:1, background:"var(--border)", opacity:.5,
                          pointerEvents:"none"
                        }}/>
                      ))}
                      {allDancers.map((dancer, ri) => {
                        const slots = (dancerSlotsOnDate[dancer] || []);
                        return (
                          <div key={dancer} style={{ display:"flex", alignItems:"center", marginBottom: ri < allDancers.length-1 ? ROW_GAP : 0 }}>
                            {/* Name */}
                            <div style={{
                              width:NAME_W, minWidth:NAME_W, fontSize:".75rem",
                              color: slots.length ? "var(--text)" : "var(--muted)",
                              overflow:"hidden", textOverflow:"ellipsis",
                              whiteSpace:"nowrap", paddingRight:8,
                              fontWeight: slots.length ? 600 : 400
                            }}>{dancer}</div>
                            {/* Bar track */}
                            <div style={{ flex:1, position:"relative", height:BAR_H, background:"var(--surface)", borderRadius:4 }}>
                              {slots.length === 0 && (
                                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", paddingLeft:8,
                                  fontSize:".65rem", color:"var(--border)", fontFamily:"'DM Mono',monospace" }}>
                                  —
                                </div>
                              )}
                              {slots.map(slot => {
                                const [sa, se] = slot.split("~").map(toMins);
                                const left = ((sa - axisMin) / axisDur) * 100;
                                const width = ((se - sa) / axisDur) * 100;
                                return (
                                  <div key={slot} title={slot.replace("~"," → ")} style={{
                                    position:"absolute",
                                    left:`${left}%`, width:`${width}%`,
                                    height:"100%",
                                    background:"var(--accent)",
                                    borderRadius:4,
                                    opacity:.85,
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                    overflow:"hidden"
                                  }}>
                                    {width > 12 && (
                                      <span style={{ fontSize:".6rem", color:"#000", fontFamily:"'DM Mono',monospace", fontWeight:700, whiteSpace:"nowrap", padding:"0 4px" }}>
                                        {slot.replace("~","→")}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Axis bottom border */}
                    <div style={{ marginLeft:NAME_W, height:1, background:"var(--border)", marginTop:8 }}/>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}

      <Toast msg={toast.msg} on={toast.on} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   VIEW: SUPER ADMIN GATE
═══════════════════════════════════════════ */
const SUPER_PIN_KEY = "sync-super-pin";

function SuperAdminGate({ onUnlock }) {
  const stored = localStorage.getItem(SUPER_PIN_KEY);
  const isSetup = !stored;
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shake, setShake] = useState(false);
  const toast = useToast();

  function handleSubmit() {
    if (isSetup) {
      if (pin.length < 4) { toast.show("密碼至少 4 位數字"); return; }
      if (pin !== confirm) { toast.show("兩次密碼不一致"); return; }
      localStorage.setItem(SUPER_PIN_KEY, pin);
      onUnlock();
    } else {
      if (pin === stored) {
        onUnlock();
      } else {
        setShake(true); setPin("");
        toast.show("密碼錯誤");
        setTimeout(() => setShake(false), 500);
      }
    }
  }

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"80vh" }}>
      <div className="card" style={{ maxWidth:360, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:"2.5rem", marginBottom:16 }}>👁️</div>
        <h3 style={{ fontSize:"1.2rem", fontWeight:900, marginBottom:6 }}>
          {isSetup ? "設定超級管理員密碼" : "超級管理員登入"}
        </h3>
        <div style={{ fontSize:".82rem", color:"var(--muted)", marginBottom:20 }}>
          {isSetup ? "首次登入，請設定你的專屬密碼" : "輸入密碼以查看所有統計房間"}
        </div>
        <input className="inp" type="password" placeholder={isSetup ? "設定密碼…" : "輸入密碼…"}
          value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}
          inputMode="numeric" style={{ textAlign:"center", letterSpacing:".3em", fontSize:"1.3rem",
            marginBottom:10, animation: shake?"shake .4s ease":"none" }}
          onKeyDown={e=>e.key==="Enter"&&(!isSetup?handleSubmit():null)} />
        {isSetup && (
          <input className="inp" type="password" placeholder="再次確認密碼…"
            value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,""))}
            inputMode="numeric" style={{ textAlign:"center", letterSpacing:".3em", fontSize:"1.3rem", marginBottom:10 }}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
        )}
        <button className="btn btn-accent" style={{ width:"100%", marginTop:4 }} onClick={handleSubmit}>
          {isSetup ? "設定並進入" : "進入總覽"}
        </button>
        {!isSetup && (
          <button onClick={()=>{ localStorage.removeItem(SUPER_PIN_KEY); toast.show("已重設密碼"); }}
            style={{ background:"none", border:"none", color:"var(--muted)", fontSize:".75rem",
              cursor:"pointer", marginTop:12, textDecoration:"underline", fontFamily:"'Noto Sans TC'" }}>
            忘記密碼？重設
          </button>
        )}
        <Toast msg={toast.msg} on={toast.on} />
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════
   VIEW: SUPER ADMIN DASHBOARD
═══════════════════════════════════════════ */
function SuperAdminView() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const copy = useCopy(toast);

  useEffect(() => {
    async function fetchAll() {
      try {
        const { getDocs, collection, orderBy, query } = await import("firebase/firestore");
        const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setPolls(snap.docs.map(d => d.data()));
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const base = window.location.href.split("?")[0];
  const EXPIRE_MS = 20 * 24 * 60 * 60 * 1000;

  return (
    <div className="wrap">
      <div style={{ marginBottom:28 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:".7rem", color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>👁️ 超級管理員</div>
            <h2 style={{ fontSize:"1.6rem", fontWeight:900 }}>所有統計房間</h2>
            <div style={{ fontSize:".82rem", color:"var(--muted)", marginTop:4 }}>共 {polls.length} 個房間</div>
          </div>
          <a href={window.location.pathname} className="btn btn-accent btn-sm" style={{ textDecoration:"none", display:"inline-flex", alignItems:"center", gap:6 }}>
            ✦ 發起新統計
          </a>
        </div>
      </div>

      {loading && <div style={{ textAlign:"center", padding:60 }}><span className="spin"/></div>}

      {!loading && polls.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:"var(--muted)" }}>尚無任何統計房間</div>
      )}

      {!loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {polls.map(p => {
            const age = Date.now() - (p.createdAt || 0);
            const daysLeft = Math.max(0, Math.ceil((EXPIRE_MS - age) / (24*60*60*1000)));
            const isExpired = age > EXPIRE_MS;
            const memberLink = `${base}?room=${p.roomId}`;
            const adminLink = `${base}?room=${p.roomId}&admin=${p.adminToken}&bypass=super`;
            return (
              <div key={p.roomId} style={{
                background:"var(--surface)", border:`1px solid ${isExpired?"rgba(255,90,122,.25)":"var(--border)"}`,
                borderRadius:12, padding:"16px 20px",
                opacity: isExpired ? 0.5 : 1
              }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:"1rem", marginBottom:4 }}>
                      {p.title}
                      {isExpired && <span style={{ marginLeft:8, fontSize:".72rem", color:"var(--accent2)", background:"rgba(255,90,122,.1)", padding:"2px 8px", borderRadius:4 }}>已過期</span>}
                    </div>
                    <div style={{ fontSize:".8rem", color:"var(--muted)", display:"flex", gap:16, flexWrap:"wrap" }}>
                      <span>發起人：<strong style={{ color:"var(--text)" }}>{p.creatorName}</strong></span>
                      <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--accent3)" }}>{p.roomId}</span>
                      <span>建立：{new Date(p.createdAt).toLocaleDateString("zh-TW")}</span>
                      {!isExpired && <span style={{ color: daysLeft <= 3 ? "var(--accent2)" : "var(--muted)" }}>剩 {daysLeft} 天</span>}
                      <span>總人數：{p.totalMembers}</span>
                      <span style={{ background:"var(--s2)", padding:"1px 8px", borderRadius:4 }}>{p.mode === "fixed" ? "📌 指定時段" : "🗓 自由填寫"}</span>
                    </div>
                  </div>
                  {!isExpired && (
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button className="copy-btn" onClick={()=>copy(memberLink, "成員連結已複製！")}>成員連結</button>
                      <button className="copy-btn" style={{ borderColor:"rgba(180,255,90,.3)", color:"var(--accent)" }}
                        onClick={()=>copy(adminLink, "後台連結已複製！")}>後台連結</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Toast msg={toast.msg} on={toast.on} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOAST COMPONENT
───────────────────────────────────────────── */
function Toast({ msg, on }) {
  return <div className={`toast${on?" on":""}`}>{msg}</div>;
}

/* ═══════════════════════════════════════════
   ROOT APP  – routing via URL params
═══════════════════════════════════════════ */
export default function App() {
  injectCSS();

  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room");
  const adminToken = params.get("admin"); // "1" means admin-gate entry
  const superadminParam = params.get("superadmin"); // "1" means super admin gate

  // view: home | created | fill | admin | admingate | loading | expired | superadmin | superadmingate
  const [view, setView] = useState(roomId ? "loading" : superadminParam === "1" ? "superadmingate" : "home");
  const [poll, setPoll] = useState(null);

  useEffect(() => {
    if (!roomId) return;
    loadPoll(roomId).then(p => {
      if (!p) { setView("notfound"); return; }
      if (p === "expired") { setView("expired"); return; }
      setPoll(p);
      // ?admin param just routes to pin-gate; actual auth happens there
      const bypassParam = new URLSearchParams(window.location.search).get("bypass");
      if (bypassParam === "super" && adminToken === p.adminToken) {
        setView("admin"); // superadmin bypass — skip pin gate
      } else if (adminToken === "1") {
        setView("admingate");
      } else {
        setView("fill");
      }
    });
  }, []);

  if (view === "loading") return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"80vh" }}>
      <span className="spin" style={{ width:32, height:32, borderWidth:3 }} />
    </div>
  );

  if (view === "notfound") return (
    <div style={{ textAlign:"center", padding:"80px 20px", color:"var(--muted)" }}>
      <div style={{ fontSize:"2.5rem", marginBottom:16 }}>🔍</div>
      <h2 style={{ marginBottom:8 }}>找不到此統計</h2>
      <p style={{ marginBottom:24 }}>房間碼不存在或已過期</p>
      <button className="btn btn-accent" onClick={()=>{ window.history.pushState({},"",window.location.pathname); setView("home"); }}>返回首頁</button>
    </div>
  );

  if (view === "expired") return (
    <div style={{ textAlign:"center", padding:"80px 20px", color:"var(--muted)" }}>
      <div style={{ fontSize:"2.5rem", marginBottom:16 }}>⏰</div>
      <h2 style={{ marginBottom:8, color:"var(--text)" }}>此統計已過期</h2>
      <p style={{ marginBottom:24, fontSize:".9rem" }}>統計資料在建立 {EXPIRE_DAYS} 天後自動刪除</p>
      <button className="btn btn-accent" onClick={()=>{ window.history.pushState({},"",window.location.pathname); setView("home"); }}>發起新統計</button>
    </div>
  );

  return (
    <>
      {/* Nav — only show on home or fill */}
      {(view === "home" || view === "fill") && (
        <nav className="nav">
          <div className="logo">SYNC<span>/</span>MASTER</div>
          {view === "fill" && poll && (
            <div style={{ fontSize:".82rem", color:"var(--muted)" }}>
              房間 <code style={{ fontFamily:"'DM Mono',monospace", color:"var(--accent3)" }}>{poll.roomId}</code>
            </div>
          )}
        </nav>
      )}

      {view === "home" && (
        <div className="wrap">
          <HomeView
            onCreated={p => { setPoll(p); setView("created"); }}
            onJoined={p => { setPoll(p); setView("fill"); }}
          />
        </div>
      )}

      {view === "created" && poll && (
        <CreatedView
          poll={poll}
          onEnterAdmin={() => setView("admingate")}
          onFillAsCreator={() => setView("fill")}
        />
      )}

      {view === "fill" && poll && <FillView poll={poll} />}

      {view === "superadmingate" && (
        <>
          <nav className="nav">
            <div className="logo">SYNC<span>/</span>MASTER</div>
          </nav>
          <SuperAdminGate onUnlock={() => setView("superadmin")} />
        </>
      )}

      {view === "superadmin" && (
        <>
          <nav className="nav">
            <div className="logo">SYNC<span>/</span>MASTER</div>
            <div style={{ fontSize:".75rem", color:"var(--muted)", fontFamily:"'DM Mono',monospace" }}>👁️ 超級管理員</div>
          </nav>
          <SuperAdminView />
        </>
      )}

      {view === "admingate" && poll && (
        <>
          <nav className="nav">
            <div className="logo">SYNC<span>/</span>MASTER</div>
          </nav>
          <AdminPinGate poll={poll} onUnlock={() => setView("admin")} />
        </>
      )}

      {view === "admin" && poll && (
        <>
          <nav className="nav">
            <div className="logo">SYNC<span>/</span>MASTER</div>
            <div style={{ fontSize:".75rem", color:"var(--muted)", fontFamily:"'DM Mono',monospace" }}>🔐 管理員後台</div>
          </nav>
          <AdminView poll={poll} />
        </>
      )}
    </>
  );
}
