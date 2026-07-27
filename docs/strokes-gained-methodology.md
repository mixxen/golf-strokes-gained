# Strokes-Gained Methodology

## Benchmark implemented by this application

The application uses the historical PGA TOUR benchmark published by Mark Broadie:

- **Benchmark ID:** `broadie-pga-tour-2003-2010-v1`
- **Population:** PGA TOUR players
- **Data period:** 2003–2010
- **Off-green source:** Mark Broadie, “Assessing Golfer Performance on the PGA TOUR,” *Interfaces* 42(2), Table B.1
- **Putting source:** Mark Broadie, “Putts Gained: Measuring Putting on the PGA TOUR,” Figure 1 and accompanying table
- **Adjustment:** none for event, course, round, weather, or field strength

Primary references:

- [Broadie 2012 — Assessing Golfer Performance on the PGA TOUR](https://business.columbia.edu/sites/default/files-efs/pubfiles/4996/assessing_golfer_performance.full.pdf)
- [Broadie 2011 — Putts Gained: Measuring Putting on the PGA TOUR](https://www.columbia.edu/~mnb2/broadie/Assets/putting_strokes_gained_20110113.pdf)

This is a documented historical comparison baseline. It is not represented as the unpublished current PGA TOUR lookup surface or as the official event-adjusted statistic.

## Per-stroke equation

Broadie defines a shot’s value as the change in expected strokes to hole out, less the stroke taken:

```text
SG = J(start lie, start distance) − 1 − J(finish lie, finish distance)
```

Where `J(lie, distance)` is the expected number of strokes a benchmark PGA TOUR player requires to hole out from that state.

For a result that includes penalty strokes:

```text
SG = J(start) − (1 + penalty strokes) − J(position after relief)
```

This is equivalent to representing every penalty stroke as a separate event with no favorable movement of the ball.

## Example: approach into a bunker

A 150-yard approach from the fairway has an interpolated benchmark of:

```text
J(fairway, 150 yd) = 2.945
```

If it finishes 20 yards from the hole in sand:

```text
J(sand, 20 yd) = 2.53
SG = 2.945 − 1 − 2.53 = −0.585
```

If it finishes 40 yards from the hole in sand:

```text
J(sand, 40 yd) = 2.82
SG = 2.945 − 1 − 2.82 = −0.875
```

A 60-yard fairway shot that finishes 20 yards away in sand is:

```text
SG = 2.70 − 1 − 2.53 = −0.83
```

Broadie used a 60-yard shot into a greenside bunker as an example of an exceptionally poor shot. The bunker loss comes from the sand expected-strokes curve and resulting distance, not from a fixed bunker surcharge.

## Lie mapping

The public Broadie benchmark has six states: tee, fairway, rough, sand, recovery, and green.

| App result | Benchmark state | Rationale |
|---|---|---|
| Fairway | Fairway | Direct mapping |
| First cut | Rough | No separate first-cut curve |
| Rough | Rough | Direct mapping |
| Deep rough, direct route available | Rough | Recovery is not a synonym for difficult rough |
| Fairway bunker | Sand | Broadie publishes one sand curve |
| Greenside bunker | Sand | Distance differentiates the situation |
| Fringe | Fairway | Explicit proxy; no public fringe curve |
| Trees / recovery | Recovery | Direct route is obstructed or a pitch-out is required |
| Green | Green | Distance is measured in feet |

The detailed app result remains stored even when multiple results use the same benchmark state.

## Distance interpolation and range handling

- Off-green distances are measured in **yards**.
- Putting distances are measured in **feet**.
- Exact published points are used without modification.
- Intermediate values use linear interpolation.
- Values outside the published range use the nearest endpoint rather than undocumented extrapolation.

The off-green table begins at 10 yards. Very short chips, pitches, and bunker shots therefore currently use the 10-yard endpoint. This is a known limitation and should be addressed with a separately sourced short-game benchmark before the app is treated as authoritative for sub-10-yard analysis.

## Penalties

### Stroke and distance

For a one-stroke penalty followed by replay from the identical position:

```text
SG = J(start) − 2 − J(start) = −2.00
```

The application uses this treatment for standard out-of-bounds and lost-ball entries.

### Penalty area and unplayable ball

The user records the actual lie and distance from which the next stroke will be played. The app then calculates:

```text
SG = J(start) − 2 − J(relief position)
```

## Completed-hole identity

For a completed hole, the shot values telescope:

```text
sum of shot SG = J(tee distance) − actual hole score
```

The actual score includes physical strokes and penalty strokes. The app checks this identity after every completed hole. This verifies accounting consistency, but the source-based golden tests are what verify the benchmark values themselves.

## Category reporting

The app currently records drive, approach, chip/short-game, and putt shot types. These categories are for aggregation only; the SG value itself always comes from the before-and-after states.

PGA TOUR documents “around the green” as within 30 yards of the
**edge of the green**. See the
[PGA TOUR stat definition](https://www.pgatour.com/korn-ferry-tour/stats/detail/331).
The application currently uses distance to the **flag** for automatic
short-game inference because its round data does not include distance to the
nearest green edge or green geometry.

The flag lies inside the green, so the current `30 yards to the flag` test is a
conservative subset of the PGA TOUR definition:

- A shot within 30 yards of the flag is necessarily within 30 yards of the near
  edge along the line to the flag.
- A shot more than 30 yards from the flag may nevertheless be within 30 yards
  of another or nearer part of the green edge.

The second case can cause an official around-the-green shot to be reported as
an approach. It does not alter the shot's expected-strokes calculation, the
shot's SG value, or total SG; it only reallocates SG between the approach and
around-the-green subtotals.

This is a known future correction. A complete implementation should capture
distance to the nearest green edge, derive it from authoritative green
geometry, or let the user explicitly override the inferred category. Merely
increasing the flag-distance threshold would be an undocumented approximation.

The official PGA TOUR event-adjusted statistics also apply course/round and
field adjustments that are not available to this application. It currently
reports **unadjusted strokes gained versus the Broadie historical PGA TOUR
benchmark**.
