import {it,expect,vi,beforeEach,afterEach,describe} from 'vitest'
import {render,screen,waitFor,fireEvent,act,within} from '@testing-library/react'
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

describe('app fullscreen controls', () => {
 let node, originals, request, exit, tablet
 const account={id:'s',username:'stockman',role:'stockist',permissions:['inventory','transactions']}
 const property=(target,key,descriptor)=>Object.defineProperty(target,key,{configurable:true,...descriptor})
 const change=nodeValue=>{node=nodeValue;fireEvent(document,new Event('fullscreenchange'))}
 beforeEach(()=>{
  originals=[[window,'matchMedia'],[document,'fullscreenEnabled'],[document,'fullscreenElement'],[document,'exitFullscreen'],[document.documentElement,'requestFullscreen'],[document,'webkitFullscreenEnabled'],[document,'webkitFullscreenElement'],[document,'webkitExitFullscreen'],[document.documentElement,'webkitRequestFullscreen']].map(([target,key])=>[target,key,Object.getOwnPropertyDescriptor(target,key)])
  node=null;tablet=true
  property(window,'matchMedia',{value:vi.fn(()=>({matches:tablet})),writable:true})
  property(document,'fullscreenEnabled',{value:true,writable:true})
  property(document,'fullscreenElement',{get:()=>node})
  request=vi.fn(()=>{change(document.documentElement);return Promise.resolve()})
  exit=vi.fn(()=>{change(null);return Promise.resolve()})
  property(document.documentElement,'requestFullscreen',{value:request,writable:true})
  property(document,'exitFullscreen',{value:exit,writable:true})
  authAPI.session.mockResolvedValue(account)
 })
 afterEach(()=>{
  for(const [target,key,descriptor] of originals){if(descriptor)Object.defineProperty(target,key,descriptor);else delete target[key]}
 })
 const open=async()=>{const view=render(<App/>);await screen.findByPlaceholderText('Search inventory...');return view}
 const navClick=name=>fireEvent.click(within(screen.getByRole('navigation')).getByText(name))

 it('automatically enters on the first tablet app click and preserves navigation, native exit and session refresh',async()=>{
  const history=vi.spyOn(window.history,'pushState')
  try {
   await open();expect(request).not.toHaveBeenCalled()
   navClick('Transactions')
   expect(within(screen.getByRole('navigation')).getByText('Transactions').closest('button')).toHaveClass('active')
   await screen.findByRole('button',{name:'Exit fullscreen'})
   expect(request).toHaveBeenCalledExactlyOnceWith({navigationUI:'hide'})
   expect(window.matchMedia).toHaveBeenCalledWith('(pointer: coarse) and (min-width: 600px)')
   act(()=>change(null)) // Browser Back/Escape emits the native change event.
   expect(screen.getByRole('button',{name:'Enter fullscreen'})).toHaveAttribute('aria-pressed','false')
   navClick('Inventory');await screen.findByPlaceholderText('Search inventory...')
   fireEvent.focus(window);await waitFor(()=>expect(authAPI.session).toHaveBeenCalledTimes(2))
   navClick('Transactions');expect(request).toHaveBeenCalledTimes(1)
   expect(history).not.toHaveBeenCalled()
  } finally {history.mockRestore()}
 })

 it('does not automatically enter on desktop but allows manual entry and exit',async()=>{
  tablet=false;await open();navClick('Transactions');expect(request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Enter fullscreen'}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeEnabled())
  fireEvent.click(screen.getByRole('button',{name:'Exit fullscreen'}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Enter fullscreen'})).toBeEnabled())
  expect(request).toHaveBeenCalledTimes(1);expect(exit).toHaveBeenCalledTimes(1)
 })

 it('lets the manual tablet toggle handle its own tap without a duplicate automatic request',async()=>{
  await open();fireEvent.click(screen.getByRole('button',{name:'Enter fullscreen'}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeEnabled())
  expect(request).toHaveBeenCalledTimes(1);expect(exit).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Exit fullscreen'}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Enter fullscreen'})).toBeEnabled())
  navClick('Transactions');expect(request).toHaveBeenCalledTimes(1)
 })

 it('leaves typing and the signed-out page outside automatic fullscreen',async()=>{
  authAPI.session.mockResolvedValue(null);const view=render(<App/>)
  fireEvent.click(await screen.findByTestId('username-input'))
  expect(request).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Enter fullscreen'})).not.toBeInTheDocument()
  view.unmount();authAPI.session.mockResolvedValue(account);await open()
  fireEvent.click(screen.getByPlaceholderText('Search inventory...'));expect(request).not.toHaveBeenCalled()
  navClick('Transactions');await waitFor(()=>expect(request).toHaveBeenCalledTimes(1))
 })

 it('keeps the app usable when fullscreen is disabled by the browser',async()=>{
  property(document,'fullscreenEnabled',{value:false});await open()
  expect(screen.queryByRole('button',{name:'Enter fullscreen'})).not.toBeInTheDocument()
  navClick('Transactions');expect(request).not.toHaveBeenCalled()
  expect(within(screen.getByRole('navigation')).getByText('Transactions').closest('button')).toHaveClass('active')
 })

 it('handles a rejected automatic request once and allows an explicit retry with useful failure feedback',async()=>{
  request.mockRejectedValue(new Error('Not allowed'));await open();navClick('Transactions')
  await waitFor(()=>expect(screen.getByRole('button',{name:'Enter fullscreen'})).toBeEnabled())
  navClick('Inventory');expect(request).toHaveBeenCalledTimes(1)
  expect(screen.queryByText(/Fullscreen is unavailable/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Enter fullscreen'}))
  expect(await screen.findByText(/Fullscreen is unavailable/)).toHaveAttribute('role','status')
  request.mockImplementation(()=>{change(document.documentElement);return Promise.resolve()})
  fireEvent.click(screen.getByRole('button',{name:'Enter fullscreen'}))
  await screen.findByRole('button',{name:'Exit fullscreen'})
  expect(screen.queryByText(/Fullscreen is unavailable/)).not.toBeInTheDocument()
 })

 it('guards rapid taps while a request is still pending',async()=>{
  let finish;request.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  await open();navClick('Transactions');navClick('Inventory')
  expect(request).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Enter fullscreen'})).toBeDisabled()
  await act(async()=>{change(document.documentElement);finish()})
  expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeEnabled()
 })

 it('supports prefixed tablet APIs and tracks their native exit event',async()=>{
  property(document.documentElement,'requestFullscreen',{value:undefined})
  property(document,'exitFullscreen',{value:undefined})
  property(document,'webkitFullscreenEnabled',{value:true})
  property(document,'webkitFullscreenElement',{get:()=>node})
  const enterLegacy=vi.fn(()=>{node=document.documentElement;fireEvent(document,new Event('webkitfullscreenchange'))})
  const exitLegacy=vi.fn(()=>{node=null;fireEvent(document,new Event('webkitfullscreenchange'))})
  property(document.documentElement,'webkitRequestFullscreen',{value:enterLegacy})
  property(document,'webkitExitFullscreen',{value:exitLegacy})
  await open();navClick('Transactions')
  await waitFor(()=>expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeEnabled())
  fireEvent.click(screen.getByRole('button',{name:'Exit fullscreen'}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Enter fullscreen'})).toBeEnabled())
  navClick('Inventory');expect(enterLegacy).toHaveBeenCalledTimes(1);expect(exitLegacy).toHaveBeenCalledTimes(1)
 })
})
