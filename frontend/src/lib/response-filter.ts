export interface FilterOptions {
  /** Called once for every field path that is removed from the payload. */
  onStripped?: (path: string) => void;
}

class AllowTrie {
  exact = false;
  children = new Map<string, AllowTrie>();

  add(path: string): void {
    this.insert(path.split('.'), 0);
  }

  private insert(parts: string[], index: number): void {
    if (index === parts.length) {
      this.exact = true;
      return;
    }

    const part = parts[index];
    let child = this.children.get(part);
    if (!child) {
      child = new AllowTrie();
      this.children.set(part, child);
    }
    child.insert(parts, index + 1);
  }

  allowsEverything(): boolean {
    return this.exact;
  }

  child(key: string): AllowTrie | null {
    if (this.exact) return null;
    return this.children.get(key) ?? null;
  }
}

/**
 * Strips every field from `data` that is not described by `allowlist`.
 *
 * The allowlist supports dot-notation for nested fields, e.g.:
 *   ['id', 'customer.name', 'cards.id']
 *
 * When a parent path is allowlisted (e.g. 'customer'), the entire subtree is
 * kept. When an array is encountered, the same allowlist is applied to every
 * element.
 */
export function filterResponse<T>(
  data: T,
  allowlist: string[],
  options: FilterOptions = {}
): Partial<T> {
  const trie = new AllowTrie();
  for (const path of allowlist) {
    trie.add(path);
  }
  return filterValue(data, trie, '', options.onStripped) as Partial<T>;
}

function filterValue(
  value: unknown,
  trie: AllowTrie,
  path: string,
  onStripped?: (path: string) => void
): unknown {
  if (trie.allowsEverything()) {
    return value;
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(value)) {
      const childTrie = trie.child(key);
      const childPath = path ? `${path}.${key}` : key;
      if (childTrie) {
        result[key] = filterValue(childValue, childTrie, childPath, onStripped);
      } else {
        onStripped?.(childPath);
      }
    }
    return result;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      return filterValue(item, trie, itemPath, onStripped);
    });
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
