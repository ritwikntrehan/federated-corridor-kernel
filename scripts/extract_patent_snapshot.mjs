// Reproducible bounded extractor for PatentsView/USPTO-exported JSON rows.
// Usage: node scripts/extract_patent_snapshot.mjs input.json > data/patents.snapshot.json
import fs from 'node:fs';
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const wanted = new Set(['US10407381B2', 'US10000000B2']);
const records = (input.records ?? input.patents ?? []).filter((row) => wanted.has(row.patent_number));
process.stdout.write(JSON.stringify({
  schema_version: '0.3', snapshot_date: new Date().toISOString().slice(0, 10),
  snapshot_source: input.snapshot_source ?? 'https://search.patentsview.org/',
  source_release_date: input.source_release_date, records
}, null, 2) + '\n');
