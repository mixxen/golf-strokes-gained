import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('app links to a dedicated Broadie benchmark methodology page',async()=>{
  const [html,methodology]=await Promise.all([
    read('index.html'),
    read('methodology.html')
  ]);
  assert.match(html,/href="methodology\.html"/);
  assert.doesNotMatch(html,/class="panel benchmark-panel/);
  assert.match(methodology,/PGA TOUR — Broadie 2003–2010/);
  assert.match(methodology,/SG = J\(start lie, distance\) − 1 − J\(finish lie, distance\)/);
  assert.match(methodology,/Historical · unadjusted/);
  assert.match(methodology,/assessing_golfer_performance\.full\.pdf/);
  assert.match(methodology,/putting_strokes_gained_20110113\.pdf/);
  assert.match(methodology,/benchmark\.css/);
});

test('round workspace includes category, distance, overview, and dispersion analytics',async()=>{
  const [html,app]=await Promise.all([read('index.html'),read('js/app.js')]);
  assert.match(html,/id="category-sg-chart"/);
  assert.match(html,/id="distance-sg-chart"/);
  assert.match(html,/id="gir-rate"/);
  assert.match(html,/id="scrambling-rate"/);
  assert.match(html,/id="putts-per-hole"/);
  assert.match(html,/data-miss-filter="drive"/);
  assert.match(html,/data-miss-filter="approach"/);
  assert.match(app,/roundAnalytics/);
  assert.match(app,/renderDivergingChart/);
  assert.match(app,/missZoneBreakdown/);
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

test('course lookup UI includes hole-level manual fallback and no separate course-name field',async()=>{
  const [html,app]=await Promise.all([read('index.html'),read('js/app.js')]);
  assert.match(html,/id="course-search-form"/);
  assert.match(html,/id="tee-selector"/);
  assert.match(html,/Enter holes manually/);
  assert.doesNotMatch(html,/id="course-name"/);
  assert.match(html,/OpenGolfAPI/);
  assert.match(html,/ODbL 1\.0/);
  assert.match(app,/createOpenGolfApiProvider/);
  assert.match(app,/createCourseCache/);
  assert.match(app,/courseData/);
  assert.match(app,/roundStore\.save\(round\)/);
  assert.match(app,/changingLoadedCourse/);
});

test('landing page separates round history, setup, and the round workspace',async()=>{
  const [html,app]=await Promise.all([read('index.html'),read('js/app.js')]);
  assert.match(html,/id="rounds-home"/);
  assert.match(html,/id="round-list"/);
  assert.match(html,/id="round-setup-panel"/);
  assert.match(html,/id="workspace-heading"/);
  assert.match(html,/Start a new round/);
  assert.match(app,/#\/rounds/);
  assert.match(app,/#\/round\/new/);
  assert.match(app,/renderRoundList/);
  assert.match(app,/roundStore\.migrateLegacy/);
});

test('landing page imports a private PGA fixture without uploading it',async()=>{
  const [html,app]=await Promise.all([read('index.html'),read('js/app.js')]);
  assert.match(html,/id="pga-fixture-file"/);
  assert.match(html,/Choose PGA fixture/);
  assert.match(html,/stays in this browser and is not uploaded/);
  assert.match(app,/importPgaFixture/);
  assert.match(app,/file\.text\(\)/);
  assert.match(app,/PGA test data/);
});

test('course import does not claim a tee loaded when only pars are available',async()=>{
  const app=await read('js/app.js');
  assert.match(app,/Pars loaded · hole yardages unavailable/);
  assert.match(app,/No hole yardages from OpenGolfAPI/);
});
