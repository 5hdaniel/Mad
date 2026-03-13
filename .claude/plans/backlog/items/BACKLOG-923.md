# BACKLOG-923: Remote Support Session via WebRTC Screen Sharing

**Type:** Feature
**Area:** Electron / Broker Portal
**Priority:** Medium
**Status:** Pending
**Created:** 2026-03-10
**Estimated Effort:** 2-3 weeks (view-only), +1-2 weeks (remote control)

---

## Summary

Add a remote support feature that lets support agents view end-user desktops in real-time via WebRTC screen sharing. Unlike SaaS impersonation (which swaps server-side sessions), Keepr's local-first architecture requires streaming the actual app window since data lives in an encrypted local SQLite DB.

## Architecture

```
User's Electron App                    Broker Portal (Next.js)
+-----------------+                   +---------------------+
| desktopCapturer  |--WebRTC stream-->|  <video> element     |
| (app window only)|                   |                     |
|                  |<--control events--|  Mouse/KB relay      |
+-----------------+                   +---------------------+
         |                                      |
         +---- Signaling via Supabase Realtime --+
```

## Implementation Phases

### Phase 1: View-Only Screen Sharing (2-3 weeks)

| Component | Details |
|---|---|
| **desktopCapturer integration** | Electron main process captures app window only (never full desktop) |
| **WebRTC signaling** | Supabase Realtime channels for ICE candidate exchange, offer/answer |
| **Peer connection (Electron)** | Standard RTCPeerConnection in renderer, media stream from capturer |
| **Viewer (Broker Portal)** | `<video>` element + session controls (end, pause, fullscreen) |
| **Session management** | `support_sessions` DB table, invite flow, agent permissions |
| **UI (Electron)** | "Share Screen with Support" button, active session indicator, kill switch |

### Phase 2: Remote Control (1-2 weeks)

| Component | Details |
|---|---|
| **Input relay** | Agent's mouse/keyboard events sent via data channel |
| **Coordinate mapping** | Map agent viewport coordinates to Electron window coordinates |
| **Input injection** | `webContents.sendInputEvent()` for mouse/keyboard on Electron side |
| **Permission escalation** | User must explicitly grant control (separate from view-only) |

## Security Requirements

- **Explicit opt-in**: User must click to start each session (no silent activation)
- **App window only**: `desktopCapturer` filtered to Keepr window — never full desktop
- **Short-TTL tokens**: Session tokens expire quickly, single-use
- **Audit trail**: Log every support session (who initiated, agent, duration, actions)
- **Kill switch**: User can end session instantly at any time
- **Encryption**: WebRTC DTLS-SRTP (built-in)
- **Remote control consent**: Separate permission grant for Phase 2

## Infrastructure Notes

- May need a TURN server for users behind strict corporate firewalls (NAT traversal)
- Consider Twilio TURN or self-hosted `coturn` for reliability
- Supabase Realtime handles signaling — no additional signaling server needed

## Key Files (Expected)

| Location | Purpose |
|---|---|
| `electron/main/remote-support.ts` | Main process: desktopCapturer, session management |
| `electron/preload/remote-support.ts` | IPC bridge for renderer |
| `src/services/remote-support-service.ts` | Renderer: WebRTC connection, UI state |
| `src/components/RemoteSupportButton.tsx` | UI component for initiating/ending sessions |
| `admin-portal/app/dashboard/support/` | Broker portal viewer page |
| Supabase migration | `support_sessions` table |

## Related

- SaaS impersonation comparison discussed in design session (2026-03-10)
- Option 2 (state snapshot) and Option 3 (co-browsing/DOM replay) were evaluated and rejected in favor of WebRTC for best effort-to-value ratio
