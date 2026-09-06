#!/usr/bin/env node
// Guards the shape of git.deploymentEnabled in the portal vercel.json files.
// BACKLOG-2833.
//
// WHY THIS EXISTS
//
// The "**": false catch-all must be the LAST key. Measured on a single-variable
// pair (refs evidence/BACKLOG-2833-catchall-first and -catchall-last, same
// parent, the only diff being that one key moving): with "**": false written
// FIRST, a branch that an allow key matches was denied on both portals; with the
// same key written LAST it deployed. Vercel's docs describe order-independent
// semantics ("a deployment occurs if at least one matching rule is set to
// true"), so the docs are not a safe guide here.
//
// The mechanism is NOT established. General first-match-wins, "any false before
// the matching true blocks it", and "a bare ** is terminal" all predict that
// result identically. The safe arrangement is the same under all three, so this
// guard asserts only the narrow, safe fact: "**" is present, is false, and is
// last.
//
// WHY IT IS A CI CHECK AND NOT A COMMENT
//
// JSON has no comment syntax, so the rule cannot travel with the file. And the
// regression is SILENT: a branch that deploymentEnabled denies gets no Vercel
// deployment and therefore NO GitHub commit status at all -- no failed check, no
// error, nothing to notice. A jq round-trip, an editor's "sort object keys", a
// merge resolution, or json.dumps(sort_keys=True) would reorder these keys and
// quietly turn default-deny into deny-everything, main and develop included.
// This check is the only thing that would catch that.
//
// Parses the JSON and inspects real key order. It does not grep: a regex over
// the file text would pass on a document whose parsed key order differs from its
// apparent one (duplicate keys, escapes), which is exactly the failure it is
// meant to catch.
//
// Exit codes:  0 = OK   1 = FINDINGS (the author's problem)   2 = infrastructure

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATCH_ALL = '**';
const FILES = ['broker-portal/vercel.json', 'admin-portal/vercel.json'];

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const findings = [];
let checked = 0;

for (const rel of FILES) {
  const abs = resolve(repoRoot, rel);
  let raw;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch (err) {
    console.error(`check-vercel-deploy-map: cannot read ${rel}: ${err.message}`);
    process.exit(2);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`check-vercel-deploy-map: ${rel} is not valid JSON: ${err.message}`);
    process.exit(2);
  }

  const map = parsed?.git?.deploymentEnabled;
  if (map === undefined) {
    findings.push(`${rel}: git.deploymentEnabled is missing. Portal deployments would fall back to Vercel's default (every branch deploys), which is the BACKLOG-2833 incident.`);
    continue;
  }
  if (typeof map !== 'object' || map === null || Array.isArray(map)) {
    findings.push(`${rel}: git.deploymentEnabled must be an object of branch-pattern -> boolean, got ${Array.isArray(map) ? 'an array' : typeof map}.`);
    continue;
  }

  const keys = Object.keys(map);
  checked += 1;

  if (!keys.includes(CATCH_ALL)) {
    findings.push(`${rel}: the "${CATCH_ALL}" catch-all key is missing. Without it every unlisted branch deploys.`);
    continue;
  }
  if (map[CATCH_ALL] !== false) {
    findings.push(`${rel}: "${CATCH_ALL}" must be false, got ${JSON.stringify(map[CATCH_ALL])}.`);
  }

  const last = keys[keys.length - 1];
  if (last !== CATCH_ALL) {
    findings.push(
      `${rel}: "${CATCH_ALL}" must be the LAST key of git.deploymentEnabled, but the last key is "${last}" ` +
      `(current order: ${keys.map((k) => JSON.stringify(k)).join(', ')}). ` +
      `Move "${CATCH_ALL}" to the end. Measured: with it first, allowed branches were denied on both portals.`
    );
  }

  // Every allow that names a path segment must be **-shaped. All 36 refs on
  // origin with two or more segments after the prefix are dependabot, so
  // "dependabot/*" would match none of them and silently stop deploying real
  // portal dependency changes.
  for (const [pattern, value] of Object.entries(map)) {
    if (value === true && pattern.includes('/') && !pattern.endsWith('/**')) {
      findings.push(`${rel}: allow "${pattern}" is not **-shaped. A single * does not cross "/", so it would miss nested branches such as dependabot/npm_and_yarn/foo-1.2.3. Use "${pattern.replace(/\/\*?\*?$/, '')}/**".`);
    }
  }
}

if (findings.length > 0) {
  for (const f of findings) console.error(`::error::${f}`);
  console.error(`\ncheck-vercel-deploy-map: ${findings.length} finding(s). See scripts/ci/check-vercel-deploy-map.mjs for why this is enforced (BACKLOG-2833).`);
  process.exit(1);
}

console.log(`check-vercel-deploy-map: OK — ${checked} file(s); "${CATCH_ALL}" present, false, and last in each.`);
