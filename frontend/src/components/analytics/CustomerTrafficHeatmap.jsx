const trafficData = [
  3, 2, 1, 1, 0, 0,
  2, 5, 8, 12, 15, 18,
  20, 22, 19, 16, 13, 15,
  18, 20, 17, 11, 6, 4,
];

function getColor(value) {
  if (value >= 20) return "#166534";
  if (value >= 15) return "#22c55e";
  if (value >= 10) return "#4ade80";
  if (value >= 5) return "#86efac";
  if (value >= 1) return "#dcfce7";

  return "#f3f4f6";
}

export default function CustomerTrafficHeatmap() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "6px",
          width: "100%",
        }}
      >
        {trafficData.map((value, hour) => (
          <div
            key={hour}
            style={{
              background: getColor(value),
              padding: "8px 4px",
              borderRadius: "6px",
              textAlign: "center",
              minHeight: "50px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <strong style={{ fontSize: '0.7rem', display: 'block', marginBottom: '2px' }}>{hour}:00</strong>
            <span style={{ fontSize: '1rem', fontWeight: '600' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}