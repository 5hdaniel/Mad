#!/usr/bin/env node
/**
 * Every Supabase migration filename must be `YYYYMMDDHHMMSS_name.sql`.
 *
 * WHY THIS EXISTS: `supabase migration new` generates that stamp from the clock,
 * so two files can never collide. Hand-named files can, and did — on 2026-09-07
 * two migrations both claimed `20260905`. `version` is the PRIMARY KEY of
 * `supabase_migrations.schema_migrations`, so only one of them could ever be
 * recorded: the second migration's SQL would run and then be invisible to the
 * ledger. That is how a migration goes missing while everything looks green.
 *
 * A duplicate stamp is therefore an error even though the filenames differ.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "supabase/migrations";
const LEGACY = new Set(
  readFileSync(`${DIR}/.legacy-names`, "utf8")
    .split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#")),
);
const SHAPE = /^(\d{14})_[a-z0-9_]+\.sql$/;

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const malformed = [];
const seen = new Map();

for (const f of files) {
  const m = SHAPE.exec(f);
  if (!m) { if (!LEGACY.has(f)) malformed.push(f); continue; }
  const stamp = m[1];
  if (seen.has(stamp)) seen.get(stamp).push(f);
  else seen.set(stamp, [f]);
}

const duplicates = [...seen.entries()].filter(([, fs]) => fs.length > 1);
let failed = false;

if (malformed.length) {
  failed = true;
  console.error(`\n${malformed.length} NEW migration file(s) are not named YYYYMMDDHHMMSS_name.sql:\n`);
  for (const f of malformed) console.error(`  ${f}`);
  console.error("\nGenerate migrations with `supabase migration new <name>` so the stamp comes from the clock.\n");
}

if (duplicates.length) {
  failed = true;
  console.error(`\n${duplicates.length} timestamp(s) claimed by more than one migration:\n`);
  for (const [stamp, fs] of duplicates) {
    console.error(`  ${stamp}`);
    for (const f of fs) console.error(`      ${f}`);
  }
  console.error("\n`version` is the PRIMARY KEY of schema_migrations — only one of these can ever be recorded.\n");
}

if (failed) process.exit(1);
console.log(
  `Migration names OK — ${files.length} file(s): ${files.length - LEGACY.size} conforming, ` +
  `${LEGACY.size} grandfathered (BACKLOG-3126), no duplicate timestamps.`,
);
