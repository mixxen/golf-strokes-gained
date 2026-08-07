import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  aggregateShortGameDistance,
  roundIsCompleteForShortGame,
  shortGameDistanceBreakdown,
  shortGameDistanceChartHtml
} from '../js/short-game-analytics.js';

function stroke({
  id,
  type='chip',
  startLie='rough',
  startDistance=10,
  startUnit='yards',
  sg=0,
  hole=1,
  shotNumber=1,
  finishLocation='green'
}) {
  return {
    id,
    hole,
    shotNumber,
    type,
    start:{lie:startLie,distance:startDistance,unit:startUnit},
    finish:{
      location:finishLocation,
      benchmarkLie:finishLocation==='holed'?'holed':'green',
      distance:finishLocation==='holed'?0:3,
      unit:finishLocation==='holed'?'yards':'feet'
    },
    calculation:{strokesGained:sg,penaltyStrokes:0}
  };
}

test('separates bunker strokes from non-sand chips and pitches',()=>{
  const shots=[
    stroke({id:'rough-4',startLie:'rough',startDistance:4,sg:0.2}),
    stroke({id:'fairway-8',startLie:'fairway',startDistance:8,sg:-0.1}),
    stroke({id:'sand-9',startLie:'sand',startDistance:9,sg:0.3}),
    stroke({id:'sand-18',startLie:'sand',startDistance:18,sg:-0.4}),
    stroke({
      id:'long-sand-approach',
      type:'approach',
      startLie:'sand',
      startDistance:20,
      sg:-0.8
    }),
    stroke({
      id:'putt',
      type:'putt',
      startLie:'green',
      startDistance:5,
      startUnit:'feet',
      sg:0.1
    })
  ];

  const chipPitch=shortGameDistanceBreakdown(shots,'chip-pitch');
  const sand=shortGameDistanceBreakdown(shots,'sand');

  assert.equal(chipPitch.reduce((sum,row)=>sum+row.count,0),2);
  assert.equal(chipPitch.find((row)=>row.key==='0-5').sg,0.2);
  assert.equal(chipPitch.find((row)=>row.key==='6-10').sg,-0.1);
  assert.equal(sand.reduce((sum,row)=>sum+row.count,0),2);
  assert.equal(sand.find((row)=>row.key==='6-10').sg,0.3);
  assert.equal(sand.find((row)=>row.key==='11-20').sg,-0.4);
});

test('normalizes an off-green starting distance stored in feet',()=>{
  const sand=shortGameDistanceBreakdown([
    stroke({
      id:'legacy-sand',
      startLie:'sand',
      startDistance:30,
      startUnit:'feet',
      sg:0.25
    })
  ],'sand');

  assert.equal(sand.find((row)=>row.key==='6-10').count,1);
  assert.equal(sand.find((row)=>row.key==='6-10').sg,0.25);
});

test('keeps around-the-green outliers in a 31-plus bucket',()=>{
  const chipPitch=shortGameDistanceBreakdown([
    stroke({id:'manual-pitch',startLie:'rough',startDistance:36,sg:-0.35})
  ],'chip-pitch');

  const bucket=chipPitch.find((row)=>row.key==='31-plus');
  assert.equal(bucket.count,1);
  assert.equal(bucket.sg,-0.35);
});

test('aggregates each short-game group by selected round and by stroke',()=>{
  const rounds=[
    {
      shots:[
        stroke({id:'sand-1',startLie:'sand',startDistance:5,sg:-0.2}),
        stroke({id:'chip-1',startLie:'rough',startDistance:15,sg:0.1})
      ]
    },
    {
      shots:[
        stroke({id:'sand-2',startLie:'sand',startDistance:5,sg:0.4}),
        stroke({id:'chip-2',startLie:'fairway',startDistance:15,sg:-0.3})
      ]
    }
  ];

  const analytics=aggregateShortGameDistance(rounds,5);
  const sand=analytics.sand.find((row)=>row.key==='0-5');
  const chipPitch=analytics.chipPitch.find((row)=>row.key==='11-20');

  assert.equal(analytics.roundCount,2);
  assert.equal(sand.count,2);
  assert.ok(Math.abs(sand.totalSg-0.2)<1e-10);
  assert.ok(Math.abs(sand.sg-0.1)<1e-10);
  assert.ok(Math.abs(sand.average-0.1)<1e-10);
  assert.equal(chipPitch.count,2);
  assert.ok(Math.abs(chipPitch.totalSg-(-0.2))<1e-10);
  assert.ok(Math.abs(chipPitch.sg-(-0.1))<1e-10);
  assert.ok(Math.abs(chipPitch.average-(-0.1))<1e-10);
});

test('limits aggregate short-game analysis to the selected recent rounds',()=>{
  const rounds=Array.from({length:5},(_,index)=>({
    shots:[stroke({
      id:`sand-${index}`,
      startLie:'sand',
      startDistance:5,
      sg:index+1
    })]
  }));

  const analytics=aggregateShortGameDistance(rounds,3);
  const bucket=analytics.sand.find((row)=>row.key==='0-5');
  assert.equal(analytics.roundCount,3);
  assert.equal(bucket.count,3);
  assert.equal(bucket.totalSg,6);
  assert.equal(bucket.sg,2);
});

test('renders sample size, per-stroke SG, and aggregate semantics',()=>{
  const html=shortGameDistanceChartHtml([
    {label:'11–20 yd',count:4,sg:-0.4,average:-0.1}
  ],{aggregate:true});

  assert.match(html,/11–20 yd/);
  assert.match(html,/4 strokes/);
  assert.match(html,/−|-/);
  assert.match(html,/-0\.10 \/ stroke/);
  assert.match(html,/average SG per selected round/);
});

test('renders a group-specific empty state',()=>{
  const html=shortGameDistanceChartHtml([],{
    emptyLabel:'No bunker shots recorded.'
  });
  assert.match(html,/No bunker shots recorded/);
  assert.match(html,/short-game-empty-state/);
});

test('recognizes completed rounds defensively',()=>{
  assert.equal(roundIsCompleteForShortGame({status:'complete'}),true);
  assert.equal(roundIsCompleteForShortGame({
    status:'in-progress',
    holeCount:1,
    holes:[{number:1}],
    shots:[stroke({id:'done',finishLocation:'holed'})]
  }),true);
  assert.equal(roundIsCompleteForShortGame({
    status:'in-progress',
    holeCount:1,
    holes:[{number:1}],
    shots:[stroke({id:'open',finishLocation:'green'})]
  }),false);
});

test('the landing-page enhancement module installs short-game analytics',async()=>{
  const launcher=await readFile(
    new URL('../js/round-list-delete.js',import.meta.url),
    'utf8'
  );
  const module=await readFile(
    new URL('../js/short-game-analytics.js',import.meta.url),
    'utf8'
  );
  const styles=await readFile(
    new URL('../round-list-delete.css',import.meta.url),
    'utf8'
  );

  assert.match(launcher,/installShortGameAnalytics/);
  assert.match(module,/bunker-distance-panel/);
  assert.match(module,/chip-pitch-distance-panel/);
  assert.match(module,/aggregate-bunker-distance-panel/);
  assert.match(module,/aggregate-chip-pitch-distance-panel/);
  assert.match(styles,/aggregate-short-game-chart/);
});
