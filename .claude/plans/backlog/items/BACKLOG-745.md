# BACKLOG-745: Sticky tab bar with scroll-spy for Settings modal

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Area** | UI/UX |
| **Priority** | Medium |
| **Status** | Testing |
| **Sprint** | - |
| **PR** | #895 |
| **Branch** | `feature/settings-tab-bar-scroll-spy` |
| **Created** | 2026-02-20 |

## Description

Adds a sticky navigation tab bar at the top of the Settings modal that highlights the currently visible section via IntersectionObserver scroll-spy. Includes click-to-scroll, bottom-detection for small sections, and license-gated AI tab filtering.

## Key Components

- **`SettingsTabBar.tsx`** - Sticky tab bar component rendered at the top of the Settings modal
- **`useScrollSpy.ts`** - Custom hook using IntersectionObserver for scroll-spy behavior with bottom-detection logic for small/short sections
- **`Settings.tsx`** - Updated to integrate the tab bar and scroll-spy wiring

## Features

- Sticky tab header that stays visible while scrolling Settings content
- Active tab highlight tracks the currently visible section as user scrolls
- Click-to-scroll navigation jumps to the selected section
- Bottom-detection ensures the last/small sections correctly activate even when they cannot reach the top of the viewport
- License-gated AI tab filtering (AI section only shown when licensed)

## Acceptance Criteria

- [ ] Tab bar is sticky at the top of the Settings modal
- [ ] Active tab updates correctly as user scrolls through sections
- [ ] Clicking a tab scrolls to the corresponding section
- [ ] Small sections near the bottom of the modal are correctly detected
- [ ] AI tab is only visible when license permits
- [ ] No regressions in existing Settings functionality
