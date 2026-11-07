import { it,expect } from 'vitest'
import * as approval from '../services/managerApproval'
it('exports role names without browser passwords or a local approval bypass',()=>{
 expect(approval.ROLES).toEqual(['admin','cashier','stockist'])
 expect(approval.USERS).toBeUndefined();expect(approval.verifyManagerPassword).toBeUndefined()
})
