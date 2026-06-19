# ISLANDS & ROADS - Claude Code Guide

## Project

Browser board game inspired by Catan. The primary development target is the
offline game. Keep it fully playable before porting changes to online mode.

- Offline UI: `index.html`, `app.js`, `styles.css`, `trade.css`
- Online UI: `online.html`, `online.js`, `online.css`, `online-map.css`
- Online server/game state: `server.js`
- No build step and no third-party runtime dependencies

## Run

```sh
npm start
```

Open:

- Offline game: `http://localhost:4180/index.html`
- Online game: `http://localhost:4180/online.html`

Always use the HTTP URLs. Do not test through `file://`, because that does not
exercise the same runtime path as the supported local server.

## Test

```sh
npm run test:all
```

Individual suites:

```sh
npm test
npm run test:offline
npm run test:online
```

After UI changes, also verify the offline game in a real browser. The VM test
must emulate browser DOM errors strictly, but it cannot replace visual checks.

## Required Game Invariants

- Initial placement order is `0,1,2,3,3,2,1,0`.
- Every player starts normal play with two settlements, two roads, and 2 VP.
- Confirmed settlements and roads must remain visible for the entire game.
- The board must not overlap the bottom action bar.
- At the start of a human turn, roll is enabled and end-turn is disabled.
- After rolling, roll is disabled and end-turn is enabled.
- Sound off must stop active sounds immediately and prevent new sounds.
- Victory is at 10 points. Display scores as `勝利点 N / 10`.

## Implementation Notes

- Confirmed pieces use the `.persistent-piece` layer. Do not merge them back
  into the clickable `.node` and `.edge` candidate elements.
- Never pass an empty string to `classList.add`; real browsers throw.
- Preserve unrelated user changes. Keep fixes scoped and run all tests.
- When changing state transitions, extend `offline-play-test.js` or
  `server-core-test.js` with the corresponding invariant.

