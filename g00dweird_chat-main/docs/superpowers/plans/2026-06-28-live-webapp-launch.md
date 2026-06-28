# Live Webapp Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare g00dweird chat to launch safely at `chat.g00dweird.com` first, while keeping the current Framer site on `g00dweird.com` until promotion.

**Architecture:** Launch as a single FastAPI/WebSocket backend instance plus a Vite static frontend. Keep live room state single-instance for now; use MongoDB for persistent data and either persistent disk or S3-compatible object storage for uploads.

**Tech Stack:** FastAPI, Uvicorn, React/Vite, MongoDB, WebSockets, Render Blueprint, Hover DNS.

---

## File Structure

- Modify `backend/server.py`: use production CORS parsing and expose launch-mode health metadata.
- Create `backend/config.py`: small production config helpers that can be tested without importing the whole server.
- Create `backend/tests/test_launch_config.py`: unit tests for CORS parsing and health payload.
- Modify `frontend/src/lib/api.js`: read both `VITE_*` and legacy `REACT_APP_*` frontend env vars.
- Create `frontend/src/lib/api.test.js`: unit tests for production backend URL and WebSocket URL generation.
- Create `render.yaml`: Render Blueprint for `g00dweird-chat` static frontend and `g00dweird-api` backend.
- Modify `DEPLOY.md`: describe `chat.g00dweird.com` first-launch DNS and later apex promotion.

---

### Task 1: Backend Launch Config

**Files:**
- Create: `backend/config.py`
- Create: `backend/tests/test_launch_config.py`
- Modify: `backend/server.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_launch_config.py`:

```python
from config import build_health_payload, cors_origins_from_env, parse_csv_env


def test_parse_csv_env_strips_blank_values():
    assert parse_csv_env(" https://chat.g00dweird.com, ,https://g00dweird.com/ ") == [
        "https://chat.g00dweird.com",
        "https://g00dweird.com",
    ]


def test_cors_defaults_are_local_development_origins():
    assert cors_origins_from_env(None) == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_cors_allows_explicit_wildcard_for_preview_tools():
    assert cors_origins_from_env("*") == ["*"]


def test_health_payload_declares_single_instance_realtime_mode():
    payload = build_health_payload(rooms_count=14, storage_provider="local")
    assert payload["ok"] is True
    assert payload["service"] == "g00dweird-backend"
    assert payload["rooms"] == 14
    assert payload["storage"] == "local"
    assert payload["realtime"]["mode"] == "single-instance"
    assert payload["realtime"]["multi_instance_ready"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python3 -m pytest backend/tests/test_launch_config.py -q
```

Expected: FAIL because `backend/config.py` does not exist.

- [ ] **Step 3: Add the backend config helper**

Create `backend/config.py`:

```python
DEFAULT_DEV_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def parse_csv_env(value, default=None):
    if value is None or str(value).strip() == "":
        return list(default or [])
    items = []
    for raw in str(value).split(","):
        item = raw.strip()
        if not item:
            continue
        if item != "*":
            item = item.rstrip("/")
        items.append(item)
    return items or list(default or [])


def cors_origins_from_env(value):
    origins = parse_csv_env(value, DEFAULT_DEV_CORS_ORIGINS)
    if "*" in origins:
        return ["*"]
    return origins


def build_health_payload(rooms_count, storage_provider, realtime_mode="single-instance"):
    return {
        "ok": True,
        "service": "g00dweird-backend",
        "rooms": rooms_count,
        "storage": storage_provider,
        "realtime": {
            "mode": realtime_mode,
            "multi_instance_ready": realtime_mode != "single-instance",
        },
    }
```

- [ ] **Step 4: Wire the helper into `backend/server.py`**

In `backend/server.py`, import:

```python
from config import build_health_payload, cors_origins_from_env
```

Change `/api/health` to return:

```python
return build_health_payload(
    rooms_count=len(ROOMS),
    storage_provider=OBJECT_STORAGE_PROVIDER,
    realtime_mode=os.environ.get("REALTIME_MODE", "single-instance"),
)
```

Change CORS middleware to:

```python
allow_origins=cors_origins_from_env(os.environ.get("CORS_ORIGINS")),
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
python3 -m pytest backend/tests/test_launch_config.py -q
```

Expected: PASS.

---

### Task 2: Frontend Production URL Config

**Files:**
- Create: `frontend/src/lib/api.test.js`
- Modify: `frontend/src/lib/api.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/api.test.js`:

```javascript
describe("frontend API environment config", () => {
    const originalEnv = process.env;

    afterEach(() => {
        jest.resetModules();
        process.env = originalEnv;
    });

    test("uses VITE_BACKEND_URL for production API and websocket URLs", () => {
        process.env = {
            ...originalEnv,
            VITE_BACKEND_URL: "https://api.g00dweird.com/",
            REACT_APP_BACKEND_URL: "",
        };

        const { API, wsUrl } = require("./api");

        expect(API).toBe("https://api.g00dweird.com/api");
        expect(wsUrl("hello", { user_id: "u 1", nickname: "rich ford" })).toBe(
            "wss://api.g00dweird.com/api/ws/hello?user_id=u+1&nickname=rich+ford"
        );
    });

    test("legacy REACT_APP_BACKEND_URL remains supported", () => {
        process.env = {
            ...originalEnv,
            VITE_BACKEND_URL: "",
            REACT_APP_BACKEND_URL: "https://legacy-api.g00dweird.com/",
        };

        const { API } = require("./api");

        expect(API).toBe("https://legacy-api.g00dweird.com/api");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
CI=true npm test -- --watchAll=false src/lib/api.test.js
```

