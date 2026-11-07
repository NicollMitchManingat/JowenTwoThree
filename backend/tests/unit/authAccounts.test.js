import {it,expect} from 'vitest'
const auth=require('../../src/services/authService')
const account={username:'stockman',fullName:'Stockman',role:'stockist',password:'fixture-password',permissions:['inventory']}
it('validates module access while omitting email from the account interface',()=>{
 expect(auth.validateNewAccount(account)).toEqual({username:account.username,fullName:account.fullName,role:'stockist',permissions:['inventory']})
 expect(auth.validateNewAccount({...account,email:'old@example.test'})).not.toHaveProperty('email')
})
it('rejects unknown modules and roles and missing usernames',()=>{
 expect(()=>auth.validateNewAccount({...account,permissions:['database']})).toThrow(/access levels/)
 expect(()=>auth.validateNewAccount({...account,role:'manager'})).toThrow(/role/)
 expect(()=>auth.validateNewAccount({...account,username:' '})).toThrow(/Username/)
 expect(()=>auth.validateNewAccount({...account,password:'123'})).toThrow(/6 characters/)
})
it('requires an authenticated administrator for account writes',async()=>{
 await expect(auth.createAccount(account,{user:{role:'cashier'}})).rejects.toMatchObject({statusCode:403})
})
