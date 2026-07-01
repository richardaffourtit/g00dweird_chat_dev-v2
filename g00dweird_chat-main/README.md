# g00dweird chat

g00dweird chat is a multi-world interactive chat app with retro desktop UI, room-based chat, animated sprites, world pickers, odd little tools, and experimental environments.

The active app lives in this folder:

```text
g00dweird_chat-main/
  backend/      FastAPI backend and realtime/chat APIs
  frontend/     React/Vite frontend
  scripts/      asset and sprite tooling
  tests/        project-level Python tests
  reports/      generated asset reports
```

## Frontend

The frontend is a React app built with Vite.

```bash
cd frontend
npm install
npm run dev
```

Common routes:

- `/` main desktop/chat experience
- `/r/:roomId` room route
- `/u/:nickname` profile route
- `/guestbook` guestbook route
- `/v2` enchanted forest experiment
- `/sprite-lab` developer sprite cleanup tool

Build and test:

```bash
cd frontend
npm run build
CI=true npm test -- --watchAll=false
```

## Backend

The backend is a FastAPI service.

```bash
cd backend
python3 -m pip install -r requirements.txt
python3 server.py
```

Some older backend tests expect `REACT_APP_BACKEND_URL` to be set or an Emergent-style `/app/frontend/.env` file to exist.

## Fast Fix / Launch Check

From this folder, run the focused pre-push check:

```bash
make quick
```

That validates the repo-root `render.yaml`, runs launch-critical backend tests,
runs focused frontend tests, and builds the Vite app. The same checks run in
GitHub Actions on pushes and pull requests to `main`.

Safe env templates live at:

```text
backend/.env.example
frontend/.env.example
```

Copy those to local `.env` files when needed; real `.env` files stay out of git.

Live deploy notes are in `DEPLOY.md`. The first launch shape is:

- `chat.g00dweird.com` for the frontend
- `api.g00dweird.com` for the backend/WebSockets
- `g00dweird.com` and `www.g00dweird.com` stay on Framer until promotion

## Assets

Runtime assets are kept under:

```text
frontend/public/assets/
```

Raw or source assets are kept under:

```text
frontend/public/source-assets/
```

Do not rely on root-level `assets/` or root-level `index.html` for the app runtime. Those were legacy/scratch locations and have been moved into the frontend project.

## Sprite Lab

Sprite Lab is still used, but it is a developer tool rather than the whole product.

Use it when cleaning red-background sprite sheets or tuning generated sprite frames:

1. Put source sprite sheets in the appropriate `frontend/public/source-assets/`, `frontend/public/anim/`, or world asset folder.
2. From `frontend/`, run:

   ```bash
   npm run sprites
   ```

3. Start the backend and frontend.
4. Open `/sprite-lab`.
5. Adjust bounding boxes and pivots.
6. Save overrides to `frontend/public/assets/cleaned-sprites/manual-overrides.json`.
7. Rebuild with Sprite Lab or rerun `npm run sprites`.

Generated descriptors live in:

```text
frontend/public/assets/cleaned-sprites/descriptors/
```

The cleaner uses Pillow to key red pixels, crop and normalize frames, flag duplicate/still frames, and write audit output to `reports/sprite-audit.md`.
