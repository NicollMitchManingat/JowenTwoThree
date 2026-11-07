import { describe,it,expect,vi,afterEach } from 'vitest'
import { authAPI } from '../services/authAPI'
afterEach(()=>vi.unstubAllGlobals())
describe('server authentication',()=>{
 it('uses an HttpOnly cookie session via credentialed requests',async()=>{
  const user={id:'u1',username:'stockman',role:'stockist',permissions:['inventory']}
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({user})}))
  expect(await authAPI.login({username:user.username,password:'test-password'})).toEqual(user)
  expect(fetch).toHaveBeenCalledWith('/api/auth/login',expect.objectContaining({credentials:'include',method:'POST'}))
 })
 it('never grants a local login or manager approval when disconnected',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  await expect(authAPI.login({username:'admin',password:'admin123'})).rejects.toThrow('Failed to fetch')
  await expect(authAPI.verifyManager('admin123')).rejects.toThrow('Failed to fetch')
 })
 it('honors server rejections and clears expired sessions',async()=>{
  const expired=vi.fn();window.addEventListener('jowen-session-expired',expired)
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401,json:async()=>({error:'Invalid credentials'})}))
  await expect(authAPI.me()).rejects.toThrow('Invalid credentials');expect(expired).toHaveBeenCalled()
  window.removeEventListener('jowen-session-expired',expired)
 })
})
