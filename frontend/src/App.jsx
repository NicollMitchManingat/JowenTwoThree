import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Package, ClipboardList, Settings,
  Coffee, Plus, Minus, Users, Tag, X, Search, Edit, Trash2,
  TrendingUp, Receipt, Lock, ShieldAlert, Play, Square,
  RefreshCcw, CakeSlice, Menu, Sparkles, LogOut, UserCog, Clock, BrainCircuit, Send
} from 'lucide-react';
import './App.css';
import LoginPage from './pages/LoginPage';
import MainPOS from './pages/MainPOS';
import InventoryPage from './pages/InventoryPage';
import SettingsPage from './pages/SettingsPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import { AnalyticsProvider } from './pages/AnalyticsContext';
import DashboardContent from './pages/DashboardContent';
import { authAPI } from './services/authAPI';
import { hasAccess, pageModule, firstPage } from './services/permissions';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentPage, setCurrentPage] = useState(null);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [queueNeedsReview, setQueueNeedsReview] = useState(false);
  const handleLogin = (user) => {
    localStorage.removeItem('jowen_user');
    setCurrentUser(user);
    setCurrentPage(firstPage(user));
  };
  useEffect(() => {
    let active = true;
    const refresh = () => authAPI.me().then(user => {
      if (active) { setCurrentUser(user); setCurrentPage(page => hasAccess(user, pageModule[page]) ? page : firstPage(user)); }
    }).catch(err => { if (active && err.status === 401) setCurrentUser(null); }).finally(() => { if (active) setCheckingSession(false); });
    const expired = () => { setCurrentUser(null); localStorage.removeItem('jowen_user'); };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('jowen-session-expired', expired);
    const queueReview = () => setQueueNeedsReview(true);
    window.addEventListener('jowen-queue-review', queueReview);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('jowen-session-expired', expired); window.removeEventListener('jowen-queue-review', queueReview); };
  }, []);
  const handleLogout = async () => {
    try {
      await authAPI.logout();
      localStorage.removeItem('jowen_user');
      setCurrentUser(null);
    } catch (err) { window.alert(err.message || 'Sign out failed. Reconnect and try again.'); }
  };

  if (checkingSession) return <p className="page-content">Checking your session…</p>;

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Cashier: POS + Transactions (stock alerts via the POS bell).
  // Stockist: Inventory + Transactions (no POS, no refunds).
  // Admin: everything.
  const menuItems = [
    { id: 'pos', label: 'POS & Traffic', icon: ShoppingCart, allowedRoles: ['admin', 'cashier'] },
    { id: 'inventory', label: 'Inventory', icon: Package, allowedRoles: ['admin', 'stockist'] },
    { id: 'orders', label: 'Transactions', icon: ClipboardList, allowedRoles: ['admin', 'cashier', 'stockist'] },
    { id: 'reports', label: 'Analytics', icon: Sparkles, allowedRoles: ['admin'] },
    { id: 'settings', label: currentUser.role === 'admin' ? 'Management' : 'Settings', icon: Settings, allowedRoles: ['admin', 'cashier', 'stockist'] },
  ];

  const visibleMenuItems = menuItems.filter(item => hasAccess(currentUser, pageModule[item.id]));

  const handleNavClick = (id) => {
    setCurrentPage(id);
    setIsMobileOpen(false);
  };

  const handleMenuToggle = () => {
    if (window.innerWidth <= 768) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      setIsDesktopCollapsed(!isDesktopCollapsed);
    }
  };

  const renderContent = () => {
    // Guard: roles can only render pages in their nav (e.g. stockist has no POS).
    const allowed = visibleMenuItems.some(item => item.id === currentPage);
    const page = allowed ? currentPage : firstPage(currentUser);
    if (!page) return <div className="page-content"><p>No modules have been assigned to your account. Ask an administrator to update your Access Level.</p><button className="btn btn-secondary" onClick={handleLogout}>Sign out</button></div>;
    switch (page) {
      case 'pos':
        return <MainPOS user={currentUser} />;
      case 'inventory':
        return <InventoryPage userRole={currentUser.role} />;
      case 'orders':
        return <OrderHistoryPage user={currentUser} />;
      case 'reports':
        return <AnalyticsProvider><DashboardContent activeTab="Sales" user={currentUser} onNavigate={handleNavClick} /></AnalyticsProvider>;
      case 'settings':
        return <SettingsPage currentUser={currentUser} onLogout={handleLogout} />;
      default:
        return <MainPOS user={currentUser} />;
    }
  };

  return (
    <div className="app-container">
      <div className={`sidebar-overlay ${isMobileOpen ? 'show' : ''}`} onClick={() => setIsMobileOpen(false)}></div>

      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''} ${isDesktopCollapsed ? 'desktop-collapsed' : ''}`}>
        <div className="sidebar-header">
          <h1>
            <button className="sidebar-logo-badge" onClick={handleMenuToggle} title="Toggle Menu" aria-label="Toggle Menu">
              {isDesktopCollapsed ? <Menu size={20} /> : <Coffee size={20} />}
            </button>
            <span className="sidebar-brand-text">
              <span className="logo-text">Jowen's Cafe</span>
              <span className="sidebar-brand-sub">POS SYSTEM</span>
            </span>
          </h1>
          <button className="mobile-close-btn" onClick={() => setIsMobileOpen(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar-nav">
          <p className="nav-section-label">MENU</p>
          {visibleMenuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button key={item.id} className={`nav-item ${currentPage === item.id ? 'active' : ''}`} onClick={() => handleNavClick(item.id)}>
                <IconComponent size={20} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{currentUser.username?.charAt(0)}</div>
          <div className="sidebar-footer-meta">
            <span className="sidebar-footer-name">{currentUser.username}</span>
            <span className="sidebar-footer-role">{currentUser.role === 'stockist' ? 'Stockman' : currentUser.role}</span>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout} title="Logout" aria-label="Log out of POS">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        {queueNeedsReview && <p className="text-danger page-content" role="status">Some offline changes are preserved. An administrator must review them before they can sync.</p>}
        <header className="top-header">
          <div className="flex items-center gap-4">
            <button className="menu-toggle desktop-hidden" onClick={handleMenuToggle}><Menu size={20} /></button>
            <h2>{visibleMenuItems.find(i => i.id === currentPage)?.label || "Jowen's Cafe"}</h2>
          </div>
        </header>
        <div className={`page-container${currentPage !== 'pos' ? ' page-container--scroll' : ''}`}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
