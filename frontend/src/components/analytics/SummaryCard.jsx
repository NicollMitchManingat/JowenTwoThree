export default function SummaryCard({ title, value, isCurrency = false, icon, color, sub }) {
  const numValue = Number(value);
  const validValue = isNaN(numValue) ? 0 : numValue;
  
  const formattedValue = isCurrency
    ? `₱${validValue.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : validValue.toLocaleString("en-PH");

  return (
    <div className="kpi-card analytics-summary-card" style={{ '--kpi-accent': color || 'var(--color-primary)' }}>
      <div className="kpi-card-heading">
        <h3 className="kpi-title">{title}</h3>
        {icon && <span className="kpi-icon" aria-hidden="true">{icon}</span>}
      </div>
      <p className="kpi-value" tabIndex={0} title={`${title}: ${formattedValue}`}>{formattedValue}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  );
}
