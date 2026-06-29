# Avatar Card Squares Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stock-avatar card squares to profile surfaces, with uploaded avatars still centered in the square and stock cards opening a larger view.

**Architecture:** Create a focused asset helper and reusable React component so stock-card selection, initials, fallback, and modal behavior live in one place. Wire that component into `ProfileWindow` and `ProfilePage` without changing upload semantics or Dripnet/Wall behavior yet.

**Tech Stack:** React, Create React App/CRACO tests, Vite production build, static assets in `frontend/public/assets/avatar-cards/`, browser visual QA.

---

## File Structure

- Create `frontend/src/lib/avatarCards.js`: maps stock avatar IDs to card asset paths and exports initials/selection helpers.
- Create `frontend/src/lib/avatarCards.test.js`: unit tests for initials and asset priority.
- Create `frontend/src/components/AvatarCardSquare.jsx`: square tile renderer, initials chip, uploaded/stock/fallback rendering, and stock-card modal.
- Create `frontend/src/components/AvatarCardSquare.test.jsx`: component tests for stock modal behavior and uploaded-avatar priority.
- Modify `frontend/src/components/ProfileWindow.jsx`: replace the current 64x64 image/initial block with `AvatarCardSquare`.
- Modify `frontend/src/components/ProfilePage.jsx`: replace stock avatar rendering with `AvatarCardSquare` while preserving uploaded image priority.
- Create assets under `frontend/public/assets/avatar-cards/full/` and `frontend/public/assets/avatar-cards/square/` for all current stock avatars.

## Task 1: Card Asset Helpers

**Files:**
- Create: `frontend/src/lib/avatarCards.js`
- Test: `frontend/src/lib/avatarCards.test.js`

- [ ] **Step 1: Write failing helper tests**

```js
import {
    avatarInitials,
    avatarCardAssetFor,
    avatarCardSquareSrc,
    avatarCardFullSrc,
} from "./avatarCards";

describe("avatar card helpers", () => {
    test("builds readable initials from one or more words", () => {
        expect(avatarInitials("rich ford")).toBe("RF");
        expect(avatarInitials("weirdbot")).toBe("W");
        expect(avatarInitials("  ")).toBe("??");
    });

    test("animated stock avatars resolve before static sprites", () => {
        expect(avatarCardAssetFor({ animId: "ape", spriteId: "ghost_cute" })?.id).toBe("ape");
        expect(avatarCardSquareSrc("ape")).toBe("/assets/avatar-cards/square/ape.png");
        expect(avatarCardFullSrc("ape")).toBe("/assets/avatar-cards/full/ape.png");
    });

    test("static stock avatars resolve when no animated avatar is selected", () => {
        expect(avatarCardAssetFor({ spriteId: "ghost_cute" })?.id).toBe("ghost_cute");
        expect(avatarCardAssetFor({ animId: "not-real", spriteId: "ghost_cute" })?.id).toBe("ghost_cute");
    });

    test("unknown stock avatars return null", () => {
        expect(avatarCardAssetFor({ animId: "nope", spriteId: "also-nope" })).toBeNull();
        expect(avatarCardSquareSrc("nope")).toBeNull();
        expect(avatarCardFullSrc("nope")).toBeNull();
    });
});
```

- [ ] **Step 2: Verify helper tests fail**

Run: `CI=true npm test -- --watchAll=false src/lib/avatarCards.test.js`

Expected: FAIL because `avatarCards.js` does not exist.

- [ ] **Step 3: Implement helper module**

```js
export const ANIMATED_AVATAR_CARD_IDS = [
    "alien", "ape", "cat", "fairy", "frog", "ghost",
    "robot", "skeleton", "slime", "tvhead", "weirdbot",
];

export const STATIC_AVATAR_CARD_IDS = [
    "ghost_tiny", "ghost_cute", "ghost_giant",
    "alien_gray", "alien_green", "alien_hulk",
    "ape_baby", "ape_dude", "ape_king",
];

const CARD_IDS = new Set([...ANIMATED_AVATAR_CARD_IDS, ...STATIC_AVATAR_CARD_IDS]);

export function avatarInitials(nickname) {
    const parts = String(nickname || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function avatarCardSquareSrc(id) {
    return CARD_IDS.has(id) ? `/assets/avatar-cards/square/${id}.png` : null;
}

export function avatarCardFullSrc(id) {
    return CARD_IDS.has(id) ? `/assets/avatar-cards/full/${id}.png` : null;
}

export function avatarCardAssetFor({ animId, spriteId } = {}) {
    if (CARD_IDS.has(animId)) {
        return { id: animId, squareSrc: avatarCardSquareSrc(animId), fullSrc: avatarCardFullSrc(animId) };
    }
    if (CARD_IDS.has(spriteId)) {
        return { id: spriteId, squareSrc: avatarCardSquareSrc(spriteId), fullSrc: avatarCardFullSrc(spriteId) };
    }
    return null;
}
```

- [ ] **Step 4: Verify helper tests pass**

Run: `CI=true npm test -- --watchAll=false src/lib/avatarCards.test.js`

Expected: PASS.

## Task 2: AvatarCardSquare Component

**Files:**
- Create: `frontend/src/components/AvatarCardSquare.jsx`
- Test: `frontend/src/components/AvatarCardSquare.test.jsx`

- [ ] **Step 1: Write failing component tests**

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import AvatarCardSquare from "./AvatarCardSquare";

