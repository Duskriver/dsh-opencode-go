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
- only events are scanned; the dashboard never parses compressed logs on disk or makes a session live.

The browser receives aggregate numbers only: no session ids, titles, content, working directories, or credentials.

## What is counted

### Included

- `assistant/message` events on the `dsh-opencode-go` route (one settled model request each);
- `compaction/summary` events on the same route (the summarization request);
- the pre-0.1.16 `opencode-go` route, but only for requests before 2026-09-30 UTC. Later `opencode-go` records belong to DSH's native route and are excluded.

### Excluded

- DSH's native OpenCode Go route and every other provider;
- fork-inherited prefixes (cut at `inheritedEventCount`);
- model calls that never enter the session log (for example some title generation);
- failed requests whose gateway charge is not represented by a usage record; they appear only as unsettled attempts.

### Request time and range

The request start comes from the matching `step/start` event, falling back to the message event time. Summaries use their own event time. The range is half-open `[from, to)` and days are bucketed in the browser's IANA timezone.

### Tokens

- input, output, cache read, and cache write are tracked separately;
- billed input = input + cache read + cache write (pi-ai's input excludes caches);
- missing or malformed usage counts as missing usage and is never zero-filled into the estimate.

### Estimate

- current models.dev rates for `opencode-go` (USD per 1M tokens);
- the highest matching context tier prices the whole request;
- DeepSeek V4.1 Flash and V4 Pro double during the documented peak window;
- amounts accumulate as integer micro-USD; this is an estimate, not an invoice.

## Monthly limits

Each row shows the Go and Go Plus monthly limit from the official plan page snapshot dated 2026-10-18 (`src/go-plan.ts`). Promotional rows use the effective value and say "limited time"; free rows are unlimited; unknown models show "Limit unknown".

The official `/usage` five-hour, weekly, and monthly percentages remain authoritative; the dashboard never derives them from the estimate.

## Themes and the pill

- Four styles: **Silent Black**, **Graphite** (default), **Sea Salt**, and **Warm Sand**. Each has a dark and a light variant that follows DSH's color scheme.
- The only switch is the **Theme** row inside the settings page's Usage analytics card, where each option previews its own surface, accent and text colors. The choice is stored in the browser, not in the settings document.
- The pill popover and the dashboard no longer carry a switch; they render whatever style is selected.
- With multiple accounts, the pill shows the active account's initial and the number of extra accounts (for example `P+2`); the full name stays in the button title and the expanded panel. Account switching is unchanged.
- The settings page keeps DSH's own appearance and is not affected by these themes.

## Scan limits and performance

- by default, at most **500 sessions**, **500,000 events**, and **12 seconds**;
- exceeding a limit marks the report incomplete and offers **Scan more history** (1,000 then 2,000 sessions);
- facts from closed sessions are cached in memory, so reopening and changing ranges only re-aggregate; live sessions are re-read each time;
- there is no background polling; closing the dialog stops the request.

## Known limitations

- session request headers carry no account identity, so history cannot be split per account; the dashboard totals every saved account;
- a request that fails or is canceled before usage may still be billed by the gateway but adds no cost;
- summaries count as requests, so the request total includes them;
- device or gateway clock skew can move a request across a peak boundary or a day boundary;
- models.dev rates and the official plan page can drift; the footer shows the price update time and the limit snapshot date.

## Verification

The `analytics-scan`, `analytics-pricing`, and `analytics` specs plus the two client specs cover provider filtering, fork cutoffs, peak pricing, tiers, caching, truncation, the unsupported state, and both entry points. All use synthetic sessions and a fake query service; no real user logs are read.
