# Hosted Postgres: three options for the beta

Scope: a small production database for the beta (under 5 GB, under 50 connections), backups included, EU region available.

## Summary

| Option | Monthly (beta size) | Backups | Branching | Notes |
|---|---|---|---|---|
| Provider North | $19 | daily, 7 days | yes | scales to zero; cold start about 400 ms |
| Provider Quay | $25 | point-in-time, 7 days | no | fixed instance; predictable latency |
| Self-managed VM | $12 + your time | scripted | no | cheapest; you own patching |

## Recommendation

Provider Quay for the beta: predictable latency matters more than branching right now, and point-in-time restore covers the one scary failure (a bad migration).

## What I checked

- Pricing pages as of this week, beta-size tier.
- Restore drill: restored a 1 GB dump on each managed option; both under 4 minutes.
- Connection limits with the app's pool size of 20.

## Open questions

1. Do we need branching for preview deploys before launch?
2. Is an EU-only region a hard requirement?
