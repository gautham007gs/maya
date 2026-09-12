
type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

type QueryFilter = {
  column: string;
  operator: FilterOperator;
  value: any;
};

type OrderBy = {
  column: string;
  ascending: boolean;
};

type QueryState = {
  action: 'select' | 'update' | 'upsert' | 'delete' | 'insert' | 'rpc';
  table: string;
  filters: QueryFilter[];
  selectColumns?: string;
  orderBy?: OrderBy;
  limit?: number;
  offset?: number;
  data?: any;
  single?: boolean;
  maybeSingle?: boolean;
  rpcName?: string;
  rpcParams?: Record<string, any>;
};

type QueryResult<T = any> = {
  data: T;
  error: null | { message: string };
};

// Always use the /api/db proxy — works in both browser and server contexts.
// Server-side direct DB access is in dbServer.ts (imported only by API routes).
const executeQuery = async (state: QueryState): Promise<QueryResult> => {
  try {
    const baseUrl =
      typeof window !== 'undefined'
        ? ''
        : process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

    const response = await fetch(`${baseUrl}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(state),
    });
    const payload = await response.json();
    if (!response.ok) {
      // Always produce a string message — payload.error may be an object in edge cases
      const rawErr = payload?.error;
      const msg = typeof rawErr === 'string' && rawErr
        ? rawErr
        : (rawErr && typeof rawErr === 'object' ? JSON.stringify(rawErr) : 'Request failed');
      return { data: null, error: { message: msg } };
    }
    return { data: payload.data ?? null, error: null };
  } catch (error: any) {
    return { data: null, error: { message: error.message || 'Request failed' } };
  }
};

class QueryBuilder {
  private state: QueryState;

  constructor(table: string) {
    this.state = {
      action: 'select',
      table,
      filters: [],
    };
  }

  select(columns = '*') {
    this.state.action = 'select';
    this.state.selectColumns = columns;
    return this;
  }

  insert(data: any) {
    return this.execute({ action: 'insert', data });
  }

  update(data: any) {
    this.state.action = 'update';
    this.state.data = data;
    return this;
  }

  upsert(data: any) {
    this.state.action = 'upsert';
    this.state.data = data;
    return this;
  }

  delete() {
    this.state.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.state.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: any) {
    this.state.filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column: string, value: any) {
    this.state.filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: any) {
    this.state.filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: any) {
    this.state.filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: any) {
    this.state.filters.push({ column, operator: 'lte', value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.state.orderBy = { column, ascending: options.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.state.limit = count;
    return this;
  }

  range(from: number, to: number) {
    this.state.offset = from;
    this.state.limit = to - from + 1;
    return this;
  }

  maybeSingle() {
    this.state.maybeSingle = true;
    return this;
  }

  single() {
    this.state.single = true;
    return this;
  }

  rpc(name: string, params?: Record<string, any>) {
    return this.execute({ action: 'rpc', rpcName: name, rpcParams: params });
  }

  private async execute(overrides?: Partial<QueryState>) {
    const state = { ...this.state, ...overrides } as QueryState;
    return executeQuery(state);
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const db = {
  from: (table: string) => new QueryBuilder(table),
  auth: {
    signInWithPassword: async () => ({
      data: null,
      error: { message: 'Use /api/admin/login instead.' },
    }),
    getUser: async () => ({
      data: { user: null },
      error: { message: 'Use /api/admin/session instead.' },
    }),
    getSession: async () => ({
      data: { session: null },
      error: { message: 'Use /api/admin/session instead.' },
    }),
  },
  rpc: (name: string, params?: Record<string, any>) =>
    new QueryBuilder('_rpc').rpc(name, params),
};

export const isDatabaseConfigured = true;

export type { QueryState, QueryResult };
