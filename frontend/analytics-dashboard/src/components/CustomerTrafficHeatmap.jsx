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
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6,1fr)",
          gap: "8px",
        }}
      >
        {trafficData.map((value, hour) => (
          <div
            key={hour}
            style={{
              background: getColor(value),
              padding: "16px",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <strong>{hour}:00</strong>

            <br />

            {value}
          </div>
        ))}
      </div>
    </div>
  );
}