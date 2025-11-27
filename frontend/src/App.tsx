import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function App() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/api/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const data = await res.json();
        setMessage(data.message ?? 'Backend responded');
        setError(null);
        setStatus('ok');
      })
      .catch((err) => {
        console.error('Health check failed', err);
        const reason = err instanceof Error ? err.message : 'Request failed';
        setError(reason);
        setMessage('Connect the backend to see the health check here.');
        setStatus('error');
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="app">
      <div className="card">
        <h1>Tomfoolery Hackathon</h1>
        <p>Vite + React + TypeScript boilerplate.</p>
        <div className="status">
          <span className={`status-dot ${status}`} aria-label={`Backend status: ${status}`} />
          <span className="label">Backend:</span>
          <span className="value">{message || 'Loading...'}</span>
        </div>
        {error ? (
          <div className="error">
            <strong>Error:</strong> {error}
            <div>API URL: {API_URL}</div>
          </div>
        ) : null}
        <div className="meta">
          <code>frontend</code> (Vercel)
          <code>backend</code> (Railway)
        </div>
      </div>
    </main>
  );
}

export default App;
