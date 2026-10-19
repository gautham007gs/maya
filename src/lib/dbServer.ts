import 'server-only';
import { getMysqlClient } from './mysql-client';

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

export type QueryState = {
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

export type QueryResult<T = any> = {
  data: T;
  error: null | { message: string };
};

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const buildWhereClause = (filters: QueryFilter[]) => {
  if (!filters.length) return { clause: '', values: [] as any[] };
  const clauses: string[] = [];
  const values: any[] = [];
  const opMap: Record<FilterOperator, string> = {
    eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
  };
  filters.forEach(f => {
    if (!SAFE_IDENTIFIER.test(f.column)) {
      throw new Error(`Invalid column name: ${f.column}`);
    }
    clauses.push(`\`${f.column}\` ${opMap[f.operator]} ?`);
    values.push(f.value);
  });
  return { clause: `WHERE ${clauses.join(' AND ')}`, values };
};

export const executeServerQuery = async (state: QueryState): Promise<QueryResult> => {
  const client = await getMysqlClient();

  try {
    if (state.action === 'rpc' && state.rpcName) {
      if (state.rpcName === 'increment_session_messages') {
        const sessionId = state.rpcParams?.session_id_param;
        await client.query(
          `INSERT INTO user_sessions (session_id, user_pseudo_id, messages_sent, is_active)
           VALUES (?, ?, 1, 1)
           ON DUPLICATE KEY UPDATE messages_sent = COALESCE(messages_sent, 0) + 1, is_active = 1`,
          [sessionId, sessionId]
        );
        return { data: null, error: null };
      }
      if (state.rpcName === 'get_daily_message_counts') {
        const [rows] = await client.query(
          `SELECT DATE(created_at) AS date, COUNT(*) AS messages
           FROM messages_log WHERE created_at >= ?
           GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC`,
          [state.rpcParams?.start_date]
        );
        return { data: Array.isArray(rows) ? rows : [], error: null };
      }
      if (state.rpcName === 'get_daily_active_user_counts') {
        const [rows] = await client.query(
          `SELECT activity_date AS date, COUNT(DISTINCT user_pseudo_id) AS active_users
           FROM daily_activity_log WHERE activity_date >= ?
           GROUP BY activity_date ORDER BY activity_date ASC`,
          [state.rpcParams?.start_date]
        );
        return { data: Array.isArray(rows) ? rows : [], error: null };
      }
      return { data: null, error: { message: `RPC ${state.rpcName} not implemented` } };
    }

    // Serialize plain objects/arrays to JSON strings for MySQL JSON columns.
    // mysql2 does not auto-stringify nested objects; doing it explicitly prevents
    // "Incorrect JSON value" constraint errors.
    const serializeValue = (val: any): any => {
      if (val === null || val === undefined) return val;
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    };

    if (state.action === 'insert') {
      if (!SAFE_IDENTIFIER.test(state.table)) throw new Error(`Invalid table name: ${state.table}`);
      const rows = Array.isArray(state.data) ? state.data : [state.data];
      if (!rows.length) return { data: [], error: null };
      const columns = Object.keys(rows[0]);
      for (const c of columns) {
        if (!SAFE_IDENTIFIER.test(c)) throw new Error(`Invalid column name: ${c}`);
      }
      const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
      const values = rows.flatMap((row: any) => columns.map(col => serializeValue(row[col])));
      await client.query(
        `INSERT INTO \`${state.table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES ${placeholders}`,
        values
      );
      return { data: rows, error: null };
    }

    if (state.action === 'upsert') {
      if (!SAFE_IDENTIFIER.test(state.table)) throw new Error(`Invalid table name: ${state.table}`);
      const rows = Array.isArray(state.data) ? state.data : [state.data];
      if (!rows.length) return { data: [], error: null };
      const columns = Object.keys(rows[0]);
      for (const c of columns) {
        if (!SAFE_IDENTIFIER.test(c)) throw new Error(`Invalid column name: ${c}`);
      }
      const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
      const values = rows.flatMap((row: any) => columns.map(col => serializeValue(row[col])));
      const updateClause = columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ');
      await client.query(
        `INSERT INTO \`${state.table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${updateClause}`,
        values
      );
      return { data: rows, error: null };
    }

    if (state.action === 'update') {
      if (!SAFE_IDENTIFIER.test(state.table)) throw new Error(`Invalid table name: ${state.table}`);
      const row = Array.isArray(state.data) ? state.data[0] : state.data;
      const columns = Object.keys(row);
      for (const c of columns) {
        if (!SAFE_IDENTIFIER.test(c)) throw new Error(`Invalid column name: ${c}`);
      }
      const { clause, values: whereValues } = buildWhereClause(state.filters);
      if (!clause) throw new Error('UPDATE requires at least one WHERE filter');
      const setClause = columns.map(col => `\`${col}\` = ?`).join(', ');
      await client.query(
        `UPDATE \`${state.table}\` SET ${setClause} ${clause}`,
        [...columns.map((col: string) => serializeValue(row[col])), ...whereValues]
      );
      return { data: row, error: null };
    }

    if (state.action === 'delete') {
      if (!SAFE_IDENTIFIER.test(state.table)) throw new Error(`Invalid table name: ${state.table}`);
      const { clause, values } = buildWhereClause(state.filters);
      if (!clause) throw new Error('DELETE requires at least one WHERE filter');
      await client.query(`DELETE FROM \`${state.table}\` ${clause}`, values);
      return { data: null, error: null };
    }

    if (state.action === 'select') {
      // Validate selectColumns to prevent identifier injection.
      // Only '*' or a comma-separated list of safe SQL identifiers are allowed.
      const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const rawColumns = state.selectColumns || '*';
      let columns: string;
      if (rawColumns === '*') {
        columns = '*';
      } else {
        const parts = rawColumns.split(',').map(c => c.trim());
        for (const part of parts) {
          if (!SAFE_IDENTIFIER.test(part)) {
            return { data: null, error: { message: `Invalid column name: ${part}` } };
          }
        }
        columns = parts.map(c => `\`${c}\``).join(', ');
      }
      const { clause, values } = buildWhereClause(state.filters);
      // Validate orderBy column to prevent identifier injection.
      let orderClause = '';
      if (state.orderBy) {
        if (!SAFE_IDENTIFIER.test(state.orderBy.column)) {
          return { data: null, error: { message: `Invalid orderBy column: ${state.orderBy.column}` } };
        }
        orderClause = `ORDER BY \`${state.orderBy.column}\` ${state.orderBy.ascending ? 'ASC' : 'DESC'}`;
      }
      const limitClause = state.limit !== undefined ? `LIMIT ${Number(state.limit)}` : '';
      const offsetClause = state.offset !== undefined ? `OFFSET ${Number(state.offset)}` : '';
      const sql = `SELECT ${columns} FROM \`${state.table}\` ${clause} ${orderClause} ${limitClause} ${offsetClause}`.trim();
      const [rows] = await client.query(sql, values);
      const data = Array.isArray(rows) ? rows : [];
      if (state.single || state.maybeSingle) {
        return { data: data[0] || null, error: null };
      }
      return { data, error: null };
    }

    return { data: null, error: { message: 'Unsupported query action' } };
  } catch (error: any) {
    return { data: null, error: { message: error.message || 'Database error' } };
  }
};

class ServerQueryBuilder {
  private state: QueryState;

  constructor(table: string) {
    this.state = { action: 'select', table, filters: [] };
  }

  select(columns = '*') { this.state.action = 'select'; this.state.selectColumns = columns; return this; }
  insert(data: any) { return this.execute({ action: 'insert', data }); }
  update(data: any) { this.state.action = 'update'; this.state.data = data; return this; }
  upsert(data: any) { this.state.action = 'upsert'; this.state.data = data; return this; }
  delete() { this.state.action = 'delete'; return this; }
  eq(col: string, val: any) { this.state.filters.push({ column: col, operator: 'eq', value: val }); return this; }
  neq(col: string, val: any) { this.state.filters.push({ column: col, operator: 'neq', value: val }); return this; }
  gt(col: string, val: any) { this.state.filters.push({ column: col, operator: 'gt', value: val }); return this; }
  gte(col: string, val: any) { this.state.filters.push({ column: col, operator: 'gte', value: val }); return this; }
  lt(col: string, val: any) { this.state.filters.push({ column: col, operator: 'lt', value: val }); return this; }
  lte(col: string, val: any) { this.state.filters.push({ column: col, operator: 'lte', value: val }); return this; }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.state.orderBy = { column: col, ascending: opts.ascending ?? true };
    return this;
  }
  limit(count: number) { this.state.limit = count; return this; }
  range(from: number, to: number) { this.state.offset = from; this.state.limit = to - from + 1; return this; }
  maybeSingle() { this.state.maybeSingle = true; return this; }
  single() { this.state.single = true; return this; }
  rpc(name: string, params?: Record<string, any>) {
    return this.execute({ action: 'rpc', rpcName: name, rpcParams: params });
  }

  private async execute(overrides?: Partial<QueryState>) {
    return executeServerQuery({ ...this.state, ...overrides } as QueryState);
  }

  then<T1 = QueryResult, T2 = never>(
    onfulfilled?: ((v: QueryResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((r: any) => T2 | PromiseLike<T2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const db = {
  from: (table: string) => new ServerQueryBuilder(table),
};

export const isDatabaseConfigured = true;
