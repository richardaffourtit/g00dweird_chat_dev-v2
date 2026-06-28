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

Backend:

```bash
python3 -m pytest backend/tests/test_launch_config.py backend/tests/test_admin.py backend/tests/test_basketball.py
```

Frontend:

```bash
cd frontend
CI=true npm test -- --watchAll=false src/lib/api.test.js src/lib/admin.test.js src/components/IsoWorld.test.js
npm run build
```

Blueprint parse check:

```bash
ruby -ryaml -e 'data = YAML.load_file("render.yaml"); services = data.fetch("services"); raise "bad service count" unless services.length == 2; raise "backend not single instance" unless services[0].fetch("numInstances") == 1; raise "static site shape changed" unless services[1].fetch("type") == "web" && services[1].fetch("runtime") == "static"; puts "render.yaml ok"'
```

Health check after backend deploy:

```text
https://api.g00dweird.com/api/health
```