describe("AvatarCardSquare", () => {
    test("renders stock card art with initials and opens large card", () => {
        render(<AvatarCardSquare nickname="rich ford" animId="ape" size={80} testId="card-square" />);

        expect(screen.getByTestId("card-square")).toHaveAttribute("data-card-id", "ape");
        expect(screen.getByTestId("avatar-card-initials")).toHaveTextContent("RF");

        fireEvent.click(screen.getByTestId("card-square"));

        expect(screen.getByTestId("avatar-card-modal")).toBeInTheDocument();
        expect(screen.getByAltText("APE card")).toHaveAttribute("src", "/assets/avatar-cards/full/ape.png");
    });

    test("uploaded avatar wins and does not open a stock modal", () => {
        render(<AvatarCardSquare nickname="rich ford" avatarUrl="/uploads/rich.png" animId="ape" size={80} testId="card-square" />);

        expect(screen.getByTestId("avatar-card-uploaded")).toHaveAttribute("src", "/uploads/rich.png");
        fireEvent.click(screen.getByTestId("card-square"));

        expect(screen.queryByTestId("avatar-card-modal")).not.toBeInTheDocument();
    });

    test("unknown avatar falls back to initials tile", () => {
        render(<AvatarCardSquare nickname="single" animId="missing" size={80} testId="card-square" />);

        expect(screen.getByTestId("avatar-card-fallback")).toHaveTextContent("SI");
        expect(screen.getByTestId("card-square")).toHaveAttribute("aria-disabled", "true");
    });
});
```

- [ ] **Step 2: Verify component tests fail**

Run: `CI=true npm test -- --watchAll=false src/components/AvatarCardSquare.test.jsx`

Expected: FAIL because `AvatarCardSquare.jsx` does not exist.

- [ ] **Step 3: Implement component**

Implement a button-like square that:

- Uses `avatarCardAssetFor()` and `avatarInitials()`.
- Shows uploaded image if `avatarUrl` exists.
- Shows stock square image if no uploaded image exists and a stock card exists.
- Shows initials fallback otherwise.
- Opens a fixed-position modal only for stock cards.
- Uses high-contrast initials chip over stock cards.
- Falls back to initials if an image errors.

- [ ] **Step 4: Verify component tests pass**

Run: `CI=true npm test -- --watchAll=false src/components/AvatarCardSquare.test.jsx`

Expected: PASS.

## Task 3: Wire Profile Surfaces

**Files:**
- Modify: `frontend/src/components/ProfileWindow.jsx`
- Modify: `frontend/src/components/ProfilePage.jsx`

- [ ] **Step 1: Update `ProfileWindow`**

Replace the current `currentAvatar ? <img> : <div>{initial}</div>` block with:

```jsx
<AvatarCardSquare
    nickname={user.nickname}
    avatarUrl={currentAvatar ? fileUrl(currentAvatar.storage_path) : null}
    animId={user.anim_id}
    spriteId={user.sprite_id}
    size={64}
    testId="profile-avatar-card"
/>
```

If `user.anim_id` and `user.sprite_id` are not available on this object, pass the current desktop state down from `Desktop.jsx`.

- [ ] **Step 2: Update `ProfilePage`**

Replace `pickAvatarRender(profile)` with `AvatarCardSquare` using:

```jsx
<AvatarCardSquare
    nickname={profile.nickname}
    avatarUrl={profile.avatar_path ? fileUrl(profile.avatar_path) : null}
    animId={profile.anim_id}
    spriteId={profile.sprite_id}
    size={144}
    testId="profile-page-avatar-card"
/>
```

Keep live/offline layout and links unchanged.

- [ ] **Step 3: Run focused tests**

Run: `CI=true npm test -- --watchAll=false src/lib/avatarCards.test.js src/components/AvatarCardSquare.test.jsx`

Expected: PASS.

## Task 4: Generate And Install Assets

**Files:**
- Create: `frontend/public/assets/avatar-cards/full/*.png`
- Create: `frontend/public/assets/avatar-cards/square/*.png`

- [ ] **Step 1: Create directories**

Run:

```bash
mkdir -p frontend/public/assets/avatar-cards/full frontend/public/assets/avatar-cards/square
```

- [ ] **Step 2: Extract animated cards**

Use the generated animated deck sheet and corrected APE card. Crop the 4x3 animated sheet into named cards, then replace `full/ape.png` with the corrected purple APE card. Create square crops from the center area of each full card.

- [ ] **Step 3: Extract static cards**

Crop the 3x3 legacy sheet into named cards and create square crops from each full card.

- [ ] **Step 4: Inspect asset dimensions**

Run:

```bash
find frontend/public/assets/avatar-cards -type f -name '*.png' -print0 | xargs -0 sips -g pixelWidth -g pixelHeight
```

Expected: every current stock avatar has both `full/{id}.png` and `square/{id}.png`.

## Task 5: Verification And Visual QA

**Files:**
- Modify tests only if a legitimate import/path issue appears.

- [ ] **Step 1: Run frontend tests**

Run: `CI=true npm test -- --watchAll=false src/lib/avatarCards.test.js src/components/AvatarCardSquare.test.jsx src/lib/api.test.js src/lib/admin.test.js src/components/IsoWorld.test.js`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS. Existing chunk-size warning is acceptable.

- [ ] **Step 3: Visual QA in browser**

Use the currently running local app at `http://127.0.0.1:3000/r/jello`:

- Open My Profile and confirm the square shows card art plus initials for a stock avatar.
- Click the square and confirm the large card opens.
- Public profile page shows the same square card behavior for stock avatars.
- Uploaded avatars still render as centered images and do not open the stock-card modal.

## Self Review

- Spec coverage: stock-vs-upload priority, initials, card modal, asset model, and profile surfaces are covered by tasks 1-5.
- Placeholder scan: no `TBD`, `TODO`, or unresolved “implement later” steps.
- Type consistency: helper names and component prop names match across tests, component, and profile wiring.
