import '../styles/Sidebar.css'

const menuItems = [
  { id: 'POS', label: 'POS', icon: '🛒' },
  { id: 'Inventory', label: 'Inventory', icon: '📦' },
  { id: 'Orders', label: 'Orders', icon: '🧾' },
  { id: 'Settings', label: 'Settings', icon: '⚙️' }
]

export default function Sidebar({
  activeMenu,
  onMenuChange,
  onLogout,
  user
}) {
  return (
    <div className="sidebar" data-testid="sidebar">
      <div className="sidebar-header">
        <h2>Jowen</h2>
        <p className="user-info" data-testid="user-info">
          {user?.username || 'User'}
        </p>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`menu-item ${
              activeMenu === item.id ? 'active' : ''
            }`}
            onClick={() =>
              onMenuChange && onMenuChange(item.id)
            }
            data-testid={`menu-${item.id.toLowerCase()}`}
          >
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="logout-button"
          onClick={onLogout}
          data-testid="logout-button"
        >
          Logout
        </button>
      </div>
    </div>
  )
}