# Express Chat API

REST + Socket.io backend for a multi-room chat app: auth, rooms, real-time messaging, file sharing, and user presence.

- [Express chat API](https://express-realtime-chat-production.up.railway.app)
- [React chat app](https://v0-react-chat-app-seven.vercel.app)

---

## Features

- **Authentication** – Register, login (JWT), protected routes and Socket.io connections
- **Rooms** – Create rooms, join/leave, list rooms and room details with participant count
- **Real-time messaging** – Send/receive messages and typing indicators via Socket.io
- **Message history** – Paginated `GET /api/rooms/:id/messages`
- **File sharing** – Upload files (multer), send file messages in chat; allowed types and size limits enforced
- **User presence** – Online/offline and per-room presence via Socket.io
- **Security** – Helmet, CORS, rate limiting (general + stricter on auth), message sanitization (sanitize-html), JWT on socket

---

## Tech Stack

- **Runtime:** Node.js  
- **Framework:** Express  
- **Real-time:** Socket.io  
- **Database:** PostgreSQL with Prisma  
- **Auth:** JWT (jsonwebtoken), bcryptjs  
- **Validation:** Zod  
- **File uploads:** Multer  

---

## Prerequisites

- Node.js 18+
- PostgreSQL
- npm or pnpm

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd express-chat-app
npm install
```

### 2. Environment variables

Copy the example env and set required values:

```bash
cp .env.example .env
```

Edit `.env` and set at least:

- `DATABASE_URL` – PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/chatdb`)
- `JWT_SECRET` – Long random string (e.g. from `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `CORS_ORIGIN` – Frontend origin (e.g. `http://localhost:3001`)

See [.env.example](.env.example) for all options.

### 3. Database

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Run

**Development (watch):**

```bash
npm run dev
```

**Production build and start:**

```bash
npm run build
npm start
```

By default the server listens on `http://localhost:3000`. Health check: `GET /health`.

---

## API Reference

Base URL: `http://localhost:3000` (or your deployed API URL).

### Health

| Method | Path     | Auth | Description        |
|--------|----------|------|--------------------|
| GET    | /health  | No   | Health check       |

### Auth (`/api/auth`)

| Method | Path     | Auth | Description        |
|--------|----------|------|--------------------|
| POST   | /register| No   | Register (username, email, password) |
| POST   | /login   | No   | Login; returns JWT |
| GET    | /me      | Yes  | Current user       |

Use the returned JWT in `Authorization: Bearer <token>` for protected routes and for Socket.io auth.

### Rooms (`/api/rooms`)

All require `Authorization: Bearer <token>`.

| Method | Path        | Description                    |
|--------|-------------|--------------------------------|
| GET    | /           | List all rooms                 |
| POST   | /           | Create room (name, description)|
| GET    | /:id        | Room by ID (with participants) |
| POST   | /:id/join   | Join room                      |
| POST   | /:id/leave  | Leave room                     |

### Messages (`/api/rooms/:id/messages`)

Require auth.

| Method | Path | Query           | Description              |
|--------|------|-----------------|--------------------------|
| GET    | /    | limit, offset   | Paginated message history|

### Upload (`/api/upload`)

Require auth. Body: `multipart/form-data` with field `file`.

| Method | Path | Description                    |
|--------|------|--------------------------------|
| POST   | /    | Upload file; returns fileUrl etc. |

File type and size limits apply (see config/multer). Optional `PUBLIC_API_URL` makes `fileUrl` a full URL.

---

## Socket.io

Connect to the same base URL as the API (e.g. `http://localhost:3000` or your Railway URL). Authenticate with the JWT (e.g. in `auth` option or query).

### Client → Server (emit)

| Event             | Payload              | Description           |
|-------------------|----------------------|-----------------------|
| join-room         | `{ roomId }`         | Join a room           |
| leave-room        | `{ roomId }`         | Leave a room          |
| send-message      | `{ roomId, content }`| Send text message    |
| send-file         | `{ roomId, fileUrl, caption? }` | Send file message |
| typing            | `{ roomId }`         | Typing started        |
| stop-typing       | `{ roomId }`         | Typing stopped        |
| get-online-users  | `{ roomId }`         | Request online users  |

### Server → Client (on)

| Event             | Payload              | Description           |
|-------------------|----------------------|-----------------------|
| new-message       | message object       | New text message in room |
| new-file-message  | message object       | New file message in room  |
| user-joined       | { userId, username, roomId } | User joined room  |
| user-left         | { userId, username, roomId } | User left room   |
| user-online       | { userId, username, roomId? }| User came online  |
| user-offline      | { userId, username, roomId? }| User went offline |
| online-users      | { roomId, userIds }  | Response to get-online-users |
| typing            | { userId, username, roomId } | Someone typing   |
| stop-typing       | { userId, username, roomId } | Someone stopped typing |

---
