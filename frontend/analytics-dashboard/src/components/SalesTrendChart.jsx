import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const mockSales = [
  { day: "Mon", sales: 4200 },
  { day: "Tue", sales: 5100 },
  { day: "Wed", sales: 4800 },
  { day: "Thu", sales: 6500 },
  { day: "Fri", sales: 7200 },
  { day: "Sat", sales: 8900 },
  { day: "Sun", sales: 8100 },
];

export default function SalesTrendChart() {
  return (
    <div data-testid="sales-chart">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={mockSales}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#16a34a"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}