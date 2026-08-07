import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  aggregateStartingDistance,
  roundIsCompleteForDistance,
  startingDistanceChartHtml
} from '../js/aggregate-distance-analytics.js';

function shot({
  id,
  hole=1,
  shotNumber=1,
  type='approach',
  startLie='fairway',
  startDistance,
  sg,
  holed=false
}) {
  return {
    id,
    hole,
    shotNumber,
    type,
    start:{
      lie:startLie,
      distance:startDistance,
      unit:startLie==='green'?'feet':'yards'
    },
    finish:{
      location:holed?'holed':'green',
      benchmarkLie:holed?'holed':'green',
      distance:holed?0:10,
      unit:holed?'yards':'feet'
    },
    calculation:{strokesGained:sg,penaltyStrokes:0}
  };
}

const firstRound={
  status:'complete',
  holeCount:1,
  holes:[{number:1,par:4,teeDistance:400}],
  shots:[
    shot({id:'first-short',shotNumber:1,startDistance:25,sg:0.2}),
    shot({id:'first-mid',shotNumber:2,startDistance:150,sg:-0.4}),
    shot({
      id:'ignored-putt',
      shotNumber:3,
      type:'putt',
      startLie:'green',
      startDistance:8,
      sg:0.5,
      holed:true
    })
  ]
};

const secondRound={
  status:'complete',
  holeCount:1,
  holes:[{number:1,par:5,teeDistance:520}],
  shots:[
    shot({id:'second-short',shotNumber:1,startDistance:25,sg:0.1}),
    shot({id:'second-long',shotNumber:2,startDistance:230,sg:0.5,holed:true})
  ]
};

test('aggregates off-green SG buckets as average SG per selected round',()=>{
  const result=aggregateStartingDistance([firstRound,secondRound],5);
  const short=result.rows.find((row)=>row.key==='0-30');
  const middle=result.rows.find((row)=>row.key==='126-175');
  const long=result.rows.find((row)=>row.key==='226-plus');

  assert.equal(result.roundCount,2);
  assert.equal(short.count,2);
  assert.ok(Math.abs(short.totalSg-0.3)<1e-10);
  assert.ok(Math.abs(short.sg-0.15)<1e-10);
  assert.ok(Math.abs(short.average-0.15)<1e-10);

  assert.equal(middle.count,1);
  assert.ok(Math.abs(middle.totalSg-(-0.4))<1e-10);
  assert.ok(Math.abs(middle.sg-(-0.2))<1e-10);
  assert.ok(Math.abs(middle.average-(-0.4))<1e-10);

  assert.equal(long.count,1);
  assert.ok(Math.abs(long.totalSg-0.5)<1e-10);
  assert.ok(Math.abs(long.sg-0.25)<1e-10);
  assert.ok(Math.abs(long.average-0.5)<1e-10);
});

test('honors the selected recent-round limit',()=>{
  const result=aggregateStartingDistance([firstRound,secondRound],1);
  assert.equal(result.roundCount,1);
  assert.equal(result.rows.find((row)=>row.key==='0-30').count,1);
  assert.equal(result.rows.find((row)=>row.key==='226-plus').count,0);
});

test('renders counts, per-stroke values, and per-round semantics',()=>{
  const html=startingDistanceChartHtml([
    {label:'126–175 yd',count:4,sg:-0.8,average:-0.2}
  ]);
  assert.match(html,/126–175 yd/);
  assert.match(html,/4 strokes/);
  assert.match(html,/-0\.20 \/ stroke/);
  assert.match(html,/average SG per selected round/);
});

test('shows an empty state when no off-green strokes are available',()=>{
  assert.match(
    startingDistanceChartHtml([]),
    /No off-green strokes recorded/
  );
});

test('recognizes completed rounds defensively',()=>{
  assert.equal(roundIsCompleteForDistance({status:'complete'}),true);
  assert.equal(roundIsCompleteForDistance({
    status:'in-progress',
    holeCount:1,
    holes:[{number:1}],
    shots:[shot({id:'done',startDistance:100,sg:0,holed:true})]
  }),true);
  assert.equal(roundIsCompleteForDistance({
    status:'in-progress',
    holeCount:1,
    holes:[{number:1}],
    shots:[shot({id:'open',startDistance:100,sg:0})]
  }),false);
});

test('the landing-page enhancement module installs starting-distance analytics',async()=>{
  const launcher=await readFile(new URL('../js/round-list-delete.js',import.meta.url),'utf8');
  const module=await readFile(new URL('../js/aggregate-distance-analytics.js',import.meta.url),'utf8');
  assert.match(launcher,/installAggregateStartingDistanceAnalytics/);
  assert.match(module,/SG by starting distance/);
  assert.match(module,/Average per selected round · off-green shots/);
});
