export const MODULES = [
  { id: 'pos', label: 'POS & Traffic' }, { id: 'inventory', label: 'Inventory' },
  { id: 'transactions', label: 'Transactions' }, { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
]
export const hasAccess = (user, module) => !!user && user.isActive !== false &&
  (user.role === 'admin' || user.permissions?.includes(module))
export const pageModule = { pos: 'pos', inventory: 'inventory', orders: 'transactions', reports: 'analytics', settings: 'settings' }
export const firstPage = user => Object.keys(pageModule).find(page => hasAccess(user, pageModule[page])) || null
