import assert from 'node:assert/strict';
import test from 'node:test';
import {importPgaFixture} from '../js/pga-fixture-import.js';
import {createRoundsExport} from '../js/round-export.js';
import {createRoundStore} from '../js/round-store.js';

function memoryStorage() {
  const values=new Map();
  return {
    getItem:(key)=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value)
  };
}

function round() {
  return {
    schemaVersion:9,
    id:'backup-round',
    createdAt:'2026-08-06T06:00:00.000Z',
    updatedAt:'2026-08-06T06:30:00.000Z',
    status:'complete',
    courseName:'Wailua Municipal Golf Course',
    courseData:{provider:'opengolfapi',teeName:'Blue · Male'},
    testData:null,
    date:'2026-08-01',
    holeCount:1,
    currentHole:1,
    holes:[{number:1,par:5,teeDistance:520,draft:{}}],
    shots:[],
    recentClubs:{}
  };
}

test('the existing JSON chooser restores an app backup instead of treating it as a PGA fixture',()=>{
  const store=createRoundStore(memoryStorage(),{
    now:()=> '2026-08-06T07:00:00.000Z'
  });
  const backup=createRoundsExport([round()],'2026-08-06T06:47:47.868Z');
  const result=importPgaFixture(backup,store);

  assert.equal(result.kind,'round-backup');
  assert.equal(result.playerName,'saved');
  assert.equal(result.tournamentName,'backup');
  assert.deepEqual({added:result.added,updated:result.updated},{added:1,updated:0});
  assert.equal(store.get('backup-round').courseName,'Wailua Municipal Golf Course');
  assert.equal(store.get('backup-round').holes[0].teeDistance,520);
});
