# Deploying g00dweird chat

This repo is configured for a Render Blueprint deploy with two services:

- `g00dweird-chat`: the Vite static frontend at `chat.g00dweird.com`
- `g00dweird-api`: the FastAPI/WebSocket backend at `api.g00dweird.com`

The chat desktop is configured to own `g00dweird.com` and `www.g00dweird.com`.
The previous Framer site can be disconnected.

## 1. Create the Blueprint

1. In Render, create a new Blueprint from the GitHub repo.
2. Use the repo root so Render finds `render.yaml`.
3. When prompted for secrets, set:

```text
MONGO_URL=<your MongoDB connection string>
```

`DB_NAME` defaults to `g00dweird`. Change it in Render only if the existing database uses a different name.

## 2. Connect Domains

Render will create custom-domain records for:

```text
g00dweird.com
www.g00dweird.com
chat.g00dweird.com
api.g00dweird.com
```

Add the DNS records Render gives you at the DNS host for `g00dweird.com`.
Replace the current Framer DNS records for `g00dweird.com` and `www.g00dweird.com`
with Render's records.

## 3. Storage

The backend is configured with a 1 GB persistent disk mounted at:

```text
/var/data/g00dweird/uploads
```

That keeps user uploads stable across deploys. If you later switch to Cloudflare R2 or S3, set these backend env vars in Render and remove the disk if it is no longer needed:

```text
OBJECT_STORAGE_PROVIDER=r2
OBJECT_STORAGE_BUCKET=<bucket>
OBJECT_STORAGE_ENDPOINT_URL=<endpoint>
OBJECT_STORAGE_REGION=auto
```

## 4. Local Verification

Before pushing deploy changes:

```bash
cd g00dweird_chat-main/frontend
npm run build

cd ../backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn server:app --host 0.0.0.0 --port 8001
```

Then check:

```text
http://localhost:8001/api/health
```
