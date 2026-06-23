import { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cashier");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    const validCredentials = {
      username: "admin",
      password: "123456",
    };

    if (
      username !== validCredentials.username ||
      password !== validCredentials.password
    ) {
      setError("Invalid username or password.");
      return;
    }

    setError("");

    const credentials = {
      username,
      password,
      role,
    };

    if (onLogin) {
      onLogin(credentials);
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

        {error && (
          <p data-testid="error-message" style={{ color: "red" }}>
            {error}
          </p>
        )}

        <button data-testid="login-button" type="submit">
          Login
        </button>
      </form>
    </div>
  );
}

export default Login;