"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigation, getNavSpots } from "../lib/navigation.js";

const T = {
  bg: "#1a1a1f", bg2: "#222228", bg3: "#2a2a32",
  tx: "#b0b0b8", txH: "#e8e8f0", txD: "#68687a",
  bd: "#2e2e38", bdL: "#3a3a48", accent: "#6375f0",
  green: "#4de8b0", red: "#e5534b", orange: "#d4843e", hover: "#2e2e3a",
};

/* ── Inline icons ── */
const IC = {
  search: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  x: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  chk: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  tgt: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
};

function useLeaflet() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.L) { setReady(true); return; }
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const js = document.createElement("script"); js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; js.onload = () => setReady(true); document.head.appendChild(js);
  }, []);
  return ready;
}

const haversineNav = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const bearingNav = (lat1, lng1, lat2, lng2) => {
  const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};
const pointInPolyNav = (lat, lng, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/* ── Outdoor spot group definitions ── */
const SPOT_GROUPS = [
  { prefix: "bench", label: "ベンチ", col: "#8bc34a" },
  { prefix: "park", label: "駐輪場", col: "#78909c" },
  { prefix: "vend_d", label: "自販機・飲料", col: "#42a5f5" },
  { prefix: "vend_f", label: "自販機・食品", col: "#ff8a65" },
  { prefix: "smoke", label: "喫煙所", col: "#b0bec5" },
];
const getGroupPrefix = (id) => { const g = SPOT_GROUPS.find(g => id.startsWith(g.prefix + "_")); return g ? g.prefix : null; };
const isGroupableSpot = (s) => s.cat === "outdoor" && getGroupPrefix(s.id) != null;

const buildSearchResults = (spots) => {
  const nonGroupable = spots.filter(s => !isGroupableSpot(s));
  const groupable = spots.filter(s => isGroupableSpot(s));
  const groups = [];
  SPOT_GROUPS.forEach(g => {
    const members = groupable.filter(s => s.id.startsWith(g.prefix + "_"));
    if (members.length > 0) groups.push({ ...g, spots: members, isGroup: true });
  });
  return { singles: nonGroupable, groups };
};

const NON_GEO_NAV = new Set(["suzu", "home_loc", "commute", "off_campus"]);

/* ── SpotSelector (search-first, category tabs) ── */
const SpotSelector = ({ navSpots, spotCats, value, onChange, onSelectGroup, placeholder, accent, onGps, gpsLoading, quickSpots }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [openCat, setOpenCat] = useState(null);
  const sel = value === "__gps__" ? { id: "__gps__", label: "現在地", col: "#4285f4", short: "GPS" } : navSpots.find(s => s.id === value);

  const searching = q.trim().length > 0;
  const filtered = searching ? navSpots.filter(s => s.label.includes(q) || s.short.includes(q) || s.id.includes(q.toLowerCase())) : [];
  const searchResults = searching ? buildSearchResults(filtered) : null;
  const searchGrouped = searching ? spotCats.map(cat => ({ ...cat, spots: filtered.filter(s => s.cat === cat.id && !isGroupableSpot(s)) })).filter(g => g.spots.length > 0) : [];
  const catSpots = openCat ? navSpots.filter(s => s.cat === openCat) : [];

  return <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
    <div style={{ position: "relative", width: "100%" }} onMouseEnter={e => { const x = e.currentTarget.querySelector('[data-clear]'); if (x) x.style.opacity = '1'; }} onMouseLeave={e => { const x = e.currentTarget.querySelector('[data-clear]'); if (x) x.style.opacity = '0'; }}>
      <button onClick={() => { setOpen(p => !p); setQ(""); setOpenCat(null); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "9px 10px", paddingRight: sel ? 30 : 10, borderRadius: 8, border: "none", background: open ? T.bg3 : "transparent", cursor: "pointer", textAlign: "left", transition: "background .12s" }} onMouseEnter={e => { if (!open) e.currentTarget.style.background = T.bg3 }} onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent" }}>
        {sel ? <span style={{ fontSize: 13, fontWeight: 600, color: T.txH, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel.label}</span>
          : <span style={{ fontSize: 13, color: T.txD, flex: 1 }}>{placeholder}</span>}
      </button>
      {sel && <button data-clear onClick={e => { e.stopPropagation(); onChange(null); setOpen(false); }} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", border: "none", background: `${T.red}18`, cursor: "pointer", opacity: 0, transition: "opacity .15s", padding: 0 }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>}
    </div>
    {open && <>
      <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 2000 }} />
      <div style={{ position: "absolute", top: "100%", left: -44, right: -12, marginTop: 6, background: T.bg2, border: `1px solid ${T.bdL}`, borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,.55)", zIndex: 2001, overflow: "hidden" }}>
        <div style={{ padding: "10px 10px 6px" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", color: T.txD, pointerEvents: "none" }}>{IC.search}</span>
            <input value={q} onChange={e => { setQ(e.target.value); setOpenCat(null); }} placeholder="建物名を検索..." autoFocus style={{ width: "100%", padding: "9px 10px 9px 34px", borderRadius: 10, border: `1px solid ${T.bd}`, background: T.bg3, color: T.txH, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ maxHeight: 280, overflowY: "auto", padding: "0 6px 6px" }}>
          {value && <button onClick={() => { onChange(null); setOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: "none", background: `${T.red}10`, cursor: "pointer", textAlign: "left", marginBottom: 4 }}>
            <span style={{ display: "flex", color: T.red }}>{IC.x}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: T.red }}>選択を解除</span>
          </button>}
          {searching ? <>
            {/* Grouped outdoor spots */}
            {searchResults.groups.map(g => (
              <button key={g.prefix} onClick={() => { if (onSelectGroup) { onSelectGroup(g.prefix); setOpen(false); } }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = T.hover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: `${g.col}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={g.col} stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.txH, flex: 1 }}>{g.label}</span>
                <span style={{ fontSize: 11, color: T.txD }}>{g.spots.length}件 ›</span>
              </button>
            ))}
            {/* Non-groupable spots */}
            {searchGrouped.map(g => <div key={g.id}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.txD, letterSpacing: .5, padding: "8px 10px 3px" }}>{g.label}</div>
              {g.spots.map(s => {
                const on = s.id === value;
                return <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", background: on ? `${accent}18` : "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => { if (!on) e.currentTarget.style.background = T.hover }} onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: on ? s.col : `${s.col}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 7, fontWeight: 700, color: on ? "#fff" : s.col }}>{s.short}</span></div>
                  <span style={{ fontSize: 12, fontWeight: on ? 600 : 400, color: on ? T.txH : T.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.label}</span>
                  {on && <span style={{ display: "flex", color: accent, flexShrink: 0 }}>{IC.chk}</span>}
                </button>;
              })}
            </div>)}
            {searchResults.groups.length === 0 && searchGrouped.length === 0 && <div style={{ padding: "16px 0", fontSize: 12, color: T.txD, textAlign: "center" }}>見つかりません</div>}
          </> : openCat ? <>
            <button onClick={() => setOpenCat(null)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: T.txD, fontSize: 11, marginBottom: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              戻る
            </button>
            {catSpots.map(s => {
              const on = s.id === value;
              return <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", background: on ? `${accent}18` : "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => { if (!on) e.currentTarget.style.background = T.hover }} onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent" }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: on ? s.col : `${s.col}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 7, fontWeight: 700, color: on ? "#fff" : s.col }}>{s.short}</span></div>
                <span style={{ fontSize: 12, fontWeight: on ? 600 : 400, color: on ? T.txH : T.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.label}</span>
                {on && <span style={{ display: "flex", color: accent, flexShrink: 0 }}>{IC.chk}</span>}
              </button>;
            })}
          </> : <>
            {onGps && <button onClick={() => { onGps(); setOpen(false); }} disabled={gpsLoading} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, border: "none", background: "#4285f410", cursor: gpsLoading ? "wait" : "pointer", textAlign: "left", marginBottom: 4 }} onMouseEnter={e => e.currentTarget.style.background = "#4285f420"} onMouseLeave={e => e.currentTarget.style.background = "#4285f410"}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: "#4285f430", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{IC.tgt}</div>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#4285f4" }}>{gpsLoading ? "取得中..." : "現在地"}</span>
            </button>}
            {quickSpots && quickSpots.length > 0 && <>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.txD, letterSpacing: .5, padding: "8px 10px 3px" }}>よく使う</div>
              {quickSpots.map(s => {
                const on = s.id === value;
                return <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", background: on ? `${accent}18` : "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => { if (!on) e.currentTarget.style.background = T.hover }} onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: on ? s.col : `${s.col}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 7, fontWeight: 700, color: on ? "#fff" : s.col }}>{s.short}</span></div>
                  <span style={{ fontSize: 12, fontWeight: on ? 600 : 400, color: on ? T.txH : T.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.label}</span>
                  {on && <span style={{ display: "flex", color: accent, flexShrink: 0 }}>{IC.chk}</span>}
                </button>;
              })}
              <div style={{ height: 1, background: T.bd, margin: "6px 10px" }} />
            </>}
            {spotCats.filter(cat => navSpots.some(s => s.cat === cat.id)).map(cat => {
              const count = navSpots.filter(s => s.cat === cat.id).length;
              return <button key={cat.id} onClick={() => setOpenCat(cat.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = T.hover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.txH }}>{cat.label}</span>
                <span style={{ fontSize: 11, color: T.txD }}>{count}件 ›</span>
              </button>;
            })}
          </>}
        </div>
      </div>
    </>}
  </div>;
};

/* ── NavigationView ── */
export default function NavigationView({ campusData }) {
  const { CAMPUS, SPOTS, SPOT_CATS, ENTRANCES, WAYPOINTS, EDGES, AREAS, QUICK_ACCESS } = campusData;
  const navSpots = useMemo(() => getNavSpots(SPOTS), [SPOTS]);
  const quickSpots = useMemo(() => {
    if (!QUICK_ACCESS || QUICK_ACCESS.length === 0) return [];
    return QUICK_ACCESS.map(id => navSpots.find(s => s.id === id)).filter(Boolean);
  }, [QUICK_ACCESS, navSpots]);
  const leafletReady = useLeaflet();
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const layersRef = useRef([]);
  const overlayRef = useRef(null);
  const gpsMarkerRef = useRef(null);
  const { origin, setOrigin, destination, setDestination, route, swap, gpsOriginPos, setGpsOriginPos } = useNavigation(SPOTS, WAYPOINTS, ENTRANCES, EDGES);
  const [selectMode, setSelectMode] = useState(null);
  const [panelMin, setPanelMin] = useState(false);
  const [searchMin, setSearchMin] = useState(true);
  const [navPhase, setNavPhase] = useState("search"); // "search" | "group" | "detail" | "route"
  const [spotGroup, setSpotGroup] = useState(null);
  const [gpsPos, setGpsPos] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  // 案内モード（GPS追従+コンパス）
  const [guiding, setGuiding] = useState(false);
  const [heading, setHeading] = useState(null);
  const headingRef = useRef(null);
  const watchIdRef = useRef(null);
  const routeCoordsRef = useRef(null);
  const initialBearingRef = useRef(null);
  const compassPermRef = useRef(false);
  const guidingOriginRef = useRef(null);
  // 自動追従モード
  const [following, setFollowing] = useState(true);
  const guidingRef = useRef(false);
  useEffect(() => { guidingRef.current = guiding; }, [guiding]);
  // 出発地がGPS由来かどうか
  const [originFromGps, setOriginFromGps] = useState(false);
  // mobile detection
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const check = () => setMob(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ルート座標をrefに同期
  useEffect(() => { routeCoordsRef.current = route?.coords || null; }, [route]);

  const REROUTE_THRESHOLD = 50;

  const distToRoute = (lat, lng, coords) => {
    if (!coords || coords.length === 0) return Infinity;
    let minD = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
      const c1 = coords[i], c2 = coords[i + 1];
      const dx = c2.lat - c1.lat, dy = c2.lng - c1.lng;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((lat - c1.lat) * dx + (lng - c1.lng) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const d = haversineNav(lat, lng, c1.lat + t * dx, c1.lng + t * dy);
      if (d < minD) minD = d;
    }
    if (coords.length === 1) {
      minD = haversineNav(lat, lng, coords[0].lat, coords[0].lng);
    }
    return minD;
  };

  const findNearestNavSpot = useCallback((lat, lng) => {
    // 1) ポリゴン判定
    if (AREAS) {
      for (const [id, poly] of Object.entries(AREAS)) {
        if (NON_GEO_NAV.has(id) || poly.length < 3) continue;
        if (pointInPolyNav(lat, lng, poly)) {
          const spot = navSpots.find(s => s.id === id);
          if (spot) return { spot, distance: 0 };
        }
      }
    }
    // 2) 入口ベース
    let bestEntSpot = null, bestEntDist = Infinity;
    for (const ent of ENTRANCES) {
      if (!ent.spot || NON_GEO_NAV.has(ent.spot)) continue;
      const d = haversineNav(lat, lng, ent.lat, ent.lng);
      if (d < bestEntDist) { bestEntDist = d; bestEntSpot = ent.spot; }
    }
    if (bestEntSpot && bestEntDist < 100) {
      const spot = navSpots.find(s => s.id === bestEntSpot);
      if (spot) return { spot, distance: bestEntDist };
    }
    // 3) フォールバック
    let best = null, bestDist = Infinity;
    for (const s of navSpots) {
      if (!s.id || s.lat == null || NON_GEO_NAV.has(s.id)) continue;
      const d = haversineNav(lat, lng, s.lat, s.lng);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return { spot: best, distance: bestDist };
  }, [navSpots, ENTRANCES, AREAS]);

  // GPS常時追従
  const startWatch = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current != null) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setGpsPos({ lat, lng, accuracy });
        const rc = routeCoordsRef.current;
        if (rc && rc.length > 0) {
          const d = distToRoute(lat, lng, rc);
          if (d > REROUTE_THRESHOLD) {
            setOrigin("__gps__"); setGpsOriginPos({ lat, lng }); setOriginFromGps(true);
          }
        } else {
          setOrigin("__gps__"); setGpsOriginPos({ lat, lng }); setOriginFromGps(true);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    watchIdRef.current = id;
  }, [setOrigin, setGpsOriginPos]);
  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
  }, []);
  useEffect(() => () => stopWatch(), []);

  // コンパス
  useEffect(() => {
    if (!guiding) { setHeading(null); return; }
    if (!compassPermRef.current) return;
    let smoothed = null;
    let prevSmoothed = null;
    let accumulated = null;
    let gotAbsolute = false;
    const process = (h) => {
      if (smoothed == null) { smoothed = h; prevSmoothed = h; accumulated = h; }
      else {
        let delta = h - smoothed;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        smoothed = (smoothed + delta * 0.25 + 360) % 360;
      }
      headingRef.current = smoothed;
      let d = smoothed - prevSmoothed;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      prevSmoothed = smoothed;
      accumulated += d;
      setHeading(prev => {
        if (prev == null) return Math.round(accumulated);
        return Math.abs(accumulated - prev) >= 2 ? Math.round(accumulated) : prev;
      });
    };
    const absHandler = (e) => {
      let h = null;
      if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;
      else if (e.alpha != null && (e.absolute || e.type === "deviceorientationabsolute")) h = (360 - e.alpha) % 360;
      if (h == null) return;
      gotAbsolute = true;
      process(h);
    };
    const fallbackHandler = (e) => {
      if (gotAbsolute) return;
      let h = null;
      if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;
      else if (e.alpha != null) h = (360 - e.alpha) % 360;
      if (h == null) return;
      process(h);
    };
    const hasAbsoluteEvent = typeof window.DeviceOrientationAbsoluteEvent !== "undefined";
    if (hasAbsoluteEvent) {
      window.addEventListener("deviceorientationabsolute", absHandler, true);
    }
    window.addEventListener("deviceorientation", hasAbsoluteEvent ? fallbackHandler : absHandler, true);
    return () => {
      if (hasAbsoluteEvent) window.removeEventListener("deviceorientationabsolute", absHandler, true);
      window.removeEventListener("deviceorientation", hasAbsoluteEvent ? fallbackHandler : absHandler, true);
    };
  }, [guiding]);

  // 案内モード: GPS追従
  useEffect(() => {
    if (guiding && following && gpsPos && mapInst.current) {
      const zoom = Math.max(mapInst.current.getZoom(), 18);
      mapInst.current.setView([gpsPos.lat, gpsPos.lng], zoom, { animate: true, duration: 0.3 });
    }
  }, [guiding, following, gpsPos]);

  // 案内モード: heading変更時にマップ回転
  useEffect(() => {
    if (!mapInst.current || typeof mapInst.current.setBearing !== 'function') return;
    if (guiding && following && heading != null) {
      mapInst.current.setBearing(-heading);
    } else if (guiding && following && initialBearingRef.current != null) {
      mapInst.current.setBearing(initialBearingRef.current);
    } else if (!guiding) {
      mapInst.current.setBearing(0);
    }
  }, [guiding, following, heading]);

  // GPSマーカーの方向矢印
  useEffect(() => {
    if (!gpsMarkerRef.current || !window.L) return;
    const hd = headingRef.current;
    const mapBearing = (mapInst.current && typeof mapInst.current.getBearing === 'function') ? mapInst.current.getBearing() : 0;
    const arrowAngle = hd != null ? hd + mapBearing : null;
    const arrowHtml = arrowAngle != null ? `<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%) rotate(${arrowAngle}deg);transform-origin:center 24px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:14px solid #4285f4;filter:drop-shadow(0 0 3px rgba(66,133,244,.6));z-index:2"></div>` : "";
    const icon = window.L.divIcon({ className: "", html: `<div style="position:relative">${arrowHtml}<div style="position:absolute;inset:-10px;border-radius:50%;background:#4285f420;border:1.5px solid #4285f440;animation:locPulse 2s ease-in-out infinite"></div><div style="width:12px;height:12px;border-radius:50%;background:#4285f4;border:2.5px solid #fff;box-shadow:0 0 6px rgba(66,133,244,.5)"></div></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });
    gpsMarkerRef.current.setIcon(icon);
  }, [heading, guiding, following]);

  // 案内開始/終了
  const startGuiding = useCallback(() => {
    const doStart = () => {
      setGuiding(true);
      setFollowing(true);
      setPanelMin(true);
      startWatch();
      const origSpot = origin === "__gps__" && gpsOriginPos ? { lat: gpsOriginPos.lat, lng: gpsOriginPos.lng } : navSpots.find(s => s.id === origin);
      if (origSpot) guidingOriginRef.current = { lat: origSpot.lat, lng: origSpot.lng };
      const destSpot = navSpots.find(s => s.id === destination);
      if (origSpot && destSpot && mapInst.current && typeof mapInst.current.setBearing === 'function') {
        const b = bearingNav(origSpot.lat, origSpot.lng, destSpot.lat, destSpot.lng);
        initialBearingRef.current = b;
        mapInst.current.setBearing(b);
      }
      if (gpsPos && mapInst.current) {
        mapInst.current.flyTo([gpsPos.lat, gpsPos.lng], 18, { duration: 0.8 });
      } else if (mapInst.current) {
        navigator.geolocation?.getCurrentPosition((pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          setGpsPos({ lat, lng, accuracy });
          mapInst.current?.flyTo([lat, lng], 18, { duration: 0.8 });
        }, () => {}, { enableHighAccuracy: true, timeout: 10000 });
      }
    };
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then(r => {
        compassPermRef.current = r === "granted";
        doStart();
      }).catch(() => { compassPermRef.current = false; doStart(); });
    } else {
      compassPermRef.current = true;
      doStart();
    }
  }, [startWatch, gpsPos, gpsOriginPos, origin, destination, navSpots]);
  const stopGuiding = useCallback(() => {
    setGuiding(false);
    setFollowing(true);
    stopWatch();
    initialBearingRef.current = null;
    guidingOriginRef.current = null;
  }, [stopWatch]);

  // 現在地に戻る
  const reCenter = useCallback(() => {
    setFollowing(true);
    if (gpsPos && mapInst.current) {
      mapInst.current.flyTo([gpsPos.lat, gpsPos.lng], 18, { duration: 0.5 });
    }
  }, [gpsPos]);

  const getGpsOrigin = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setGpsPos({ lat, lng, accuracy });
        setOrigin("__gps__"); setGpsOriginPos({ lat, lng }); setOriginFromGps(true);
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [setOrigin, setGpsOriginPos]);

  // init map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInst.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: [CAMPUS.center.lat, CAMPUS.center.lng], zoom: CAMPUS.zoom || 17, zoomControl: false, attributionControl: false });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 22, maxNativeZoom: 19 }).addTo(map);
    overlayRef.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 22, maxNativeZoom: 19, pane: "overlayPane", opacity: 0.35 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInst.current = map;
    map.on("click", () => { if (navPhaseRef.current === "search") setSearchMin(true); });
    map.on("dragstart", () => { if (guidingRef.current) setFollowing(false); });
    return () => { map.remove(); mapInst.current = null; };
  }, [leafletReady, CAMPUS]);

  // refs for click handler
  const selectModeRef = useRef(selectMode);
  useEffect(() => { selectModeRef.current = selectMode; }, [selectMode]);
  const originRef = useRef(origin);
  useEffect(() => { originRef.current = origin; }, [origin]);
  const destRef = useRef(destination);
  useEffect(() => { destRef.current = destination; }, [destination]);
  const navPhaseRef = useRef(navPhase);
  useEffect(() => { navPhaseRef.current = navPhase; }, [navPhase]);
  const spotGroupRef = useRef(spotGroup);
  useEffect(() => { spotGroupRef.current = spotGroup; }, [spotGroup]);

  // update markers/route
  useEffect(() => {
    if (!mapInst.current || !leafletReady) return;
    const L = window.L;
    const map = mapInst.current;
    layersRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
    layersRef.current = [];
    gpsMarkerRef.current = null;

    const originSpot = origin === "__gps__" && gpsOriginPos ? { id: "__gps__", label: "現在地", lat: gpsOriginPos.lat, lng: gpsOriginPos.lng, col: "#4285f4" } : navSpots.find(s => s.id === origin);
    const destSpot = navSpots.find(s => s.id === destination);

    // All building dots
    const isGroupPhase = navPhase === "group" && spotGroup;
    const groupBounds = [];
    navSpots.forEach(s => {
      const isOrig = s.id === origin, isDest = s.id === destination;
      if (isOrig || isDest) return;
      const inGroup = isGroupPhase && s.id.startsWith(spotGroup + "_");
      if (inGroup) {
        const gInfo = SPOT_GROUPS.find(g => g.prefix === spotGroup);
        const col = gInfo?.col || s.col;
        const lbl = s.label.replace(/^[^（(]*[（(]/, "").replace(/[）)]$/, "") || s.short;
        const mkIcon = (showLabel, anim = false, delay = 0) => L.divIcon({ className: "", html: showLabel
          ? `<div style="position:relative;display:flex;flex-direction:column;align-items:center;${anim ? `animation:navPinPop .35s cubic-bezier(.34,1.56,.64,1) ${delay}ms both` : ""}"><div style="background:${col};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.4);border:2px solid #fff">${lbl}</div><div style="width:2px;height:6px;background:#fff;opacity:.7"></div><div style="width:6px;height:6px;border-radius:50%;background:${col};border:1.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div></div>`
          : `<div style="position:relative;display:flex;flex-direction:column;align-items:center"><div style="width:14px;height:14px;border-radius:50%;background:${col};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);${anim ? `animation:navPinDot .3s cubic-bezier(.34,1.56,.64,1) ${delay}ms both` : ""}"></div></div>`,
          iconSize: [0, 0], iconAnchor: [0, showLabel ? 40 : 7] });
        const m = L.marker([s.lat, s.lng], { icon: mkIcon(false), interactive: true, zIndexOffset: 500 }).addTo(map);
        m._mkIcon = mkIcon;
        m.on("click", () => { setDestination(s.id); setSpotGroup(null); setNavPhase("detail"); });
        layersRef.current.push(m);
        groupBounds.push([s.lat, s.lng]);
      } else {
        const opacity = isGroupPhase ? "20" : "55";
        const borderOp = isGroupPhase ? "40" : "80";
        const icon = L.divIcon({ className: "", html: `<div style="width:10px;height:10px;border-radius:50%;background:${s.col}${opacity};border:1.5px solid ${s.col}${borderOp};cursor:pointer;transition:transform .15s" onmouseover="this.style.transform='scale(1.6)'" onmouseout="this.style.transform='scale(1)'"></div>`, iconSize: [10, 10], iconAnchor: [5, 5] });
        const m = L.marker([s.lat, s.lng], { icon, interactive: true }).addTo(map);
        m.on("click", () => {
          const mode = selectModeRef.current;
          const phase = navPhaseRef.current;
          if (mode === "origin") { setOrigin(s.id); setGpsOriginPos(null); setOriginFromGps(false); setSelectMode(null); }
          else if (mode === "destination") { setDestination(s.id); setSelectMode(null); setNavPhase("detail"); }
          else if (phase === "search" || phase === "detail" || phase === "group") { setDestination(s.id); setSpotGroup(null); setNavPhase("detail"); }
          else if (phase === "route" && !originRef.current) { setOrigin(s.id); setGpsOriginPos(null); setOriginFromGps(false); }
        });
        m.bindTooltip(s.label, { direction: "top", offset: [0, -8], className: "nav-tip" });
        layersRef.current.push(m);
      }
    });
    // Fit map to group bounds
    if (isGroupPhase && groupBounds.length > 0) {
      if (groupBounds.length === 1) map.flyTo(groupBounds[0], 18, { duration: .4 });
      else map.fitBounds(L.latLngBounds(groupBounds).pad(0.3));
    }

    // Zoom-dependent label toggle for group pins
    if (isGroupPhase) {
      let prevShow = false;
      const onZoom = () => {
        const show = map.getZoom() >= 17;
        if (show === prevShow) return;
        prevShow = show;
        const center = map.getCenter();
        const pins = layersRef.current.filter(m => m._mkIcon);
        const dists = pins.map(m => { const ll = m.getLatLng(); return Math.hypot(ll.lat - center.lat, ll.lng - center.lng); });
        const maxD = Math.max(...dists) || 1;
        pins.forEach((m, i) => { m.setIcon(m._mkIcon(show, true, Math.round((dists[i] / maxD) * 200))); });
      };
      map.on("zoomend", onZoom);
      layersRef.current.push({ remove: () => map.off("zoomend", onZoom) });
    }

    // Route polyline
    if (route && route.coords.length > 1) {
      const latlngs = route.coords.map(c => [c.lat, c.lng]);
      if (guiding && gpsPos) {
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < latlngs.length; i++) {
          const d = haversineNav(gpsPos.lat, gpsPos.lng, latlngs[i][0], latlngs[i][1]);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        const passed = latlngs.slice(0, bestIdx + 1);
        const remaining = latlngs.slice(bestIdx);
        if (passed.length > 1) {
          const pg = L.polyline(passed, { color: "#888", weight: 5, opacity: 0.4, lineCap: "round", lineJoin: "round", dashArray: "6 8" }).addTo(map);
          layersRef.current.push(pg);
        }
        if (remaining.length > 1) {
          const rGlow = L.polyline(remaining, { color: "#4de8b0", weight: 12, opacity: 0.15, lineCap: "round", lineJoin: "round" }).addTo(map);
          const rShadow = L.polyline(remaining, { color: "#000", weight: 7, opacity: 0.3, lineCap: "round", lineJoin: "round" }).addTo(map);
          const rLine = L.polyline(remaining, { color: "#4de8b0", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(map);
          layersRef.current.push(rGlow, rShadow, rLine);
        }
      } else {
        const glow = L.polyline(latlngs, { color: "#4de8b0", weight: 12, opacity: 0.15, lineCap: "round", lineJoin: "round" }).addTo(map);
        const shadow = L.polyline(latlngs, { color: "#000", weight: 7, opacity: 0.3, lineCap: "round", lineJoin: "round" }).addTo(map);
        const line = L.polyline(latlngs, { color: "#4de8b0", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(map);
        layersRef.current.push(glow, shadow, line);
        map.fitBounds(line.getBounds().pad(0.25));
      }
    }

    // Origin marker
    const originPos = guiding && guidingOriginRef.current ? guidingOriginRef.current : originSpot;
    if (originPos) {
      const icon = L.divIcon({ className: "", html: `<div style="width:18px;height:18px;border-radius:50%;background:#fff;border:3px solid #ccc;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><div style="width:6px;height:6px;border-radius:50%;background:#aaa"></div></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
      const m = L.marker([originPos.lat, originPos.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      m.bindTooltip(`出発: ${originSpot?.label || "現在地"}`, { direction: "top", offset: [0, -12], className: "nav-tip" });
      layersRef.current.push(m);
    }

    // Destination marker
    if (destSpot) {
      const icon = L.divIcon({ className: "", html: `
        <div style="position:relative;width:32px;height:42px">
          <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;background:rgba(0,0,0,.2);filter:blur(3px)"></div>
          <div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:28px;height:28px;border-radius:50%;background:${T.accent};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
          </div>
        </div>`, iconSize: [32, 42], iconAnchor: [16, 42] });
      const m = L.marker([destSpot.lat, destSpot.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      m.bindTooltip(`到着: ${destSpot.label}`, { direction: "top", offset: [0, -44], className: "nav-tip" });
      layersRef.current.push(m);
    }

    // GPS位置マーカー
    if (gpsPos) {
      const hd = headingRef.current;
      const mapBearing = (map && typeof map.getBearing === 'function') ? map.getBearing() : 0;
      const arrowAngle = hd != null ? hd + mapBearing : null;
      const arrowHtml = arrowAngle != null ? `<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%) rotate(${arrowAngle}deg);transform-origin:center 24px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:14px solid #4285f4;filter:drop-shadow(0 0 3px rgba(66,133,244,.6));z-index:2"></div>` : "";
      const gpsDot = L.divIcon({ className: "", html: `<div style="position:relative">${arrowHtml}<div style="position:absolute;inset:-10px;border-radius:50%;background:#4285f420;border:1.5px solid #4285f440;animation:locPulse 2s ease-in-out infinite"></div><div style="width:12px;height:12px;border-radius:50%;background:#4285f4;border:2.5px solid #fff;box-shadow:0 0 6px rgba(66,133,244,.5)"></div></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });
      const gm = L.marker([gpsPos.lat, gpsPos.lng], { icon: gpsDot, zIndexOffset: 900 }).addTo(map);
      gm.bindTooltip(`<b>現在地</b>`, { direction: "top", offset: [0, -10], className: "nav-tip" });
      gpsMarkerRef.current = gm;
      layersRef.current.push(gm);
      if (gpsPos.accuracy && gpsPos.accuracy < 500) {
        const circle = L.circle([gpsPos.lat, gpsPos.lng], { radius: gpsPos.accuracy, color: "#4285f4", fillColor: "#4285f4", fillOpacity: 0.08, weight: 1, opacity: 0.3 }).addTo(map);
        layersRef.current.push(circle);
      }
    }

    // detailフェーズ: 目的地にズーム
    if (!route && destSpot && !originSpot) {
      map.flyTo([destSpot.lat, destSpot.lng], 18, { duration: .4 });
    }
    if (!route && originSpot && destSpot) {
      map.fitBounds(L.latLngBounds([[originSpot.lat, originSpot.lng], [destSpot.lat, destSpot.lng]]).pad(0.3));
    }
  }, [leafletReady, origin, destination, route, gpsPos, gpsOriginPos, guiding, navPhase, spotGroup, navSpots]);

  /* ── Inline search for search phase ── */
  const [searchQ, setSearchQ] = useState("");
  const [openCatInline, setOpenCatInline] = useState(null);

  if (!leafletReady) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100dvh", background: T.bg, color: T.txD, fontFamily: "'Inter',sans-serif" }}>マップを読み込み中...</div>;

  const tipStyle = `.nav-tip{background:${T.bg2}!important;color:${T.txH}!important;border:1px solid ${T.bdL}!important;border-radius:8px!important;font-size:11px!important;font-weight:600!important;padding:4px 10px!important;box-shadow:0 4px 16px rgba(0,0,0,.45)!important;font-family:inherit!important}.nav-tip::before{display:none!important}`;

  const hasRoute = !!route;
  const noRoute = origin && destination && origin !== destination && !route;

  const destSpotInfo = navSpots.find(s => s.id === destination);

  const cardBase = { position: "absolute", top: mob ? 10 : 14, left: mob ? 10 : 14, right: mob ? 10 : "auto", width: mob ? "auto" : 360, zIndex: 1000, background: T.bg2, borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.45), 0 1px 3px rgba(0,0,0,.2)", border: `1px solid ${T.bdL}`, overflow: "visible" };

  const groupInfo = spotGroup ? SPOT_GROUPS.find(g => g.prefix === spotGroup) : null;
  const groupSpots = spotGroup ? navSpots.filter(s => s.id.startsWith(spotGroup + "_")) : [];
  const searchFiltered = searchQ.trim().length > 0 ? navSpots.filter(s => s.label.includes(searchQ) || s.short.includes(searchQ) || s.id.includes(searchQ.toLowerCase())) : [];
  const searchInlineResults = searchQ.trim().length > 0 ? buildSearchResults(searchFiltered) : null;
  const searchInlineGrouped = searchQ.trim().length > 0 ? SPOT_CATS.map(cat => ({ ...cat, spots: searchFiltered.filter(s => s.cat === cat.id && !isGroupableSpot(s)) })).filter(g => g.spots.length > 0) : [];

  const stopProp = e => { e.stopPropagation(); };
  const searchCard = navPhase === "search" && searchMin ?
    <div onClick={() => setSearchMin(false)} style={{ position: "absolute", top: mob ? 10 : 14, left: mob ? 10 : 14, right: mob ? 10 : "auto", width: mob ? "auto" : 360, zIndex: 1000, display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: T.bg2, borderRadius: 16, border: `1px solid ${T.bdL}`, boxShadow: "0 4px 24px rgba(0,0,0,.45), 0 1px 3px rgba(0,0,0,.2)", cursor: "pointer", transition: "box-shadow .15s" }}>
      <span style={{ display: "flex", color: T.txD }}>{IC.search}</span>
      <span style={{ fontSize: 14, color: T.txD, flex: 1 }}>スポットを検索...</span>
    </div>
  : navPhase === "search" ?
    /* ── Phase 1: Search ── */
    <div style={cardBase} onMouseDown={stopProp} onDoubleClick={stopProp} onKeyDown={stopProp} onKeyUp={stopProp}>
      <div style={{ padding: "10px 10px 6px" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", color: T.txD, pointerEvents: "none" }}>{IC.search}</span>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="スポットを検索..." autoFocus style={{ width: "100%", padding: "11px 10px 11px 34px", borderRadius: 10, border: `1px solid ${T.bd}`, background: T.bg3, color: T.txH, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto", padding: "0 6px 6px" }}>
        {searchQ.trim().length > 0 ? <>
          {searchInlineResults.groups.map(g => (
            <button key={g.prefix} onClick={() => { setSpotGroup(g.prefix); setNavPhase("group"); setSearchQ(""); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = T.hover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: `${g.col}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill={g.col} stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.txH, flex: 1 }}>{g.label}</span>
              <span style={{ fontSize: 11, color: T.txD }}>{g.spots.length}件 ›</span>
            </button>
          ))}
          {searchInlineGrouped.map(g => <div key={g.id}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.txD, letterSpacing: .5, padding: "8px 10px 3px" }}>{g.label}</div>
            {g.spots.map(s => (
              <button key={s.id} onClick={() => { setDestination(s.id); setSpotGroup(null); setNavPhase("detail"); setSearchQ(""); if (mapInst.current) mapInst.current.flyTo([s.lat, s.lng], 18, { duration: .5 }); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = T.hover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: `${s.col}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 7, fontWeight: 700, color: s.col }}>{s.short}</span></div>
                <span style={{ fontSize: 12, fontWeight: 400, color: T.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.label}</span>
              </button>
            ))}
          </div>)}
          {searchInlineResults.groups.length === 0 && searchInlineGrouped.length === 0 && <div style={{ padding: "16px 0", fontSize: 12, color: T.txD, textAlign: "center" }}>見つかりません</div>}
        </> : <>
          {SPOT_CATS.filter(cat => navSpots.some(s => s.cat === cat.id)).map(cat => {
            const catSpots = navSpots.filter(s => s.cat === cat.id && !isGroupableSpot(s));
            const catGroups = SPOT_GROUPS.filter(g => navSpots.some(s => s.cat === cat.id && s.id.startsWith(g.prefix + "_")));
            const isOpen = openCatInline === cat.id;
            return <div key={cat.id}>
              <button onClick={() => setOpenCatInline(isOpen ? null : cat.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 10px", borderRadius: 8, border: "none", background: isOpen ? T.bg3 : "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = T.hover }} onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = isOpen ? T.bg3 : "transparent" }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.txH }}>{cat.label}</span>
                <span style={{ fontSize: 11, color: T.txD }}>{catSpots.length + catGroups.length}件 {isOpen ? "▾" : "›"}</span>
              </button>
              {isOpen && <div style={{ padding: "0 4px 4px" }}>
                {catGroups.map(g => {
                  const cnt = navSpots.filter(s => s.id.startsWith(g.prefix + "_")).length;
                  return <button key={g.prefix} onClick={() => { setSpotGroup(g.prefix); setNavPhase("group"); setSearchQ(""); setOpenCatInline(null); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = T.hover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: `${g.col}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={g.col} stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 400, color: T.tx, flex: 1 }}>{g.label}</span>
                    <span style={{ fontSize: 10, color: T.txD }}>{cnt}件 ›</span>
                  </button>;
                })}
                {catSpots.map(s => (
                  <button key={s.id} onClick={() => { setDestination(s.id); setSpotGroup(null); setNavPhase("detail"); setSearchQ(""); setOpenCatInline(null); if (mapInst.current) mapInst.current.flyTo([s.lat, s.lng], 18, { duration: .5 }); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = T.hover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: `${s.col}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 7, fontWeight: 700, color: s.col }}>{s.short}</span></div>
                    <span style={{ fontSize: 12, fontWeight: 400, color: T.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.label}</span>
                  </button>
                ))}
              </div>}
            </div>;
          })}
        </>}
      </div>
    </div>
  : navPhase === "group" ?
    /* ── Phase 1.5: Group pins on map ── */
    <div style={cardBase}>
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${groupInfo?.col || T.txD}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={groupInfo?.col || T.txD} stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.txH }}>{groupInfo?.label || ""}</div>
            <div style={{ fontSize: 11, color: T.txD, marginTop: 1 }}>{groupSpots.length}件のスポット</div>
          </div>
          <button onClick={() => { setSpotGroup(null); setNavPhase("search"); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", border: `1px solid ${T.bd}`, background: "transparent", cursor: "pointer", color: T.txD, flexShrink: 0 }}>{IC.x}</button>
        </div>
        <div style={{ fontSize: 11, color: T.txD }}>マップ上のピンをタップして選択</div>
      </div>
    </div>
  : navPhase === "detail" ?
    /* ── Phase 2: Spot detail + navigate button ── */
    <div style={{ ...cardBase, top: "auto", bottom: mob ? 10 : 14 }}>
      <div style={{ padding: 14 }}>
        {destSpotInfo && <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${destSpotInfo.col}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: destSpotInfo.col }}>{destSpotInfo.short}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.txH, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{destSpotInfo.label}</div>
              <div style={{ fontSize: 11, color: T.txD, marginTop: 1 }}>{SPOT_CATS.find(c => c.id === destSpotInfo.cat)?.label || ""}</div>
            </div>
            <button onClick={() => { setDestination(null); setOrigin(null); setNavPhase("search"); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", border: `1px solid ${T.bd}`, background: "transparent", cursor: "pointer", color: T.txD, flexShrink: 0 }}>{IC.x}</button>
          </div>
          <button onClick={() => {
            setNavPhase("route");
            if (navigator.geolocation) {
              setGpsLoading(true);
              navigator.geolocation.getCurrentPosition(
                pos => {
                  const { latitude: lat, longitude: lng, accuracy } = pos.coords;
                  setGpsPos({ lat, lng, accuracy });
                  setOrigin("__gps__"); setGpsOriginPos({ lat, lng }); setOriginFromGps(true);
                  setGpsLoading(false);
                },
                () => setGpsLoading(false),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
              );
            }
          }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#4de8b0,#34a853)", cursor: "pointer", transition: "opacity .15s" }} onMouseEnter={e => e.currentTarget.style.opacity = ".85"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>ここへ案内</span>
          </button>
        </>}
      </div>
    </div>
  :
    /* ── Phase 3: Route mode ── */
    <div style={cardBase}>
      <div style={{ display: "flex", alignItems: "stretch", padding: "4px 8px 4px 4px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0, padding: "12px 0" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: origin ? "#fff" : "#ccc", border: "2px solid #bbb", flexShrink: 0 }} />
          <div style={{ width: 2, flex: 1, background: `${T.txD}30`, margin: "3px 0", minHeight: 12 }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: destination ? T.accent : `${T.accent}60`, border: `2px solid ${T.accent}`, flexShrink: 0 }} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ borderBottom: `1px solid ${T.bd}` }}>
            <SpotSelector navSpots={navSpots} spotCats={SPOT_CATS} value={origin} onChange={v => { setOrigin(v); setGpsOriginPos(null); setOriginFromGps(false); setSelectMode(null); }} placeholder="出発地を選択" accent="#34a853" onGps={getGpsOrigin} gpsLoading={gpsLoading} quickSpots={quickSpots} />
          </div>
          <SpotSelector navSpots={navSpots} spotCats={SPOT_CATS} value={destination} onChange={v => { if (v) { setDestination(v); } else { setDestination(null); setOrigin(null); setNavPhase("search"); } }} placeholder="目的地を選択" accent={T.accent} quickSpots={quickSpots} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0, paddingLeft: 4 }}>
          <button onClick={getGpsOrigin} disabled={gpsLoading} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", border: `1px solid ${gpsPos ? "#4285f440" : T.bd}`, background: gpsPos ? "#4285f410" : "transparent", cursor: gpsLoading ? "wait" : "pointer", color: gpsPos ? "#4285f4" : T.txD, transition: "all .15s", opacity: gpsLoading ? 0.5 : 1 }} title="現在地を出発地に設定">
            {IC.tgt}
          </button>
          <button onClick={swap} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", border: `1px solid ${T.bd}`, background: "transparent", cursor: "pointer", color: T.txD, transition: "all .15s" }} title="入れ替え">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 3 7 21" /><polyline points="4 6 7 3 10 6" /><polyline points="17 21 17 3" /><polyline points="14 18 17 21 20 18" /></svg>
          </button>
        </div>
      </div>
      {selectMode && <div style={{ padding: "6px 14px 10px", borderTop: `1px solid ${T.bd}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: `${T.accent}10` }}>
          <span style={{ display: "flex", color: T.accent }}>{IC.tgt}</span>
          <span style={{ fontSize: 11, color: T.accent, fontWeight: 500 }}>マップ上の建物をタップして{selectMode === "origin" ? "出発地" : "目的地"}を選択</span>
        </div>
      </div>}
    </div>;

  /* ── Floating route info card (bottom) ── */
  const routeCard = hasRoute && !panelMin && <div style={{
    position: "absolute",
    bottom: mob ? 12 : 20,
    left: mob ? 12 : 14,
    right: mob ? 12 : "auto",
    width: mob ? "auto" : 360,
    zIndex: 1000,
    background: T.bg2,
    borderRadius: 16,
    boxShadow: "0 -2px 20px rgba(0,0,0,.35), 0 1px 3px rgba(0,0,0,.2)",
    border: `1px solid ${T.bdL}`,
    padding: "16px 18px",
    animation: "navSlideUp .25s ease-out",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#4de8b0,#34a853)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{route.minutes}</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,.85)", marginTop: -1 }}>分</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.txH }}>{route.distance}m</span>
          <span style={{ fontSize: 12, color: T.txD }}>徒歩</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: T.bg3 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4de8b0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.txH }}>約{route.minutes}分</span>
          </div>
          {route.hasStairs && <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: `${T.orange}12` }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.orange} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18h4v-4h4v-4h4v-4h4" /></svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.orange }}>階段あり</span>
          </div>}
        </div>
      </div>
      <button onClick={() => setPanelMin(true)} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: T.txD, cursor: "pointer", display: "flex", padding: 4 }} title="閉じる">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 15 12 9 18 15" /></svg>
      </button>
    </div>
    {!guiding && originFromGps && <button onClick={startGuiding} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 0", marginTop: 10, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#4de8b0,#34a853)", cursor: "pointer", transition: "opacity .15s" }} onMouseEnter={e => e.currentTarget.style.opacity = ".85"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>案内を開始</span>
    </button>}
    {guiding && <button onClick={stopGuiding} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 0", marginTop: 10, borderRadius: 12, border: `1.5px solid ${T.red}40`, background: `${T.red}12`, cursor: "pointer", transition: "opacity .15s" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.red }}>案内を終了</span>
    </button>}
  </div>;

  /* ── Minimized route pill ── */
  const routePill = hasRoute && panelMin && <button onClick={() => setPanelMin(false)} style={{
    position: "absolute",
    bottom: mob ? 12 : 20,
    left: mob ? 12 : 14,
    zIndex: 1000,
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 16px",
    borderRadius: 28,
    background: "linear-gradient(135deg,#4de8b0,#34a853)",
    border: "none",
    boxShadow: "0 4px 16px rgba(77,232,176,.3), 0 2px 6px rgba(0,0,0,.2)",
    cursor: "pointer",
    animation: "navSlideUp .2s ease-out",
  }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{route.minutes}分</span>
    <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,.8)" }}>{route.distance}m</span>
  </button>;

  /* ── No route error ── */
  const noRouteCard = noRoute && <div style={{
    position: "absolute",
    bottom: mob ? 12 : 20,
    left: mob ? 12 : 14,
    right: mob ? 12 : "auto",
    width: mob ? "auto" : 360,
    zIndex: 1000,
    background: T.bg2,
    borderRadius: 14,
    boxShadow: "0 4px 20px rgba(0,0,0,.35)",
    border: `1px solid ${T.red}30`,
    padding: "14px 18px",
    display: "flex", alignItems: "center", gap: 10,
    animation: "navSlideUp .25s ease-out",
  }}>
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${T.red}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
    </div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.txH }}>経路が見つかりません</div>
      <div style={{ fontSize: 11, color: T.txD, marginTop: 2 }}>別のルートをお試しください</div>
    </div>
  </div>;

  return <div style={{ position: "fixed", inset: 0, overflow: "hidden", fontFamily: "'Inter',sans-serif" }}>
    <style>{tipStyle}{`
@keyframes navSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes navPinPop{0%{opacity:0;transform:scale(.3) translateY(8px)}60%{opacity:1;transform:scale(1.08) translateY(-1px)}100%{opacity:1;transform:scale(1) translateY(0)}}
@keyframes navPinDot{0%{transform:scale(.5)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes locPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
    `}</style>
    {/* Full-screen map */}
    <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
    {/* Floating UI */}
    {!guiding && searchCard}
    {routeCard}
    {routePill}
    {noRouteCard}
    {/* 案内中: 終了ボタン */}
    {guiding && <div style={{ position: "absolute", top: mob ? 10 : 14, left: mob ? 10 : 14, right: mob ? 10 : "auto", width: mob ? "auto" : 320, zIndex: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: T.bg2, borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,.4)", border: `1px solid #4de8b060` }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: following ? "#4de8b0" : "#888", animation: following ? "locPulse 1.5s infinite" : "none", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: following ? "#4de8b0" : "#888", flex: 1 }}>{following ? "案内中" : "自由操作中"}</span>
        {route && <span style={{ fontSize: 12, fontWeight: 600, color: T.txH }}>{route.distance}m / {route.minutes}分</span>}
        <button onClick={stopGuiding} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${T.red}40`, background: `${T.red}10`, cursor: "pointer", fontSize: 11, fontWeight: 600, color: T.red }}>終了</button>
      </div>
    </div>}
    {/* 案内中 + 自由操作中: 現在地に戻るボタン */}
    {guiding && !following && <button onClick={reCenter} style={{ position: "absolute", bottom: hasRoute && !panelMin ? (mob ? 180 : 195) : (mob ? 70 : 80), right: mob ? 12 : 14, zIndex: 1000, display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 28, background: T.bg2, border: `1px solid #4285f440`, boxShadow: "0 4px 16px rgba(0,0,0,.35)", cursor: "pointer", animation: "navSlideUp .2s ease-out", transition: "bottom .25s ease" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285f4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4m-10-10h4m12 0h4" /></svg>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#4285f4" }}>現在地に戻る</span>
    </button>}
  </div>;
}
