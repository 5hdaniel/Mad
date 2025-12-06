/**
 * Unit tests for useSelection hook
 */

import { renderHook, act } from "@testing-library/react";
import { useSelection, SelectableItem } from "../useSelection";

describe("useSelection", () => {
  const mockItems: SelectableItem[] = [
    { id: "1" },
    { id: "2" },
    { id: "3" },
    { id: "4" },
    { id: "5" },
  ];

  describe("initial state", () => {
    it("should start with empty selection", () => {
      const { result } = renderHook(() => useSelection());

      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.count).toBe(0);
    });

    it("should return all required functions", () => {
      const { result } = renderHook(() => useSelection());

      expect(typeof result.current.toggleSelection).toBe("function");
      expect(typeof result.current.selectAll).toBe("function");
      expect(typeof result.current.deselectAll).toBe("function");
      expect(typeof result.current.isSelected).toBe("function");
    });
  });

  describe("toggleSelection", () => {
    it("should add item to selection", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelection("1");
      });

      expect(result.current.selectedIds.has("1")).toBe(true);
      expect(result.current.count).toBe(1);
    });

    it("should remove item from selection if already selected", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelection("1");
      });

      expect(result.current.isSelected("1")).toBe(true);

      act(() => {
        result.current.toggleSelection("1");
      });

      expect(result.current.isSelected("1")).toBe(false);
      expect(result.current.count).toBe(0);
    });

    it("should handle multiple selections", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelection("1");
      });
      act(() => {
        result.current.toggleSelection("2");
      });
      act(() => {
        result.current.toggleSelection("3");
      });

      expect(result.current.count).toBe(3);
      expect(result.current.isSelected("1")).toBe(true);
      expect(result.current.isSelected("2")).toBe(true);
      expect(result.current.isSelected("3")).toBe(true);
    });
  });

  describe("selectAll", () => {
    it("should select all items", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.selectAll(mockItems);
      });

      expect(result.current.count).toBe(5);
      mockItems.forEach((item) => {
        expect(result.current.isSelected(item.id)).toBe(true);
      });
    });

    it("should replace existing selection", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelection("other-id");
      });

      expect(result.current.isSelected("other-id")).toBe(true);

      act(() => {
        result.current.selectAll(mockItems);
      });

      expect(result.current.isSelected("other-id")).toBe(false);
      expect(result.current.count).toBe(5);
    });

    it("should handle empty array", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelection("1");
      });

      act(() => {
        result.current.selectAll([]);
      });

      expect(result.current.count).toBe(0);
    });
  });

  describe("deselectAll", () => {
    it("should clear all selections", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.selectAll(mockItems);
      });

      expect(result.current.count).toBe(5);

      act(() => {
        result.current.deselectAll();
      });

      expect(result.current.count).toBe(0);
      expect(result.current.selectedIds.size).toBe(0);
    });

    it("should work when already empty", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.deselectAll();
      });

      expect(result.current.count).toBe(0);
    });
  });

  describe("isSelected", () => {
    it("should return true for selected items", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelection("1");
      });

      expect(result.current.isSelected("1")).toBe(true);
    });

    it("should return false for unselected items", () => {
      const { result } = renderHook(() => useSelection());

      expect(result.current.isSelected("nonexistent")).toBe(false);
    });
  });

  describe("count", () => {
    it("should accurately track selection count", () => {
      const { result } = renderHook(() => useSelection());

      expect(result.current.count).toBe(0);

      act(() => {
        result.current.toggleSelection("1");
      });
      expect(result.current.count).toBe(1);

      act(() => {
        result.current.toggleSelection("2");
      });
      expect(result.current.count).toBe(2);

      act(() => {
        result.current.toggleSelection("1");
      });
      expect(result.current.count).toBe(1);
    });
  });
});
