import { useState, useEffect, useRef, useCallback } from "react";

// ─── FARGER ──────────────────────────────────────────────────────────────────
const C = {
  bg:          "#f5eeea",
  bgCard:      "#fff",
  primary:     "#5c1a1a",
  primary2:    "#7a2828",
  primary3:    "#9b3a3a",
  accent:      "#b85c38",
  gold:        "#c8922a",
  text:        "#2a1010",
  textMid:     "#5a3030",
  textSoft:    "#8a5a50",
  border:      "#e8d0c8",
  borderLight: "#f0e0d8",
  headerBg:    "linear-gradient(135deg, #3a0f0f 0%, #5c1a1a 60%, #7a2828 100%)",
  red:         "#c0392b",
  green:       "#2e7d32",
  gold2:       "#c8922a",
};

// ─── VIN-API (via vår Vercel-proxy mot Vinmonopolets åpne API) ───────────────
const VMP = {
  async search({ query = "", category = "", currentPage = 0 } = {}) {
    const p = new URLSearchParams({ search: query, category, page: currentPage });
    const res = await fetch(`/api/wines?${p}`);
    if (!res.ok) throw new Error(`API-feil: ${res.status}`);
    return res.json(); // { wines, total, page }
  },
};

// ─── BRUKER-API (kun notater og kjeller) ─────────────────────────────────────
const API = {
  async auth(action, username, password) {
    const res = await fetch("/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, username, password }),
    });
    return res.json();
  },
  async getData(username) {
    const res = await fetch(`/api/data?username=${encodeURIComponent(username)}`);
    return res.json();
  },
  async saveData(username, tastings, cellar) {
    await fetch("/api/data", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, tastings, cellar }),
    }).catch(() => {});
  },
  async scanLabel(base64, mediaType = "image/jpeg") {
    const res = await fetch("/api/scan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64, mediaType }),
    });
    return res.json();
  },
};

function getSession() { try { return localStorage.getItem("vb_session"); } catch { return null; } }
function setSession(u) { try { localStorage.setItem("vb_session", u); } catch {} }
function clearSession() { try { localStorage.removeItem("vb_session"); } catch {} }

