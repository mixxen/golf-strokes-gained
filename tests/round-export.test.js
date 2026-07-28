import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRoundsExport,
  ROUND_EXPORT_FORMAT,
  ROUND_EXPORT_VERSION,
  roundsExportFilename
} from '../js/round-export.js';

test('creates a versioned JSON-safe backup containing every round',()=>{
  const rounds=[
    {id:'round-1',date:'2026-07-26',shots:[{id:'shot-1'}]},
    {id:'round-2',date:'2026-07-25',shots:[]}
  ];
  const backup=createRoundsExport(rounds,'2026-07-27T08:00:00.000Z');
  assert.equal(backup.format,ROUND_EXPORT_FORMAT);
  assert.equal(backup.version,ROUND_EXPORT_VERSION);
  assert.equal(backup.exportedAt,'2026-07-27T08:00:00.000Z');
  assert.equal(backup.roundCount,2);
  assert.deepEqual(backup.rounds,rounds);
  assert.notEqual(backup.rounds,rounds);
  assert.doesNotThrow(()=>JSON.stringify(backup));
});

test('uses the export date in a filesystem-friendly filename',()=>{
  assert.equal(
    roundsExportFilename('2026-07-27T08:00:00.000Z'),
    'golf-strokes-gained-rounds-2026-07-27.json'
  );
});
