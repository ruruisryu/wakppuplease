# WAKPPU Please

- This is a full-screen 3D game, not a dashboard. Preserve the playable world and compact HUD.
- Stack: Three.js 0.180, TypeScript, Vite. `npm ci`, `npm run dev`, `npm test`, `npm run build`, `npm run preview`.
- Game rules in `src/game/`; renderer in `src/render/`; input, audio and UI have separate modules. Balance JSON uses seconds, coins, world units.
- Read `docs/implementation.md` for implemented decisions; `docs/wax-shop-design.md` is earlier proposed research.
- Preserve WAKPPU_clicker; it is a read-only reference, not this project's working directory.
- Browser evidence goes in `output/playwright/`. Never claim deployment before public URL verification.
