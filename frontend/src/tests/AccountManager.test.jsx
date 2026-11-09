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
 expect(authAPI.updateUser.mock.calls[0][1]).not.toHaveProperty('email');expect(authAPI.updateUser.mock.calls[0][1]).not.toHaveProperty('password');expect(authAPI.updateUser.mock.calls[0][1]).not.toHaveProperty('currentPassword')
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
it('requires both passwords when changing an existing account password',async()=>{
 const u=userEvent.setup();render(<AccountManager currentUser={admin}/>);await screen.findByTestId('account-edit-s');await u.click(screen.getByTestId('account-edit-s'))
 const current=screen.getByLabelText('Current password'),next=screen.getByTestId('account-password-input')
 await u.type(next,'new-password');await u.click(screen.getByTestId('account-save-btn'));expect(current).toBeInvalid();expect(authAPI.updateUser).not.toHaveBeenCalled()
 await u.clear(next);await u.type(current,'old-password');await u.click(screen.getByTestId('account-save-btn'));expect(next).toBeInvalid();expect(authAPI.updateUser).not.toHaveBeenCalled()
 await u.type(next,'new-password');await u.click(screen.getByTestId('account-save-btn'))
 await waitFor(()=>expect(authAPI.updateUser).toHaveBeenCalledWith('s',expect.objectContaining({currentPassword:'old-password',password:'new-password'})))
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('shows a rejected current password without closing the form',async()=>{
 authAPI.updateUser.mockRejectedValueOnce(new Error('Current password is incorrect'))
 const u=userEvent.setup();render(<AccountManager currentUser={admin}/>);await screen.findByTestId('account-edit-s');await u.click(screen.getByTestId('account-edit-s'))
 await u.type(screen.getByLabelText('Current password'),'wrong-password');await u.type(screen.getByTestId('account-password-input'),'new-password');await u.click(screen.getByTestId('account-save-btn'))
 expect(await screen.findByTestId('account-form-error')).toHaveTextContent('Current password is incorrect');expect(screen.getByRole('dialog')).toBeVisible()
})
it('toggles passwords independently and clears secrets and visibility on close',async()=>{
 const u=userEvent.setup();render(<AccountManager currentUser={admin}/>);await screen.findByTestId('account-edit-s');await u.click(screen.getByTestId('account-edit-s'))
 await u.type(screen.getByLabelText('Current password'),'old-password');await u.type(screen.getByTestId('account-password-input'),'new-password')
 await u.click(screen.getByRole('button',{name:'Show current password'}));expect(screen.getByLabelText('Current password')).toHaveAttribute('type','text');expect(screen.getByTestId('account-password-input')).toHaveAttribute('type','password')
 await u.click(screen.getByRole('button',{name:'Show new password'}));expect(screen.getByTestId('account-password-input')).toHaveAttribute('type','text')
 await u.click(screen.getByRole('button',{name:'Hide current password'}));expect(screen.getByLabelText('Current password')).toHaveAttribute('type','password')
 await u.click(screen.getByRole('button',{name:'Cancel'}));await u.click(screen.getByTestId('account-edit-s'))
 expect(screen.getByLabelText('Current password')).toHaveValue('');expect(screen.getByTestId('account-password-input')).toHaveValue('');expect(screen.getByTestId('account-password-input')).toHaveAttribute('type','password')
})
it('creates an account with a visibility toggle and no current-password field or payload',async()=>{
 const u=userEvent.setup();render(<AccountManager currentUser={admin}/>);await screen.findByTestId('account-add-btn');await u.click(screen.getByTestId('account-add-btn'))
 expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
 await u.type(screen.getByTestId('account-username-input'),'new-cashier');await u.type(screen.getByTestId('account-password-input'),'new-password');await u.click(screen.getByRole('button',{name:'Show password'}))
 expect(screen.getByTestId('account-password-input')).toHaveAttribute('type','text');await u.click(screen.getByTestId('account-save-btn'))
 await waitFor(()=>expect(authAPI.createUser).toHaveBeenCalled());expect(authAPI.createUser.mock.calls[0][0]).not.toHaveProperty('currentPassword')
})
