import {it,expect,beforeAll,beforeEach,vi} from 'vitest'
import bcrypt from 'bcryptjs'
import express from 'express'
import request from 'supertest'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const fake=require('./fixtures/session-database.cjs')
let db,auth,access,storedHash,app
beforeAll(async()=>{
 storedHash=await bcrypt.hash('fixture-password',10)
 db=fake({app_users:[],app_user_module_permissions:[],auth_sessions:[]})
 const path=require.resolve('../src/config/supabaseClient');require.cache[path]={id:path,filename:path,loaded:true,exports:{supabase:db}}
 for(const name of ['../src/services/accessService','../src/services/authService'])delete require.cache[require.resolve(name)]
 access=require('../src/services/accessService');auth=require('../src/services/authService')
 app=express();app.use(express.json());app.use('/api/auth',require('../src/routes/auth'))
 app.use((err,_req,res,_next)=>res.status(err.statusCode||500).json({error:err.message,code:err.code}))
})
beforeEach(()=>{
 db.tables.app_users=[{id:'a1',username:'admin',full_name:'Administrator',role:'admin',is_active:true,password_hash:storedHash},{id:'c1',username:'cashier',role:'cashier',is_active:true,password_hash:storedHash}]
 db.tables.app_user_module_permissions=[{user_id:'c1',module_key:'pos'}];db.tables.auth_sessions=[]
 db.rpc=vi.fn(async(_name,args)=>({data:{...db.tables.app_users.find(u=>u.id===args.p_id),...args.p_data},error:null}))
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
it('rejects missing, wrong and non-text current passwords before writing',async()=>{
 const session={user:{id:'a1',role:'admin'},tokenHash:'server-token-digest'}
 for(const currentPassword of [undefined,'wrong-password',{}]) {
  await expect(auth.updateAccount('c1',{password:'new-password',currentPassword},session)).rejects.toMatchObject({statusCode:currentPassword==='wrong-password'?403:400})
 }
 expect(db.rpc).not.toHaveBeenCalled();expect(db.tables.app_users[1].password_hash).toBe(storedHash)
})
it('verifies the target account password, not the editing administrator password',async()=>{
 db.tables.app_users[1].password_hash=await bcrypt.hash('cashier-password',10)
 const session={user:{id:'a1',role:'admin'},tokenHash:'server-token-digest'}
 await expect(auth.updateAccount('c1',{password:'new-password',currentPassword:'fixture-password'},session)).rejects.toMatchObject({code:'CURRENT_PASSWORD_INCORRECT'})
 await auth.updateAccount('c1',{password:'new-password',currentPassword:'cashier-password',expected_password_hash:'browser-forgery'},session)
 const args=db.rpc.mock.calls[0][1]
 expect(args.p_data.expected_password_hash).toBe(db.tables.app_users[1].password_hash)
 expect(args.p_data).not.toHaveProperty('currentPassword');expect(args.p_data).not.toHaveProperty('password')
 expect(await bcrypt.compare('new-password',args.p_data.password_hash)).toBe(true)
})
it('keeps metadata-only edits password-free and does not accept raw hash fields',async()=>{
 const result=await auth.updateAccount('c1',{fullName:'Cashier Name',password_hash:'browser-forgery',expected_password_hash:'browser-forgery'},{user:{id:'a1',role:'admin'},tokenHash:'server-token-digest'})
 expect(db.rpc.mock.calls[0][1].p_data).toMatchObject({full_name:'Cashier Name',password_hash:null,expected_password_hash:null})
 expect(result).not.toHaveProperty('password_hash');expect(result).not.toHaveProperty('expected_password_hash')
})
it('reports concurrent password changes without treating them as expired login sessions',async()=>{
 db.rpc.mockResolvedValueOnce({data:null,error:{message:'PASSWORD_CHANGED'}})
 await expect(auth.updateAccount('c1',{password:'new-password',currentPassword:'fixture-password'},{user:{id:'a1',role:'admin'},tokenHash:'server-token-digest'})).rejects.toMatchObject({statusCode:409,code:'PASSWORD_CHANGED'})
})
it('creates new accounts without a current password and retains password validation',async()=>{
 await auth.createAccount({username:'new-cashier',role:'cashier',permissions:['pos'],password:'new-password'},{user:{id:'a1',role:'admin'},tokenHash:'server-token-digest'})
 expect(db.rpc.mock.calls[0][1].p_id).toBeNull();expect(db.rpc.mock.calls[0][1].p_data.expected_password_hash).toBeNull()
 await expect(auth.updateAccount('c1',{password:{}},{user:{id:'a1',role:'admin'}})).rejects.toThrow('Password must be text')
})
it('keeps login throttling active and requires admin access to account updates',async()=>{
 const result=await request(app).post('/api/auth/login').send({username:'cashier',password:'fixture-password'})
 expect(result.status).toBe(200);expect(result.headers['set-cookie'][0]).toMatch(/HttpOnly/)
 const denied=await request(app).patch('/api/auth/users/a1').set('Cookie',result.headers['set-cookie']).send({password:'new-password',currentPassword:'fixture-password'})
 expect(denied.status).toBe(403);expect(db.rpc).not.toHaveBeenCalled()
 const middleware=require('../src/middleware/authentication');expect(middleware.throttle.length).toBe(3)
})
it('clears the cookie only after changing the signed-in administrator password',async()=>{
 const token=await access.createSession('a1')
 const result=await request(app).patch('/api/auth/users/a1').set('Cookie',`jowen_session=${token}`).send({password:'new-password',currentPassword:'fixture-password'})
 expect(result.status).toBe(200);expect(result.body.reauthenticate).toBe(true);expect(result.headers['set-cookie'][0]).toMatch(/Max-Age=0/)
 expect(JSON.stringify(result.body)).not.toMatch(/password_hash|fixture-password|new-password/)
})
it('throttles repeated password guesses across sessions without throttling metadata edits',async()=>{
 db.tables.app_users[0].id='rate-admin'
 const token=await access.createSession('rate-admin')
 for(let i=0;i<10;i++) {
  const result=await request(app).patch('/api/auth/users/c1').set('Cookie',`jowen_session=${token}`).send({password:'new-password'})
  expect(result.status).toBe(400)
 }
 const otherToken=await access.createSession('rate-admin')
 const blocked=await request(app).patch('/api/auth/users/C1').set('Cookie',`jowen_session=${otherToken}`).send({password:'new-password',currentPassword:'fixture-password'})
 expect(blocked.status).toBe(429)
 const metadata=await request(app).patch('/api/auth/users/c1').set('Cookie',`jowen_session=${otherToken}`).send({fullName:'Cashier Name'})
 expect(metadata.status).toBe(200)
})
