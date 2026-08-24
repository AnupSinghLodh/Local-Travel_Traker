# Local Travel Tracker

A simple full-stack travel tracker app built with Node.js, Express, EJS, and PostgreSQL. It lets family members track which states they have visited and switch between different users.

## Features

- View a selected user's visited states
- Add states to the selected user's travel list
- Switch between family members
- Add new family members with custom colors
- Store data in PostgreSQL
- Simple and clean EJS-based interface

## Tech Stack

- Node.js
- Express.js
- PostgreSQL (NeonDB compatible)
- EJS templating
- pg (PostgreSQL client)
- body-parser

## Repository layout

- `frontend/` - EJS templates and static assets (Netlify-targeted frontend)
- `backend/` - backend server (render/Node) and package.json
- `config/` - shared configuration helpers (e.g., `config/db.js`)
- `neon-db/` - SQL migrations / seeds (moved `queries.sql` here)

## Environment variables

This project uses a single DATABASE_URL connection string (recommended for NeonDB and many cloud providers). Example `.env` values:

```env
DATABASE_URL=postgres://user:password@host:5432/dbname
DB_REJECT_UNAUTHORIZED=true   # default: verify TLS certs. Set to 'false' only if necessary.
PORT=3000
```

## Setup & run (backend)

1. Install backend dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create a `.env` in `backend/` (or provide the env variables in your platform) with `DATABASE_URL` set.

3. Run DB migrations / seeds (use the SQL files in `neon-db/`).

4. Start the backend:

   ```bash
   npm start
   ```

5. Open the app in your browser (backend serves the EJS views by default):

   ```text
   http://localhost:3000
   ```

## API routes

The app exposes the following server-rendered pages and API endpoints used by the frontend:

- GET `/` — render the main page
- GET `/new` — render "add user" form
- POST `/api/users` — create a new user (body: name, color)
- POST `/api/users/select` — select an active user (body: user)
- POST `/api/users/delete` — delete the selected user and their visits
- POST `/api/visited` — add a visited state (body: state)
- POST `/api/visited/delete` — delete a visited state (body: state)

## Database Overview

The app uses two main tables:

- `users` — stores each family member's name and color
- `visited_states` — stores each visited state linked to a user

The `neon-db/queries.sql` file includes sample records and SQL examples for creating and querying these tables.

## Notes

- The code now requires `DATABASE_URL` and fails fast if it is not provided.
- TLS certificate verification is enabled by default. To disable (not recommended) set `DB_REJECT_UNAUTHORIZED=false` in env.
- `selectedUserId` is an in-memory selection. For serverless/multi-instance deployments persist selection in the DB or pass the selected user from the client.

## Deployment

This repository is organized to host the frontend on Netlify and the backend on render.

Backend (render)
- The backend code is in `backend/index.js`. It exports a serverless handler (via `serverless-http`) so render can invoke the app per request.
- render config is provided in `render.json` and maps `/api/*` to `backend/index.js`.
- Environment variables required on render:
  - DATABASE_URL (required) — full Postgres connection string (NeonDB-compatible)
  - DB_REJECT_UNAUTHORIZED (optional) — set to `false` only if you must disable TLS cert verification
  - PORT is not used on render (serverless)

To deploy the backend to render:
1. Push this repo to GitHub (or connect render to your Git provider).
2. Create a new project in render and select this repository.
3. In Project Settings > Environment Variables, add `DATABASE_URL` (and `DB_REJECT_UNAUTHORIZED` if needed).
4. Deploy — render will build `backend/index.js` using `@render/node` and expose routes under `/api/*` (as configured in `render.json`).

Frontend (Netlify)
- The frontend static assets and EJS views are in `frontend/` (if you convert to a static site or SPA for Netlify, build output should be placed into `frontend/dist` or similar and referenced in Netlify settings).
- Netlify hosts static sites — if you keep server-side EJS rendering you should host the rendered site on the backend (render). For Netlify hosting, convert the UI into a static HTML/JS site or SPA that calls the backend `/api/*` endpoints.

To deploy the frontend to Netlify (static approach):
1. Prepare a build that outputs static files (for example, `frontend/dist`), or copy the static HTML/CSS/JS into a folder to publish.
2. Create a new site in Netlify and point the publish directory to the build output (e.g., `frontend/dist` or `frontend/public`).
3. (Optional) Configure a redirect/proxy in Netlify to forward API calls to your render backend (use `_redirects` or Netlify _proxy rules_) or have the frontend call the full render URL for API requests.

Notes
- The backend now requires `DATABASE_URL` and exposes the API under `/api/*`. The server files still support local `node index.js` runs (they will start a local HTTP server when run directly).
- Do NOT rely on in-memory selection (`selectedUserId`) in production serverless deployment — it is per-instance and non-durable. Persist selection in the DB or pass the selected user id from the client on each request.

## License

This project is licensed under ISC.
