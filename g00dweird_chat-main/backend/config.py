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
