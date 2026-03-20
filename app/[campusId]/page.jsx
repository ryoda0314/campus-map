"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { loadCampusData, getCampusIds } from "../../lib/campuses/index.js";
import { useParams } from "next/navigation";

const MapEditor = dynamic(() => import("../../components/MapEditor.jsx"), { ssr: false });

export default function CampusPage() {
  const { campusId } = useParams();
  const [campusData, setCampusData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadCampusData(campusId).then(data => {
      if (data) setCampusData(data);
      else setError(true);
    });
  }, [campusId]);

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#1a1a1f", color: "#b0b0b8", fontFamily: "'Inter',sans-serif", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#e5534b" }}>キャンパスが見つかりません</div>
      <a href="/" style={{ fontSize: 13, color: "#6375f0", textDecoration: "none" }}>トップに戻る</a>
    </div>
  );

  if (!campusData) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#1a1a1f", color: "#68687a", fontFamily: "'Inter',sans-serif" }}>
      読み込み中...
    </div>
  );

  return <MapEditor campusData={campusData} />;
}
