import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

const options = {
  responsive: true,
  maintainAspectRatio: false,
};

// Default fallback data
const defaultData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      label: "Revenue",
      data: [0, 0, 0, 0, 0, 0, 0],
      borderColor: "#16a34a",
      backgroundColor: "#16a34a",
      tension: 0.4,
      fill: false,
    },
  ],
};

export default function SalesTrendChart({ data }) {
  const chartData = data && data.labels && data.labels.length > 0 ? data : defaultData;
  
  return (
    <div
      data-testid="sales-chart"
      style={{ width: "100%", height: "100%" }}
    >
      <Line data={chartData} options={options} />
    </div>
  );
}