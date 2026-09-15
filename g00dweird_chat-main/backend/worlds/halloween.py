"""Halloween Town's entrance, in the shared 1000 by 500 stage coordinates."""

from hashlib import blake2s


async def enter_halloween(_ctx, conn, _room) -> None:
    # Keep arrivals on the open plaza, clear of the crooked houses and hill.
    # A stable spread gives returning users the same spot without piling up.
    seed = int.from_bytes(blake2s(conn.user_id.encode(), digest_size=4).digest(), "big")
    conn.x = 456 + seed % 89
    conn.y = 304 + (seed // 89) % 33
