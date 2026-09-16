# Kakistocracy: Survive the Term

An isometric satirical simulation of a superpower in freefall. Survive a 4-year term (JAN 2024 → DEC 2027) while your cabinet does as much dumb stuff as possible before the Debt, Party IQ, Happiness or DEFCON ends the run.

- Game design: [docs/GAME_PLAN.md](docs/GAME_PLAN.md)
- Coding rules and project status: [CLAUDE.md](CLAUDE.md)

## Getting started

1. Install **Node.js 22 LTS** from <https://nodejs.org> (check with `node -v`) and Yarn (`npm install -g yarn`).
2. In this folder:

   ```bash
   yarn install
   yarn start
   ```

3. The game opens in your browser at <http://localhost:5173>.

Before finishing any change, run:

```bash
yarn verify
```

It runs the typecheck, lint, format check and tests. (npm works too: `npm install`, `npm start`, `npm run verify`.)

## Scripts

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `yarn start`      | Dev server with hot reload, opens the browser |
| `yarn dev`        | Same, without opening the browser             |
| `yarn build`      | Production build into `dist/`                 |
| `yarn preview`    | Serve the production build                    |
| `yarn test`       | Run tests once                                |
| `yarn test:watch` | Tests in watch mode                           |
| `yarn lint`       | ESLint                                        |
| `yarn format`     | Format all files with Prettier                |
| `yarn verify`     | Typecheck + lint + format check + tests       |

## Tech

React 19 · TypeScript · Vite · Zustand · Vitest · ESLint · Prettier. PixiJS joins in Phase 2 for the rooms.