// ─── IKONER ──────────────────────────────────────────────────────────────────
const IcoWine    = ({s=22}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2h8l1 6a5 5 0 0 1-10 0L8 2z"/><path d="M12 13v7"/><path d="M8 20h8"/></svg>;
const IcoNotes   = ({s=22}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IcoCellar  = ({s=22}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>;
const IcoCamera  = ({s=22}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const IcoSearch  = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoClose   = ({s=18}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoTrash   = ({s=15}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const IcoEdit    = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoLogout  = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoFilter  = ({s=18}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
const IcoLeaf    = ({s=12}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-14 7-.73.64-1.41 1.37-2 2.17"/></svg>;
const IcoChevron = ({s=16,dir="down"}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform: dir==="up"?"rotate(180deg)":""}}><polyline points="6 9 12 15 18 9"/></svg>;

function IcoStar(filled, s=16) { return <svg width={s} height={s} viewBox="0 0 24 24" fill={filled?"currentColor":"none"} stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const labelStyle = { fontSize:11, color:C.textSoft, display:"block", marginBottom:6, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" };
const inputStyle = { width:"100%", padding:"11px 14px", border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:15, color:C.text, background:"#fdfaf8", boxSizing:"border-box", outline:"none", fontFamily:"inherit" };

function StarRating({ value, onChange, max=10 }) {
  const [hov, setHov] = useState(null);
  const d = hov ?? value;
  return (
    <div style={{ display:"flex", gap:1, alignItems:"center", flexWrap:"wrap" }}>
      {Array.from({ length: max }, (_, i) => (
        <button key={i} onClick={() => onChange?.(i+1)}
          onMouseEnter={() => onChange && setHov(i+1)}
          onMouseLeave={() => onChange && setHov(null)}
          style={{ background:"none", border:"none", cursor:onChange?"pointer":"default", color:i<d?C.gold:"#d4b8b0", padding:"2px", lineHeight:1, minWidth:22, minHeight:22, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {IcoStar(i < d)}
        </button>
      ))}
      {value > 0 && <span style={{ marginLeft:4, fontSize:13, color:C.textMid, fontWeight:700 }}>{value}/10</span>}
    </div>
  );
}

function TasteBar({ label, value, max=12 }) {
  if (!value) return null;
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom:5 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
        <span style={{ fontSize:11, color:C.textSoft, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</span>
        <span style={{ fontSize:11, color:C.textMid, fontWeight:600 }}>{value}</span>
      </div>
      <div style={{ height:5, background:C.borderLight, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.primary3},${C.accent})`, borderRadius:3 }} />
      </div>
    </div>
  );
}

// ─── FLASKEBILDE ─────────────────────────────────────────────────────────────
function WineBottleImg({ wine, size=80, style={} }) {
  const [err, setErr] = useState(false);
  if (err || !wine?.id) return (
    <div style={{ width:size, height:size*2.2, display:"flex", alignItems:"center", justifyContent:"center", background:C.borderLight, borderRadius:6, ...style }}>
      <IcoWine s={size*0.5} />
    </div>
  );
  return <img src={wine.imageUrl} alt={wine.name} onError={() => setErr(true)}
    style={{ width:size, height:size*2.2, objectFit:"contain", borderRadius:6, ...style }} />;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode]       = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!username.trim() || !password.trim()) { setError("Fyll inn brukernavn og passord."); return; }
    setLoading(true); setError("");
    const r = await API.auth(mode, username.trim(), password);
    if (r.error) { setError(r.error); setLoading(false); return; }
    onLogin(r.username);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.headerBg, display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"'Georgia','Times New Roman',serif" }}>
      <div style={{ background:"#fff", borderRadius:22, padding:"38px 32px", width:"100%", maxWidth:400, boxShadow:"0 24px 64px rgba(0,0,0,0.45)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:48, marginBottom:6 }}>🍷</div>
          <div style={{ fontSize:24, fontWeight:800, color:C.primary }}>VinBriefcase</div>
          <div style={{ fontSize:12, color:C.textSoft, letterSpacing:"0.12em", textTransform:"uppercase", marginTop:4 }}>Din personlige vinlogg</div>
        </div>
        <div style={{ display:"flex", background:C.bg, borderRadius:12, padding:4, marginBottom:24 }}>
          {[["login","Logg inn"],["register","Registrer"]].map(([m,lbl]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{ flex:1, padding:"9px", border:"none", borderRadius:9, background:mode===m?C.primary:"transparent", color:mode===m?"#fff":C.textSoft, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div><label style={labelStyle}>Brukernavn</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ditt_brukernavn" style={inputStyle} onKeyDown={e => e.key==="Enter" && handle()} /></div>
          <div><label style={labelStyle}>Passord</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} onKeyDown={e => e.key==="Enter" && handle()} /></div>
          {error && <div style={{ background:"#fbe9e7", color:C.red, padding:"10px 14px", borderRadius:8, fontSize:13, fontWeight:600 }}>{error}</div>}
          <button onClick={handle} disabled={loading}
            style={{ background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"14px", fontSize:15, fontWeight:700, cursor:loading?"wait":"pointer", marginTop:4, opacity:loading?0.7:1, fontFamily:"inherit" }}>
            {loading ? "Vennligst vent..." : mode==="login" ? "Logg inn" : "Opprett konto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OVERLAYS ─────────────────────────────────────────────────────────────────
function BottomSheet({ onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(30,5,5,0.7)", zIndex:1000, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", width:"100%", maxHeight:"92vh", overflow:"auto", paddingBottom:32 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 6px" }}>
          <div style={{ width:36, height:4, background:C.border, borderRadius:4 }} />
        </div>
        {children}
      </div>
    </div>
  );
}

function Modal({ onClose, children, wide=false }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(30,5,5,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:wide?700:560, maxHeight:"92vh", overflow:"auto", padding:28, boxShadow:"0 24px 64px rgba(0,0,0,0.35)" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Overlay({ isMobile, onClose, children, wide }) {
  if (isMobile) return <BottomSheet onClose={onClose}><div style={{ padding:"0 18px" }}>{children}</div></BottomSheet>;
  return <Modal onClose={onClose} wide={wide}>{children}</Modal>;
}

// ─── VINE CARD ────────────────────────────────────────────────────────────────
function WineCard({ wine, onSelect, onAddTasting, onAddToCellar, isDesktop }) {
  const cat = wine.mainCategory || "";
  const catColor = cat.includes("Rød") ? C.primary : cat.includes("Hvit") ? "#7a6a20" : cat.includes("Rosé") ? "#c06080" : cat.includes("Muss") || cat.includes("Champ") ? "#4a6a8a" : C.primary3;

  return (
    <div style={{ background:C.bgCard, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 1px 4px rgba(92,26,26,0.07)", display:"flex", flexDirection:"column" }}>
      <div onClick={() => onSelect(wine)} style={{ padding:isDesktop?"14px 16px 10px":"13px 14px 10px", cursor:"pointer", display:"flex", gap:12, flex:1 }}>
        <div style={{ flexShrink:0, display:"flex", alignItems:"center" }}>
          <WineBottleImg wine={wine} size={isDesktop?44:40} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:6 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:isDesktop?15:14, fontWeight:700, color:C.text, lineHeight:1.25 }}>{wine.name}</div>
              {wine.producer && <div style={{ fontSize:11, color:C.textSoft, marginTop:1 }}>{wine.producer}</div>}
              {wine.year && <div style={{ fontSize:11, color:C.textSoft }}>{wine.year}</div>}
            </div>
            {wine.price && (
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:isDesktop?17:16, fontWeight:800, color:C.primary }}>{wine.price.toLocaleString("nb-NO")} kr</div>
                <div style={{ fontSize:10, color:C.textSoft }}>{wine.volume ? `${(wine.volume*100).toFixed(0)} cl` : ""}</div>
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:5, marginTop:7, flexWrap:"wrap" }}>
            {wine.mainCategory && <span style={{ background:catColor+"18", color:catColor, padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600 }}>{wine.mainCategory}</span>}
            {wine.country && <span style={{ background:C.bg, color:C.textMid, padding:"2px 9px", borderRadius:20, fontSize:11 }}>{wine.country}</span>}
            {wine.status && wine.status !== "aktiv" && (
              <span style={{ background:"#fbe9e7", color:C.red, padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                {wine.status === "utgatt" ? "⚠ Utgått" : wine.status === "langtidsutsolgt" ? "📦 Utsolgt" : wine.status === "utsolgt" ? "📦 Utsolgt" : "⚠ Ikke aktiv"}
              </span>
            )}

          </div>
          {wine.grapes && <div style={{ fontSize:11, color:C.textSoft, marginTop:5, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>🍇 {wine.grapes}</div>}
        </div>
      </div>
      <div style={{ display:"flex", borderTop:`1px solid ${C.borderLight}` }}>
        <button onClick={() => onAddTasting(wine)}
          style={{ flex:1, background:C.primary, color:"#fff", border:"none", padding:"11px 6px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
          <IcoNotes s={13} /> Smaksnotat
        </button>
        <button onClick={() => onAddToCellar(wine)}
          style={{ flex:1, background:C.gold, color:C.text, border:"none", borderLeft:`1px solid rgba(92,26,26,0.12)`, padding:"11px 6px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
          🍾 Kjeller
        </button>
      </div>
    </div>
  );
}

// ─── WINE DETAIL ──────────────────────────────────────────────────────────────
function WineDetail({ wine, onClose, onAddTasting, onAddToCellar, isMobile }) {
  if (!wine) return null;
  const cat = wine.mainCategory || "";
  const catColor = cat.includes("Rød") ? C.primary : cat.includes("Hvit") ? "#7a6a20" : cat.includes("Rosé") ? "#c06080" : "#4a6a8a";

  const content = (
    <>
      <div style={{ display:"flex", gap:16, alignItems:"flex-start", marginBottom:14 }}>
        <WineBottleImg wine={wine} size={60} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div style={{ fontSize:12, color:catColor, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>{wine.mainCategory}</div>
            <button onClick={onClose} style={{ background:C.bg, border:"none", borderRadius:10, width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.text, flexShrink:0 }}><IcoClose /></button>
          </div>
          <h2 style={{ margin:"3px 0 2px", fontSize:20, fontWeight:800, color:C.text, lineHeight:1.2 }}>{wine.name}</h2>
          {wine.producer && <div style={{ fontSize:13, color:C.textMid }}>{wine.producer}</div>}
          {wine.price && <div style={{ fontSize:22, fontWeight:800, color:C.primary, marginTop:4 }}>{wine.price.toLocaleString("nb-NO")} kr</div>}
        </div>
      </div>

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
        {wine.country && <span style={{ background:C.bg, color:C.textMid, padding:"3px 11px", borderRadius:20, fontSize:12, fontWeight:600 }}>🌍 {wine.country}</span>}
        {wine.region && <span style={{ background:C.bg, color:C.textMid, padding:"3px 11px", borderRadius:20, fontSize:12 }}>{wine.region}</span>}
        {wine.subRegion && <span style={{ background:C.bg, color:C.textMid, padding:"3px 11px", borderRadius:20, fontSize:12 }}>{wine.subRegion}</span>}
        {wine.year && <span style={{ background:C.bg, color:C.textMid, padding:"3px 11px", borderRadius:20, fontSize:12, fontWeight:600 }}>📅 {wine.year}</span>}
        {wine.status && wine.status !== "aktiv" && (
          <span style={{ background:"#fbe9e7", color:C.red, padding:"3px 14px", borderRadius:20, fontSize:13, fontWeight:700, border:`1.5px solid ${C.red}` }}>
            {wine.status === "utgatt" ? "⚠ Utgått — ikke lenger i sortimentet"
             : wine.status === "langtidsutsolgt" ? "📦 Langtidsutsolgt"
             : wine.status === "utsolgt" ? "📦 Utsolgt"
             : "⚠ Ikke aktiv"}
          </span>
        )}

      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {[["Alkohol", wine.alcohol ? `${wine.alcohol}%` : "—"],
          ["Volum", wine.volume ? `${(wine.volume*100).toFixed(0)} cl` : "—"],
          ["Druer", wine.grapes || "—"],
          ["Farge", wine.color || "—"]].map(([l,v]) => (
          <div key={l} style={{ background:C.bg, borderRadius:8, padding:"9px 12px" }}>
            <div style={{ fontSize:10, color:C.textSoft, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</div>
            <div style={{ fontWeight:700, color:C.text, fontSize:13, marginTop:1 }}>{v}</div>
          </div>
        ))}
      </div>

      {wine.description_no && (
        <p style={{ color:C.textMid, lineHeight:1.65, fontSize:14, margin:"0 0 14px" }}>{wine.description_no}</p>
      )}

      {wine.taste && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:C.textSoft, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Smaksprofil</div>
          <TasteBar label="Fylde"     value={wine.taste.fullness} />
          <TasteBar label="Sødme"     value={wine.taste.sweetness} />
          <TasteBar label="Friskhet"  value={wine.taste.freshness} />
          <TasteBar label="Bitterhet" value={wine.taste.bitterness} />
          <TasteBar label="Tanniner"  value={wine.taste.tannins} />
        </div>
      )}

      {wine.aromaCategories?.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:C.textSoft, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Aromaer</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {wine.aromaCategories.map(a => <span key={a} style={{ background:C.borderLight, color:C.textMid, padding:"4px 11px", borderRadius:20, fontSize:12 }}>{a}</span>)}
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginBottom:10 }}>
        <button onClick={() => { onAddToCellar(wine); onClose(); }}
          style={{ flex:1, background:C.gold, color:C.text, border:"none", borderRadius:12, padding:"13px 8px", fontSize:14, fontWeight:700, cursor:"pointer" }}>🍾 Legg i kjeller</button>
        <button onClick={() => { onAddTasting(wine); onClose(); }}
          style={{ flex:1, background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"13px 8px", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          <IcoNotes s={15} /> Smaksnotat
        </button>
      </div>
      <a href={wine.url} target="_blank" rel="noreferrer"
        style={{ display:"block", textAlign:"center", fontSize:13, color:C.primary3, textDecoration:"none", padding:"8px", borderRadius:8, border:`1px solid ${C.border}` }}>
        Se på Vinmonopolet.no ↗
      </a>
    </>
  );
  return <Overlay isMobile={isMobile} onClose={onClose} wide>{content}</Overlay>;
}

// ─── SMAKSNOTAT ───────────────────────────────────────────────────────────────
function TastingSheet({ wine, onClose, onSave, isMobile, existing }) {
  const [form, setForm] = useState({
    date:         existing?.date || new Date().toISOString().split("T")[0],
    myScore:      existing?.myScore || 0,
    notes:        existing?.notes || "",
    foodPairing:  existing?.foodPairing || "",
    occasion:     existing?.occasion || "",
    wouldBuyAgain: existing?.wouldBuyAgain ?? null,
  });
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const content = (
    <>
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:18 }}>
        <WineBottleImg wine={wine} size={38} />
        <div>
          <div style={{ fontSize:11, color:C.textSoft, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>Smaksnotat</div>
          <h3 style={{ margin:"2px 0 0", fontSize:18, fontWeight:800, color:C.text, lineHeight:1.2 }}>{wine.name}</h3>
          {wine.year && <div style={{ fontSize:12, color:C.textSoft }}>{wine.year}</div>}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div><label style={labelStyle}>Dato smakt</label>
          <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Min karakter (1–10)</label>
          <StarRating value={form.myScore} onChange={v => set("myScore", v)} /></div>
        <div><label style={labelStyle}>Smaksnotater</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
            placeholder="Farge, duft, smak, ettersmak..." style={{ ...inputStyle, resize:"vertical" }} /></div>
        <div><label style={labelStyle}>Matkombinasjoner</label>
          <input value={form.foodPairing} onChange={e => set("foodPairing", e.target.value)}
            placeholder="Lam, viltkjøtt, pasta..." style={inputStyle} /></div>
        <div><label style={labelStyle}>Anledning</label>
          <input value={form.occasion} onChange={e => set("occasion", e.target.value)}
            placeholder="Middagsselskap, jul, hverdagsvin..." style={inputStyle} /></div>
        <div>
          <label style={labelStyle}>Ville kjøpt igjen?</label>
          <div style={{ display:"flex", gap:8 }}>
            {[[true,"✅ Ja"],[null,"🤷 Kanskje"],[false,"❌ Nei"]].map(([v,lbl]) => (
              <button key={String(v)} onClick={() => set("wouldBuyAgain", v)}
                style={{ flex:1, padding:"9px", border:`1.5px solid ${form.wouldBuyAgain===v?C.primary:C.border}`, borderRadius:9, background:form.wouldBuyAgain===v?C.primary:"#fff", color:form.wouldBuyAgain===v?"#fff":C.textMid, fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display:"flex", gap:10, marginTop:20 }}>
        <button onClick={onClose} style={{ flex:1, background:C.bg, color:C.text, border:"none", borderRadius:12, padding:"13px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Avbryt</button>
        <button onClick={() => { onSave({ wine, ...form, id:existing?.id || Date.now() }); onClose(); }}
          style={{ flex:2, background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"13px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Lagre notat</button>
      </div>
    </>
  );
  return <Overlay isMobile={isMobile} onClose={onClose}>{content}</Overlay>;
}

// ─── TASTING CARD ─────────────────────────────────────────────────────────────
function TastingCard({ entry, onDelete, onEdit }) {
  return (
    <div style={{ background:C.bgCard, borderRadius:14, border:`1px solid ${C.border}`, padding:"14px", boxShadow:`0 1px 4px rgba(92,26,26,0.05)` }}>
      <div style={{ display:"flex", gap:10, justifyContent:"space-between" }}>
        <div style={{ display:"flex", gap:10, flex:1, minWidth:0 }}>
          <WineBottleImg wine={entry.wine} size={36} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{entry.wine.name}</div>
            <div style={{ fontSize:11, color:C.textSoft }}>{entry.wine.year && `${entry.wine.year} · `}{entry.date}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
          <button onClick={() => onEdit(entry)} style={{ background:C.bg, border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.textMid }}><IcoEdit /></button>
          <button onClick={() => onDelete(entry.id)} style={{ background:"#fbe9e7", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.red }}><IcoTrash /></button>
        </div>
      </div>
      <div style={{ marginTop:8 }}><StarRating value={entry.myScore} max={10} /></div>
      {entry.notes && (
        <div style={{ marginTop:9, background:C.bg, borderRadius:8, padding:"9px 12px", fontSize:13, color:C.textMid, lineHeight:1.6, borderLeft:`3px solid ${C.accent}` }}>
          {entry.notes}
        </div>
      )}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
        {entry.foodPairing && <span style={{ fontSize:11, background:C.borderLight, color:C.textMid, padding:"3px 9px", borderRadius:20 }}>🍽️ {entry.foodPairing}</span>}
        {entry.occasion && <span style={{ fontSize:11, background:C.borderLight, color:C.textMid, padding:"3px 9px", borderRadius:20 }}>🥂 {entry.occasion}</span>}
        {entry.wouldBuyAgain === true && <span style={{ fontSize:11, background:"#e8f5e9", color:C.green, padding:"3px 9px", borderRadius:20 }}>✅ Kjøper igjen</span>}
        {entry.wouldBuyAgain === false && <span style={{ fontSize:11, background:"#fbe9e7", color:C.red, padding:"3px 9px", borderRadius:20 }}>❌ Kjøper ikke igjen</span>}
      </div>
    </div>
  );
}

// ─── SKANNER ──────────────────────────────────────────────────────────────────
function LabelScanner({ onScanComplete, onClose, isMobile }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const fileRef   = useRef();
  const cameraRef = useRef();

  const compressImage = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 400;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.5));
    };
    img.onerror = reject;
    img.src = url;
  });

  const handleImage = async (file) => {
    if (!file) return;
    setScanning(true); setError(""); setResult(null);
    try {
      const compressed = await compressImage(file);
      const base64 = compressed.split(",")[1];
      const data = await API.scanLabel(base64, "image/jpeg");
      if (data.error) { setError(data.error); return; }

      // Search via proxy with Claude's identified info
      const wineInfo = data.wineInfo || {};
      const searchTerm = wineInfo.producer || wineInfo.name || "";
      let wines = [];
      if (searchTerm) {
        try {
          const p = new URLSearchParams({ search: searchTerm });
          const r = await fetch(`/api/wines?${p}`);
          const vmpResult = await r.json();
          wines = vmpResult.wines || [];
        } catch { wines = []; }
      }
      setResult({ wineInfo, wines });
    } catch(e) {
      setError(`Feil: ${e.message || "Prøv igjen"}`);
    }
    setScanning(false);
  };

  const content = (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <div style={{ fontSize:11, color:C.textSoft, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>AI-skanning</div>
          <h3 style={{ margin:"2px 0 0", fontSize:20, fontWeight:800, color:C.text }}>Skann vinflasken</h3>
        </div>
        <button onClick={onClose} style={{ background:C.bg, border:"none", borderRadius:10, width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.text }}><IcoClose /></button>
      </div>

      {!result && !scanning && (
        <div>
          <p style={{ fontSize:14, color:C.textMid, lineHeight:1.6, marginBottom:16 }}>
            Ta bilde av etiketten. Claude AI identifiserer vinen og søker direkte på Vinmonopolet.
          </p>
          <input ref={fileRef} type="file" accept="image/*" onChange={e => handleImage(e.target.files?.[0])} style={{ display:"none" }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e => handleImage(e.target.files?.[0])} style={{ display:"none" }} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => fileRef.current.click()}
              style={{ flex:1, background:C.bg, color:C.text, border:`1.5px solid ${C.border}`, borderRadius:12, padding:"14px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              📁 Velg fra bibliotek
            </button>
            <button onClick={() => cameraRef.current.click()}
              style={{ flex:1, background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"14px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <IcoCamera s={16} /> Ta bilde
            </button>
          </div>
        </div>
      )}

      {scanning && (
        <div style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:8 }}>Analyserer etikett...</div>
          <div style={{ fontSize:13, color:C.textSoft }}>Claude AI identifiserer vinen og søker på Vinmonopolet</div>
        </div>
      )}

      {error && (
        <div style={{ background:"#fbe9e7", color:C.red, padding:"12px 16px", borderRadius:10, marginBottom:16, fontSize:14 }}>
          {error}
          <button onClick={() => { setError(""); setResult(null); }} style={{ marginLeft:8, background:"none", border:"none", cursor:"pointer", color:C.red, fontWeight:700 }}>Prøv igjen</button>
        </div>
      )}

      {result && (
        <div>
          {result.wineInfo?.name && (
            <div style={{ background:C.bg, borderRadius:12, padding:"12px 16px", marginBottom:16, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:11, color:C.textSoft, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Claude identifiserte:</div>
              <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{result.wineInfo.name}</div>
              {result.wineInfo.producer && <div style={{ fontSize:12, color:C.textMid }}>{result.wineInfo.producer}{result.wineInfo.year ? ` · ${result.wineInfo.year}` : ""}</div>}
            </div>
          )}

          {result.wines?.length > 0 ? (
            <div>
              <div style={{ fontSize:13, color:C.textSoft, marginBottom:10 }}>Fant {result.wines.length} treff på Vinmonopolet:</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:320, overflowY:"auto" }}>
                {result.wines.map(wine => (
                  <button key={wine.id} onClick={() => { onScanComplete([wine], result.wineInfo); onClose(); }}
                    style={{ display:"flex", gap:10, alignItems:"center", padding:"10px 12px", background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:10, cursor:"pointer", textAlign:"left", fontFamily:"inherit", width:"100%" }}>
                    <WineBottleImg wine={wine} size={30} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{wine.name}</div>
                      <div style={{ fontSize:11, color:C.textSoft }}>{wine.country}{wine.year ? ` · ${wine.year}` : ""}{wine.price ? ` · ${wine.price.toLocaleString("nb-NO")} kr` : ""}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => { setResult(null); setError(""); }}
                style={{ marginTop:12, width:"100%", background:C.bg, color:C.text, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Skann et nytt bilde
              </button>
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"20px", background:C.bg, borderRadius:12 }}>
              <div style={{ fontSize:30, marginBottom:8 }}>🔍</div>
              <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:6 }}>Ingen treff på Vinmonopolet</div>
              <div style={{ fontSize:12, color:C.textSoft }}>Prøv manuelt søk i databasefanen</div>
              <button onClick={() => { setResult(null); setError(""); }}
                style={{ marginTop:12, width:"100%", background:C.bg, color:C.text, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Skann et nytt bilde
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
  return <Overlay isMobile={isMobile} onClose={onClose} wide>{content}</Overlay>;
}

// ─── FILTER PANEL ─────────────────────────────────────────────────────────────
const CATEGORIES = ["Rødvin","Hvitvin","Rosévin","Musserende vin"];

function PriceSlider({ min, max, value, onChange }) {
  const [localMin, setLocalMin] = useState(value[0]);
  const [localMax, setLocalMax] = useState(value[1]);

  // Sync if parent resets
  useEffect(() => { setLocalMin(value[0]); setLocalMax(value[1]); }, [value[0], value[1]]);

  const pctMin = ((localMin - min) / (max - min)) * 100;
  const pctMax = ((localMax - min) / (max - min)) * 100;

  const handleMinChange = (e) => {
    const v = Math.min(Number(e.target.value), localMax - 50);
    setLocalMin(v);
    onChange([v, localMax]);
  };
  const handleMaxChange = (e) => {
    const v = Math.max(Number(e.target.value), localMin + 50);
    setLocalMax(v);
    onChange([localMin, v]);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
        <span style={{ fontSize:13, fontWeight:700, color:C.primary }}>{localMin.toLocaleString("nb-NO")} kr</span>
        <span style={{ fontSize:13, fontWeight:700, color:C.primary }}>{localMax.toLocaleString("nb-NO")} kr</span>
      </div>
      <div style={{ position:"relative", height:28, marginBottom:4 }}>
        {/* Track background */}
        <div style={{ position:"absolute", top:"50%", left:0, right:0, height:5, background:C.borderLight, borderRadius:3, transform:"translateY(-50%)" }} />
        {/* Active range highlight */}
        <div style={{ position:"absolute", top:"50%", left:`${pctMin}%`, right:`${100-pctMax}%`, height:5, background:C.primary, borderRadius:3, transform:"translateY(-50%)", pointerEvents:"none" }} />
        {/* Min range input — sits on left half priority */}
        <input type="range" min={min} max={max} step={50} value={localMin}
          onChange={handleMinChange}
          style={{ position:"absolute", width:"100%", height:"100%", opacity:0, cursor:"pointer", margin:0, zIndex: localMin > max * 0.5 ? 5 : 4 }} />
        {/* Max range input */}
        <input type="range" min={min} max={max} step={50} value={localMax}
          onChange={handleMaxChange}
          style={{ position:"absolute", width:"100%", height:"100%", opacity:0, cursor:"pointer", margin:0, zIndex: localMin > max * 0.5 ? 4 : 5 }} />
        {/* Visual min thumb */}
        <div style={{ position:"absolute", top:"50%", left:`${pctMin}%`, width:20, height:20, background:C.primary, borderRadius:"50%", transform:"translate(-50%,-50%)", border:"3px solid #fff", boxShadow:"0 2px 6px rgba(92,26,26,0.35)", pointerEvents:"none", zIndex:6 }} />
        {/* Visual max thumb */}
        <div style={{ position:"absolute", top:"50%", left:`${pctMax}%`, width:20, height:20, background:C.primary, borderRadius:"50%", transform:"translate(-50%,-50%)", border:"3px solid #fff", boxShadow:"0 2px 6px rgba(92,26,26,0.35)", pointerEvents:"none", zIndex:6 }} />
      </div>
      {/* Tick labels */}
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
        {[0,1000,2000,3000,4000,5000].map(v => (
          <span key={v} style={{ fontSize:10, color:C.textSoft }}>{v === 0 ? "0" : `${v/1000}k`}</span>
        ))}
      </div>
    </div>
  );
}

function FilterPanel({ isMobile, open, onClose, filters, setFilters }) {
  const [facets, setFacets] = useState({ countries:[], regions:[], subRegions:[] });
  const [loadingFacets, setLoadingFacets] = useState(false);

  // Load facets whenever category or country changes
  useEffect(() => {
    setLoadingFacets(true);
    const p = new URLSearchParams({ category: filters.cat||"", country: filters.country||"" });
    fetch(`/api/facets?${p}`)
      .then(r => r.json())
      .then(d => { if (d.countries) setFacets(d); })
      .catch(() => {})
      .finally(() => setLoadingFacets(false));
  }, [filters.cat, filters.country]);

  const reset = () => setFilters({ cat:"", country:"", region:"", price:[0,5000], status:"aktiv" });

  const chip = (val, current, onSelect, small=false) => (
    <button key={val||"__all__"} onClick={() => onSelect(val)}
      style={{ padding: small?"5px 10px":"6px 13px", borderRadius:20, border:`1.5px solid ${current===val?C.primary:C.border}`, background:current===val?C.primary:"#fff", color:current===val?"#fff":C.textMid, fontSize: small?11:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
      {val || "Alle"}
    </button>
  );

  // Combine regions and sub-regions, deduplicate
  const allRegions = [...new Set([...facets.regions, ...facets.subRegions])].sort();

  const content = (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:17, fontWeight:800, color:C.text }}>Filter</span>
        <button onClick={reset} style={{ background:"none", border:"none", color:C.accent, fontWeight:700, fontSize:14, cursor:"pointer" }}>Nullstill</button>
      </div>

      {/* Kategori */}
      <div>
        <div style={labelStyle}>Kategori</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["", ...CATEGORIES].map(c => chip(c, filters.cat, v => setFilters(f => ({ ...f, cat:v, country:"", region:"" }))))}
        </div>
      </div>

      {/* Land — dynamisk basert på kategori */}
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <span style={labelStyle}>Land</span>
          {loadingFacets && <span style={{ fontSize:10, color:C.textSoft }}>Laster...</span>}
        </div>
        {facets.countries.length > 0 ? (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", maxHeight:140, overflowY:"auto" }}>
            {chip("", filters.country, v => setFilters(f => ({ ...f, country:v, region:"" })), true)}
            {facets.countries.map(c => chip(c, filters.country, v => setFilters(f => ({ ...f, country:v, region:"" })), true))}
          </div>
        ) : (
          <div style={{ fontSize:12, color:C.textSoft }}>Velg kategori først</div>
        )}
      </div>

      {/* Region — dynamisk basert på kategori + land */}
      {allRegions.length > 0 && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={labelStyle}>Region / distrikt</span>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", maxHeight:180, overflowY:"auto" }}>
            {chip("", filters.region, v => setFilters(f => ({ ...f, region:v })), true)}
            {allRegions.map(r => chip(r, filters.region, v => setFilters(f => ({ ...f, region:v })), true))}
          </div>
        </div>
      )}

      {/* Pris */}
      <div>
        <div style={labelStyle}>Pris</div>
        <PriceSlider min={0} max={5000} value={filters.price}
          onChange={v => setFilters(f => ({ ...f, price:v }))} />
      </div>

      {/* Status */}
      <div>
        <div style={labelStyle}>Status</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["aktiv","✅ Aktiv"],["utgatt","⚠ Utgått"],["utsolgt","📦 Utsolgt"],["langtidsutsolgt","📦 Langtidsutsolgt"],["","Alle"]].map(([v,lbl]) => (
            <button key={v||"all"} onClick={() => setFilters(f => ({ ...f, status:v }))}
              style={{ padding:"6px 13px", borderRadius:20, border:`1.5px solid ${filters.status===v?C.primary:C.border}`, background:filters.status===v?C.primary:"#fff", color:filters.status===v?"#fff":C.textMid, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onClose} style={{ width:"100%", background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"13px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Vis resultater</button>
    </div>
  );

  if (!isMobile) return (
    <div style={{ background:C.bgCard, borderRadius:14, border:`1px solid ${C.border}`, padding:"20px", position:"sticky", top:80, maxHeight:"calc(100vh - 100px)", overflowY:"auto" }}>{content}</div>
  );
  if (!open) return null;
  return <BottomSheet onClose={onClose}><div style={{ padding:"0 18px 20px" }}>{content}</div></BottomSheet>;
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:24, flexWrap:"wrap" }}>
      <button onClick={() => onChange(page-1)} disabled={page===0}
        style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:page===0?C.bg:"#fff", color:page===0?C.textSoft:C.text, cursor:page===0?"default":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 }}>← Forrige</button>
      <span style={{ padding:"8px 16px", fontSize:13, color:C.textMid, alignSelf:"center" }}>Side {page+1} av {totalPages}</span>
      <button onClick={() => onChange(page+1)} disabled={page>=totalPages-1}
        style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:page>=totalPages-1?C.bg:"#fff", color:page>=totalPages-1?C.textSoft:C.text, cursor:page>=totalPages-1?"default":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 }}>Neste →</button>
    </div>
  );
}

// ─── HOVED-APP ────────────────────────────────────────────────────────────────
export default function VinApp() {
  const [user, setUser]             = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const isDesktop = windowWidth >= 768;

  useEffect(() => {
    const saved = getSession();
    if (saved) setUser(saved);
    setLoadingUser(false);
  }, []);

  const handleLogin  = (u) => { setSession(u); setUser(u); };
  const handleLogout = () => { clearSession(); setUser(null); setTastings([]); setCellar([]); };

  // ── Søke-tilstand ──
  const [tab, setTab]             = useState("database");
  const [search, setSearch]       = useState("");
  const [filters, setFilters] = useState({ cat:"", country:"", region:"", price:[0,5000], status:"aktiv" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [wines, setWines]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalWines, setTotalWines] = useState(0);
  const [selectedWine, setSelectedWine] = useState(null);
  const [addingTasting, setAddingTasting] = useState(null);
  const [editingTasting, setEditingTasting] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [tastings, setTastings]   = useState([]);
  const [cellar, setCellar]       = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const searchTimer = useRef(null);

  // Last brukerdata
  useEffect(() => {
    if (!user) return;
    API.getData(user).then(data => {
      setTastings(data.tastings || []);
      setCellar(data.cellar || []);
      setDataLoaded(true);
    });
  }, [user]);

  // Auto-lagre
  useEffect(() => {
    if (!user || !dataLoaded) return;
    API.saveData(user, tastings, cellar);
  }, [tastings, cellar, user, dataLoaded]);

  // Søk mot Vinmonopolet
  const doSearch = useCallback(async (q, f, pg) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ search: q, category: f.cat||"", country: f.country||"", region: f.region||"", status: f.status||"", priceMin: f.price?.[0]||0, priceMax: f.price?.[1]||5000 });
      const res = await fetch(`/api/wines?${p}`);
      const result = await res.json();
      setWines(result.wines || []);
      setTotalPages(0);
      setTotalWines(result.total || 0);
    } catch(e) {
      setWines([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab !== "database") return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(0);
      doSearch(search, filters, 0);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [search, filters, tab, doSearch]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    doSearch(search, filters, newPage);
    window.scrollTo(0, 0);
  };

  const handleTabSwitch = (t) => {
    setTab(t);
    if (t === "database") doSearch(search, filters, page);
    if (t === "tastings" || t === "cellar") {
      API.getData(user).then(data => {
        setTastings(data.tastings || []);
        setCellar(data.cellar || []);
      }).catch(() => {});
    }
  };

  // Kjeller
  const addToCellar = (wine) => {
    setCellar(c => {
      const ex = c.find(e => e.wine.id === wine.id);
      if (ex) return c.map(e => e.wine.id === wine.id ? { ...e, qty:e.qty+1 } : e);
      return [...c, { wine, qty:1, addedDate:new Date().toISOString().split("T")[0], id:Date.now() }];
    });
  };
  const adjustCellar = (id, delta) => {
    setCellar(c => c.map(e => e.id===id ? { ...e, qty:Math.max(0,e.qty+delta) } : e).filter(e => e.qty>0));
  };
  const saveTasting = (entry) => {
    let updated;
    if (editingTasting) {
      updated = tastings.map(t => t.id===editingTasting.id ? { ...entry, id:editingTasting.id } : t);
      setEditingTasting(null);
    } else {
      updated = [entry, ...tastings];
    }
    setTastings(updated);
    API.saveData(user, updated, cellar).catch(() => {});
  };

  const totalCellar = cellar.reduce((s,e) => s+e.qty, 0);
  const avgScore    = tastings.length ? (tastings.reduce((s,t) => s+(t.myScore||0), 0) / tastings.length).toFixed(1) : "–";
  const hasFilter = !!(filters.cat || filters.country || filters.region || filters.price[0] > 0 || filters.price[1] < 5000 || filters.status !== "aktiv");

  const TABS = [
    { id:"database", Icon:IcoWine,   label:"Viner",   badge:null },
    { id:"tastings", Icon:IcoNotes,  label:"Notater", badge:tastings.length||null },
    { id:"cellar",   Icon:IcoCellar, label:"Kjeller", badge:totalCellar||null },
    { id:"scan",     Icon:IcoCamera, label:"Skann",   badge:null },
  ];

  if (loadingUser) return (
    <div style={{ minHeight:"100vh", background:C.headerBg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif", color:C.gold, fontSize:18 }}>
      🍷 Laster...
    </div>
  );
  if (!user) return <AuthScreen onLogin={handleLogin} />;

  // ── Database-fane ──
  const dbTab = (
    <div style={isDesktop ? { display:"grid", gridTemplateColumns:"330px 1fr", gap:24 } : {}}>
      {isDesktop && (
        <FilterPanel isMobile={false} open filters={filters} setFilters={v => { setFilters(v); setPage(0); }} onClose={() => {}} />
      )}
      <div>
        <div style={{ fontSize:12, color:C.textSoft, marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>{loading ? "Søker på Vinmonopolet..." : totalWines > 0 ? `${totalWines.toLocaleString("nb-NO")} viner fra Vinmonopolet` : wines.length === 0 && !search && !hasFilter ? "Søk for å utforske sortimentet" : "Ingen treff"}</span>
          {hasFilter && <button onClick={() => setFilters({ cat:"", country:"", region:"", price:[0,5000], status:"aktiv" })} style={{ background:"none", border:"none", color:C.accent, cursor:"pointer", fontSize:12, fontWeight:700 }}>Nullstill ×</button>}
        </div>

        {loading && (
          <div style={{ textAlign:"center", padding:"60px 20px", color:C.textSoft }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🍷</div>
            <div style={{ fontSize:14 }}>Henter fra Vinmonopolet...</div>
          </div>
        )}

        {!loading && wines.length === 0 && !search && !hasFilter && (
          <div style={{ textAlign:"center", padding:"80px 20px" }}>
            <div style={{ fontSize:52, marginBottom:14 }}>🍷</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:8 }}>Søk i Vinmonopolets sortiment</div>
            <div style={{ fontSize:14, color:C.textSoft, marginBottom:20 }}>Direkte fra Vinmonopolet — alltid oppdaterte priser og bilder</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
              {["Barolo","Champagne","Malbec","Chablis","Rioja","Amarone","Riesling","Brunello"].map(s => (
                <button key={s} onClick={() => setSearch(s)}
                  style={{ padding:"8px 16px", background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:20, cursor:"pointer", fontSize:13, color:C.textMid, fontFamily:"inherit" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && wines.length === 0 && (search || hasFilter) && (
          <div style={{ textAlign:"center", padding:"60px 20px", color:C.textSoft }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🔍</div>
            <div style={{ fontSize:15, fontWeight:600 }}>Ingen viner funnet</div>
          </div>
        )}

        {wines.length > 0 && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(auto-fill,minmax(300px,1fr))":"1fr", gap:12 }}>
              {wines.map(w => (
                <WineCard key={w.id} wine={w} onSelect={setSelectedWine} onAddTasting={setAddingTasting} onAddToCellar={addToCellar} isDesktop={isDesktop} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  );

  // ── Smaksnotater-fane ──
  const tastingsTab = (
    <div style={{ maxWidth:900 }}>
      {tastings.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(4,1fr)":"1fr 1fr", gap:12, marginBottom:20 }}>
          {[["Smakt",tastings.length,"📝"],["Snitt",avgScore,"⭐"],["Viner",new Set(tastings.map(t=>t.wine?.id)).size,"🍷"],["Land",new Set(tastings.map(t=>t.wine?.country).filter(Boolean)).size,"🌍"]].map(([l,v,e]) => (
            <div key={l} style={{ background:C.bgCard, borderRadius:12, border:`1px solid ${C.border}`, padding:"14px", textAlign:"center" }}>
              <div style={{ fontSize:22 }}>{e}</div>
              <div style={{ fontSize:isDesktop?24:22, fontWeight:800, color:C.primary }}>{v}</div>
              <div style={{ fontSize:10, color:C.textSoft, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</div>
            </div>
          ))}
        </div>
      )}
      {tastings.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px" }}>
          <div style={{ fontSize:50, marginBottom:14 }}>📝</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:8 }}>Ingen smaksnotater ennå</div>
          <div style={{ fontSize:14, color:C.textSoft, marginBottom:24 }}>Finn en vin og trykk «Smaksnotat»</div>
          <button onClick={() => handleTabSwitch("database")} style={{ background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"12px 28px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Gå til søk →</button>
        </div>
      ) : (
        <div style={{ display:isDesktop?"grid":"flex", gridTemplateColumns:"repeat(auto-fill,minmax(400px,1fr))", flexDirection:"column", gap:12 }}>
          {tastings.map(entry => (
            <TastingCard key={entry.id} entry={entry}
              onDelete={id => setTastings(t => t.filter(e => e.id!==id))}
              onEdit={e => { setEditingTasting(e); setAddingTasting(e.wine); }} />
          ))}
        </div>
      )}
    </div>
  );

  // ── Kjeller-fane (mobil) ──
  const cellarMobile = (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:C.text }}>Min vinkjeller</div>
          <div style={{ fontSize:12, color:C.textSoft }}>Flasker du har hjemme</div>
        </div>
        {totalCellar > 0 && <div style={{ background:C.bgCard, borderRadius:10, border:`1px solid ${C.border}`, padding:"6px 14px", textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, color:C.gold }}>{totalCellar}</div>
          <div style={{ fontSize:9, color:C.textSoft, textTransform:"uppercase" }}>flasker</div>
        </div>}
      </div>
      {cellar.length === 0 ? (
        <div style={{ textAlign:"center", padding:"70px 20px" }}>
          <div style={{ fontSize:46, marginBottom:12 }}>🍾</div>
          <div style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:6 }}>Kjelleren er tom</div>
          <div style={{ fontSize:13, color:C.textSoft, marginBottom:20 }}>Finn en vin og trykk «🍾 Kjeller»</div>
          <button onClick={() => handleTabSwitch("database")} style={{ background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"12px 24px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Gå til søk →</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {cellar.map(entry => (
            <div key={entry.id} style={{ background:C.bgCard, borderRadius:14, border:`1px solid ${C.border}`, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
              <div onClick={() => setSelectedWine(entry.wine)} style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0, cursor:"pointer" }}>
                <WineBottleImg wine={entry.wine} size={36} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{entry.wine.name}</div>
                  <div style={{ fontSize:11, color:C.textSoft }}>{entry.wine.country}{entry.wine.year ? ` · ${entry.wine.year}` : ""}</div>
                  {entry.wine.price && <div style={{ fontSize:13, fontWeight:700, color:C.primary }}>{entry.wine.price.toLocaleString("nb-NO")} kr</div>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center" }}>
                <button onClick={() => adjustCellar(entry.id,-1)} style={{ width:36, height:36, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:"8px 0 0 8px", cursor:"pointer", fontSize:19, color:C.text, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                <span style={{ minWidth:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:C.text, background:C.bg, border:`1.5px solid ${C.border}`, borderLeft:"none", borderRight:"none" }}>{entry.qty}</span>
                <button onClick={() => adjustCellar(entry.id,1)} style={{ width:36, height:36, background:C.primary, border:"none", borderRadius:"0 8px 8px 0", cursor:"pointer", fontSize:19, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
              </div>
              <button onClick={() => setCellar(c => c.filter(e => e.id!==entry.id))} style={{ background:"#fbe9e7", border:"none", borderRadius:8, width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.red, flexShrink:0 }}><IcoTrash /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Kjeller desktop ──
  const cellarDesktop = (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}>Min vinkjeller</h2>
          <div style={{ fontSize:13, color:C.textSoft }}>Flasker du har hjemme</div>
        </div>
        {totalCellar > 0 && <div style={{ background:C.bgCard, borderRadius:12, border:`1px solid ${C.border}`, padding:"10px 20px", textAlign:"center" }}>
          <div style={{ fontSize:22, fontWeight:800, color:C.gold }}>{totalCellar}</div>
          <div style={{ fontSize:10, color:C.textSoft, textTransform:"uppercase" }}>flasker</div>
        </div>}
      </div>
      {cellar.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px" }}>
          <div style={{ fontSize:50, marginBottom:14 }}>🍾</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:8 }}>Kjelleren er tom</div>
          <button onClick={() => handleTabSwitch("database")} style={{ background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"12px 28px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Gå til søk →</button>
        </div>
      ) : (
        <div style={{ background:C.bgCard, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:C.primary, color:"#fff" }}>
                {[" ","Vin","Kategori","Land","Pris","Lagt inn","Antall",""].map((h,i) => (
                  <th key={i} style={{ padding:"12px 14px", textAlign:"left", fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cellar.map((entry,i) => (
                <tr key={entry.id} style={{ borderBottom:`1px solid ${C.borderLight}`, background:i%2===0?"#fff":C.bg }}>
                  <td style={{ padding:"10px 8px 10px 14px", cursor:"pointer" }} onClick={() => setSelectedWine(entry.wine)}><WineBottleImg wine={entry.wine} size={28} /></td>
                  <td style={{ padding:"12px 14px", cursor:"pointer" }} onClick={() => setSelectedWine(entry.wine)}>
                    <div style={{ fontWeight:700, color:C.primary, fontSize:14, textDecoration:"underline", textDecorationStyle:"dotted" }}>{entry.wine.name}</div>
                    {entry.wine.year && <div style={{ fontSize:11, color:C.textSoft }}>{entry.wine.year}</div>}
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:12, color:C.textMid }}>{entry.wine.mainCategory || "—"}</td>
                  <td style={{ padding:"12px 14px", fontSize:12, color:C.textMid }}>{entry.wine.country || "—"}</td>
                  <td style={{ padding:"12px 14px", fontSize:13, fontWeight:700, color:C.primary }}>{entry.wine.price ? `${entry.wine.price.toLocaleString("nb-NO")} kr` : "—"}</td>
                  <td style={{ padding:"12px 14px", fontSize:11, color:C.textSoft }}>{entry.addedDate}</td>
                  <td style={{ padding:"12px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center" }}>
                      <button onClick={() => adjustCellar(entry.id,-1)} style={{ width:32, height:32, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:"8px 0 0 8px", cursor:"pointer", fontSize:17, color:C.text, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                      <span style={{ minWidth:34, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:C.text, background:C.bg, border:`1.5px solid ${C.border}`, borderLeft:"none", borderRight:"none" }}>{entry.qty}</span>
                      <button onClick={() => adjustCellar(entry.id,1)} style={{ width:32, height:32, background:C.primary, border:"none", borderRadius:"0 8px 8px 0", cursor:"pointer", fontSize:17, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                    </div>
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    <button onClick={() => setCellar(c => c.filter(e => e.id!==entry.id))} style={{ background:"#fbe9e7", border:"none", borderRadius:7, width:30, height:30, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.red }}><IcoTrash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Georgia','Times New Roman',serif", paddingBottom:isDesktop?0:70 }}>
      {/* HEADER */}
      <div style={{ background:C.headerBg, color:"#fff", position:"sticky", top:0, zIndex:50, boxShadow:"0 2px 16px rgba(0,0,0,0.4)" }}>
        <div style={{ display:"flex", alignItems:"center", padding:isDesktop?"0 32px":`${window.navigator.standalone?"44px":"16px"} 14px 0` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flex:isDesktop?0:1, padding:isDesktop?"14px 0":"0" }}>
            <span style={{ fontSize:isDesktop?22:20 }}>🍷</span>
            <div>
              <div style={{ fontSize:isDesktop?16:15, fontWeight:800, lineHeight:1 }}>VinBriefcase <span style={{ color:C.gold }}>v2.0</span></div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", letterSpacing:"0.12em", textTransform:"uppercase" }}>Live fra Vinmonopolet</div>
            </div>
          </div>

          {isDesktop && (
            <div style={{ display:"flex", flex:1, marginLeft:28 }}>
              {TABS.map(({ id, Icon, label, badge }) => {
                const active = tab === id;
                return (
                  <button key={id} onClick={() => id==="scan" ? setShowScanner(true) : handleTabSwitch(id)}
                    style={{ background:"none", border:"none", color:active?C.gold:"rgba(255,255,255,0.6)", cursor:"pointer", padding:"16px 18px", fontSize:14, fontWeight:active?700:500, borderBottom:active?`2px solid ${C.gold}`:"2px solid transparent", display:"flex", alignItems:"center", gap:6, fontFamily:"inherit", position:"relative" }}>
                    <Icon s={17} />{label}
                    {badge !== null && <span style={{ background:C.gold, color:C.text, borderRadius:10, padding:"1px 6px", fontSize:10, fontWeight:800 }}>{badge}</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:isDesktop?"auto":0 }}>
            {isDesktop && <span style={{ fontSize:13, color:"rgba(255,255,255,0.6)" }}>{user}</span>}
            <button onClick={handleLogout} style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:7, padding:isDesktop?"7px 12px":"6px 10px", color:"#fff", cursor:"pointer", fontSize:isDesktop?12:11, fontWeight:600, display:"flex", alignItems:"center", gap:4, fontFamily:"inherit" }}>
              <IcoLogout s={isDesktop?15:14} /> Ut
            </button>
          </div>
        </div>

        {/* Søkefelt */}
        {tab === "database" && (
          <div style={{ display:"flex", gap:8, padding:isDesktop?"10px 32px 14px":"10px 14px 14px" }}>
            <div style={{ flex:1, position:"relative" }}>
              <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.45)", pointerEvents:"none" }}><IcoSearch /></span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk vin, produsent, drue, region..."
                style={{ width:"100%", padding:"10px 12px 10px 34px", border:"none", borderRadius:10, fontSize:14, background:"rgba(255,255,255,0.12)", color:"#fff", boxSizing:"border-box", outline:"none" }} />
            </div>
            <button onClick={() => setFilterOpen(true)}
              style={{ background:hasFilter?C.gold:"rgba(255,255,255,0.12)", border:"none", borderRadius:10, minWidth:42, cursor:"pointer", color:hasFilter?C.text:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <IcoFilter />
            </button>
            <button onClick={() => setShowScanner(true)}
              style={{ background:C.accent, border:"none", borderRadius:10, minWidth:42, cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap:4, padding:"0 12px", fontSize:12, fontWeight:600 }}>
              <IcoCamera s={15} />{isDesktop?" Skann":""}
            </button>
          </div>
        )}
      </div>

      {/* INNHOLD */}
      <div style={{ padding:isDesktop?"24px 32px":"14px 12px", maxWidth:isDesktop?1400:undefined, margin:isDesktop?"0 auto":undefined }}>
        {tab === "database" && dbTab}
        {tab === "tastings" && tastingsTab}
        {tab === "cellar"   && (isDesktop ? cellarDesktop : cellarMobile)}
      </div>

      {/* Mobil bunn-nav */}
      {!isDesktop && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:C.primary, display:"flex", borderTop:"1px solid rgba(255,255,255,0.08)", zIndex:50, paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
          {TABS.map(({ id, Icon, label, badge }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => id==="scan" ? setShowScanner(true) : handleTabSwitch(id)}
                style={{ flex:1, background:"none", border:"none", cursor:"pointer", padding:"10px 4px 9px", display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:active?C.gold:"rgba(255,255,255,0.5)", position:"relative", WebkitTapHighlightColor:"transparent" }}>
                {active && id!=="scan" && <span style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:28, height:2.5, background:C.gold, borderRadius:"0 0 3px 3px" }} />}
                <div style={{ position:"relative" }}>
                  <Icon s={22} />
                  {badge !== null && <span style={{ position:"absolute", top:-5, right:-7, background:C.gold, color:C.text, borderRadius:10, padding:"1px 5px", fontSize:9, fontWeight:800, lineHeight:1.5 }}>{badge}</span>}
                </div>
                <span style={{ fontSize:10, fontWeight:active?700:400 }}>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Modaler */}
      {selectedWine && !addingTasting && (
        <WineDetail wine={selectedWine} onClose={() => setSelectedWine(null)}
          onAddTasting={w => { setSelectedWine(null); setAddingTasting(w); }}
          onAddToCellar={w => { addToCellar(w); setSelectedWine(null); }}
          isMobile={!isDesktop} />
      )}
      {addingTasting && (
        <TastingSheet wine={addingTasting} onClose={() => { setAddingTasting(null); setEditingTasting(null); }}
          onSave={saveTasting} isMobile={!isDesktop} existing={editingTasting} />
      )}
      {showScanner && (
        <LabelScanner
          onScanComplete={(scanWines, wineInfo) => {
            setShowScanner(false);
            handleTabSwitch("database");
            setWines(scanWines);
            setSearch(wineInfo?.producer || wineInfo?.name || "");
          }}
          onClose={() => setShowScanner(false)}
          isMobile={!isDesktop} />
      )}
      {!isDesktop && (
        <FilterPanel isMobile open={filterOpen} onClose={() => setFilterOpen(false)}
          filters={filters} setFilters={v => { setFilters(v); setPage(0); }} />
      )}
    </div>
  );
}
