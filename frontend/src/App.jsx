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
import { USERS } from './services/managerApproval';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('jowen_user');
      const user = saved ? JSON.parse(saved) : null;
      // Legacy sessions stored role 'staff' — map to cashier so old logins keep working.
      if (user && user.role === 'staff') user.role = 'cashier';
      return user;
    } catch {
      return null;
    }
  });
  const defaultPageFor = (role) => (role === 'stockist' ? 'inventory' : 'pos');
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const saved = localStorage.getItem('jowen_user');
      const user = saved ? JSON.parse(saved) : null;
      const role = user?.role === 'staff' ? 'cashier' : user?.role;
      return defaultPageFor(role);
    } catch {
      return 'pos';
    }
  });
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  // Credentials live in managerApproval.js so manager-approval checks
  // always verify against the same admin password used at login.
  const [users] = useState(USERS);

  const handleLogin = (credentials) => {
    if (credentials && credentials.username) {
      const user = users.find(u => u.username === credentials.username);
      const loggedInUser = user || { username: credentials.username, role: 'cashier' };
      if (loggedInUser.role === 'staff') loggedInUser.role = 'cashier';
      localStorage.setItem('jowen_user', JSON.stringify(loggedInUser));
      setCurrentUser(loggedInUser);
      setCurrentPage(defaultPageFor(loggedInUser.role));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jowen_user');
    setCurrentUser(null);
  };

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
    { id: 'settings', label: 'Settings', icon: Settings, allowedRoles: ['admin', 'cashier', 'stockist'] },
  ];

  const visibleMenuItems = menuItems.filter(item => item.allowedRoles.includes(currentUser.role));

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
    const page = allowed ? currentPage : defaultPageFor(currentUser.role);
    switch (page) {
      case 'pos':
        return <MainPOS user={currentUser} />;
      case 'inventory':
        return <InventoryPage userRole={currentUser.role} />;
      case 'orders':
        return <OrderHistoryPage user={currentUser} />;
      case 'reports':
        return currentUser.role === 'admin' ? <AnalyticsProvider><DashboardContent activeTab="Sales" user={currentUser} /></AnalyticsProvider> : <MainPOS user={currentUser} />;
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
            <div onClick={handleMenuToggle} style={{ cursor: 'pointer', display: 'flex' }} title="Toggle Menu">
              {isDesktopCollapsed ? <Menu size={24} color="var(--color-accent)" /> : <Coffee size={24} color="var(--color-accent)" />}
            </div>
            <span className="logo-text">Jowen's Cafe</span>
          </h1>
          <button className="mobile-close-btn" onClick={() => setIsMobileOpen(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar-nav">
          {visibleMenuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button key={item.id} className={`nav-item ${currentPage === item.id ? 'active' : ''}`} onClick={() => handleNavClick(item.id)}>
                <IconComponent size={20} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="flex items-center gap-4">
            <button className="menu-toggle desktop-hidden" onClick={handleMenuToggle}><Menu size={20} /></button>
            <h2>{visibleMenuItems.find(i => i.id === currentPage)?.label || "Jowen's Cafe"}</h2>
          </div>
          <div className="header-actions">
            <div className="user-profile">
              <div className="avatar">{currentUser.username?.charAt(0)}</div>
              <span className="user-role-text" style={{ textTransform: 'capitalize' }}>{currentUser.username}</span>
            </div>
            <button className="btn-icon-small text-danger" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
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
