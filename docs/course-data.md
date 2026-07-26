# Course data integration

## Provider boundary

The application currently uses OpenGolfAPI, but provider-specific URLs and response fields are isolated in:

```text
js/course-providers/opengolfapi.js
```

The adapter exposes two operations:

```js
provider.searchCourses(query)
provider.getCourse(courseId)
```

Both return normalized app-owned objects. UI and round logic do not read raw OpenGolfAPI fields.

## API endpoints and schema

The implementation targets the full current endpoints documented by the provider’s OpenAPI 3.1 specification:

```text
GET https://api.opengolfapi.org/api/v1/courses/search?q={query}
GET https://api.opengolfapi.org/api/v1/courses/{id}
```

The detail response provides:

- `tees[]` with `tee_key`, name, color, gender, course rating, slope, par, and total yardage
- `holes_data[]` with hole number, par, handicap index, and a `yardages` map keyed by tee color/name

The adapter joins each tee to hole yardages by normalized tee color, then tee name, then the non-gender portion of the tee key. It retains incomplete tee sets and reports how many holes contain usable yardages.

## Cache and fallback behavior

- Search results remain fresh for 24 hours.
- Full course details remain fresh for 30 days.
- Expired entries remain available as a fallback when a live request fails.
- Cache size is capped to the 20 latest searches and 12 latest course details.
- The six latest imported course/tee combinations are shown as recent shortcuts.
- Storage failures never prevent live lookup or manual entry.

The cache uses `localStorage`; it is device- and browser-specific.

## Import behavior

Importing a tee set:

1. Sets the round course name.
2. Replaces every available hole par and tee yardage.
3. Leaves missing yardages editable rather than inventing values.
4. Records source, license, selected tee, rating, slope, and import time.
5. Recalculates recorded strokes if the user confirms an import into an active round.
6. Marks provenance as locally modified after a manual course, par, or yardage edit.

## Attribution and license

Course data is provided by [OpenGolfAPI](https://opengolfapi.org/) under the [Open Data Commons Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

The attribution is displayed in the app footer and alongside an imported scorecard. Redistributors should review the ODbL requirements before publishing a derivative course database.

## Known limitations

- Provider coverage is primarily the United States.
- Community data can be incomplete or stale.
- Some combination tees may not share a simple color/name key with the per-hole yardage map.
- The app has no server-side proxy, so anonymous rate limits apply.
- There is no cloud course cache or cross-device sync.
