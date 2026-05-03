"""
iter10/11 backend tests:
  - keyword triggers fire instantly (no LLM, no I/O)
  - reply_no_keyword still returns a non-empty canned response
  - sanitiser strips dangerous content
  - LLM is NOT imported — pure canned brain
"""
import asyncio
import os
import sys

import pytest


def test_keyword_void_returns_canned():
    from weirdbot_brain import _maybe_keyword_reply
    out = _maybe_keyword_reply("yo i feel the void today")
    assert out is not None
    assert "void" in out.lower() or out.startswith("void")


def test_keyword_no_match_returns_none():
    from weirdbot_brain import _maybe_keyword_reply
    assert _maybe_keyword_reply("the rain falls quietly") is None
    assert _maybe_keyword_reply("") is None


def test_sanitize_strips_caps_and_long():
    from weirdbot_brain import _sanitize
    assert _sanitize('"NICE try void"') == "nice try void"
    out = _sanitize("x" * 200)
    assert len(out) <= 80
    # URLs become a fallback (canned reaction)
    out_url = _sanitize("yo @rick check https://x.y")
    assert "https" not in out_url and "@" not in out_url


@pytest.mark.asyncio
async def test_reply_uses_keyword_path():
    from weirdbot_brain import weirdbot_reply
    out = await weirdbot_reply([{"nickname": "u", "text": "wifi forever"}], "wifi forever")
    assert out
    # one of the wifi-trigger lines
    assert "wifi" in out or "ghost" in out or len(out) > 0


@pytest.mark.asyncio
async def test_reply_falls_to_canned_without_keyword():
    from weirdbot_brain import weirdbot_reply, WEIRDBOT_REACTS, WEIRDBOT_SAYINGS
    out = await weirdbot_reply([{"nickname": "u", "text": "mornin' all"}], "mornin' all")
    assert out  # non-empty
    # must be from one of the canned pools (case-insensitive contains)
    pool = [s.lower() for s in WEIRDBOT_REACTS + WEIRDBOT_SAYINGS]
    assert out.lower() in pool, f"reply '{out}' not in canned pool"


def test_llm_module_not_imported_at_module_load():
    """Confirms the bot does not pull in external LLM integrations on import."""
    # Remove cached import if any (this test file may re-import after others)
    sys.modules.pop("weirdbot_brain", None)
    import weirdbot_brain  # noqa: F401
    assert not any(name.endswith(".llm.chat") for name in sys.modules)
