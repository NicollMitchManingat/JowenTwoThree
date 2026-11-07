import { it,expect,vi,beforeEach } from 'vitest'
import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../pages/LoginPage'
import { authAPI } from '../services/authAPI'
vi.mock('../services/authAPI',()=>({authAPI:{login:vi.fn()}}))
beforeEach(()=>vi.resetAllMocks())
it('renders the existing form without demo passwords',()=>{
 render(<LoginPage onLogin={()=>{}}/>);expect(screen.getByTestId('login-button')).toBeInTheDocument()
 expect(screen.queryByText('Demo Credentials:')).not.toBeInTheDocument()
})
it('requires credentials before contacting the backend',async()=>{
 const u=userEvent.setup();render(<LoginPage onLogin={()=>{}}/>);await u.click(screen.getByTestId('login-button'))
 expect(screen.getByTestId('error-message')).toHaveTextContent('Username and password are required');expect(authAPI.login).not.toHaveBeenCalled()
})
it('accepts the renamed username and retains server permissions',async()=>{
 const user={id:'s1',username:'stockman',role:'stockist',permissions:['inventory']};authAPI.login.mockResolvedValue(user)
 const onLogin=vi.fn(),u=userEvent.setup();render(<LoginPage onLogin={onLogin}/>);
 await u.type(screen.getByTestId('username-input'),user.username);await u.type(screen.getByTestId('password-input'),'fixture-password');await u.click(screen.getByTestId('login-button'))
 await waitFor(()=>expect(onLogin).toHaveBeenCalledWith(user))
})
it('shows the server authentication error',async()=>{
 authAPI.login.mockRejectedValue(new Error('Invalid username or password'));const u=userEvent.setup();render(<LoginPage onLogin={()=>{}}/>);
 await u.type(screen.getByTestId('username-input'),'unknown');await u.type(screen.getByTestId('password-input'),'wrong');await u.click(screen.getByTestId('login-button'))
 expect(await screen.findByTestId('error-message')).toHaveTextContent('Invalid username or password')
})
