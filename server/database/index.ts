import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

/**
 * ⚠ **The connection is pinned to UTC, and every `timestamp` column in this schema depends on
 * it.** Do not drop the `options` below.
 *
 * Every timestamp here is `timestamp without time zone`, and the two halves of the round trip
 * disagree about what a naive value means. Drizzle's node-postgres driver *writes* a JS `Date`
 * as its UTC wall clock and *reads* a naive value back as UTC — but a column defaulted with
 * `defaultNow()` is written by Postgres, which renders `now()` in the **session's** time zone.
 * On a developer machine in Europe/Amsterdam that stores `13:50:02` for an instant whose UTC
 * time is `11:50:02`, and the driver hands it back as `13:50:02Z` — two hours in the future.
 *
 * That is not cosmetic. Every idle game in this codebase founds its state row with a
 * `defaultNow()` settle clock and then accrues from `Date.now() - lastSettledAt.getTime()`:
 * Hero Quest (`hq_state`), the bank (`bank_state`), the colony (`colony_state`) and the miner
 * all do. A clock in the future makes that gap negative, every settle takes its
 * `elapsedMs <= 0` early return, and — because the early return happens *before* the write —
 * the clock is never corrected either. A brand-new run therefore accrues **nothing at all** for
 * exactly the UTC offset, while the client's projection walks forward on its own ticker: the
 * screen advances, every refresh snaps it back to where the run was founded, and it looks for
 * all the world like progress being wiped on reload.
 *
 * Pinning the session to UTC makes Postgres write `now()` in the same frame the driver reads it
 * in. It is also what a deployment already gets by default, so this is what makes a local
 * database behave like the deployed one rather than a change to how the app stores time.
 */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    options: '-c timezone=UTC'
})

export const db = drizzle(pool, { schema })

// Anything that can run a statement: the pool, or an open transaction. Callers
// that already hold a row lock MUST pass their `tx` — issuing the write on a
// second pool connection would deadlock against the lock they're holding.
export type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'query' | 'execute'>
