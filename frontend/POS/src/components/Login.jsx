import { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cashier");

  const handleSubmit = (e) => {
    e.preventDefault();

    const credentials = {
      username,
      password,
      role,
    };

    if (onLogin) {
      onLogin(credentials);
    } else {
      console.log("Login data:", credentials);
    }
  };

  return (
    <div>
      <h1>Login</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Username</label>
          <input
            data-testid="username-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div>
          <label>Password</label>
          <input
            data-testid="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div>
          <label>Role</label>
          <select
            data-testid="role-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="cashier">Cashier</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button data-testid="login-button" type="submit">
          Login
        </button>
      </form>
    </div>
  );
}

export default Login;