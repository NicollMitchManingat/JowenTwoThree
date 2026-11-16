import {it,expect,vi,beforeEach} from 'vitest'
import {render,screen,waitFor,fireEvent,act} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import {authAPI} from '../services/authAPI'
vi.mock('../services/db',()=>({db:{getProducts:vi.fn().mockResolvedValue([]),getCategories:vi.fn().mockResolvedValue([]),getActiveDiscounts:vi.fn().mockResolvedValue([]),getLowStockItems:vi.fn().mockResolvedValue([]),getOutOfStockItems:vi.fn().mockResolvedValue([]),getInventory:vi.fn().mockResolvedValue([]),getTransactions:vi.fn().mockResolvedValue([]),getRefundsForTransactions:vi.fn().mockResolvedValue([])}}))
vi.mock('../services/authAPI',()=>({authAPI:{session:vi.fn(),login:vi.fn(),logout:vi.fn()}}))

beforeEach(()=>{vi.clearAllMocks();localStorage.clear();authAPI.session.mockResolvedValue(null);authAPI.logout.mockResolvedValue({})})
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

it('does not poll or refresh on window focus while signed out', async () => {
 vi.useFakeTimers({toFake:['setInterval','clearInterval']})
 try {
  render(<App/>);await screen.findByTestId('login-button')
  expect(authAPI.session).toHaveBeenCalledTimes(1)
  fireEvent.focus(window)
  await act(async()=>{await vi.advanceTimersByTimeAsync(120000)})
  expect(authAPI.session).toHaveBeenCalledTimes(1)
 } finally {vi.useRealTimers()}
})
it('shows a retryable service outage instead of treating it as a signed-out session', async () => {
 authAPI.session.mockRejectedValueOnce(new Error('Session service unavailable'))
 render(<App/>);expect(await screen.findByRole('alert')).toHaveTextContent('Session service unavailable')
 authAPI.session.mockResolvedValue(null)
 await userEvent.click(screen.getByRole('button',{name:'Retry session check'}))
 expect(await screen.findByTestId('login-button')).toBeInTheDocument()
})
it('discards a stale session response arriving after logout', async () => {
 const account={id:'admin',username:'admin',role:'admin'}
 authAPI.session.mockResolvedValueOnce(account)
 render(<App/>);await screen.findByRole('navigation')
 let finish
 authAPI.session.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 fireEvent.focus(window)
 await userEvent.click(screen.getByLabelText('Log out of POS'))
 await screen.findByTestId('login-button')
 await act(async()=>{finish(account)})
 expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
 expect(screen.getByTestId('login-button')).toBeInTheDocument()
})
it('ends a revoked session on focus and stops subsequent signed-out checks', async () => {
 authAPI.session.mockResolvedValueOnce({id:'admin',username:'admin',role:'admin'})
 render(<App/>);await screen.findByRole('navigation')
 authAPI.session.mockResolvedValue(null)
 fireEvent.focus(window);await screen.findByTestId('login-button')
 const calls=authAPI.session.mock.calls.length
 fireEvent.focus(window);await act(async()=>{})
 expect(authAPI.session).toHaveBeenCalledTimes(calls)
})
