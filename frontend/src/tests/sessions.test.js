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
it('filters session dates before limiting, using an exclusive next Manila midnight',async()=>{
 const query={select:vi.fn(),gte:vi.fn(),lt:vi.fn(),order:vi.fn(),limit:vi.fn(),abortSignal:vi.fn()}
 for(const method of ['select','gte','lt','order','limit'])query[method].mockReturnValue(query)
 query.abortSignal.mockResolvedValue({data:[{id:'older'}],error:null});apiDatabase.from.mockReturnValue(query)
 expect(await db.getSessions(100,{date:'2026-10-15'})).toEqual([{id:'older'}])
 expect(query.gte).toHaveBeenCalledWith('started_at','2026-10-14T16:00:00.000Z')
 expect(query.lt).toHaveBeenCalledWith('started_at','2026-10-15T16:00:00.000Z')
 expect(query.gte.mock.invocationCallOrder[0]).toBeLessThan(query.limit.mock.invocationCallOrder[0])
})
it('rejects invalid calendar dates without sending a database request',async()=>{
 await expect(db.getSessions(100,{date:'2026-02-30'})).rejects.toThrow('Choose a valid session date')
 expect(apiDatabase.from).not.toHaveBeenCalled()
})
