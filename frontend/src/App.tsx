import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  useParams,
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

type TumEvent = {
  title: string;
  date?: string;
  url?: string;
  image?: string;
  category?: string;
};

type MensaItem = {
  name: string;
  side?: string;
  price?: string;
  type?: string;
  date?: string;
};

type Meetup = {
  id: string;
  title: string;
  description: string;
  category: 'hike' | 'bike' | 'food' | 'code' | 'study' | 'social';
  timeInfo: string;
  location: string;
  maxAttendees?: number | null;
  host: {
    id: string;
    fullName: string;
  };
  memberCount: number;
  joined: boolean;
  isHost: boolean;
};

type ForumPost = {
  id: string;
  title: string;
  body: string;
  category: 'market' | 'qa' | 'discussion';
  createdAt: string;
  author: { id: string; fullName: string; email: string; faculty?: string | null };
  commentsCount: number;
};

type ForumPostDetail = ForumPost & {
  comments: Array<{ id: string; body: string; createdAt: string; author: { id: string; fullName: string; email: string } }>;
};

type ChatSummary = {
  id: string;
  members: Array<{ id: string; fullName: string; email: string }>;
  lastMessage?: { id: string; body: string; createdAt: string; senderId: string };
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; fullName: string; email: string };
};

type Student = { id: string; fullName: string; email: string; faculty: string | null };

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
      if (faculty && !['CIT', 'SOM'].includes(faculty)) {
        throw new Error('Select a valid faculty.');
      }

      const response = await fetch(`${API_URL}/auth/mock-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: safeEmail,
          fullName: safeName,
          tumId: tumId?.trim() || null,
          faculty: faculty || null,
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
  const location = useLocation();
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

  const navLinks = [
    { path: '/app/home', label: 'Home' },
    { path: '/app/meetups', label: 'Meetups' },
    { path: '/app/forum', label: 'Forum' },
    { path: '/app/messages', label: 'Messages' },
    { path: '/app/profile', label: 'Profile' },
  ];

  return (
    <div className="page">
      <header className="top">
        <div className="brand" onClick={() => navigate(user ? '/app/home' : '/login')}>
          <div className="logo">insideTUM</div>
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
      {user ? (
        <nav className="tabs">
          {navLinks.map((link) => {
            const active = location.pathname.startsWith(link.path);
            return (
              <button
                key={link.path}
                className={`tab ${active ? 'active' : ''}`}
                onClick={() => navigate(link.path)}
              >
                {link.label}
              </button>
            );
          })}
        </nav>
      ) : null}
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
  const [faculty, setFaculty] = useState<'CIT' | 'SOM' | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/app/home', { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    try {
      await login({ fullName, email, tumId, faculty });
      navigate('/app/home', { replace: true });
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
            <span>Faculty</span>
            <select
              value={faculty}
              onChange={(e) => {
                const val = e.target.value as 'CIT' | 'SOM' | '';
                setFaculty(val);
              }}
              required
            >
              <option value="">Select faculty</option>
              <option value="CIT">CIT</option>
              <option value="SOM">SOM</option>
            </select>
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

function HomePage() {
  const [events, setEvents] = useState<TumEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [mensa, setMensa] = useState<{ date?: string; items: MensaItem[] }>({ items: [] });
  const [mensaLoading, setMensaLoading] = useState(true);

  useEffect(() => {
    setEventsLoading(true);
    fetch(`${API_URL}/api/tum-events`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    setMensaLoading(true);
    fetch(`${API_URL}/api/mensa`)
      .then((res) => res.json())
      .then((data) => setMensa({ date: data.date, items: data.items ?? [] }))
      .catch(() => setMensa({ items: [] }))
      .finally(() => setMensaLoading(false));
  }, []);

  return (
    <div className="content">
      <div className="card wide">
        <div className="card-header">
          <div>
            <p className="eyebrow">Campus Feed</p>
            <h1>Events & Mensa</h1>
            <p className="muted">Live data from TUM events and Mensa Heilbronn.</p>
          </div>
        </div>

        <section className="section">
          <div className="section-header">
            <h2>Upcoming events</h2>
            <span className="muted tiny">Top 5 from chn.tum.de</span>
          </div>
          {eventsLoading ? (
            <div className="muted">Loading events…</div>
          ) : events.length === 0 ? (
            <div className="muted">No events found right now.</div>
          ) : (
            <div className="cards-grid">
              {events.map((event, idx) => (
                <a
                  className="event-card"
                  key={idx}
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {event.image ? <img src={event.image} alt={event.title} /> : null}
                  <div className="event-body">
                    <p className="eyebrow">{event.date || 'TBD'}</p>
                    <h3>{event.title}</h3>
                    {event.category ? <span className="pill small">{event.category}</span> : null}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Mensa menu</h2>
            <span className="muted tiny">{mensa.date ? `Menu for ${mensa.date}` : 'Nearest open day'}</span>
          </div>
          {mensaLoading ? (
            <div className="muted">Loading Mensa…</div>
          ) : mensa.items.length === 0 ? (
            <div className="muted">No menu found.</div>
          ) : (
            <div className="list">
              {mensa.items.map((item, idx) => (
                <div className="list-row" key={idx}>
                  <div>
                    <div className="list-title">{item.name}</div>
                    {item.side ? <div className="muted tiny">{item.side}</div> : null}
                  </div>
                  <div className="right">
                    {item.type ? <span className="chip">{item.type}</span> : null}
                    {item.price ? <span className="muted tiny">{item.price}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MeetupsPage() {
  const { token } = useAuth();
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'hike' as Meetup['category'],
    timeInfo: '',
    location: '',
    maxAttendees: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const categories: Meetup['category'][] = ['hike', 'bike', 'food', 'code', 'study', 'social'];

  const authHeaders = useMemo(
    () => ({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    }),
    [token],
  );

  const loadMeetups = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/meetups`, { headers: authHeaders })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => setMeetups(data.meetups ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load meetups'))
      .finally(() => setLoading(false));
  }, [authHeaders, token]);

  useEffect(() => {
    loadMeetups();
  }, [loadMeetups]);

  const handleSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!token) return;
    setError(null);
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      timeInfo: form.timeInfo,
      location: form.location,
      maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
    };
    const url = editingId ? `${API_URL}/meetups/${editingId}` : `${API_URL}/meetups`;
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(payload) });
    if (!res.ok) {
      const text = await res.text();
      setError(text || 'Failed to save meetup');
      return;
    }
    setForm({ title: '', description: '', category: 'hike', timeInfo: '', location: '', maxAttendees: '' });
    setEditingId(null);
    loadMeetups();
  };

  const handleJoin = async (id: string) => {
    if (!token) return;
    await fetch(`${API_URL}/meetups/${id}/join`, { method: 'POST', headers: authHeaders });
    loadMeetups();
  };

  const handleLeave = async (id: string) => {
    if (!token) return;
    await fetch(`${API_URL}/meetups/${id}/leave`, { method: 'POST', headers: authHeaders });
    loadMeetups();
  };

  const startEdit = (meetup: Meetup) => {
    setEditingId(meetup.id);
    setForm({
      title: meetup.title,
      description: meetup.description,
      category: meetup.category,
      timeInfo: meetup.timeInfo,
      location: meetup.location,
      maxAttendees: meetup.maxAttendees ? String(meetup.maxAttendees) : '',
    });
  };

  return (
    <div className="content">
      <div className="card wide">
        <div className="card-header">
          <div>
            <p className="eyebrow">Meetups</p>
            <h1>Plan campus meetups</h1>
            <p className="muted">Create, join, leave, or edit meetups hosted by students.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Title</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label className="field">
            <span>Description</span>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </label>
          <label className="field">
            <span>Category</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Meetup['category'] })}
            >
              {categories.map((c) => (
                <option value={c} key={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Time</span>
            <input value={form.timeInfo} onChange={(e) => setForm({ ...form, timeInfo: e.target.value })} required />
          </label>
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
          </label>
          <label className="field">
            <span>Max attendees (optional)</span>
            <input
              type="number"
              min={1}
              value={form.maxAttendees}
              onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })}
            />
          </label>
          <button type="submit">{editingId ? 'Update meetup' : 'Create meetup'}</button>
        </form>
        {error ? <div className="error">{error}</div> : null}

        <section className="section">
          <div className="section-header">
            <h2>All meetups</h2>
            <span className="muted tiny">Join or leave with one click</span>
          </div>
          {loading ? (
            <div className="muted">Loading meetups…</div>
          ) : meetups.length === 0 ? (
            <div className="muted">No meetups yet.</div>
          ) : (
            <div className="list">
              {meetups.map((m) => (
                <div className="list-row align-start" key={m.id}>
                  <div className="list-main">
                    <div className="list-title">{m.title}</div>
                    <div className="muted tiny">
                      {m.timeInfo} • {m.location}
                    </div>
                    <div className="muted tiny">
                      Host: {m.host.fullName} • {m.memberCount} joined {m.maxAttendees ? `(max ${m.maxAttendees})` : ''}
                    </div>
                    <div className="chips">
                      <span className="chip">{m.category}</span>
                      {m.joined ? <span className="chip soft">Joined</span> : null}
                      {m.isHost ? <span className="chip soft">Host</span> : null}
                    </div>
                  </div>
                  <div className="list-actions">
                    {m.joined ? (
                      <button className="ghost" onClick={() => handleLeave(m.id)}>
                        Leave
                      </button>
                    ) : (
                      <button className="ghost" onClick={() => handleJoin(m.id)}>
                        Join
                      </button>
                    )}
                    {m.isHost ? (
                      <button className="ghost" onClick={() => startEdit(m)}>
                        Edit
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ForumPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<'all' | ForumPost['category']>('all');
  const [newPost, setNewPost] = useState({ title: '', body: '', category: 'discussion' as ForumPost['category'] });

  const authHeaders = useMemo(
    () => ({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    }),
    [token],
  );

  const loadPosts = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const query = category !== 'all' ? `?category=${category}` : '';
    fetch(`${API_URL}/forum/posts${query}`, { headers: authHeaders })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => setPosts(data.posts ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load posts'))
      .finally(() => setLoading(false));
  }, [authHeaders, category, token]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleCreatePost = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!token) return;
    setError(null);
    const res = await fetch(`${API_URL}/forum/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(newPost),
    });
    if (!res.ok) {
      setError((await res.text()) || 'Failed to create post');
      return;
    }
    setNewPost({ title: '', body: '', category: 'discussion' });
    loadPosts();
  };

  return (
    <div className="content">
      <div className="card wide">
        <div className="card-header">
          <div>
            <p className="eyebrow">Student Forum</p>
            <h1>Discuss, ask, share</h1>
            <p className="muted">Marketplace, Q&A, and discussions. Click a post to open comments.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleCreatePost}>
          <label className="field">
            <span>Title</span>
            <input value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} required />
          </label>
          <label className="field">
            <span>Category</span>
            <select
              value={newPost.category}
              onChange={(e) => setNewPost({ ...newPost, category: e.target.value as ForumPost['category'] })}
            >
              <option value="discussion">Discussion</option>
              <option value="qa">Q&A</option>
              <option value="market">Marketplace</option>
            </select>
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Body</span>
            <textarea
              value={newPost.body}
              onChange={(e) => setNewPost({ ...newPost, body: e.target.value })}
              rows={3}
              required
            />
          </label>
          <button type="submit">Post</button>
        </form>
        {error ? <div className="error">{error}</div> : null}

        <div className="chips">
          {['all', 'discussion', 'qa', 'market'].map((cat) => (
            <button
              key={cat}
              className={`chip ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat as typeof category)}
            >
              {cat.toString().toUpperCase()}
            </button>
          ))}
        </div>

        <section className="section">
          {loading ? (
            <div className="muted">Loading posts…</div>
          ) : posts.length === 0 ? (
            <div className="muted">No posts yet.</div>
          ) : (
            <div className="list">
              {posts.map((p) => (
                <div className="list-row clickable" key={p.id} onClick={() => navigate(`/app/forum/${p.id}`)}>
                  <div className="list-main">
                    <div className="list-title">{p.title}</div>
                    <div className="muted tiny">{p.author.fullName} • {new Date(p.createdAt).toLocaleString()}</div>
                    <div className="muted tiny truncate">{p.body}</div>
                  </div>
                  <div className="list-actions">
                    <span className="chip">{p.category}</span>
                    <span className="pill small">{p.commentsCount} comments</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ForumDetailPage() {
  const { token } = useAuth();
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<ForumPostDetail | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(
    () => ({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    }),
    [token],
  );

  const loadPost = useCallback(() => {
    if (!token || !postId) return;
    fetch(`${API_URL}/forum/posts/${postId}`, { headers: authHeaders })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => setPost(data.post ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load post'));
  }, [authHeaders, postId, token]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const submitComment = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!token || !postId) return;
    setError(null);
    const res = await fetch(`${API_URL}/forum/posts/${postId}/comments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ body: comment }),
    });
    if (!res.ok) {
      setError((await res.text()) || 'Failed to add comment');
      return;
    }
    setComment('');
    loadPost();
  };

  if (!post) {
    return (
      <div className="content">
        <div className="card wide">
          <div className="muted">Loading post…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="card wide">
        <button className="ghost" onClick={() => navigate('/app/forum')}>
          ← Back
        </button>
        <div className="card-header">
          <div>
            <p className="eyebrow">{post.category.toUpperCase()}</p>
            <h1>{post.title}</h1>
            <p className="muted">
              {post.author.fullName} • {new Date(post.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <p>{post.body}</p>

        <section className="section">
          <h3>Comments ({post.comments.length})</h3>
          <form className="form-grid" onSubmit={submitComment}>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Reply</span>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} required />
            </label>
            <button type="submit">Add comment</button>
          </form>
          {error ? <div className="error">{error}</div> : null}
          <div className="list">
            {post.comments.map((c) => (
              <div className="list-row" key={c.id}>
                <div className="list-main">
                  <div className="list-title">{c.author.fullName}</div>
                  <div className="muted tiny">{new Date(c.createdAt).toLocaleString()}</div>
                  <p>{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MessagesPage() {
  const { token, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCache, setMessageCache] = useState<Record<string, ChatMessage[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const authHeaders = useMemo(
    () => ({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    }),
    [token],
  );

  const loadStudents = useCallback(() => {
    if (!token) return;
    fetch(`${API_URL}/students`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setStudents(data.users ?? []))
      .catch(() => setStudents([]));
  }, [authHeaders, token]);

  const loadChats = useCallback(() => {
    if (!token) return;
    fetch(`${API_URL}/chats`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setChats(data.chats ?? []))
      .catch(() => setChats([]));
  }, [authHeaders, token]);

  const loadMessages = useCallback(
    (chatId: string, force = false) => {
      if (!token) return;
      const cached = messageCache[chatId];
      if (cached && !force) {
        setMessages(cached);
      }
      fetch(`${API_URL}/chats/${chatId}/messages`, { headers: authHeaders })
        .then((res) => res.json())
        .then((data) => {
          setMessages(data.messages ?? []);
          setMessageCache((prev) => ({ ...prev, [chatId]: data.messages ?? [] }));
        })
        .catch(() => setMessages([]));
    },
    [authHeaders, messageCache, token],
  );

  useEffect(() => {
    loadStudents();
    loadChats();
  }, [loadStudents, loadChats]);

  useEffect(() => {
    if (messageListRef.current && selectedChat) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, selectedChat]);

  useEffect(() => {
    if (!token) return;
    const chatTimer = setInterval(() => loadChats(), 5000);
    return () => clearInterval(chatTimer);
  }, [loadChats, token]);

  useEffect(() => {
    if (!token || !selectedChat) return;
    loadMessages(selectedChat.id, true);
    const msgTimer = setInterval(() => loadMessages(selectedChat.id, true), 4000);
    return () => clearInterval(msgTimer);
  }, [loadMessages, selectedChat, token]);

  const startChat = async () => {
    if (!selectedStudent || !token) return;
    setError(null);
    const res = await fetch(`${API_URL}/chats`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ participantId: selectedStudent }),
    });
    if (!res.ok) {
      setError((await res.text()) || 'Failed to start chat');
      return;
    }
    const data = await res.json();
    const chat: ChatSummary = data.chat;
    setSelectedChat(chat);
    loadChats();
    loadMessages(chat.id);
  };

  const sendMessage = async () => {
    if (!selectedChat || !newMessage.trim() || !token) return;
    const body = newMessage.trim();
    setNewMessage('');
    const res = await fetch(`${API_URL}/chats/${selectedChat.id}/messages`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      setError((await res.text()) || 'Failed to send message');
      return;
    }
    const data = await res.json();
    const newMsg: ChatMessage = {
      id: data.message.id,
      body: data.message.body,
      createdAt: data.message.createdAt || new Date().toISOString(),
      sender: { id: user?.id || '', fullName: user?.fullName || 'You', email: user?.email || '' },
    };
    setMessages((prev) => [...prev, newMsg]);
    setMessageCache((prev) => ({
      ...prev,
      [selectedChat.id]: [...(prev[selectedChat.id] || []), newMsg],
    }));
    loadChats();
  };

  return (
    <div className="content">
      <div className="card wide">
        <div className="card-header">
          <div>
            <p className="eyebrow">Messages</p>
            <h1>Chat with classmates</h1>
            <p className="muted">Start a chat with any student, then send messages.</p>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Start chat with</span>
            <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
              <option value="">Choose student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.email})
                </option>
              ))}
            </select>
          </label>
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button type="button" onClick={startChat}>
              Start chat
            </button>
          </div>
        </div>
        {error ? <div className="error">{error}</div> : null}

        <div className="messages-layout">
          <div className="chat-list">
            <div className="list">
              {chats.map((chat) => {
                const other = chat.members.find((m) => m.id !== user?.id) || chat.members[0];
                return (
                  <div
                    key={chat.id}
                    className={`list-row clickable ${selectedChat?.id === chat.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedChat(chat);
                      loadMessages(chat.id);
                    }}
                  >
                    <div className="list-main">
                      <div className="list-title">{other?.fullName || 'Group chat'}</div>
                      <div className="muted tiny truncate">{chat.lastMessage?.body || 'No messages yet'}</div>
                    </div>
                    <div className="list-actions muted tiny">
                      {chat.lastMessage ? new Date(chat.lastMessage.createdAt).toLocaleTimeString() : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="chat-panel">
            {selectedChat ? (
              <>
                <div className="chat-header">
                  <div>
                    <div className="list-title">
                      {selectedChat.members.find((m) => m.id !== user?.id)?.fullName || 'Chat'}
                    </div>
                    <div className="muted tiny">
                      {selectedChat.members.map((m) => m.fullName).join(', ')}
                    </div>
                  </div>
                  <button className="ghost" onClick={() => setSelectedChat(null)}>
                    Close
                  </button>
                </div>
                <div className="message-list" ref={messageListRef}>
                  {messages.map((msg) => {
                    const isMine = msg.sender.id === user?.id;
                    return (
                      <div key={msg.id} className={`bubble ${isMine ? 'mine' : 'theirs'}`}>
                        <div className="tiny muted">{msg.sender.fullName}</div>
                        <div>{msg.body}</div>
                        <div className="muted tiny">{new Date(msg.createdAt).toLocaleTimeString()}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="chat-input">
                  <input
                    placeholder="Message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <button type="button" onClick={sendMessage}>
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="muted">Select a chat to start messaging.</div>
            )}
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
        <Route path="/app/home" element={<HomePage />} />
        <Route path="/app/meetups" element={<MeetupsPage />} />
        <Route path="/app/forum" element={<ForumPage />} />
        <Route path="/app/forum/:postId" element={<ForumDetailPage />} />
        <Route path="/app/messages" element={<MessagesPage />} />
        <Route path="/app/profile" element={<ProfilePage />} />
      </Route>
      <Route path="/" element={<Navigate to="/app/home" replace />} />
      <Route path="*" element={<Navigate to="/app/home" replace />} />
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
