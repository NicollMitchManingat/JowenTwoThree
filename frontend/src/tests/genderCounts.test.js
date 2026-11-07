import {it,expect,vi,beforeEach} from 'vitest'
import {db} from '../services/db'
import {apiRequest} from '../services/apiClient'
vi.mock('../services/apiClient',()=>({apiRequest:vi.fn(),apiDatabase:{from:vi.fn()}}))
beforeEach(()=>{vi.clearAllMocks();apiRequest.mockResolvedValue({data:{id:'traffic'}})})
it('sends headcounts separately from peso totals to authorized checkout',async()=>{
 const input={orderKey:'stable',total:432,counts:{male:1,female:1,unspecified:0},cart:[]};await db.checkoutOrder(input)
 expect(apiRequest).toHaveBeenCalledWith('/api/commands/checkout',{method:'POST',body:input});expect(input.counts).toEqual({male:1,female:1,unspecified:0})
})
it('derives traffic from the gender split while ignoring a peso total key',async()=>{
 await db.logTraffic({male:1,female:2,unspecified:0,total:999});expect(apiRequest).toHaveBeenCalledWith('/api/commands/traffic',{method:'POST',body:{male:1,female:2,unspecified:0}})
})
it('maps a legacy traffic total to unspecified',async()=>{
 await db.logTraffic(3);expect(apiRequest).toHaveBeenCalledWith('/api/commands/traffic',{method:'POST',body:{male:0,female:0,unspecified:3}})
})
