from __future__ import annotations

import re

ADMIN_NICKNAME = "rich ford"


def normalize_admin_nickname(nickname: str | None) -> str:
    return re.sub(r"\s+", " ", (nickname or "").strip()).lower()


def is_admin_nickname(nickname: str | None) -> bool:
    return normalize_admin_nickname(nickname) == ADMIN_NICKNAME


async def assert_admin_identity(db, user_id: str | None, nickname: str | None) -> dict:
    if not user_id or not is_admin_nickname(nickname):
        raise PermissionError("admin access required")

    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "nickname": 1})
    if not user_doc or not is_admin_nickname(user_doc.get("nickname")):
        raise PermissionError("admin access required")

    return user_doc
