import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTrafficChannelSql, classifyTrafficChannel, normalizeTrafficChannel } from '../src/lib/channels'

test('normalizeTrafficChannel accepts known channels case-insensitively', () => {
  assert.equal(normalizeTrafficChannel('search'), 'Search')
  assert.equal(normalizeTrafficChannel('SOCIAL'), 'Social')
  assert.equal(normalizeTrafficChannel('Paid'), 'Paid')
  assert.equal(normalizeTrafficChannel('unknown'), null)
})

test('classifyTrafficChannel applies utm_medium overrides first', () => {
  assert.equal(classifyTrafficChannel('https://google.com/search?q=beam', 'email'), 'Email')
  assert.equal(classifyTrafficChannel('https://news.ycombinator.com/item?id=1', 'social'), 'Social')
  assert.equal(classifyTrafficChannel('https://google.com/search?q=beam', 'cpc'), 'Paid')
})

test('classifyTrafficChannel maps direct/search/social/email/referral', () => {
  assert.equal(classifyTrafficChannel('', null), 'Direct')
  assert.equal(classifyTrafficChannel('https://www.google.co.uk/search?q=beam', null), 'Search')
  assert.equal(classifyTrafficChannel('https://x.com/keylightdigital', null), 'Social')
  assert.equal(classifyTrafficChannel('https://mail.google.com/mail/u/0', null), 'Email')
  assert.equal(classifyTrafficChannel('https://example-partner.com/article', null), 'Referral')
})

test('buildTrafficChannelSql includes override and default branches', () => {
  const sql = buildTrafficChannelSql()
  assert.match(sql, /utm_medium/)
  assert.match(sql, /THEN 'Paid'/)
  assert.match(sql, /THEN 'Direct'/)
  assert.match(sql, /ELSE 'Referral'/)
})
