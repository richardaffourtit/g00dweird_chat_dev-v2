"""
iter15 backend tests:
  - GET /api/users/{id}/bio returns empty bio for new user
  - PUT /api/users/{id}/bio persists the bio
  - bio length capped at 500
  - 404 on unknown user
"""
import time
import os
import requests

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
).rstrip("/")
API = f"{BASE_URL}/api"


def _new_user(nick_prefix="bio"):
    nick = f"{nick_prefix}_{int(time.time()) % 1000000}"
    r = requests.post(f"{API}/join", json={"nickname": nick}, timeout=15)
    assert r.status_code == 200
    return r.json()


def test_get_bio_empty_for_new_user():
    u = _new_user()
    r = requests.get(f"{API}/users/{u['user_id']}/bio", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["user_id"] == u["user_id"]
    assert body["bio"] == ""
    assert body["nickname"] == u["nickname"]


def test_put_bio_persists():
    u = _new_user()
    r = requests.put(
        f"{API}/users/{u['user_id']}/bio",
        json={"bio": "the soup is alive"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json()["bio"] == "the soup is alive"
    # Read-back
    r2 = requests.get(f"{API}/users/{u['user_id']}/bio", timeout=15)
    assert r2.json()["bio"] == "the soup is alive"


def test_put_bio_strips_whitespace():
    u = _new_user()
    r = requests.put(
        f"{API}/users/{u['user_id']}/bio",
        json={"bio": "   weird stuff   "},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json()["bio"] == "weird stuff"


def test_put_bio_too_long_rejected():
    u = _new_user()
    r = requests.put(
        f"{API}/users/{u['user_id']}/bio",
        json={"bio": "x" * 501},
        timeout=15,
    )
    assert r.status_code == 400


def test_put_bio_unknown_user_404():
    r = requests.put(
        f"{API}/users/does-not-exist/bio",
        json={"bio": "hello"},
        timeout=15,
    )
    assert r.status_code == 404


def test_get_bio_unknown_user_404():
    r = requests.get(f"{API}/users/does-not-exist/bio", timeout=15)
    assert r.status_code == 404


def test_bio_can_be_overwritten():
    u = _new_user()
    requests.put(f"{API}/users/{u['user_id']}/bio", json={"bio": "first"}, timeout=15)
    requests.put(f"{API}/users/{u['user_id']}/bio", json={"bio": "second"}, timeout=15)
    r = requests.get(f"{API}/users/{u['user_id']}/bio", timeout=15)
    assert r.json()["bio"] == "second"
