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

const data = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      label: "Revenue",
      data: [12500, 15800, 14100, 17900, 20100, 22300, 19500],
      borderColor: "#16a34a",
      backgroundColor: "#16a34a",
      tension: 0.4,
      fill: false,
    },
  ],
};

const options = {
  responsive: true,
  maintainAspectRatio: false,
};

export default function SalesTrendChart() {
  return (
    <div
      data-testid="sales-chart"
      style={{ width: "100%", height: "250px" }}
    >
      <Line data={data} options={options} />
    </div>
  );
}