// Manager (admin) approval for sensitive actions like refunds.
// Single source of truth for POS credentials — App.jsx login reads the
// same list, so the approval password is always the admin's real password
// (no second PIN/secret to drift out of sync). Session is never switched:
// approval only returns { success, username } for audit (approved_by).

export const USERS = [
  { id: 1, username: 'admin', password: 'admin123', email: 'admin@jowen.com', role: 'admin' },
  { id: 2, username: 'staff', password: 'staff123', email: 'staff@jowen.com', role: 'staff' },
]

export const ADMIN_USERNAME = 'admin'

// Staff triggering an admin-only action calls this with the manager's
// password. Resolves to the admin username on success for approved_by audit.
export function verifyManagerPassword(password) {
  const admin = USERS.find((u) => u.username === ADMIN_USERNAME && u.role === 'admin')
  if (admin && typeof password === 'string' && password === admin.password) {
    return { success: true, username: admin.username }
  }
  return { success: false, error: 'Manager approval failed: incorrect admin password' }
}
