import Sidebar from "./components/Sidebar";
import POSLayout from "./components/POSLayout";
import ProductPage from "./components/ProductPage";
import OrderSummary from "./components/OrderSummary";
import CustomerRecordingButton from "./components/CustomerRecordingButton";
import Login from "./components/Login";

function App() {
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content */}
      <main className="main-content">
        <POSLayout />

        <section className="pos-features">
          <ProductPage />
          <OrderSummary />
          <CustomerRecordingButton />
        </section>

        {/* Optional Login section (if needed for auth page view) */}
        <section className="login-section">
          <Login />
        </section>
      </main>
    </div>
  );
}

export default App;