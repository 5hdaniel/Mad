/**
 * Unit tests for useToast hook
 * Tests toast notification management including creation, removal, and auto-dismiss
 */

import { renderHook, act } from "@testing-library/react";
import { useToast } from "../useToast";

describe("useToast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with empty toasts array", () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.toasts).toEqual([]);
    });

    it("should provide all required methods", () => {
      const { result } = renderHook(() => useToast());

      expect(typeof result.current.showToast).toBe("function");
      expect(typeof result.current.showSuccess).toBe("function");
      expect(typeof result.current.showError).toBe("function");
      expect(typeof result.current.showWarning).toBe("function");
      expect(typeof result.current.removeToast).toBe("function");
      expect(typeof result.current.clearAll).toBe("function");
    });
  });

  describe("showToast", () => {
    it("should add a toast with default info type", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast("Test message");
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe("Test message");
      expect(result.current.toasts[0].type).toBe("info");
      expect(result.current.toasts[0].id).toMatch(/^toast-\d+$/);
    });

    it("should add a toast with specified type", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast("Error message", "error");
      });

      expect(result.current.toasts[0].type).toBe("error");
    });

    it("should add multiple toasts with unique IDs", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast("First");
        result.current.showToast("Second");
        result.current.showToast("Third");
      });

      expect(result.current.toasts).toHaveLength(3);
      const ids = result.current.toasts.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it("should auto-dismiss after default timeout", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast("Auto dismiss");
      });

      expect(result.current.toasts).toHaveLength(1);

      // Advance time past default auto-dismiss (5000ms)
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it("should use custom auto-dismiss timeout", () => {
      const { result } = renderHook(() => useToast(2000));

      act(() => {
        result.current.showToast("Quick dismiss");
      });

      expect(result.current.toasts).toHaveLength(1);

      // Advance time to just before custom timeout
      act(() => {
        jest.advanceTimersByTime(1999);
      });

      expect(result.current.toasts).toHaveLength(1);

      // Advance past custom timeout
      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it("should not auto-dismiss when autoDismissMs is 0", () => {
      const { result } = renderHook(() => useToast(0));

      act(() => {
        result.current.showToast("Persistent");
      });

      expect(result.current.toasts).toHaveLength(1);

      // Advance time significantly
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(result.current.toasts).toHaveLength(1);
    });

    it("should not auto-dismiss when autoDismissMs is negative", () => {
      const { result } = renderHook(() => useToast(-1));

      act(() => {
        result.current.showToast("Persistent negative");
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(result.current.toasts).toHaveLength(1);
    });
  });

  describe("showSuccess", () => {
    it("should add a success toast", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showSuccess("Operation successful");
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe("Operation successful");
      expect(result.current.toasts[0].type).toBe("success");
    });

    it("should auto-dismiss success toast", () => {
      const { result } = renderHook(() => useToast(1000));

      act(() => {
        result.current.showSuccess("Quick success");
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe("showError", () => {
    it("should add an error toast", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showError("Something went wrong");
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe("Something went wrong");
      expect(result.current.toasts[0].type).toBe("error");
    });

    it("should auto-dismiss error toast", () => {
      const { result } = renderHook(() => useToast(1000));

      act(() => {
        result.current.showError("Error occurred");
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe("showWarning", () => {
    it("should add a warning toast", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showWarning("Be careful");
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe("Be careful");
      expect(result.current.toasts[0].type).toBe("warning");
    });

    it("should auto-dismiss warning toast", () => {
      const { result } = renderHook(() => useToast(1000));

      act(() => {
        result.current.showWarning("Watch out");
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe("removeToast", () => {
    it("should remove a specific toast by ID", () => {
      const { result } = renderHook(() => useToast(0)); // Disable auto-dismiss

      act(() => {
        result.current.showToast("First");
        result.current.showToast("Second");
        result.current.showToast("Third");
      });

      const secondToastId = result.current.toasts[1].id;

      act(() => {
        result.current.removeToast(secondToastId);
      });

      expect(result.current.toasts).toHaveLength(2);
      expect(result.current.toasts.find((t) => t.id === secondToastId)).toBeUndefined();
      expect(result.current.toasts[0].message).toBe("First");
      expect(result.current.toasts[1].message).toBe("Third");
    });

    it("should handle removing non-existent toast ID", () => {
      const { result } = renderHook(() => useToast(0));

      act(() => {
        result.current.showToast("Test");
      });

      act(() => {
        result.current.removeToast("non-existent-id");
      });

      expect(result.current.toasts).toHaveLength(1);
    });

    it("should handle removing from empty toasts array", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.removeToast("any-id");
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe("clearAll", () => {
    it("should remove all toasts", () => {
      const { result } = renderHook(() => useToast(0));

      act(() => {
        result.current.showToast("First");
        result.current.showSuccess("Second");
        result.current.showError("Third");
        result.current.showWarning("Fourth");
      });

      expect(result.current.toasts).toHaveLength(4);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it("should handle clearing empty toasts array", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe("toast ID generation", () => {
    it("should generate sequential IDs", () => {
      const { result } = renderHook(() => useToast(0));

      act(() => {
        result.current.showToast("First");
      });
      const firstId = result.current.toasts[0].id;

      act(() => {
        result.current.showToast("Second");
      });
      const secondId = result.current.toasts[1].id;

      // Extract numeric parts
      const firstNum = parseInt(firstId.replace("toast-", ""), 10);
      const secondNum = parseInt(secondId.replace("toast-", ""), 10);

      expect(secondNum).toBe(firstNum + 1);
    });
  });

  describe("auto-dismiss timing precision", () => {
    it("should dismiss individual toasts at their scheduled time", () => {
      const { result } = renderHook(() => useToast(1000));

      act(() => {
        result.current.showToast("First");
      });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      act(() => {
        result.current.showToast("Second");
      });

      expect(result.current.toasts).toHaveLength(2);

      // First toast should dismiss at 1000ms
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe("Second");

      // Second toast should dismiss at 1500ms
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe("toast types", () => {
    it("should support all toast types", () => {
      const { result } = renderHook(() => useToast(0));

      act(() => {
        result.current.showToast("Info", "info");
        result.current.showToast("Success", "success");
        result.current.showToast("Error", "error");
        result.current.showToast("Warning", "warning");
      });

      const types = result.current.toasts.map((t) => t.type);
      expect(types).toContain("info");
      expect(types).toContain("success");
      expect(types).toContain("error");
      expect(types).toContain("warning");
    });
  });

  describe("hook stability", () => {
    it("should maintain function reference stability across renders", () => {
      const { result, rerender } = renderHook(() => useToast());

      const firstShowToast = result.current.showToast;
      const firstShowSuccess = result.current.showSuccess;
      const firstShowError = result.current.showError;
      const firstShowWarning = result.current.showWarning;
      const firstRemoveToast = result.current.removeToast;
      const firstClearAll = result.current.clearAll;

      rerender();

      // Functions should be memoized
      expect(result.current.removeToast).toBe(firstRemoveToast);
      expect(result.current.clearAll).toBe(firstClearAll);
      // Note: showToast, showSuccess, showError, showWarning depend on autoDismissMs
      // and removeToast, so they may or may not be stable depending on implementation
    });
  });

  describe("edge cases", () => {
    it("should handle empty message", () => {
      const { result } = renderHook(() => useToast(0));

      act(() => {
        result.current.showToast("");
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe("");
    });

    it("should handle very long message", () => {
      const { result } = renderHook(() => useToast(0));
      const longMessage = "A".repeat(10000);

      act(() => {
        result.current.showToast(longMessage);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe(longMessage);
    });

    it("should handle special characters in message", () => {
      const { result } = renderHook(() => useToast(0));
      const specialMessage = '<script>alert("xss")</script> & "quotes" \'apostrophe\'';

      act(() => {
        result.current.showToast(specialMessage);
      });

      expect(result.current.toasts[0].message).toBe(specialMessage);
    });
  });
});
