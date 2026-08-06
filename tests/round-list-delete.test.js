import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRoundStore } from '../js/round-store.js';
import {
  deleteStoredRound,
  formatDeleteRoundDate,
  roundDeletePrompt
} from '../js/round-list-delete.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem:(key)=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value)
  };
}

function savedRound(id='round-1') {
  return {
    schemaVersion:9,
    id,
    courseName:'Wailua Municipal Golf Course',
    date:'2026-08-01',
    holes:[],
    shots:[]
  };
}

test('builds a specific permanent-deletion prompt',()=>{
  assert.equal(formatDeleteRoundDate('2026-08-01','en-US'),'August 1, 2026');
  const prompt=roundDeletePrompt(savedRound(),{locale:'en-US'});
  assert.match(prompt,/Delete Wailua Municipal Golf Course from August 1, 2026\?/);
  assert.match(prompt,/permanently removes its scorecard and all recorded strokes/);
  assert.match(prompt,/Export a backup first/);
});

test('does not delete when confirmation is cancelled',()=>{
  const store=createRoundStore(memoryStorage(),{now:()=> '2026-08-06T08:00:00.000Z'});
  store.save(savedRound());
  let prompt='';
  const removed=deleteStoredRound('round-1',store,{
    locale:'en-US',
    confirmDelete:(value)=>{ prompt=value; return false; }
  });

  assert.equal(removed,false);
  assert.ok(store.get('round-1'));
  assert.match(prompt,/Wailua Municipal Golf Course/);
});

test('removes the selected round after confirmation',()=>{
  const store=createRoundStore(memoryStorage(),{now:()=> '2026-08-06T08:00:00.000Z'});
  store.save(savedRound('round-1'));
  store.save(savedRound('round-2'));

  const removed=deleteStoredRound('round-1',store,{confirmDelete:()=>true});

  assert.equal(removed,true);
  assert.equal(store.get('round-1'),null);
  assert.ok(store.get('round-2'));
  assert.equal(store.list().length,1);
});

test('missing round ids are ignored without confirmation',()=>{
  const store=createRoundStore(memoryStorage());
  let confirmations=0;
  const removed=deleteStoredRound('missing',store,{
    confirmDelete:()=>{ confirmations+=1; return true; }
  });

  assert.equal(removed,false);
  assert.equal(confirmations,0);
});

test('the landing page loads the round delete assets',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/round-list-delete\.css/);
  assert.match(html,/js\/round-list-delete\.js/);
});
