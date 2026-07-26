import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('app discloses the Broadie benchmark and equation',async()=>{
  const html=await read('index.html');
  assert.match(html,/PGA TOUR — Broadie 2003–2010/);
  assert.match(html,/SG = J\(start lie, distance\) − 1 − J\(finish lie, distance\)/);
  assert.match(html,/Historical · unadjusted/);
  assert.match(html,/assessing_golfer_performance\.full\.pdf/);
  assert.match(html,/putting_strokes_gained_20110113\.pdf/);
  assert.match(html,/benchmark\.css/);
});

test('benchmark methodology documents mappings and range limits',async()=>{
  const methodology=await read('docs/strokes-gained-methodology.md');
  assert.match(methodology,/Deep rough, direct route available \| Rough/);
  assert.match(methodology,/Trees \/ recovery \| Recovery/);
  assert.match(methodology,/off-green table begins at 10 yards/);
  assert.match(methodology,/use the 10-yard endpoint/);
  assert.match(methodology,/−0\.585/);
});

test('static page contains no duplicate ids',async()=>{
  const html=await read('index.html');
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map((match)=>match[1]);
  const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
  assert.deepEqual(duplicates,[]);
});

test('course lookup UI includes manual fallback and ODbL attribution',async()=>{
  const [html,app]=await Promise.all([read('index.html'),read('js/app.js')]);
  assert.match(html,/id="course-search-form"/);
  assert.match(html,/id="tee-selector"/);
  assert.match(html,/Use manual entry/);
  assert.match(html,/OpenGolfAPI/);
  assert.match(html,/ODbL 1\.0/);
  assert.match(app,/createOpenGolfApiProvider/);
  assert.match(app,/createCourseCache/);
  assert.match(app,/courseData/);
});
