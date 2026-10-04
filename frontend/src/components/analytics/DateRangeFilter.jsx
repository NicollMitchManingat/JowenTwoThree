export default function DateRangeFilter({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}) {
  return (
    <div className="date-filter">
      <input
        type="date"
        className="form-input analytics-date-input"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        aria-label="Start date"
      />

      <span>to</span>

      <input
        type="date"
        className="form-input analytics-date-input"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        aria-label="End date"
      />
    </div>
  );
}