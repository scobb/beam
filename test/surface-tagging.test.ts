import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEventPropertiesQuery, taggedSql } from '../src/lib/analytics'

/**
 * D1 Insights groups by query text. /public/:site_id and
 * /dashboard/sites/:id/analytics issue textually identical SQL, so their
 * execution counts and rows-read merge into a single row and cannot be told
 * apart — which is why ~114,000 analytics renders/month have no known source.
 * A trailing SQL comment splits them without changing the query plan.
 */

test('taggedSql appends a trailing SQL comment', () => {
  const sql = taggedSql('SELECT 1 FROM t WHERE a = ?', 'public')

  assert.equal(sql, 'SELECT 1 FROM t WHERE a = ? /* beam:public */')
})

test('taggedSql yields distinct text per surface so D1 Insights splits them', () => {
  const base = 'SELECT COUNT(*) FROM pageviews WHERE site_id = ?'

  assert.notEqual(taggedSql(base, 'public'), taggedSql(base, 'app'))
})

test('taggedSql keeps the original statement intact ahead of the comment', () => {
  const base = 'SELECT path FROM pageviews WHERE site_id = ? ORDER BY x DESC LIMIT 20'

  assert.ok(taggedSql(base, 'app').startsWith(base), 'statement must be unchanged')
  assert.match(taggedSql(base, 'app'), /\/\* beam:app \*\/$/, 'comment goes last')
})

test('buildEventPropertiesQuery is attributed to its calling surface', () => {
  const pub = buildEventPropertiesQuery('public')
  const app = buildEventPropertiesQuery('app')

  assert.match(pub, /\/\* beam:public \*\/$/)
  assert.match(app, /\/\* beam:app \*\/$/)
  assert.notEqual(pub, app)
  // the statement itself must not have drifted
  for (const sql of [pub, app]) {
    assert.match(sql, /json_each/)
    assert.match(sql, /LIMIT 20/)
  }
})
