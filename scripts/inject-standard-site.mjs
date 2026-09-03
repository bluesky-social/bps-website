/**
 * Runs `sequoia inject`, then scopes its work to the default locale.
 *
 * `sequoia inject` adds the site.standard.document/publication <link> tags that
 * verify a post against its AT Protocol record. It globs every .html under the
 * output directory and matches `<dir>/index.html` by the name of its parent
 * directory, so a localized copy at build/ja/blog/<slug>/index.html matches the
 * same slug and gets the same atUri as the English page. Two URLs would then
 * assert they are the same document while the record's canonicalUrl names only
 * one of them. The CLI has no include/exclude, so the tags are stripped back
 * out of the non-default locales here.
 *
 * Also turns inject's silent no-op into a failure. With no .sequoia-state.json
 * the CLI warns and exits 0 — which inside a container build ships an image
 * with no verification tags and a green build.
 *
 * Run after `npm run build`, from the repo root. See the Dockerfile.
 */

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const BUILD = path.join(ROOT, 'build')

// The config is CommonJS and the source of truth for the locale list; reading
// it rather than restating "ja" here means a third locale cannot be forgotten.
const require = createRequire(import.meta.url)
const { i18n } = require(path.join(ROOT, 'docusaurus.config.js'))
const otherLocales = i18n.locales.filter((l) => l !== i18n.defaultLocale)

const TAG = /[ \t]*<link rel="site\.standard\.(?:document|publication)"[^>]*>/g

function htmlFilesUnder(dir) {
  if (!fs.existsSync(dir)) return []
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...htmlFilesUnder(full))
    else if (entry.name.endsWith('.html')) found.push(full)
  }
  return found
}

function countTagged(dir) {
  return htmlFilesUnder(dir).filter((file) =>
    fs.readFileSync(file, 'utf8').includes('rel="site.standard.document"'),
  ).length
}

if (!fs.existsSync(BUILD)) {
  console.error('inject-standard-site: no ./build — run `npm run build` first.')
  process.exit(1)
}

// Fail before invoking the CLI, so the message names the real problem rather
// than leaving a warning buried in build output.
if (!fs.existsSync(path.join(ROOT, '.sequoia-state.json'))) {
  console.error(
    'inject-standard-site: .sequoia-state.json is missing.\n' +
      '  `sequoia inject` reads its slug -> atUri map from that file only (not\n' +
      '  from post front matter), and exits 0 when it is absent. Run\n' +
      '  `npx sequoia publish` and commit the state file.',
  )
  process.exit(1)
}

execFileSync('npx', ['--no-install', 'sequoia', 'inject'], {
  cwd: ROOT,
  stdio: 'inherit',
})

let stripped = 0
for (const locale of otherLocales) {
  for (const file of htmlFilesUnder(path.join(BUILD, locale))) {
    const before = fs.readFileSync(file, 'utf8')
    const after = before.replace(TAG, '')
    if (after !== before) {
      fs.writeFileSync(file, after)
      stripped += 1
    }
  }
}

// Counted after the strip: every remaining tag is on a default-locale page.
const tagged = countTagged(BUILD)

console.log(
  `\ninject-standard-site: ${tagged} tagged page(s) in ${i18n.defaultLocale}, ` +
    `${stripped} stripped from ${otherLocales.join(', ') || '(no other locales)'}`,
)

if (tagged === 0) {
  console.error(
    'inject-standard-site: no page carries a site.standard.document tag.\n' +
      '  Every post was skipped, so nothing on this build can be verified.',
  )
  process.exit(1)
}
