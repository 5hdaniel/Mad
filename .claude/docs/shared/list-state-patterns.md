# List State Patterns

## Problem: Index-Based Navigation with Dynamic Filtering

When managing navigation through a list of items that can be dynamically filtered (e.g., onboarding steps that show/hide based on context), using index-based state leads to bugs:

```typescript
// BROKEN PATTERN
const [currentIndex, setCurrentIndex] = useState(0);
const items = useMemo(() => allItems.filter(shouldShow), [context]);

// Problem: When an item is filtered out, currentIndex points to wrong item
// - User is at index 1 (item B)
// - Item B gets filtered out
// - items array changes from [A, B, C] to [A, C]
// - currentIndex still = 1, now points to C instead of advancing properly
```

## Solution: Track by ID, Derive Index

Track the current item by its stable identifier, not its array position:

```typescript
// CORRECT PATTERN
const [currentItemId, setCurrentItemId] = useState<string | null>(() => {
  // Initialize to first valid item
  if (initialId) {
    const item = items.find(i => i.id === initialId);
    if (item) return item.id;
  }
  return items[0]?.id ?? null;
});

// Derive index from ID - automatically handles array changes
const currentIndex = useMemo(() => {
  if (!currentItemId) return 0;
  const idx = items.findIndex(i => i.id === currentItemId);
  if (idx >= 0) return idx;

  // Current item was filtered out - find next available
  const allIdx = allItems.findIndex(i => i.id === currentItemId);
  for (let i = allIdx + 1; i < allItems.length; i++) {
    const nextIdx = items.findIndex(item => item.id === allItems[i].id);
    if (nextIdx >= 0) return nextIdx;
  }
  return Math.max(0, items.length - 1);
}, [currentItemId, items, allItems]);

// Effect to update ID when current item is filtered out
useEffect(() => {
  if (!currentItemId || items.length === 0) return;

  const exists = items.some(i => i.id === currentItemId);
  if (!exists) {
    // Item was filtered - advance to next available
    const allIdx = allItems.findIndex(i => i.id === currentItemId);
    for (let i = allIdx + 1; i < allItems.length; i++) {
      const nextItem = items.find(item => item.id === allItems[i].id);
      if (nextItem) {
        setCurrentItemId(nextItem.id);
        return;
      }
    }
    // No next item - go to last available
    setCurrentItemId(items[items.length - 1]?.id ?? null);
  }
}, [currentItemId, items, allItems]);
```

## Navigation Functions

```typescript
// Navigate to next item by ID
const goToNext = useCallback(() => {
  if (currentIndex < items.length - 1) {
    setCurrentItemId(items[currentIndex + 1].id);
  } else {
    onComplete?.();
  }
}, [currentIndex, items, onComplete]);

// Navigate to previous item by ID
const goToPrevious = useCallback(() => {
  if (currentIndex > 0) {
    setCurrentItemId(items[currentIndex - 1].id);
  }
}, [currentIndex, items]);

// Navigate to specific item by ID
const goToItem = useCallback((itemId: string) => {
  const item = items.find(i => i.id === itemId);
  if (item) {
    setCurrentItemId(item.id);
  }
}, [items]);
```

## Key Benefits

1. **Stable identity**: Current position survives array reordering/filtering
2. **Automatic recovery**: When current item is removed, finds next logical item
3. **Correct navigation**: Next/previous work relative to current position, not stale index
4. **No closure bugs**: Derived index always reflects current state

## When to Use

Use this pattern when:
- List items can be dynamically filtered
- Navigation depends on user's current position in the list
- Items have stable, unique identifiers
- The order of items in the source (`allItems`) is meaningful

## Related

- React `useState` initializer only runs once
- `useMemo` dependencies affect when derived values update
- Stale closure problem in callbacks
