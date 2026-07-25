# Golf Strokes Gained

A mobile-friendly, static web application for recording golf shots and calculating strokes gained by category.

## Current prototype

The first vertical slice includes:

- Course, date, hole, and par entry
- Shot entry using starting and finishing lies and distances
- Approximate expected-strokes benchmark tables with linear interpolation
- Strokes-gained totals for off the tee, approach, around the green, and putting
- Penalty-stroke handling
- Automatic carry-forward of the previous finishing position
- Undo and new-round controls
- Browser local-storage persistence
- Responsive mobile-first styling

## Run locally

No build system is required. Open `index.html` directly, or serve the repository with any static web server.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

After merging the prototype, enable GitHub Pages under **Settings → Pages** and deploy from the `main` branch root.

## Benchmark warning

The bundled values are approximate and are currently intended to validate application behavior and user experience. A documented, authoritative expected-strokes dataset should replace them before using the results for formal player evaluation.

## Planned next steps

1. Separate calculation, benchmark, storage, and UI modules.
2. Add deterministic unit tests for interpolation, penalties, categorization, and aggregation.
3. Add shot editing and deletion.
4. Add hole completion, scoring, and round export.
5. Replace prototype benchmark values with sourced datasets and selectable comparison baselines.
