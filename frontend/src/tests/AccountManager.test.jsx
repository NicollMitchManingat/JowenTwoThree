import { it,expect,vi,beforeEach } from 'vitest'
import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountManager from '../components/settings/AccountManager'
import { authAPI } from '../services/authAPI'
vi.mock('../services/authAPI',()=>({authAPI:{listUsers:vi.fn(),createUser:vi.fn(),updateUser:vi.fn()}}))
const admin={id:'a',username:'admin',role:'admin',isActive:true,permissions:['pos','inventory','transactions','analytics','settings']}
const staff={id:'s',username:'stockman',fullName:'Stockman',role:'stockist',isActive:true,permissions:['inventory']}
beforeEach(()=>{vi.clearAllMocks();authAPI.listUsers.mockResolvedValue([admin,staff]);authAPI.createUser.mockResolvedValue({});authAPI.updateUser.mockResolvedValue({})})
it('loads accounts using the authenticated admin session and replaces email with access level',async()=>{
 render(<AccountManager currentUser={admin}/>);expect(await screen.findByTestId('account-row-s')).toHaveTextContent('stockman')
 expect(screen.getByText('Access Level')).toBeInTheDocument();expect(screen.queryByText('Email')).not.toBeInTheDocument()
 expect(authAPI.listUsers).toHaveBeenCalledWith();expect(screen.queryByTestId('account-unlock-password')).not.toBeInTheDocument()
})
it('edits names and module grants without sending email or existing passwords',async()=>{
 const u=userEvent.setup();render(<AccountManager currentUser={admin}/>);await screen.findByTestId('account-row-s');await u.click(screen.getByTestId('account-edit-s'))
 await u.click(screen.getByLabelText('Transactions'));await u.click(screen.getByTestId('account-save-btn'))
 await waitFor(()=>expect(authAPI.updateUser).toHaveBeenCalledWith('s',expect.objectContaining({username:'stockman',permissions:['inventory','transactions']})))
 expect(authAPI.updateUser.mock.calls[0][1]).not.toHaveProperty('email');expect(authAPI.updateUser.mock.calls[0][1]).not.toHaveProperty('password')
})
it('cannot disable or demote the currently signed-in admin from the form',async()=>{
 const u=userEvent.setup();render(<AccountManager currentUser={admin}/>);await screen.findByTestId('account-edit-a')
 expect(screen.queryByTestId('account-toggle-a')).not.toBeInTheDocument();await u.click(screen.getByTestId('account-edit-a'))
 expect(screen.getByTestId('account-role-select')).toBeDisabled()
})
it('shows backend permission failures',async()=>{
 authAPI.listUsers.mockRejectedValue(new Error('Administrator access is required'));render(<AccountManager currentUser={admin}/>)
 expect(await screen.findByRole('alert')).toHaveTextContent('Administrator access is required')
})
