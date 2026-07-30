export default function SummaryCard({ title, value, isCurrency = false, icon, color }) {
  const numValue = Number(value);
  const validValue = isNaN(numValue) ? 0 : numValue;
  
  const formattedValue = isCurrency
    ? `₱${validValue.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : validValue.toLocaleString("en-PH");

  return (
    <div className="kpi-card" style={color ? { borderLeft: `4px solid ${color}` } : {}}>
      {icon && <div className="kpi-icon" style={{ color: color || 'var(--color-primary)' }}>{icon}</div>}
      <div>
        <h3 className="kpi-title">{title}</h3>
        <h1 className="kpi-value">{formattedValue}</h1>
      </div>
    </div>
  );
}