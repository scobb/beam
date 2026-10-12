import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * An in-memory SQLite database with every migration applied, exposed through
 * the slice of the D1 API the app uses. Lets a test run the real SQL instead of
 * pattern-matching it.
 */
export function createSqliteD1() {
  const db = new DatabaseSync(':memory:')
  const dir = join(process.cwd(), 'migrations') // npm test runs from the repo root
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(dir, file), 'utf8'))
  }

  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => (db.prepare(sql).get(...(args as never[])) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => {
      const info = db.prepare(sql).run(...(args as never[]))
      return { meta: { changes: Number(info.changes) } }
    },
  })

  const d1 = {
    prepare: (sql: string) => statement(sql),
    batch: async (stmts: Array<{ all: () => Promise<unknown> }>) => Promise.all(stmts.map(s => s.all())),
  }

  return { db, d1 }
}
