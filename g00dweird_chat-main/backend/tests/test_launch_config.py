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
