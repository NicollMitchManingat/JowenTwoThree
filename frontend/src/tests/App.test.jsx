import {it,expect,vi,beforeEach} from 'vitest'
import {render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import {authAPI} from '../services/authAPI'
vi.mock('../services/db',()=>({db:{getProducts:vi.fn().mockResolvedValue([]),getCategories:vi.fn().mockResolvedValue([]),getActiveDiscounts:vi.fn().mockResolvedValue([]),getLowStockItems:vi.fn().mockResolvedValue([]),getOutOfStockItems:vi.fn().mockResolvedValue([]),getInventory:vi.fn().mockResolvedValue([]),getTransactions:vi.fn().mockResolvedValue([]),getRefundsForTransactions:vi.fn().mockResolvedValue([])}}))
vi.mock('../services/authAPI',()=>({authAPI:{me:vi.fn(),login:vi.fn(),logout:vi.fn()}}))

beforeEach(()=>{vi.clearAllMocks();localStorage.clear();authAPI.me.mockRejectedValue(new Error('Sign in'));authAPI.logout.mockResolvedValue({})})
it('ignores forged localStorage identities',async()=>{
 localStorage.setItem('jowen_user',JSON.stringify({role:'admin'}));render(<App/>);expect(await screen.findByTestId('login-button')).toBeInTheDocument()
 expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})
it('logs in through the backend and revokes the session when signing out',async()=>{
 authAPI.login.mockResolvedValue({id:'a',username:'admin',role:'admin'});const u=userEvent.setup();render(<App/>);
 await u.type(await screen.findByTestId('username-input'),'admin');await u.type(screen.getByTestId('password-input'),'test-password');await u.click(screen.getByTestId('login-button'))
 expect(await screen.findByPlaceholderText('Search menu...')).toBeInTheDocument();await u.click(screen.getByLabelText('Log out of POS'))
 await waitFor(()=>expect(authAPI.logout).toHaveBeenCalled());expect(await screen.findByTestId('login-button')).toBeInTheDocument()
})
