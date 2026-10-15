# Confabulate Chat

Full-stack chat application with a React/Vite frontend and an Express, MongoDB, and Socket.IO backend.

## Repository layout

- `frontend/` contains the React application and runs on port `5173`.
- `backend/` contains the API and realtime server and runs on port `8000`.

## Frontend setup

Copy `frontend/.env.example` to `frontend/.env`, then run:

```powershell
cd frontend
npm install
npm run dev
```

Both `npm start` and `npm run dev` use Vite on port `5173` with strict port checking.
Production builds default to a same-origin API. Set `VITE_API_URL` and `VITE_SOCKET_URL` at build time when the backend is deployed on another origin.

## Backend setup

Copy `backend/.env.example` to `backend/.env`, set a unique production `JWT_SECRET` of at least 32 bytes, then run:

```powershell
cd backend
npm install
npm start
```

The backend exposes `GET http://localhost:8000/api/health`.

Cloudinary uploads are signed by the backend. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` together. `CLOUDINARY_UPLOAD_PRESET` is optional and must support signed uploads when used. Never expose the API secret to the frontend.

Data-URL attachment storage is disabled by default. It can be enabled only for local testing with `ALLOW_DATA_URL_UPLOAD_FALLBACK=true`.

The authenticated chat schema does not read legacy anonymous `{ username, message, timestamp }` documents from the earlier prototype. Back up and migrate any legacy `b0506` data before pointing this version at that database. Production also requires an explicit `MONGO_URI`, preventing an accidental switch to a blank default database.

## Validation

```powershell
cd frontend
npm test
npm run build

cd ../backend
npm test
```
