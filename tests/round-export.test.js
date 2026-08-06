import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRoundsExport,
  importRoundsExport,
  MAX_IMPORTED_ROUND_SCHEMA_VERSION,
  parseRoundsExport,
  ROUND_EXPORT_FORMAT,
  ROUND_EXPORT_VERSION,
  roundsExportFilename
} from '../js/round-export.js';
import {createRoundStore} from '../js/round-store.js';

function memoryStorage() {
  const values=new Map();
  return {
    getItem:(key)=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value)
  };
}

function savedRound(id='round-1') {
  return {
    schemaVersion:9,
    id,
    createdAt:'2026-08-01T10:00:00.000Z',
    updatedAt:'2026-08-01T11:00:00.000Z',
    status:'complete',
    courseName:'Example Golf Club',
    courseData:null,
    testData:null,
    date:'2026-08-01',
    holeCount:1,
    currentHole:1,
    holes:[{
      number:1,
      par:4,
      teeDistance:400,
      draft:{}
    }],
    shots:[],
    recentClubs:{}
  };
}

test('creates a versioned JSON-safe backup containing every round',()=>{
  const rounds=[savedRound('round-1'),savedRound('round-2')];
  const backup=createRoundsExport(rounds,'2026-07-27T08:00:00.000Z');
  assert.equal(backup.format,ROUND_EXPORT_FORMAT);
  assert.equal(backup.version,ROUND_EXPORT_VERSION);
  assert.equal(backup.exportedAt,'2026-07-27T08:00:00.000Z');
  assert.equal(backup.roundCount,2);
  assert.deepEqual(backup.rounds,rounds);
  assert.notEqual(backup.rounds,rounds);
  assert.doesNotThrow(()=>JSON.stringify(backup));
});

test('parses and restores an exported round collection idempotently',()=>{
  const backup=createRoundsExport([
    savedRound('round-1'),
    savedRound('round-2')
  ],'2026-08-06T06:47:47.868Z');
  const store=createRoundStore(memoryStorage(),{
    now:()=> '2026-08-06T07:00:00.000Z'
  });

  assert.equal(parseRoundsExport(backup).length,2);
  const first=importRoundsExport(backup,store);
  const second=importRoundsExport(backup,store);

  assert.equal(first.kind,'round-backup');
  assert.deepEqual({added:first.added,updated:first.updated},{added:2,updated:0});
  assert.deepEqual({added:second.added,updated:second.updated},{added:0,updated:2});
  assert.equal(store.list().length,2);
  assert.equal(store.get('round-1').courseName,'Example Golf Club');
  assert.equal(store.get('round-1').date,'2026-08-01');
});

test('rejects an unsupported rounds-backup version with a backup-specific error',()=>{
  const backup=createRoundsExport([savedRound()]);
  backup.version=ROUND_EXPORT_VERSION+1;
  assert.throws(
    ()=>parseRoundsExport(backup),
    /This rounds backup version is not supported/
  );
});

test('validates the full backup before saving any rounds',()=>{
  const valid=savedRound('valid-round');
  const tooNew={
    ...savedRound('future-round'),
    schemaVersion:MAX_IMPORTED_ROUND_SCHEMA_VERSION+1
  };
  const backup=createRoundsExport([valid,tooNew]);
  const store=createRoundStore(memoryStorage());

  assert.throws(
    ()=>importRoundsExport(backup,store),
    /created by a newer app version/
  );
  assert.equal(store.list().length,0);
});

test('uses the export date in a filesystem-friendly filename',()=>{
  assert.equal(
    roundsExportFilename('2026-07-27T08:00:00.000Z'),
    'golf-strokes-gained-rounds-2026-07-27.json'
  );
});
