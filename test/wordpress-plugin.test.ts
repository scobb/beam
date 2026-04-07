import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pluginDir = resolve(process.cwd(), '../beam-wordpress-plugin/beam-analytics')
const pluginMainFile = resolve(pluginDir, 'beam-analytics.php')
const pluginReadmeFile = resolve(pluginDir, 'README.md')
const wpReadmeFile = resolve(pluginDir, 'readme.txt')
const packagingChecklistFile = resolve(process.cwd(), '../beam-wordpress-plugin/PACKAGING_CHECKLIST.md')
const buildScriptFile = resolve(process.cwd(), '../beam-wordpress-plugin/build-plugin-zip.sh')

test('wordpress plugin package includes required files', () => {
  assert.equal(existsSync(pluginDir), true)
  assert.equal(existsSync(pluginMainFile), true)
  assert.equal(existsSync(pluginReadmeFile), true)
  assert.equal(existsSync(wpReadmeFile), true)
  assert.equal(existsSync(packagingChecklistFile), true)
  assert.equal(existsSync(buildScriptFile), true)
})

test('plugin header and hooks include required Beam integration metadata', () => {
  const php = readFileSync(pluginMainFile, 'utf8')

  assert.match(php, /Plugin Name:\s+Beam Analytics/)
  assert.match(php, /Requires at least:\s+6\.0/)
  assert.match(php, /Requires PHP:\s+7\.4/)
  assert.match(php, /add_action\('wp_head', \[self::class, 'render_tracking_script'\], 99\)/)
  assert.match(php, /register_setting\('beam_analytics_options', self::OPTION_SITE_ID/)
  assert.match(php, /register_setting\('beam_analytics_options', self::OPTION_SKIP_ADMINS/)
  assert.match(php, /apply_filters\('beam_analytics_base_url', self::DEFAULT_BASE_URL\)/)
})

test('plugin documentation includes install guidance and minimum version support', () => {
  const readme = readFileSync(pluginReadmeFile, 'utf8')
  const wpReadme = readFileSync(wpReadmeFile, 'utf8')

  assert.match(readme, /Minimum WordPress version:\s+6\.0/)
  assert.match(readme, /Minimum PHP version:\s+7\.4/)
  assert.match(readme, /Upload Plugin/)
  assert.match(readme, /plugin only installs Beam tracking/i)

  assert.match(wpReadme, /Requires at least:\s+6\.0/)
  assert.match(wpReadme, /Requires PHP:\s+7\.4/)
  assert.match(wpReadme, /skip-tracking mode for logged-in administrators/)
  assert.match(wpReadme, /plugin only injects Beam's tracking script/i)
})

test('packaging assets include repeatable zip command and submission checklist', () => {
  const checklist = readFileSync(packagingChecklistFile, 'utf8')
  const buildScript = readFileSync(buildScriptFile, 'utf8')

  assert.match(checklist, /Run `\.\/build-plugin-zip\.sh`/)
  assert.match(checklist, /Upload zip via `Plugins -> Add New -> Upload Plugin`/)
  assert.match(buildScript, /zip -r \"\$OUTPUT_ZIP\" beam-analytics/)
  assert.match(buildScript, /set -euo pipefail/)
})
