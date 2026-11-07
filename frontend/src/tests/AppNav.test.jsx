import {it,expect,vi,beforeEach} from 'vitest'
import {render,screen,within,fireEvent,waitFor} from '@testing-library/react'
import App from '../App'
import {authAPI} from '../services/authAPI'
vi.mock('../services/db',()=>({db:{getProducts:vi.fn().mockResolvedValue([]),getCategories:vi.fn().mockResolvedValue([]),getActiveDiscounts:vi.fn().mockResolvedValue([]),getLowStockItems:vi.fn().mockResolvedValue([]),getOutOfStockItems:vi.fn().mockResolvedValue([]),getInventory:vi.fn().mockResolvedValue([]),getTransactions:vi.fn().mockResolvedValue([]),getRefundsForTransactions:vi.fn().mockResolvedValue([])}}))
vi.mock('../services/authAPI',()=>({authAPI:{me:vi.fn(),login:vi.fn(),logout:vi.fn()}}))

beforeEach(()=>{vi.clearAllMocks();localStorage.clear()})
it('shows only the modules returned by the server, independently of role defaults',async()=>{
 authAPI.me.mockResolvedValue({id:'c',username:'cashier',role:'cashier',permissions:['transactions']});render(<App/>);
 const nav=within(await screen.findByRole('navigation'));expect(nav.getByText('Transactions')).toBeInTheDocument();expect(nav.queryByText('POS & Traffic')).not.toBeInTheDocument();expect(nav.queryByText('Inventory')).not.toBeInTheDocument()
})
it('lands stockman on Inventory and retains its internal role',async()=>{
 authAPI.me.mockResolvedValue({id:'s',username:'stockman',role:'stockist',permissions:['inventory','transactions']});render(<App/>);
 expect(await screen.findByPlaceholderText('Search inventory...')).toBeInTheDocument();expect(screen.getByText('stockman')).toBeInTheDocument();expect(screen.getByText('Stockman')).toBeInTheDocument();expect(screen.queryByTestId('traffic-widget')).not.toBeInTheDocument()
})
it('keeps all administrator modules available',async()=>{
 authAPI.me.mockResolvedValue({id:'a',username:'admin',role:'admin',permissions:[]});render(<App/>);const nav=within(await screen.findByRole('navigation'))
 for(const label of ['POS & Traffic','Inventory','Transactions','Analytics','Management'])expect(nav.getByText(label)).toBeInTheDocument()
})
it('applies permission changes when the session refreshes',async()=>{
 const user={id:'s',username:'stockman',role:'stockist',permissions:['inventory','transactions']};authAPI.me.mockResolvedValue(user);render(<App/>);await screen.findByPlaceholderText('Search inventory...')
 authAPI.me.mockResolvedValue({...user,permissions:['transactions']});fireEvent.focus(window)
 await waitFor(()=>expect(within(screen.getByRole('navigation')).queryByText('Inventory')).not.toBeInTheDocument())
})
