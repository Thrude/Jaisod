import { Link, Route, Routes } from 'react-router-dom';
import MenuPage from './pages/customer/MenuPage';
import CartPage from './pages/customer/CartPage';
import OrderPage from './pages/customer/OrderPage';
import Login from './pages/vendor/Login';
import Onboarding from './pages/vendor/Onboarding';
import VendorLayout from './pages/vendor/VendorLayout';
import Dashboard from './pages/vendor/Dashboard';
import MenuManager from './pages/vendor/MenuManager';
import Poster from './pages/vendor/Poster';
import Summary from './pages/vendor/Summary';
import { LangToggle, useLang } from './lib/i18n';

function Landing() {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="absolute right-4 top-4"><LangToggle /></div>
      <h1 className="text-5xl font-bold text-orange-600">จ่ายสด</h1>
      <p className="text-xl text-stone-600">{t('tagline')}</p>
      <Link to="/vendor" className="rounded-2xl bg-orange-600 px-8 py-4 text-lg font-semibold text-white shadow">
        {t('forVendors')} →
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/s/:vendorId" element={<MenuPage />} />
      <Route path="/s/:vendorId/cart" element={<CartPage />} />
      <Route path="/o/:orderId" element={<OrderPage />} />
      <Route path="/vendor/login" element={<Login />} />
      <Route path="/vendor/onboarding" element={<Onboarding />} />
      <Route path="/vendor" element={<VendorLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="menu" element={<MenuManager />} />
        <Route path="poster" element={<Poster />} />
        <Route path="summary" element={<Summary />} />
      </Route>
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
