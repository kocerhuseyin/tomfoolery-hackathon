# insideTUM (Tomfoolery Hackathon)

One codebase, three clients:
- **Backend:** Node + Express + Prisma/PostgreSQL (Railway-ready)
- **Web:** React + Vite (Vercel-ready)
- **Mobile:** Expo React Native (Android/iOS)

The hackathon scope delivers mock login, student profiles, events & Mensa data, meetups, forum posts/comments, and direct messages with JWT auth. Real TUM OIDC can be swapped in later.

## Features
- **Mock TUM Login** → JWT + auto profile (email, name, TUM ID, faculty).
- **Profile & auth** → `/auth/mock-login`, `/me` with JWT middleware.
- **Events** → Scrapes top TUM events from `https://chn.tum.de/events`.
- **Mensa** → Scrapes and translates Mensa Heilbronn menu (nearest open day) from imensa.
- **Meetups** → Create/edit (host), join/leave, categories, attendee counts.
- **Forum** → Posts (market/qa/discussion) + threaded comments.
- **Messages** → Start chat with any student, send messages; live polling on web/mobile.
- **Mobile parity** → Tabs for Home, Meetups, Forum, Messages, Profile; settings via gear on profile.
- **Web parity** → Same tabs and flows as mobile.

## Repo layout
- `backend/` Express + Prisma API
- `frontend/` Vite React web app
- `mobile/` Expo app

## Environment
Backend (`backend/.env`):
```
DATABASE_URL=postgres://user:pass@host:port/db
JWT_SECRET=supersecret
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
MENSA_URL=https://www.imensa.de/heilbronn/mensa-am-bildungscampus/index.html
PORT=4000
```
Frontend (`frontend/.env`):
```
VITE_API_URL=http://localhost:4000
```
Mobile (`mobile/.env`):
```
EXPO_PUBLIC_API_URL=http://YOUR-LAN-IP:4000
```

## Install & run locally
```bash
# root
npm install

# backend
cd backend
npm install
npm run prisma:generate   # if needed
npx prisma migrate dev    # creates DB schema locally
npm run dev               # http://localhost:4000

# frontend
cd ../frontend
npm install
npm run dev               # http://localhost:5173

# mobile
cd ../mobile
npm install
npm start                 # Expo dev server; set EXPO_PUBLIC_API_URL to LAN IP
```

## Deploy hints
- **Railway backend:** set `DATABASE_URL`, `JWT_SECRET`, `PORT`, `MENSA_URL`, `FRONTEND_ORIGIN`; run `npx prisma migrate deploy` during build before `npm run build`.
- **Vercel frontend:** set `VITE_API_URL` to your Railway URL.
- **Expo production:** set `EXPO_PUBLIC_API_URL` to your Railway URL.

## Key API endpoints
- `POST /auth/mock-login { email, fullName, tumId?, faculty? } -> { token, user }`
- `GET /me` → current user
- `GET /api/health`
- `GET /api/tum-events` → top 5 events with images when available
- `GET /api/mensa` → nearest-day menu `{ date, items[] }`
- **Forum:** `GET /forum/posts`, `POST /forum/posts`, `GET /forum/posts/:id`, `POST /forum/posts/:id/comments`
- **Meetups:** `GET /meetups`, `POST /meetups`, `POST /meetups/:id/join`, `POST /meetups/:id/leave`, `PUT /meetups/:id` (host only)
- **Chats:** `GET /students`, `GET /chats`, `POST /chats { participantId }`, `GET /chats/:id/messages`, `POST /chats/:id/messages`

## Notes
- Auth is JWT Bearer; clients store token in localStorage (web) or SecureStore (mobile).
- Faculties supported: `CIT`, `SOM` (easy to extend in Prisma).
- Scrapers set a desktop UA and have timeouts; graceful fallbacks return empty lists on errors.
- Default ports: backend `4000`, frontend `5173`.

Happy hacking with insideTUM! 💙
