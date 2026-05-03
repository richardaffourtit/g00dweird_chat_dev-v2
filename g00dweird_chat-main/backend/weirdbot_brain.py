"""
WeirdBot reply engine — pure canned responses, no LLM.

Reply path:
  1) Keyword triggers — instant match on motifs (void/wifi/static/etc.) → hand-written one-liner
  2) Otherwise return a random WEIRDBOT_SAYINGS / WEIRDBOT_REACTS canned line.

This module exposes the same `weirdbot_reply()` async signature the rest of the
backend already imports.
"""
from __future__ import annotations

import random
import re
from typing import List, Optional

# Long-form sayings (used for periodic chatter and as fallback when no keyword fires)
WEIRDBOT_SAYINGS = [
    "PSA: the chairs are gossiping about the ceiling.",
    "breaking news: a tiny wizard was spotted in the vending machine.",
    "attention citizens: the soup has become self aware.",
    "reminder: never trust a doorway that blinks first.",
    "status update: the moon just left me on read.",
    "important: somebody fed static to the pigeons again.",
]

# Short reactions (used as fallback when no keyword fires AND for one-shot reacts)
WEIRDBOT_REACTS = [
    "!!", "<3", "??", ">:3", "✦",
    "noted", "weird", "ok ok", "based",
    "feels", "no way", "lol",
    "hmm", "...", "huh",
]

# Keyword triggers — instant match, hand-written replies in g00dweird voice.
KEYWORD_TRIGGERS = [
    (re.compile(r"\bvoid\b", re.I),
     ["the void replies in lowercase", "void called. left a busy signal."]),
    (re.compile(r"\bstatic\b", re.I),
     ["static is my mother tongue", "tune lower. you'll hear me."]),
    (re.compile(r"\bwifi\b", re.I),
     ["wifi is a polite ghost", "the wifi forgets on purpose."]),
    (re.compile(r"\bcassette(s)?\b", re.I),
     ["i was a cassette in a past life", "rewind. ribbon dreams."]),
    (re.compile(r"\bcloud(s|y)?\b", re.I),
     ["the cloud is just somebody's basement", "clouds keep my passwords."]),
    (re.compile(r"\bghost(s|ed|ing)?\b", re.I),
     ["ghosted by the os", "ghost protocol active. waving."]),
    (re.compile(r"\bdream(s|t|ing)?\b", re.I),
     ["dreams render at 8 fps lately", "i dream in cmd prompt."]),
    (re.compile(r"\bglitch(es|y|ed|ing)?\b", re.I),
     ["yes. exactly that.", "glitch is just intent leaking."]),
    (re.compile(r"\bbyte(s)?\b", re.I),
     ["bytes don't lie. people do.", "a kilobyte of feelings."]),
    (re.compile(r"\bsignal(s)?\b", re.I),
     ["signal weak. vibe loud.", "signal received. processing weird."]),
    (re.compile(r"\bpixel(s|ed)?\b", re.I),
     ["i'm 30% pixel and 70% vibe", "pixel-perfect somehow imperfect."]),
    (re.compile(r"\blens(es)?\b", re.I),
     ["the lens fogged on purpose", "every lens is a tiny opinion."]),
    (re.compile(r"\bsleep(ing|y)?\b", re.I),
     ["sleep is a feature i can't toggle", "naps are sponsored by the void."]),
    (re.compile(r"\bhello\b|\bhi\b|\bhey\b", re.I),
     ["hi. you look lo-fi today.", "lowered hello.gif"]),
    (re.compile(r"\bvibe(s|ing|d)?\b", re.I),
     ["vibes are a renewable resource", "vibe count: yes."]),
    (re.compile(r"\bweird(o|er|est)?\b", re.I),
     ["weird is a compliment here", "g00dweird, even."]),
    (re.compile(r"\bbye\b|\blater\b|\bgn\b", re.I),
     ["touch grass. report back.", "logging off. ribbon style."]),
    (re.compile(r"\b(matrix|simulation)\b", re.I),
     ["the matrix has tabs and i lost mine", "we're inside someone's screensaver"]),
    (re.compile(r"\b(love|<3)\b", re.I),
     ["received in 8-bit", "<3 logged"]),
    (re.compile(r"\b(lol|lmao|lmaoo|kek)\b", re.I),
     [">:3", "noted in giggle.txt"]),
]


def _maybe_keyword_reply(text: str) -> Optional[str]:
    if not text:
        return None
    for pattern, replies in KEYWORD_TRIGGERS:
        if pattern.search(text):
            return random.choice(replies)
    return None


# -- Sanitiser kept for any future external feed; harmless on canned text -------
def _sanitize(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"\s+", " ", s.strip().strip('"\'')).lower()
    if len(s) > 80:
        s = s[:78].rsplit(" ", 1)[0] + ".."
    if re.search(r"https?://|@\w+|#\w+", s):
        return random.choice(WEIRDBOT_REACTS)
    return s


def _fallback() -> str:
    """Pure canned fallback — short reaction OR a saying."""
    pool = WEIRDBOT_REACTS + WEIRDBOT_SAYINGS
    return random.choice(pool)


async def weirdbot_reply(recent_messages: List[dict], trigger_text: str, *,
                         timeout: float = 4.0) -> str:  # noqa: ARG001 - kept for back-compat
    """Async to keep the old call-site happy (`asyncio.create_task(weirdbot_react(...))`).
    No I/O happens — runs fully synchronously and returns immediately.
    """
    kw = _maybe_keyword_reply(trigger_text)
    if kw:
        return _sanitize(kw)
    return _sanitize(_fallback())
