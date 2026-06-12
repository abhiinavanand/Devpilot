import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';

type LoginProps = {
  authenticated: boolean;
  onLogin: () => void;
};

export const Login = ({ authenticated, onLogin }: LoginProps) => {
  const [email, setEmail] = useState('demo@devpilot.ai');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email === 'demo@devpilot.ai' && password === 'password123') {
      localStorage.setItem('devpilot.authenticated', 'true');
      onLogin();
      return;
    }
    setError('Invalid credentials. Use demo@devpilot.ai / password123.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">DevPilot AI</h1>
          <p className="text-muted text-sm">Project management, deployments, and monitoring for engineering teams</p>
        </div>

        <form className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              type="email"
              placeholder="demo@devpilot.ai"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              type="password"
              placeholder="password123"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="w-full px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition"
            type="submit"
          >
            Login
          </button>

          <div className="text-xs text-muted text-center mt-4">
            Demo account: demo@devpilot.ai / password123
          </div>
        </form>
      </div>
    </div>
  );
};
