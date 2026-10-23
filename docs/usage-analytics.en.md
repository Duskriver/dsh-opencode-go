# Usage analytics notes

[Back to README](../README.en.md) · [简体中文](usage-analytics.md)

This page documents what the `dsh-opencode-go` usage dashboard counts, how it prices requests, and what it deliberately leaves out.

## Entry points

- the **Usage analytics** row at the bottom of the pill's expanded panel, styled like the account row above it;
- the **Usage analytics** card on the settings page: the same folding card the model and advanced sections use. Unfolded it has two rows — **Dashboard**, which opens the dashboard, and **Theme**, which picks the style. Folded, its trailing note names the style in force.

## Data source

The Host reads DSH's `ctx.sessionQuery`:

- `listSessions()` lists sessions newest-first;
- `readSession(id)` returns the complete event log, including closed sessions;
- only events are scanned; the dashboard never parses compressed logs on disk or makes a session live. After an app restart, unchanged sessions are served from the local fold cache without decompressing their logs again.

The browser receives aggregate numbers only: no session ids, titles, content, working directories, or credentials.

Session scanning and aggregation run locally, but model and pricing metadata may refresh from `https://models.dev/api.json`. That request carries no conversation content, account keys or per-request analytics. Normal inference and quota requests still reach your configured model gateway; there is no additional telemetry or analytics service.

## What is counted

### Included

- `assistant/message` events on the `dsh-opencode-go` route (one settled model request each);
- `compaction/summary` events on the same route (the summarization request);
- the pre-0.1.16 `opencode-go` route, but only for requests before 2026-09-30 UTC. Later `opencode-go` records belong to DSH's native route and are excluded.

### Excluded

