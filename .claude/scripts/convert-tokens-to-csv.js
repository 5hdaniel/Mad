#!/usr/bin/env node
/**
 * Convert tokens.jsonl to tokens.csv
 *
 * Usage: node convert-tokens-to-csv.js
 */

const fs = require('fs');
const path = require('path');

const metricsDir = path.join(__dirname, '..', 'metrics');
const jsonlPath = path.join(metricsDir, 'tokens.jsonl');
const csvPath = path.join(metricsDir, 'tokens.csv');

// CSV columns in order
const columns = [
  'timestamp',
  'session_id',
  'agent_id',
  'agent_type',
  'task_id',
  'description',
  'input_tokens',
  'output_tokens',
  'cache_read',
  'cache_create',
  'billable_tokens',
  'total_tokens',
  'api_calls',
  'duration_secs',
  'started_at',
  'ended_at'
];

function parseJsonl(content) {
  const records = [];
  let buffer = '';
  let braceCount = 0;

  for (const char of content) {
    buffer += char;
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;

    if (braceCount === 0 && buffer.trim()) {
      try {
        const obj = JSON.parse(buffer.trim());
        records.push(obj);
      } catch (e) {
        // Skip invalid JSON
      }
      buffer = '';
    }
  }

  return records;
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function main() {
  if (!fs.existsSync(jsonlPath)) {
    console.error('tokens.jsonl not found');
    process.exit(1);
  }

  const content = fs.readFileSync(jsonlPath, 'utf8');
  const records = parseJsonl(content);

  console.log(`Parsed ${records.length} records from tokens.jsonl`);

  // Build CSV
  const lines = [columns.join(',')];

  for (const record of records) {
    const row = columns.map(col => escapeCSV(record[col] || ''));
    lines.push(row.join(','));
  }

  fs.writeFileSync(csvPath, lines.join('\n') + '\n');

  const jsonlSize = fs.statSync(jsonlPath).size;
  const csvSize = fs.statSync(csvPath).size;

  console.log(`Created tokens.csv`);
  console.log(`  JSONL size: ${(jsonlSize / 1024).toFixed(1)} KB`);
  console.log(`  CSV size:   ${(csvSize / 1024).toFixed(1)} KB`);
  console.log(`  Reduction:  ${((1 - csvSize / jsonlSize) * 100).toFixed(1)}%`);
}

main();
