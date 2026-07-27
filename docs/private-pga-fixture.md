# Private PGA shot fixture

The repository includes a one-time importer for a small, private development
fixture. It defaults to Rory McIlroy's four regulation rounds at the 2025 THE
PLAYERS Championship.

The downloaded records are deliberately excluded from Git:

```text
data/private/
```

Do not commit, publish, redistribute, or use the importer as a scheduled
collector. PGA TOUR data remains subject to the provider's terms even when the
fixture is used only for development.

## Import

Use an API key available to an authorized PGA TOUR web session. Pass it only as
an environment variable; the importer does not write the key to disk.

```bash
PGA_API_KEY="..." npm run fixture:pga
```

The default output is:

```text
data/private/rory-mcilroy-2025-players.json
```

## Load it into the app

1. Open the app landing page.
2. Expand **Developer test data**.
3. Choose **Choose PGA fixture**.
4. Select `data/private/rory-mcilroy-2025-players.json`.

The browser converts the four PGA rounds into the app's round schema and stores
them in local browser storage. No file upload or network request occurs during
this step. The imported cards are labeled **PGA test data**, and importing the
same fixture again refreshes those rounds instead of creating duplicates.

Each imported round is complete and opens read-only by default. Choose **Edit
round** if an input needs to be changed for a test.

The importer only allows output beneath `data/private/`. It performs four
requests—one for each regulation round—and does not crawl players, tournaments,
or seasons.

Expected summary for the default fixture:

```json
{
  "rounds": 4,
  "holes": 72,
  "actions": 277,
  "physicalStrokes": 275,
  "penaltyStrokes": 1,
  "drops": 1,
  "score": 276,
  "scoreFromActions": 276,
  "scoreMatchesActions": true
}
```

The penalty and drop occurred on hole 9 in round 3 after a tee shot entered the
water. This is useful for validating the distinction between a physical stroke,
a penalty stroke, and a non-scoring drop action.

## Normalized fields

Each action retains the source play-by-play text and includes:

- Round, hole, and stroke number
- Action type (`stroke`, `penalty`, or `drop`)
- Shot and remaining distance with normalized units
- Distance to the hole before and after each action
- Starting and finishing source locations and codes
- Benchmark-lie mapping used by the app
- Left, right, or target-side finish
- Shot coordinates, when present
- Final-stroke status

The public feed does not identify the player's club or intended target. Its
left/right labels describe the measured finishing area and should not be
presented as a definitive intended-target miss.

## Validation boundary

This fixture can validate score reconstruction, shot ordering, lie mapping,
penalty bookkeeping, strokes-gained aggregation, and analytics displays. It
cannot make this app's historical Broadie baseline identical to the PGA TOUR's
current event-adjusted statistic.
