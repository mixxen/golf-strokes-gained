# Golf Strokes Gained

A mobile-friendly static web app for recording a round shot by shot and calculating strokes gained.

## Current prototype

- Persistent 18-hole scorecard with per-hole par and tee distance
- Sequential stroke entry: each finish becomes the next starting position
- Automatic drive, approach, short-game, and putting inference
- Nine-zone directional miss capture
- Detailed finish and relief positions
- Per-hole editing, deletion, undo, scoring, and completion flow
- Local browser persistence with schema migration
- GitHub Pages deployment and automated calculation tests

## Strokes-gained calculation

For a played stroke without a penalty:

```text
SG = expected strokes before − 1 − expected strokes after
```

When the result includes penalty strokes:

```text
SG = expected strokes before − (1 + penalty strokes) − expected strokes after relief
```

The app treats stroke-and-distance outcomes specially: the post-penalty position is the exact starting position, so a one-penalty-stroke out-of-bounds or lost-ball result is exactly `-2.00 SG`. Penalty-area and unplayable-ball entries ask for the actual relief lie and distance.

For a completed hole, the per-stroke values are checked against the identity:

```text
hole SG = expected strokes from the tee − actual hole score
```

Actual hole score includes both played strokes and penalty strokes.

## Run locally

No build step is required.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

Run the calculation tests with:

```bash
npm test
```

## GitHub Pages

The repository deploys the static site whenever changes are pushed to `main`. Configure **Settings → Pages → Build and deployment → Source** to **GitHub Actions** if needed.

The application is available at:

https://mixxen.github.io/golf-strokes-gained/

## Benchmark warning

The expected-strokes table is still an approximate prototype reference. The formula, sequence accounting, relief handling, score totals, and complete-hole consistency checks are tested, but a documented authoritative or player-level benchmark dataset should replace the bundled table before formal performance evaluation.
