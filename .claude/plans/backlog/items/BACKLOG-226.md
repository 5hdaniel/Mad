# BACKLOG-226: URL Preview Formatting in Messages

## Problem Statement

URLs shared in iMessages show as plain text links instead of rich previews like iMessage displays them (with title, description, thumbnail).

## Current Behavior

- URLs appear as plain text in message bubbles
- No preview card with site title/description/image
- Less visual context for shared links

## Expected Behavior

- Detect URLs in message text
- Fetch Open Graph / meta data for preview
- Display preview card similar to iMessage:
  - Site favicon
  - Page title
  - Description snippet
  - Thumbnail image (if available)

## Technical Considerations

- Would need to fetch URL metadata (og:title, og:description, og:image)
- Could cache previews to avoid re-fetching
- Privacy: fetching URLs reveals user activity
- Option: Only show previews for URLs that were previewed in original iMessage

## Priority

Low - Nice to have enhancement

## Acceptance Criteria

- [ ] URLs detected in message text
- [ ] Preview card displayed below/inline with message
- [ ] Shows title, description, and thumbnail
- [ ] Graceful fallback for sites without meta tags

## Notes

- Discovered during SPRINT-034 verification
- User mentioned "would be nice if it was formatted with the preview like it is on iMessages but it's not critical at all"
