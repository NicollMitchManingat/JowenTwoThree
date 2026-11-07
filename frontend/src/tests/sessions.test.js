import {it,expect,vi,beforeEach} from 'vitest'
import {db} from '../services/db'
import {apiRequest,apiDatabase} from '../services/apiClient'
vi.mock('../services/apiClient',()=>({apiRequest:vi.fn(),apiDatabase:{from:vi.fn()}}))
beforeEach(()=>vi.resetAllMocks())
it('uses the authorized session command and never trusts browser actor names',async()=>{
 apiRequest.mockResolvedValue({data:{id:'s1'}});expect(await db.startSession({by:'forged-admin',managerPassword:'test-password'})).toEqual({id:'s1'})
 expect(apiRequest).toHaveBeenCalledWith('/api/commands/shop-session',{method:'POST',body:{action:'start',managerPassword:'test-password'}})
 expect(apiDatabase.from).not.toHaveBeenCalled()
})
it('sends approval with the final session-close command',async()=>{
 apiRequest.mockResolvedValue({data:{id:'s1',ended_at:'now'}});await db.endSession('s1',{managerPassword:'test-password'})
 expect(apiRequest).toHaveBeenCalledWith('/api/commands/shop-session',{method:'POST',body:{action:'end',id:'s1',managerPassword:'test-password'}})
})
it('does not retry a failed authorization using a legacy unapproved insert',async()=>{
 apiRequest.mockRejectedValue(new Error('APPROVAL_REQUIRED'));await expect(db.startSession({managerPassword:'wrong'})).rejects.toThrow('APPROVAL_REQUIRED');expect(apiRequest).toHaveBeenCalledTimes(1)
})
