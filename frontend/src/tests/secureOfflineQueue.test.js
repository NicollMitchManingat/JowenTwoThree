import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { offlineQueue, processQueue } from '../services/offlineQueue'
import { apiRequest } from '../services/apiClient'
vi.mock('../services/apiClient', () => ({ apiRequest: vi.fn(), currentActorId: vi.fn(() => 'u1') }))
beforeEach(() => { vi.restoreAllMocks(); apiRequest.mockReset() })
afterEach(() => vi.restoreAllMocks())
it('preserves legacy operations and operations belonging to another user', async () => {
 vi.spyOn(offlineQueue, 'dequeueAll').mockResolvedValue([{ id: 1, method: 'sale' }, { id: 2, method: 'authorized-inventory', actorId: 'other', body: {} }])
 const remove=vi.spyOn(offlineQueue,'remove').mockResolvedValue(), clear=vi.spyOn(offlineQueue,'clear').mockResolvedValue()
 apiRequest.mockResolvedValue({user:{id:'u1'}})
 await processQueue()
 expect(apiRequest).toHaveBeenCalledTimes(1);expect(remove).not.toHaveBeenCalled();expect(clear).not.toHaveBeenCalled()
})
it('acknowledges only successful operations and retains failed and unprocessed entries',async()=>{
 vi.spyOn(offlineQueue,'dequeueAll').mockResolvedValue([1,2,3].map(id=>({id,method:'authorized-inventory',actorId:'u1',body:{operationKey:String(id),expectedUnitVersion:'0'}})))
 const remove=vi.spyOn(offlineQueue,'remove').mockResolvedValue()
 apiRequest.mockResolvedValueOnce({user:{id:'u1'}}).mockResolvedValueOnce({data:{}}).mockRejectedValueOnce(Object.assign(new Error('Unit version changed'), {status:409}))
 await processQueue()
 expect(remove.mock.calls).toEqual([[1]]);expect(apiRequest).toHaveBeenCalledTimes(3)
 expect(apiRequest).toHaveBeenCalledWith('/api/commands/inventory',{method:'POST',body:{operationKey:'2',expectedUnitVersion:'0'}})
})
