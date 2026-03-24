import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

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
async function loadPoll(roomId) {
  try {
    const snap = await getDoc(doc(db, "polls", roomId));
    return snap.exists() ? snap.data() : null;
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
async function saveResponses(roomId, responses) {
  await setDoc(doc(db, "responses", roomId), responses);
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
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  function handlePinInput(e) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setAdminPin(val);
  }

  async function handleCreate() {
    if (!title.trim() || !creator.trim()) { toast.show("請填寫統計名稱與你的名字"); return; }
    if (adminPin.length !== 6) { toast.show("請設定 6 位數字的後台密碼"); return; }
    const tm = parseInt(totalMembers);
    if (!totalMembers || isNaN(tm) || tm < 1 || tm > 999) { toast.show("請填寫有效的統計總人數（1–999）"); return; }
    if (!dateEnd) { toast.show("請設定統計截止日期"); return; }
    if (dateEnd < toDateStr(new Date())) { toast.show("截止日期不能早於今天"); return; }
    setLoading(true);
    const roomId = genId(8);
    const adminToken = adminPin;
    const poll = { roomId, title: title.trim(), creatorName: creator.trim(), adminToken, totalMembers: tm, dateStart: toDateStr(new Date()), dateEnd, createdAt: Date.now() };
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
        <p>發起一次統計，取得專屬連結分享給成員，即時看到所有人可以的時段</p>
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
              <input
                className="inp"
                placeholder="例：12"
                value={totalMembers}
                onChange={e=>setTotalMembers(e.target.value.replace(/\D/g,"").slice(0,3))}
                inputMode="numeric"
                maxLength={3}
                style={{ fontFamily:"'DM Mono',monospace", fontSize:"1.1rem", textAlign:"center", letterSpacing:".1em" }}
              />
            </div>
            <div>
              <div style={{ fontSize:".78rem", color:"var(--muted)", marginBottom:6 }}>📅 統計區間（截止日期）</div>
              <input
                type="date"
                className="inp"
                value={dateEnd}
                min={toDateStr(new Date())}
                onChange={e=>setDateEnd(e.target.value)}
                style={{ fontFamily:"'DM Mono',monospace", fontSize:".95rem", colorScheme:"dark" }}
              />
              <div style={{ fontSize:".72rem", color:"var(--muted)", marginTop:5 }}>
                從今天起，成員只能選擇此日期以內的日期填寫
              </div>
            </div>
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
   VIEW: FILL  – 成員填寫時段
═══════════════════════════════════════════ */
function FillView({ poll }) {
  const [dancer, setDancer] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [responses, setResponses] = useState({});
  const [loadingResp, setLoadingResp] = useState(true);
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

  async function confirmName() {
    if (!dancer.trim()) { toast.show("請輸入名字"); return; }
    setDancer(dancer.trim());
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
    await saveResponses(poll.roomId, updated);
    toast.show("✓ 已儲存");
  }

  async function removeSlot(slot) {
    const updated = { ...responses };
    updated[dancer][selDate] = updated[dancer][selDate].filter(s => s !== slot);
    if (!updated[dancer][selDate].length) delete updated[dancer][selDate];
    if (!Object.keys(updated[dancer]||{}).length) delete updated[dancer];
    setResponses(updated);
    await saveResponses(poll.roomId, updated);
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
          <div style={{ display:"flex", gap:10 }}>
            <input className="inp" placeholder="你的名字…" value={dancer} onChange={e=>setDancer(e.target.value)}
              maxLength={20} onKeyDown={e=>e.key==="Enter"&&confirmName()} />
            <button className="btn btn-accent btn-sm" onClick={confirmName}>確認</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24, flexWrap:"wrap" }}>
            <div style={{ background:"var(--s2)", border:"1px solid var(--border)", borderRadius:100, padding:"7px 16px", fontSize:".85rem", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"var(--muted)" }}>📍</span>
              <strong style={{ color:"var(--accent)" }}>{dancer}</strong>
              <button className="btn-ghost" onClick={()=>{ setConfirmed(false); setSelDate(null); }}>更換</button>
            </div>
            <span style={{ fontSize:".8rem", color:"var(--muted)" }}>
              點選日期 → 新增可排練時段
              {poll.dateEnd && (
                <span style={{ marginLeft:8, color:"var(--accent3)" }}>
                  （截止 {poll.dateEnd}）
                </span>
              )}
            </span>
          </div>

          {loadingResp ? <div style={{ textAlign:"center", padding:40 }}><span className="spin" /></div> : (
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
                  <h4>📍 <span>{formatDateTW(selDate)}</span> — 可排練時段</h4>
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
        <div className="stat"><div className="v">{allDates.length}</div><div className="l">個已填寫日期</div></div>
        <div className="stat"><div className="v">{totalSlots}</div><div className="l">個時段登記</div></div>
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

      {!loading && allDates.map(date => {
        const allSlots = [...new Set(allDancers.flatMap(n=>(responses[n]||{})[date]||[]))].sort();

        // Build per-dancer slots for this date
        const dancerSlotsOnDate = {};
        allDancers.forEach(n => {
          const s = (responses[n]||{})[date];
          if (s && s.length) dancerSlotsOnDate[n] = s;
        });

        // Compute overlapping segments (at least 2 people)
        const overlaps = calcOverlaps(dancerSlotsOnDate, 2);
        // Sort by number of dancers desc, then duration desc
        const sortedOverlaps = [...overlaps].sort((a,b) =>
          b.dancers.length - a.dancers.length || (b.end - b.start) - (a.end - a.start)
        );

        return (
          <div className="date-group" key={date}>
            <div className="dg-head">
              <span className="dg-date">📅 {formatDateTW(date)}</span>
              <span className="badge">{allSlots.length} 個時段</span>
            </div>

            {/* ── OVERLAP SECTION ── */}
            {sortedOverlaps.length > 0 && (
              <div style={{ background:"rgba(180,255,90,.05)", border:"1px solid rgba(180,255,90,.2)", borderRadius:10, padding:"16px 18px", marginBottom:12 }}>
                <div style={{ fontSize:".7rem", color:"var(--accent)", letterSpacing:".12em", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:12 }}>
                  ✦ 重疊時段分析
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {sortedOverlaps.map((seg, i) => {
                    const duration = seg.end - seg.start;
                    const pct = totalMembers > 0 ? Math.round(seg.dancers.length / totalMembers * 100) : 0;
                    const absentees = allDancers.filter(n => !seg.dancers.includes(n));
                    return (
                      <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"12px 14px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"1rem", color:"var(--accent)", fontWeight:700 }}>
                            {fromMins(seg.start)} → {fromMins(seg.end)}
                          </span>
                          <span style={{ fontSize:".75rem", color:"var(--muted)", background:"var(--s2)", padding:"2px 8px", borderRadius:4 }}>
                            {Math.floor(duration/60) > 0 ? `${Math.floor(duration/60)}小時` : ""}{duration%60 > 0 ? `${duration%60}分` : ""}
                          </span>
                          <span style={{ fontSize:".75rem", color: pct===100 ? "var(--accent)" : "var(--muted)" }}>
                            {seg.dancers.length} / {totalMembers} 人可參加
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
            )}

            {overlaps.length === 0 && Object.keys(dancerSlotsOnDate).length > 1 && (
              <div style={{ background:"rgba(255,90,122,.05)", border:"1px solid rgba(255,90,122,.2)", borderRadius:8, padding:"12px 16px", marginBottom:12, fontSize:".85rem", color:"var(--accent2)" }}>
                ⚠️ 此日期無任何重疊時段
              </div>
            )}

            {/* ── INDIVIDUAL SLOTS ── */}
            <div style={{ fontSize:".7rem", color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:8, marginTop:4 }}>
              個別填寫時段
            </div>
            {allSlots.map(slot => {
              const avail = allDancers.filter(n => ((responses[n]||{})[date]||[]).includes(slot));
              const unavail = allDancers.filter(n => !((responses[n]||{})[date]||[]).includes(slot));
              const pct = totalMembers > 0 ? Math.round(avail.length/totalMembers*100) : 0;
              return (
                <div className="slot-row" key={slot}>
                  <div className="tc">{slot.replace("~","\n→ ")}</div>
                  <div>
                    <div className="col-head">可以參加</div>
                    <div className="count-pill"><span className="n">{avail.length}</span> / {totalMembers} 人</div>
                    <div className="bar"><div className="bar-fill" style={{ width:pct+"%" }}/></div>
                    <div className="chips">
                      {avail.length ? avail.map(n=><span className="chip ok" key={n}>✓ {n}</span>)
                        : <span style={{ fontSize:".78rem", color:"var(--muted)" }}>無人可參加</span>}
                    </div>
                  </div>
                  <div>
                    <div className="col-head">無法參加</div>
                    <div className="chips">
                      {unavail.length ? unavail.map(n=><span className="chip no" key={n}>{n}</span>)
                        : <span style={{ fontSize:".78rem", color:"var(--muted)" }}>所有人皆可 🎉</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

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

  // view: home | created | fill | admin | admingate | loading
  const [view, setView] = useState(roomId ? "loading" : "home");
  const [poll, setPoll] = useState(null);

  useEffect(() => {
    if (!roomId) return;
    loadPoll(roomId).then(p => {
      if (!p) { setView("notfound"); return; }
      setPoll(p);
      // ?admin param just routes to pin-gate; actual auth happens there
      if (adminToken === "1") {
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
