import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'tum-mock-token';

type User = {
  id: string;
  tumId: string | null;
  email: string;
  fullName: string;
  faculty: string | null;
  semester?: number | null;
  profileSlug: string;
  authProvider: 'mock' | 'tum';
  createdAt: string;
  updatedAt: string;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (input: { fullName: string; email: string; tumId?: string; faculty?: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (authToken: string) => {
      try {
        const response = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Request failed: ${response.status}`);
        }
        const data = (await response.json()) as { user: User };
        setUser(data.user);
        setError(null);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Failed to fetch profile';
        setError(reason);
        setUser(null);
      }
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    if (token) {
      await fetchProfile(token);
    }
  }, [fetchProfile, token]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (saved) {
      setToken(saved);
      fetchProfile(saved).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchProfile]);

  const login = useCallback(
    async ({ fullName, email, tumId, faculty }: { fullName: string; email: string; tumId?: string; faculty?: string }) => {
      const safeEmail = email.trim();
      const safeName = fullName.trim();
      if (!safeEmail || !safeName) {
        throw new Error('Please enter your email and full name.');
      }

      const response = await fetch(`${API_URL}/auth/mock-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: safeEmail,
          fullName: safeName,
          tumId: tumId?.trim() || null,
          faculty: faculty?.trim() || null,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed: ${response.status}`);
      }

      const data = (await response.json()) as { token: string; user: User };
      setToken(data.token);
      setUser(data.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      setError(null);
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, error, login, logout, refreshProfile }),
    [user, token, loading, error, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page">
        <div className="card centered">
          <div className="spinner" aria-label="Loading session" />
          <p>Checking session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function Layout({ children }: { children: ReactNode }) {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = useState('Checking backend…');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStatus('ok');
        setStatusMessage(data.message ?? 'Backend OK');
      })
      .catch((err) => {
        setStatus('error');
        setStatusMessage(err instanceof Error ? err.message : 'Backend unreachable');
      });
    return () => controller.abort();
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  return (
    <div className="page">
      <header className="top">
        <div className="brand" onClick={() => navigate(user ? '/app/profile' : '/login')}>
          <div className="logo">TUM Social</div>
          <div className="pill small">Prototype</div>
        </div>
        <div className="top-actions">
          <div className={`status-chip ${status}`}>
            <span className="dot" />
            <span>{statusMessage}</span>
          </div>
          <div className="theme-toggle">
            <button type="button" onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}>
              {theme === 'light' ? '🌙' : '🌞'}
            </button>
          </div>
          {user ? (
            <div className="menu">
              <button
                type="button"
                className="menu-trigger"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                ☰
              </button>
              {menuOpen ? (
                <div className="menu-popover">
                  <button type="button" onClick={() => { refreshProfile(); setMenuOpen(false); }}>
                    Refresh profile
                  </button>
                  <button type="button" className="danger" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}

function LoginPage() {
  const { user, login, error } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [tumId, setTumId] = useState('');
  const [faculty, setFaculty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/app/profile', { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    try {
      await login({ fullName, email, tumId, faculty });
      navigate('/app/profile', { replace: true });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="content">
      <div className="card wide">
        <div className="card-header">
          <div>
            <p className="eyebrow">Mock TUM Login</p>
            <h1>Sign in to your student profile</h1>
            <p className="muted">
              We create a profile and issue a JWT. Real OIDC will replace this flow after the hackathon.
            </p>
          </div>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="field">
            <span>Full name</span>
            <input
              type="text"
              placeholder="Mia Schmidt"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>TUM email</span>
            <input
              type="email"
              placeholder="mia.schmidt@tum.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>TUM ID (optional)</span>
            <input
              type="text"
              placeholder="ga12abc"
              value={tumId}
              onChange={(e) => setTumId(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Faculty (optional)</span>
            <input
              type="text"
              placeholder="CIT, SOM, MW, EDU…"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Login with TUM (Prototype)'}
          </button>
        </form>
        {localError || error ? (
          <div className="error">
            <strong>Auth error:</strong> {localError || error}
          </div>
        ) : null}
        <div className="muted tiny">API: {API_URL}</div>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="content">
      <div className="card wide">
        <div className="card-header">
          <div>
            <p className="eyebrow">Profile</p>
            <h1>{user.fullName}</h1>
            <p className="muted">Welcome back, {user.fullName.split(' ')[0] || 'student'}.</p>
          </div>
        </div>
        <div className="profile-grid">
          <div>
            <div className="muted">Email</div>
            <code>{user.email}</code>
          </div>
          <div>
            <div className="muted">Faculty</div>
            <span>{user.faculty || '—'}</span>
          </div>
          <div>
            <div className="muted">TUM ID</div>
            <span>{user.tumId || '—'}</span>
          </div>
          <div>
            <div className="muted">Profile slug</div>
            <code>{user.profileSlug}</code>
          </div>
          <div>
            <div className="muted">Provider</div>
            <span className="pill">{user.authProvider}</span>
          </div>
          <div>
            <div className="muted">Created</div>
            <span>{new Date(user.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <div className="muted">Updated</div>
            <span>{new Date(user.updatedAt).toLocaleString()}</span>
          </div>
          <div>
            <div className="muted">Token (preview)</div>
            <code>{token ? `${token.slice(0, 28)}…` : '—'}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app/profile" element={<ProfilePage />} />
      </Route>
      <Route path="/" element={<Navigate to="/app/profile" replace />} />
      <Route path="*" element={<Navigate to="/app/profile" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <AppRoutes />
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
