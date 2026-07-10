export default function Loading() {
  return (
    <div className="skwrap">
      {/* رأس الصفحة */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div className="skel" style={{ width: 180, height: 26, marginBottom: 8 }} />
          <div className="skel" style={{ width: 120, height: 13 }} />
        </div>
        <div className="skel" style={{ width: 130, height: 40, borderRadius: 10 }} />
      </div>
      {/* كروت أرقام */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div className="skel" style={{ width: "60%", height: 12, marginBottom: 10 }} />
            <div className="skel" style={{ width: "45%", height: 24 }} />
          </div>
        ))}
      </div>
      {/* جدول */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skrow">
            <div className="skel" style={{ width: "22%", height: 15 }} />
            <div className="skel" style={{ width: "18%", height: 15 }} />
            <div className="skel" style={{ width: "16%", height: 15 }} />
            <div className="skel" style={{ width: "14%", height: 15 }} />
            <div className="skel" style={{ marginInlineStart: "auto", width: 70, height: 22, borderRadius: 20 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
