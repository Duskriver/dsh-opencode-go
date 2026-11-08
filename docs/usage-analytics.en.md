# Usage analytics notes

[Back to README](../README.en.md) · [简体中文](usage-analytics.md)

The dashboard shows official history for the workspace belonging to the selected OpenCode key. It can include calls from other clients and does not attribute calls to this plugin. Coverage of anonymous Free calls is not guaranteed.

## Entry points and accounts

Open it from the conversation's expanded usage pill or the sidebar dashboard button. Settings no longer include a usage analytics card; the interface theme picker is under **Settings → OpenCode Go → Advanced settings → Usage settings → Appearance**.

The dashboard has an independent viewing-account selector, defaulting to the account currently used for inference. Changing it only changes the dashboard scope; it does not switch the account for subsequent conversations or combine all saved accounts. The dashboard's five-hour, weekly and monthly quota windows follow the selected account and use official quota percentages.

## Official data source

The Host uses the selected account's key to request the official daily CSV:

```text
https://opencode.ai/console/api/v2/usage/export?range=7d|30d|90d
```

Totals, daily charts and model detail all come from one CSV snapshot, avoiding differences between endpoints queried at different times. Ranges are today, 7 days, 30 days and 90 days; today filters the 7-day CSV to the current UTC date. All dates use UTC, with missing dates filled with zero to keep the daily series continuous. Official daily aggregates may be delayed, so refreshing may not immediately include a recently completed call.

The Host stores and uses keys. Normal reports send the browser only aggregate numbers and grouping fields such as provider, model and day, without conversation content, member fields or keys. An official CSV explicitly downloaded by the user may contain official member fields.

History queries require an official model gateway configuration before the Host sends a key to the `opencode.ai` Console. Third-party gateways show an unsupported state and their keys are not sent to Console. Queries retain the configured proxy path, cancellation, timeouts and response-size limits.

## Accounting

| Metric | Source |
| --- | --- |
| Requests | Sum of official CSV request counts |
| Input / output tokens | Official input and output fields, summed separately |
| Cache-read tokens | Sum of the official cache-read field |
| Cache-write tokens | Sum of official 5-minute and 1-hour cache-write fields |
| Total tokens | Input + output + cache read + both cache-write fields |
| Official usage amount | Exact sum of `cost_micro_cents`; `1 USD = 100,000,000 cost_micro_cents` |
| Model grouping | Provider + model; identical model names from different providers stay separate |

The amount comes directly from official records and is labeled **official usage amount**. It does not mean an additional charge beyond the Go subscription. The dashboard does not reprice history using the current model catalog or derive quota percentages from amounts.

Only source-supported metrics are shown. Local session coverage, summary-call counts, unsettled attempts and unattributed activity are not reported or filled with misleading zeros. UTC zero-filling only means the official CSV contains no records for that day.

## Presentation and refresh

- A wide-screen dialog becomes full-screen on narrow screens, with stacked daily token bars or daily request bars, model rankings and detail.
- Settings, the pill, expanded sidebar and dashboard share component layouts and internal tokens, following the Host's light/dark mode. `appearanceTheme: native` (the default) follows DSH and third-party themes through public Host semantic tokens for colors, fonts, radii and more, with neutral fallbacks for unresolved tokens. `classic` retains warm paper / charcoal surfaces, terracotta accents, and preferred local Anthropic Serif / Sans / Mono fonts with system and CJK serif fallbacks; Host and third-party themes do not override these brand tokens. Existing profiles without the field default to Native, while the input's `badge` / `plain` styles and the sidebar quota switch keep their existing behavior.
- History queries run only when opening the dashboard, changing the viewing account or range, or refreshing manually. There is no background history polling; closing the dashboard cancels its active query.
- The Host caches official reports and CSVs for 30 seconds, isolated by credential, account, network configuration, range and UTC date. A forced manual refresh bypasses the cache.
- Authentication, permission, network and data-format errors show an explicit failure, without falling back to local session scans or fabricated zero usage.

The usage pill's existing quota refresh is independent of history queries.

## Verification

An existing manual check on 2026-11-06 used the current desktop key without Cookie or organization headers. All four official Console history endpoints returned HTTP 200, with matching 30-day totals of **7,064 requests, 1,105,009,939 tokens and 3,152,640,453 cost_micro_cents**. This established that the daily CSV supplies the dashboard data; it does not establish identical permissions for every account or complete anonymous Free coverage.

See [verification notes](verification.md) for this implementation's automated tests, build and UI checks. Unfinished checks are marked separately.
