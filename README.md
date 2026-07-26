# Golf Strokes Gained

A mobile-friendly static web app for recording a round stroke by stroke and calculating strokes gained.

## Current capabilities

- Persistent 18-hole scorecard with per-hole par and tee distance
- Sequential stroke entry: every finish becomes the next starting position
- Automatic drive, approach, short-game, and putting inference
- Nine-zone directional miss capture
- Fairway, rough, bunker, recovery, green, relief, and stroke-and-distance outcomes
- Per-hole editing, deletion, undo, scoring, and completion flow
- Local browser persistence with schema migration and recalculation
- GitHub Pages deployment and automated calculation tests

## Implemented benchmark

The app uses the historical PGA TOUR expected-strokes benchmark published by Mark Broadie:

- **Benchmark ID:** `broadie-pga-tour-2003-2010-v1`
- **Comparison population:** PGA TOUR players
- **ShotLink period:** 2003–2010
- **Adjustment:** unadjusted for course, round, weather, event, and field strength

Primary references:

- [Mark Broadie, “Assessing Golfer Performance on the PGA TOUR” — off-green Table B.1](https://business.columbia.edu/sites/default/files-efs/pubfiles/4996/assessing_golfer_performance.full.pdf)
- [Mark Broadie, “Putts Gained: Measuring Putting on the PGA TOUR” — putting benchmark](https://www.columbia.edu/~mnb2/broadie/Assets/putting_strokes_gained_20110113.pdf)
- [Detailed methodology used by this app](docs/strokes-gained-methodology.md)

This is a documented historical baseline. It is not presented as the unpublished current PGA TOUR lookup surface or as the official event-adjusted PGA TOUR statistic.

## Strokes-gained calculation

For a played stroke without a penalty:

```text
SG = J(start lie, start distance) − 1 − J(finish lie, finish distance)
```

`J(lie, distance)` is the expected number of strokes a benchmark golfer requires to hole out from that state.

When the result includes penalty strokes:

```text
SG = J(start) − (1 + penalty strokes) − J(position after relief)
```

The app treats standard stroke-and-distance outcomes specially: after the physical stroke and one penalty stroke, the next position is the exact prior lie and distance. Therefore:

```text
SG for standard OB / lost ball = J(start) − 2 − J(start) = −2.00
```

Penalty-area and unplayable-ball entries ask for the actual relief lie and distance.

## Bunker example

Broadie’s benchmark gives:

```text
J(fairway, 150 yd) = 2.945
J(sand, 20 yd) = 2.53
```

Therefore a 150-yard fairway approach finishing 20 yards from the hole in a bunker is:

```text
SG = 2.945 − 1 − 2.53 = −0.585
```

The same shot finishing 40 yards from the hole in sand is `−0.875 SG`. The app does not add an arbitrary bunker surcharge; the loss comes from the resulting sand state and distance.

## Lie mapping

- Fairway bunker and greenside bunker → `sand`
- Deep rough with an unobstructed route → `rough`
- Trees / blocked / pitch-out required → `recovery`
- Fringe → `fairway` proxy because the public benchmark has no separate fringe curve
- Green distances are entered in feet; all other distances use yards

Detailed app results are preserved for analytics even when they map to the same Broadie benchmark state.

## Interpolation and range limits

- Published points are used exactly.
- Intermediate distances use linear interpolation.
- Distances outside the published range use the nearest endpoint rather than undocumented extrapolation.
- The published off-green table begins at 10 yards, so sub-10-yard short-game results currently use the 10-yard endpoint. This limitation is visible in the methodology and should be addressed with a separately sourced short-game benchmark later.

## Completed-hole consistency

For a completed hole, per-stroke values must telescope to:

```text
hole SG = J(tee distance) − actual hole score
```

Actual score includes physical strokes and penalty strokes. The app checks this identity and also uses source-based golden tests to verify the published benchmark values.

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
