export default function SummaryCard({ title, value, isCurrency = false }) {
  const formattedValue = isCurrency
    ? `₱${Number(value).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : Number(value).toLocaleString("en-PH");

  return (
    <div className="kpi-card">
      <h3>{title}</h3>
      <h1>{formattedValue}</h1>
    </div>
  );
}