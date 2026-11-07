import {it,expect,beforeAll,beforeEach} from 'vitest'
import bcrypt from 'bcryptjs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const fake=require('./fixtures/session-database.cjs')
let db,auth,access,storedHash
beforeAll(async()=>{
 storedHash=await bcrypt.hash('fixture-password',10)
 db=fake({app_users:[],app_user_module_permissions:[],auth_sessions:[]})
 const path=require.resolve('../src/config/supabaseClient');require.cache[path]={id:path,filename:path,loaded:true,exports:{supabase:db}}
 for(const name of ['../src/services/accessService','../src/services/authService'])delete require.cache[require.resolve(name)]
 access=require('../src/services/accessService');auth=require('../src/services/authService')
})
beforeEach(()=>{
 db.tables.app_users=[{id:'a1',username:'admin',full_name:'Administrator',role:'admin',is_active:true,password_hash:storedHash},{id:'c1',username:'cashier',role:'cashier',is_active:true,password_hash:storedHash}]
 db.tables.app_user_module_permissions=[{user_id:'c1',module_key:'pos'}];db.tables.auth_sessions=[]
})
it('verifies bcrypt and stores only a token digest, returning no password hash',async()=>{
 const result=await auth.login({username:'cashier',password:'fixture-password'})
 expect(result.user.permissions).toEqual(['pos']);expect(result.user).not.toHaveProperty('password_hash')
 expect(result.token).toMatch(/^[0-9a-f]{64}$/);expect(db.tables.auth_sessions[0].token_hash).toBe(access.hashToken(result.token))
 expect(db.tables.auth_sessions[0].token_hash).not.toBe(result.token)
 expect((await access.authenticate(result.token)).user.id).toBe('c1')
})
it('rejects wrong passwords, missing accounts and deactivated accounts without fallback',async()=>{
 await expect(auth.login({username:'admin',password:'admin123'})).rejects.toMatchObject({statusCode:401})
 await expect(auth.login({username:'missing',password:'fixture-password'})).rejects.toMatchObject({statusCode:401})
 db.tables.app_users[0].is_active=false
 await expect(auth.login({username:'admin',password:'fixture-password'})).rejects.toMatchObject({statusCode:401})
 expect(db.tables.auth_sessions).toHaveLength(0)
})
it('rechecks live module grants and account activity on every session use',async()=>{
 const result=await auth.login({username:'cashier',password:'fixture-password'})
 db.tables.app_user_module_permissions=[];expect((await access.authenticate(result.token)).user.permissions).toEqual([])
 db.tables.app_users[1].is_active=false;await expect(access.authenticate(result.token)).rejects.toMatchObject({statusCode:401})
})
it('rejects expired and revoked tokens',async()=>{
 const result=await auth.login({username:'cashier',password:'fixture-password'})
 db.tables.auth_sessions[0].revoked_at=new Date().toISOString();await expect(access.authenticate(result.token)).rejects.toMatchObject({statusCode:401})
 db.tables.auth_sessions[0].revoked_at=null;db.tables.auth_sessions[0].expires_at='2000-01-01';await expect(access.authenticate(result.token)).rejects.toMatchObject({statusCode:401})
})
it('requires a live administrator to authorize another account',async()=>{
 expect((await auth.verifyManager({password:'fixture-password'})).id).toBe('a1')
 db.tables.app_users[0].is_active=false;await expect(auth.verifyManager({password:'fixture-password'})).rejects.toMatchObject({statusCode:403})
})
