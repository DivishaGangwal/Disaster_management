export function reconcileKeyed<T, V>(
  current: Map<string, V>,
  items: readonly T[],
  keyOf: (item: T) => string,
  create: (item: T) => V,
  update: (value: V, item: T) => void,
  remove: (value: V) => void,
): void {
  const present = new Set<string>();
  for (const item of items) {
    const key = keyOf(item);
    present.add(key);
    const existing = current.get(key);
    if (existing) {
      update(existing, item);
      continue;
    }
    current.set(key, create(item));
  }

  for (const [key, value] of current) {
    if (present.has(key)) continue;
    remove(value);
    current.delete(key);
  }
}