- DSH's native OpenCode Go route and every other provider;
- fork-inherited prefixes (sequence numbers strictly below `inheritedEventCount`; the boundary slot belongs to this session, matching the host's half-open `isOwnSeq`);
- model calls that never enter the session log (for example some title generation);
- model calls that cannot be attributed to this plugin's route (the log lacks a routing header or model name) — the footer counts them as unattributed activity, without tokens or cost;
- failed requests whose gateway charge is not represented by a usage record; they appear only as unsettled attempts.

### Request time and range

The request start comes from the matching `step/start` event; when that key is absent (legacy or damaged logs) the session's most recent `step/start` is used, and the message event time is the fallback only when a session recorded no start at all. The legacy-route judgment follows the request start time. Summaries use their own event time. The range is half-open `[from, to)` and days are bucketed in the browser's IANA timezone.

### Tokens

- input, output, cache read, and cache write are tracked separately;
- billed input = input + cache read + cache write (pi-ai's input excludes caches);
- usage degrades per field: a present-but-malformed component zeroes only itself while the valid components still count; a request counts as missing usage only when input and output are both missing or malformed, and missing usage is never zero-filled into the estimate;
- cache hit rate = cache read / (input + cache read + cache write): output tokens never enter the denominator, matching the repository's existing session statistic; a zero denominator shows 0.0%.

### Estimate

- current models.dev rates for `opencode-go` (USD per 1M tokens) — all history is estimated at the rates in force at query time (models.dev publishes no historical rates);
- the highest matching context tier prices the whole request;
- DeepSeek V4.1 Flash and V4 Pro double during the documented peak window;
- a model whose upstream cost block is missing or malformed is treated as unpriced: it adds no cost, is counted separately, and its cost cell shows an **unpriced** tag; such models were previously priced at zero silently — the new display is louder but honest. A genuinely free model with a published, legal (including all-zero) cost block still prices at zero;
- the lead sentence only states an amount when at least one request was priced: with `pricedRequests === 0` it puts `—` where the amount would go (the same meaning as the KPI's `-`), so "cannot be priced" is never rendered as `$0.00`;
- when the price table fails or times out (at most a 4-second wait) the last successful table is used; with no usable table at all, every model that appeared is listed as unpriced;
- amounts accumulate as integer micro-USD; this is an estimate, not an invoice.

## Model detail

Each model row shows only the display name plus requests, input, output, cache read, cost, and cost share; the invocation id and the Go / Go Plus monthly limits are no longer rendered (the snapshot data remains in `src/go-plan.ts`).

The cost cell has three states: priced requests render the estimate (even when some requests in the same row are unpriced); `pricedRequests === 0` with `unpricedRequests > 0` renders the **unpriced** tag; a row whose requests all lack usage (both pricing counters are zero) renders `—`, meaning the row carries no usable data rather than "free". The share cell renders `—` whenever there is no amount, and the composition note's "also free or unpriced" line only lists genuinely unpriced models, no longer mixing in missing-usage rows.

The official `/usage` five-hour, weekly, and monthly percentages remain authoritative; the dashboard never derives them from the estimate. The quota row now shows only the window name, percentage, bar, reset time and the near-limit tick — the "plenty left / near limit" wording and the remaining-percentage line are gone.

The daily view is pointer-interactive: hovering a calendar cell (or within 5px of one) or any point on the trend shows that day's estimate, request count and tokens, highlights the same bucket in both views and draws a vertical guide. Selection is computed from the distance to the nearest cell: moving more than 5px away from every cell — into the gaps between cells — clears it immediately instead of holding the previous bucket, and leaving the chart area clears it too. Per-model, per-day breakdowns are not part of the current contract, so the tooltip reports the day's totals.

The calendar is laid out densely by calendar date across the selected range (a 30-day range always fills 30 cells, capped at 366): dates missing from `byDay` become zero-value cells, so every cell always sits under its true weekday instead of drifting when activity skips dates. Days without activity are hoverable too and report $0.00 / 0 requests; the trend shares this dense series, so the hover index matches in both views. The daily average is computed over the range's calendar days (including days without activity), the same denominator as the KPI band.

## Themes and the pill

- Four styles: **Silent Black**, **Graphite** (default), **Sea Salt**, and **Warm Sand**. Each has a dark and a light variant that follows DSH's color scheme.
- The only switch is the **Theme** row inside the settings page's Usage analytics card, where each option previews its own surface, accent and text colors. The choice is stored in the browser, not in the settings document.
- The pill popover and the dashboard no longer carry a switch; they render whatever style is selected.
- The pill no longer carries the `Go ·` prefix; with multiple accounts it shows the active account's full name, truncated with an ellipsis when long, with the complete name kept in the button title and accessible label while the expanded panel still offers every account. Account switching is unchanged, and pill rebuilds triggered by account or connection changes no longer close an open dashboard.
- The settings page keeps DSH's own appearance and is not affected by these themes.

## Scan limits and performance

- by default, at most **500 sessions**, **500,000 events**, and **12 seconds**, read with up to eight concurrent session reads (falling back to serial for a Host that cannot read concurrently);
- exceeding a limit marks the report incomplete with its cause (session slice / event budget / time budget); the footer also reports how many sessions were left unread when the budget or cap stopped the scan, without implying the range was fully covered;
- **Scan more history** raises the session cap to 1,000 then 2,000; the choice is stored in the browser and survives reopening the panel;
- closed sessions' folds are cached in memory and served LRU-style, checking their durable log revision on every scan: a session resumed and closed between dashboard opens is re-read when its revision changes. When the Host has no revision, its index fails, or the session is missing from that index, in-memory reuse is limited to five seconds. Live folds also have a five-second reuse window and are re-read on closing; eviction happens only at the end of a scan, and a report is always built from the results actually read in that run, so cache eviction cannot silently drop requests;
- folds are also persisted to `~/.dsh/cache/dsh-opencode-go/analytics-folds.v1.json` (honoring `DSH_HOME`): the file is versioned, capped at 32MB, replaced atomically, and entries not re-verified for 30 days are dropped on the next write. Entries are validated against the durable log revision reported by the Host's `sessionPersistence`, so after an app restart every session whose log did not change is reused without being read again. Live sessions are never written, a cancelled scan writes nothing, and an incomplete scan only merges what it read instead of deleting unseen entries; a Host without `sessionPersistence` (or with a failing one) falls back to the in-memory cache with no effect on the report. The cache holds session ids, model names, token counts and timestamps only — no titles, message text, working directories or credentials;
- the price table is fetched in parallel with the scan, waiting at most 4 seconds;
- the footer splits list / scan / pricing timings;
- within one open, the window end is taken once at open time, so re-entering the same range does not rescan; **Refresh** forces a new scan;
- without a reusable cache, the first scan reads the target sessions under the limits above; when durable revisions are available, later scans re-read only changed closed sessions, and persisted folds can also be reused after a restart;
- a range already seen in this open renders its previous report immediately and revalidates in the background, explicitly labeled as the previous scan while loading;
- closing the dialog aborts the running scan; there is no background polling.

## Contract compatibility rules

The dashboard's query and report are validated on both sides by the strict codecs in `src/analytics-contract.ts`. Two rules are now fixed repository policy:

- **New fields travel as optional numbers/strings**: the report validator passes unknown keys through and the query validator drops unknown fields, so adding optional numeric or string fields is safe when both ends ship together. The new `coverage.listMs` / `pricingMs` / `unreadSessions` / `evictedSessions` / `unattributedRequests` fields followed this channel; an older client keeps accepting a report that carries them;
- **Never add a value to an enum**: `coverage.truncation` and a model row's `limitNote` are whitelist-validated enum fields — an older client rejects the **whole report** on an unknown enum value. Do not extend these enums without shipping the change on both ends.

## Known limitations

- session request headers carry no account identity, so history cannot be split per account; the dashboard totals every saved account;
- a request that fails or is canceled before usage may still be billed by the gateway but adds no cost;
- summaries count as requests, so the request total includes them;
- device or gateway clock skew can move a request across a peak boundary or a day boundary;
- models.dev rates and the official plan page can drift; the footer shows the price update time.

## Verification

The `analytics-scan`, `analytics-pricing`, and `analytics` specs plus the two client specs cover provider filtering, fork cutoffs, peak pricing, tiers, per-field usage degradation, request-time fallbacks, the cache reuse window, truncation and budget stops, the concurrency pool, unpriced models, price-table fallback, cancellation, segmented timings, and both entry points. All use synthetic sessions and a fake query service; no real user logs are read.
