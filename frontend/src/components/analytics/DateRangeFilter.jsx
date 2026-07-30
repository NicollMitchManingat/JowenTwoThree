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
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />

      <span>to</span>

      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
      />
    </div>
  );
}