export default function LoadingSkeleton() {
  return (
    <div
      data-testid="loading-skeleton"
      style={{
        height: "250px",
        borderRadius: "10px",
        background: "#e5e7eb",
        animation: "pulse 1.5s infinite",
      }}
    />
  );
}