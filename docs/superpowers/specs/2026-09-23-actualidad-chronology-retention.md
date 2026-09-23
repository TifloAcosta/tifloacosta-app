# Android 1.3.0 — Actualidad chronology and retention addendum

Date: 2026-09-23

This addendum records the final product decision for the Android 1.3.0 Actualidad list.

## General list order

The general Actualidad list is chronological. The publication timestamp supplied by the source is authoritative for ordering; discovery or ingestion time is not.

- Newest published story appears first.
- Older stories follow in descending publication order.
- `featuredRank` or other editorial highlighting must not move a story ahead of a more recently published story in the general list.
- Featured/editorial priority may still be used in other surfaces, such as a home preview, without changing the general Actualidad chronology.

## Story presentation

Each story card presents its primary metadata in this order:

1. Title.
2. Publishing medium/source.
3. Publication date and time.
4. New-item marker when applicable.
5. Summary and actions.

Date and time are rendered in the device/user local timezone. The application stores/transports an unambiguous timestamp but does not force Canary Islands time or any other fixed timezone in the UI.

## Language

The Android Actualidad list shows the catalog matching the selected interface language. Spanish and English catalogs remain independently bounded.

## Retention

The mobile feed keeps a useful rolling background without becoming a permanent archive.

- Maximum age: 10 days from publication.
- Maximum retained stories: 60 per language.
- Both limits apply; whichever removes a story first wins.
- Invalid publication timestamps do not enter the mobile Actualidad feed.
- Future-dated stories do not enter the mobile Actualidad feed until their publication time is valid relative to feed generation.

## New-item state

The existing Android 1.3.0 seen-state design remains in force:

- First use establishes a baseline rather than marking the existing backlog new.
- Later unseen stable IDs are marked with explicit readable text (`Nuevo` / `New`).
- Actualidad announces the count of new items since the previous visit.
- Visiting Actualidad consumes the current new-item state for the next visit.
- No visual-only marker is sufficient.

## Acceptance tests

Automated coverage must demonstrate:

- out-of-order input becomes strict publication-time descending output;
- stories older than 10 days are removed;
- only the newest 60 stories per language are retained;
- invalid dates are rejected;
- the screen filters to the active interface language;
- title is followed by source and localized publication date/time;
- the general screen contains no `featuredRank` ordering;
- `Intl.DateTimeFormat` uses the device timezone rather than a hard-coded timezone.
