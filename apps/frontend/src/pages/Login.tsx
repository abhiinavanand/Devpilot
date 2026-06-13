import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';

export type AuthUser = {
  name: string;
  email: string;
};

type LoginProps = {
  authenticated: boolean;
  onLogin: (user: AuthUser) => void;
};

type StoredUser = AuthUser & {
  password: string;
};

const usersKey = 'devpilot.users';

const readUsers = (): StoredUser[] => {
  try {
    const users = JSON.parse(localStorage.getItem(usersKey) || '[]');
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
};

export const Login = ({ authenticated, onLogin }: LoginProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const users = readUsers();

    if (mode === 'register') {
      if (!name.trim() || !normalizedEmail || !password) {
        setError('Enter a name, email, and password.');
        return;
      }
      if (users.some((user) => user.email === normalizedEmail)) {
        setError('An account already exists for this email.');
        return;
      }
      const user = { name: name.trim(), email: normalizedEmail, password };
      localStorage.setItem(usersKey, JSON.stringify([...users, user]));
      localStorage.setItem('devpilot.authenticated', 'true');
      localStorage.setItem('devpilot.user', JSON.stringify({ name: user.name, email: user.email }));
      onLogin({ name: user.name, email: user.email });
      return;
    }

    const user = users.find((candidate) => candidate.email === normalizedEmail && candidate.password === password);
    if (!user) {
      setError('No account found for those credentials. Register first or check your password.');
      return;
    }
    localStorage.setItem('devpilot.authenticated', 'true');
    localStorage.setItem('devpilot.user', JSON.stringify({ name: user.name, email: user.email }));
    onLogin({ name: user.name, email: user.email });
  };

  return (
    <div className="login-shell">
      <div className="w-full max-w-5xl">
        <div className="card hero-panel">
          <div className="hero-copy">
            <span className="badge">DevPilot AI</span>
            <div>
              <h1>Project delivery, deployments, incidents, and monitoring in one calm workspace.</h1>
              <p className="subtle">Sign in with a local account to keep your own projects isolated, connect deployed apps, and route monitoring into Grafana.</p>
            </div>
            <div className="hero-meta">
              <span className="status-badge status-healthy"><span className="status-badge-dot" /> Per-user project workspace</span>
              <span className="subtle">Create an account or use one you already registered in this browser.</span>
            </div>
          </div>

          <form className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-background p-1">
            <button className={`rounded-md px-3 py-2 text-sm font-medium ${mode === 'login' ? 'bg-card shadow-sm' : 'text-muted'}`} type="button" onClick={() => setMode('login')}>Login</button>
            <button className={`rounded-md px-3 py-2 text-sm font-medium ${mode === 'register' ? 'bg-card shadow-sm' : 'text-muted'}`} type="button" onClick={() => setMode('register')}>Register</button>
          </div>

          {mode === 'register' ? (
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              type="email"
              placeholder="you@company.com"
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
              placeholder="Password"
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
            {mode === 'login' ? 'Login' : 'Create Account'}
          </button>
          </form>
        </div>
      </div>
    </div>
  );
};
