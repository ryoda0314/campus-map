"use client";
import { CAMPUS_LIST } from "../lib/campuses/index.js";

const T = {
  bg: "#1a1a1f", bg2: "#222228", bg3: "#2a2a32",
  tx: "#b0b0b8", txH: "#e8e8f0", txD: "#68687a",
  bd: "#2e2e38", bdL: "#3a3a48", accent: "#6375f0",
};

export default function CampusSelectPage() {
  // Group campuses by university
  const byUniv = {};
  CAMPUS_LIST.forEach(c => {
    const u = c.university || "その他";
    if (!byUniv[u]) byUniv[u] = [];
    byUniv[u].push(c);
  });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter',sans-serif", color: T.txH, display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>キャンパスマップ</h1>
      </div>
      <p style={{ fontSize: 14, color: T.txD, marginBottom: 40, textAlign: "center" }}>
        キャンパスを選択してナビゲーションマップを開きます
      </p>

      {Object.entries(byUniv).map(([univ, campuses]) => (
        <div key={univ} style={{ width: "100%", maxWidth: 600, marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.txD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingLeft: 4 }}>
            {univ}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {campuses.map(c => (
              <a
                key={c.id}
                href={`/${c.id}`}
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "16px 20px", borderRadius: 12,
                  background: T.bg2, border: `1px solid ${T.bd}`,
                  textDecoration: "none", color: T.txH,
                  transition: "all .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.bg3; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.bd; e.currentTarget.style.background = T.bg2; }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10, background: `${T.accent}18`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{c.shortName}</div>
                  <div style={{ fontSize: 11, color: T.txD, marginTop: 2 }}>{c.name}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.txD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      ))}

      {CAMPUS_LIST.length === 0 && (
        <div style={{ fontSize: 14, color: T.txD }}>登録されたキャンパスがありません</div>
      )}
    </div>
  );
}
