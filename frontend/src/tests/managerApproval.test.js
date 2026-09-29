import { describe, it, expect } from 'vitest'
import { verifyManagerPassword, USERS } from '../services/managerApproval'

describe('managerApproval', () => {
  it('should approve with the admin password', () => {
    expect(verifyManagerPassword('admin123')).toEqual({ success: true, username: 'admin' })
  })

  it('should reject wrong passwords', () => {
    expect(verifyManagerPassword('nope').success).toBe(false)
    expect(verifyManagerPassword('').success).toBe(false)
    expect(verifyManagerPassword(undefined).success).toBe(false)
  })

  it('should reject non-admin passwords (cashier and stockist are not managers)', () => {
    expect(verifyManagerPassword('cashier123').success).toBe(false)
    expect(verifyManagerPassword('stockist123').success).toBe(false)
  })

  it('should keep login credentials in sync with the approval list', () => {
    const admin = USERS.find((u) => u.role === 'admin')
    expect(admin.username).toBe('admin')
    expect(verifyManagerPassword(admin.password).success).toBe(true)
  })
})
