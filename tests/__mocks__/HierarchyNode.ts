// In-memory mock for HierarchyNode mongoose model
export type NodeType = 'strategic_pillar' | 'business_unit' | 'team' | 'group';

export interface IMember {
  email: string;
}

// Module-level store - cleared by deleteMany({}) in beforeEach
const store: Record<string, unknown>[] = [];

function matchQuery(doc: Record<string, unknown>, query: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(query)) {
    if (key.includes('.')) {
      // Handle nested queries like 'members.email'
      const dotIndex = key.indexOf('.');
      const field = key.slice(0, dotIndex);
      const subfield = key.slice(dotIndex + 1);
      const arr = doc[field];
      if (!Array.isArray(arr)) return false;
      if (!arr.some((item: Record<string, unknown>) => item[subfield] === value)) return false;
    } else if (doc[key] !== value) {
      return false;
    }
  }
  return true;
}

export class HierarchyNode {
  [key: string]: unknown;

  constructor(data: Record<string, unknown>) {
    Object.assign(this, data);
  }

  async save(): Promise<this> {
    store.push({ ...this } as Record<string, unknown>);
    return this;
  }

  static async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const doc = { ...data };
    store.push(doc);
    return doc;
  }

  static async findOne(query: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    return store.find((doc) => matchQuery(doc, query)) ?? null;
  }

  static async find(query: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    if (!query || Object.keys(query).length === 0) return [...store];
    return store.filter((doc) => matchQuery(doc, query));
  }

  static async deleteMany(query: Record<string, unknown>): Promise<{ deletedCount: number }> {
    if (!query || Object.keys(query).length === 0) {
      store.length = 0;
    } else {
      const toDelete = store.filter((doc) => matchQuery(doc, query));
      toDelete.forEach((doc) => {
        const idx = store.indexOf(doc);
        if (idx > -1) store.splice(idx, 1);
      });
    }
    return { deletedCount: 0 };
  }

  static async findOneAndUpdate(
    query: Record<string, unknown>,
    update: Record<string, unknown>,
    opts?: { new?: boolean }
  ): Promise<Record<string, unknown> | null> {
    const idx = store.findIndex((doc) => matchQuery(doc, query));
    if (idx === -1) return null;
    const original = { ...store[idx] };
    const updated = { ...store[idx], ...update };
    store[idx] = updated;
    return opts?.new ? updated : original;
  }
}
