# Deploying g00dweird chat

First launch target:

- Frontend app: `chat.g00dweird.com`
- Backend API and WebSockets: `api.g00dweird.com`
- Current Framer site stays on: `g00dweird.com` and `www.g00dweird.com`

Later promotion path:

- Move the Framer site to `legacy.g00dweird.com`
- Point `g00dweird.com` and `www.g00dweird.com` to the app once the chat is stable

## Why This Launch Shape

The chat app is not Framer-static-only. It needs:

- React/Vite static assets
- FastAPI HTTP routes under `/api`
- WebSockets under `/api/ws`
- MongoDB
- Upload storage
- One backend instance for now, because live room presence and realtime state are in memory

`render.yaml` defines a Render Blueprint with:

- `g00dweird-chat`: Vite static frontend
- `g00dweird-api`: FastAPI/WebSocket backend
- `numInstances: 1` on the backend to keep live room state coherent
- a persistent disk for local upload storage

The only live Blueprint file is the repo-root `render.yaml`. Do not use a nested
`g00dweird_chat-main/render.yaml`; keeping one file avoids split-brain deploys.

## Render Setup

1. In Render, create a new Blueprint from the GitHub repo.
2. Use the repo root so Render finds `render.yaml`.
3. Keep the backend at one instance for launch.
4. Set this required secret when prompted:

```text
MONGO_URL=<your production MongoDB connection string>
```

`DB_NAME` defaults to `g00dweird`.

## DNS Setup For First Launch

At Hover, add only the records Render gives you for:

```text
chat.g00dweird.com
api.g00dweird.com
```

Do not remove or edit Hover mail records such as the existing MX record.

Do not move these yet during first launch:

```text
g00dweird.com
www.g00dweird.com
```

Those currently point to Framer and should stay there until the chat app is proven live.

## Git Fix Rhythm

For small fixes before launch:

```bash
cd g00dweird_chat-main
make quick
git status --short
git add <changed files>
git commit -m "Describe the fix"
git push origin main
```

`make quick` checks the Render Blueprint, runs the focused backend launch tests,
runs focused frontend tests, and builds the frontend. GitHub Actions runs the
same checks on pushes and pull requests to `main`.

## Later Framer Legacy Move

When the chat app is ready to own the root domain:

1. Add `legacy.g00dweird.com` to the Framer project.
2. Add the Framer DNS record for `legacy`.
3. Confirm `https://legacy.g00dweird.com` works.
4. Change root/app DNS so `g00dweird.com` and `www.g00dweird.com` point to the app host.

## Upload Storage

The launch Blueprint uses a Render persistent disk:

```text
/var/data/g00dweird/uploads
```

If we switch to Cloudflare R2 or S3-compatible storage, set these backend env vars and remove the disk only after upload/download QA passes:

```text
OBJECT_STORAGE_PROVIDER=r2
OBJECT_STORAGE_BUCKET=<bucket>
OBJECT_STORAGE_ENDPOINT_URL=<endpoint>
OBJECT_STORAGE_REGION=auto
```

## Local Verification

From `g00dweird_chat-main/`:

```bash
make quick
```

Or run individual pieces:

```bash
make launch-check
make backend-test
make frontend-test
make frontend-build
```

Health check after backend deploy:

```text
https://api.g00dweird.com/api/health
```
