# Tomfoolery Hackathon

Fresh minimal React + Vite + TypeScript frontend and Express + TypeScript backend. Frontend defaults to port 5173 and backend to 4000 with CORS wired for local dev.

## Quick start

```bash
# in two terminals (or use two shell tabs)
npm --prefix frontend install
npm --prefix backend install

npm --prefix backend run dev
npm --prefix frontend run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000/api/health

## Docker

Build and run both services:

```bash
docker compose up --build
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000/api/health

## Frontend (frontend/)

- React 18 + Vite + TypeScript, no extra tooling.
- Env override for API base: set `VITE_API_URL` (defaults to `http://localhost:4000`).
- Scripts: `dev`, `build`, `preview`.

## Backend (backend/)

- Express + TypeScript with `ts-node-dev` for hot reload.
- CORS allows `http://localhost:5173` by default; override with `FRONTEND_ORIGIN` (comma-separated for multiples).
- Scripts: `dev`, `build`, `start`.

## Notes

- Shared `.gitignore` covers `node_modules` and build output.
- Keep everything minimal—add dependencies only as needed during the hackathon.
