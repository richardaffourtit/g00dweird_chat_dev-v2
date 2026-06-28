import asyncio

import pytest

from admin import assert_admin_identity, is_admin_nickname, normalize_admin_nickname


def test_admin_nickname_normalizes_rich_ford_variants():
    assert normalize_admin_nickname(" Rich   Ford ") == "rich ford"
    assert is_admin_nickname("rich ford")
    assert is_admin_nickname("RICH FORD")
    assert not is_admin_nickname("rich")
    assert not is_admin_nickname("weirdbot")


def test_assert_admin_identity_requires_matching_user_record():
    class Users:
        async def find_one(self, query, projection):
            assert query == {"id": "owner-1"}
            assert projection == {"_id": 0, "nickname": 1}
            return {"nickname": "Rich Ford"}

    class Db:
        users = Users()

    assert asyncio.run(assert_admin_identity(Db(), "owner-1", "rich ford")) == {"nickname": "Rich Ford"}


def test_assert_admin_identity_rejects_non_admin_handle():
    class Users:
        async def find_one(self, query, projection):
            return {"nickname": "Someone Else"}

    class Db:
        users = Users()

    with pytest.raises(PermissionError):
        asyncio.run(assert_admin_identity(Db(), "user-2", "someone else"))
