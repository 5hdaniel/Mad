/**
 * Tests for emailConnectionEvents utility
 * TASK-1730: Email connection state propagation
 */

import { renderHook, act } from "@testing-library/react";
import {
  emitEmailConnectionChanged,
  useEmailConnectionListener,
  EMAIL_CONNECTION_CHANGED,
  type EmailConnectionEventDetail,
} from "../emailConnectionEvents";

describe("emailConnectionEvents", () => {
  describe("emitEmailConnectionChanged", () => {
    it("emits a custom event with connection details", () => {
      const eventHandler = jest.fn();
      window.addEventListener(EMAIL_CONNECTION_CHANGED, eventHandler);

      emitEmailConnectionChanged({
        connected: true,
        email: "user@gmail.com",
        provider: "google",
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      const event = eventHandler.mock.calls[0][0] as CustomEvent<EmailConnectionEventDetail>;
      expect(event.detail).toEqual({
        connected: true,
        email: "user@gmail.com",
        provider: "google",
      });

      window.removeEventListener(EMAIL_CONNECTION_CHANGED, eventHandler);
    });

    it("emits disconnect event without email", () => {
      const eventHandler = jest.fn();
      window.addEventListener(EMAIL_CONNECTION_CHANGED, eventHandler);

      emitEmailConnectionChanged({
        connected: false,
        provider: "microsoft",
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      const event = eventHandler.mock.calls[0][0] as CustomEvent<EmailConnectionEventDetail>;
      expect(event.detail).toEqual({
        connected: false,
        provider: "microsoft",
      });

      window.removeEventListener(EMAIL_CONNECTION_CHANGED, eventHandler);
    });
  });

  describe("useEmailConnectionListener", () => {
    it("calls callback when email connection event is emitted", () => {
      const callback = jest.fn();
      renderHook(() => useEmailConnectionListener(callback));

      act(() => {
        emitEmailConnectionChanged({
          connected: true,
          email: "test@outlook.com",
          provider: "microsoft",
        });
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        connected: true,
        email: "test@outlook.com",
        provider: "microsoft",
      });
    });

    it("cleans up event listener on unmount", () => {
      const callback = jest.fn();
      const { unmount } = renderHook(() => useEmailConnectionListener(callback));

      // Emit event while mounted
      act(() => {
        emitEmailConnectionChanged({ connected: true, email: "a@b.com", provider: "google" });
      });
      expect(callback).toHaveBeenCalledTimes(1);

      // Unmount and emit again
      unmount();
      act(() => {
        emitEmailConnectionChanged({ connected: false, provider: "google" });
      });

      // Should not receive second event
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("responds to multiple events", () => {
      const callback = jest.fn();
      renderHook(() => useEmailConnectionListener(callback));

      act(() => {
        emitEmailConnectionChanged({ connected: true, email: "user1@gmail.com", provider: "google" });
        emitEmailConnectionChanged({ connected: false, provider: "google" });
        emitEmailConnectionChanged({ connected: true, email: "user2@outlook.com", provider: "microsoft" });
      });

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, {
        connected: true,
        email: "user1@gmail.com",
        provider: "google",
      });
      expect(callback).toHaveBeenNthCalledWith(2, {
        connected: false,
        provider: "google",
      });
      expect(callback).toHaveBeenNthCalledWith(3, {
        connected: true,
        email: "user2@outlook.com",
        provider: "microsoft",
      });
    });

    it("handles callback updates correctly", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const { rerender } = renderHook(
        ({ cb }) => useEmailConnectionListener(cb),
        { initialProps: { cb: callback1 } }
      );

      act(() => {
        emitEmailConnectionChanged({ connected: true, email: "a@b.com", provider: "google" });
      });
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(0);

      // Rerender with new callback
      rerender({ cb: callback2 });

      act(() => {
        emitEmailConnectionChanged({ connected: false, provider: "google" });
      });
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe("EMAIL_CONNECTION_CHANGED constant", () => {
    it("is a non-empty string", () => {
      expect(typeof EMAIL_CONNECTION_CHANGED).toBe("string");
      expect(EMAIL_CONNECTION_CHANGED.length).toBeGreaterThan(0);
    });
  });
});
