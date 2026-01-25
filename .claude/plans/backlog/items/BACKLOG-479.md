# BACKLOG-479: Device Registration Service

**Category**: service
**Priority**: P1
**Sprint**: SPRINT-057
**Estimated Tokens**: ~20K
**Status**: Pending

---

## Summary

Create a service for managing device registrations and enforcing device limits.

## Background

Device limits prevent account sharing:
- Trial: 1 device
- Individual: 2 devices
- Team: Unlimited

## Requirements

### Service Interface

```typescript
// electron/services/deviceService.ts
export async function registerDevice(userId: string): Promise<{
  success: boolean;
  error?: 'device_limit_reached' | 'already_registered';
}>;

export async function getDeviceId(): Promise<string>;
export async function deactivateDevice(userId: string, deviceId: string): Promise<void>;
export async function listDevices(userId: string): Promise<DeviceRegistration[]>;
```

### Implementation Requirements

1. **Device ID Generation**:
   - Use machine-specific identifier (machine-id package or similar)
   - Persist if regeneration is problematic

2. **Registration Flow**:
   - Check if device already registered
   - If new, check against limit (trigger handles this)
   - Register and return success

3. **Device Management**:
   - List active devices for user
   - Deactivate device (for "log out everywhere" feature)

### Error Handling

- Clear error message when device limit reached
- UI should show which devices are registered
- Option to deactivate a device remotely

## Acceptance Criteria

- [ ] `getDeviceId()` returns consistent ID for same machine
- [ ] `registerDevice()` succeeds when under limit
- [ ] `registerDevice()` fails gracefully when limit reached
- [ ] `deactivateDevice()` marks device inactive
- [ ] `listDevices()` returns all registered devices

## Dependencies

- BACKLOG-477: Schema must exist first

## Related Files

- `electron/services/deviceService.ts`
- `package.json` (may need machine-id dependency)