Expected: FAIL because `VITE_BACKEND_URL` is ignored.

- [ ] **Step 3: Add Vite env fallback in `frontend/src/lib/api.js`**

Add:

```javascript
function readClientEnv(name) {
    return (
        process.env[`VITE_${name}`] ||
        process.env[`REACT_APP_${name}`] ||
        ""
    ).trim();
}
```

Change:

```javascript
const PREVIEW_MOCK = process.env.REACT_APP_PREVIEW_MOCK === "1";
```

to:

```javascript
const PREVIEW_MOCK = readClientEnv("PREVIEW_MOCK") === "1";
```

Change configured backend lookup to:

```javascript
const configured = readClientEnv("BACKEND_URL");
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd frontend
CI=true npm test -- --watchAll=false src/lib/api.test.js
```

Expected: PASS.

---

### Task 3: Render Blueprint

**Files:**
- Create: `render.yaml`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Add `render.yaml`**

Create `render.yaml` with a single backend instance and static frontend:

```yaml
services:
  - type: web
    name: g00dweird-api
    runtime: python
    plan: starter
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn server:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /api/health
    numInstances: 1
    envVars:
      - key: DB_NAME
        value: g00dweird
      - key: CORS_ORIGINS
        value: https://chat.g00dweird.com,https://g00dweird.com,https://www.g00dweird.com
      - key: REALTIME_MODE
        value: single-instance
      - key: OBJECT_STORAGE_PROVIDER
        value: local
      - key: LOCAL_STORAGE_DIR
        value: /var/data/g00dweird/uploads
      - key: MONGO_URL
        sync: false
    disk:
      name: g00dweird-uploads
      mountPath: /var/data/g00dweird/uploads
      sizeGB: 1

  - type: web
    name: g00dweird-chat
    runtime: static
    rootDir: frontend
    buildCommand: npm ci && npm run build
    staticPublishPath: frontend/build
    envVars:
      - key: VITE_BACKEND_URL
        value: https://api.g00dweird.com
      - key: VITE_PREVIEW_MOCK
        value: "0"
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

- [ ] **Step 2: Validate the YAML parses locally**

Run:

```bash
ruby -ryaml -e 'data = YAML.load_file("render.yaml"); services = data.fetch("services"); raise "bad service count" unless services.length == 2; raise "backend not single instance" unless services[0].fetch("numInstances") == 1; raise "static site shape changed" unless services[1].fetch("type") == "web" && services[1].fetch("runtime") == "static"; puts "render.yaml ok"'
```

Expected: `render.yaml ok`.

---

### Task 4: Update Deploy Docs

**Files:**
- Modify: `DEPLOY.md`

- [ ] **Step 1: Replace root-first launch wording**

Document:

```text
First launch target:
- app frontend: chat.g00dweird.com
- app backend: api.g00dweird.com
- current Framer site remains: g00dweird.com and www.g00dweird.com

Later promotion:
- move Framer to legacy.g00dweird.com
- point g00dweird.com and www.g00dweird.com to the app
```

- [ ] **Step 2: Document DNS records**

Add:

```text
Do not remove Hover MX records.
Add Render-provided records for chat.g00dweird.com and api.g00dweird.com only during first launch.
```

- [ ] **Step 3: Document required secrets**

Add:

```text
MONGO_URL is required.
For durable upload storage, either keep the Render disk or configure S3/R2 vars:
OBJECT_STORAGE_PROVIDER=r2
OBJECT_STORAGE_BUCKET=<bucket>
OBJECT_STORAGE_ENDPOINT_URL=<endpoint>
OBJECT_STORAGE_REGION=auto
```

---

### Task 5: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
python3 -m pytest backend/tests/test_launch_config.py backend/tests/test_admin.py backend/tests/test_basketball.py
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend tests**

Run:

```bash
cd frontend
CI=true npm test -- --watchAll=false src/lib/api.test.js src/lib/admin.test.js src/components/IsoWorld.test.js
```

Expected: PASS.

- [ ] **Step 3: Build frontend**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS. Existing Vite large chunk warning is acceptable.

- [ ] **Step 4: Check diff whitespace**

Run:

```bash
git diff --check
```

Expected: no output and exit 0.

---

## Self-Review

- Spec coverage: first-launch deployability, health/CORS, frontend backend URL config, Render blueprint, DNS staging docs, and single-instance live-room constraint are covered.
- Placeholder scan: no `TBD`, `TODO`, or “implement later” steps.
- Type consistency: helper names used in tests match implementation names.
