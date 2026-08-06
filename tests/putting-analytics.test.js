import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  aggregateRoundsAnalytics,
  puttingDistanceBreakdown,
  roundAnalytics
} from '../js/analytics.js';
import {
  puttingDistanceChartHtml,
  roundIsCompleteForPutting
} from '../js/putting-analytics.js';

function putt({
  id,
  hole=1,
  shotNumber=1,
  startDistance,
  startUnit='feet',
  finishDistance=0,
  holed=true,
  sg=0
}) {
  return {
    id,
    hole,
    shotNumber,
    type:'putt',
    start:{lie:'green',distance:startDistance,unit:startUnit},
    finish:{
      location:holed?'holed':'green',
      benchmarkLie:holed?'holed':'green',
      distance:holed?0:finishDistance,
      unit:holed?'yards':'feet'
    },
    miss:{zone:holed?'target':'short'},
    penalty:null,
    calculation:{strokesGained:sg,penaltyStrokes:0}
  };
}

const samplePutts=[
  putt({id:'two',startDistance:2,sg:0.1}),
  putt({id:'five',startDistance:5,sg:-0.2}),
  putt({id:'eight',startDistance:8,sg:0.3}),
  putt({id:'fifteen',startDistance:15,sg:-0.4}),
  putt({id:'thirty',startDistance:30,sg:0.5}),
  putt({id:'fifty',startDistance:50,sg:-0.6})
];

test('bins putting SG by starting distance in feet',()=>{
  const result=puttingDistanceBreakdown(samplePutts);
  assert.deepEqual(
    result.map(({key,count,sg})=>({key,count,sg})),
    [
      {key:'0-3',count:1,sg:0.1},
      {key:'4-6',count:1,sg:-0.2},
      {key:'7-10',count:1,sg:0.3},
      {key:'11-20',count:1,sg:-0.4},
      {key:'21-40',count:1,sg:0.5},
      {key:'41-plus',count:1,sg:-0.6}
    ]
  );
});

test('normalizes a legacy green distance stored in yards',()=>{
  const result=puttingDistanceBreakdown([
    putt({id:'legacy',startDistance:2,startUnit:'yards',sg:0.25})
  ]);
  assert.equal(result.find((bucket)=>bucket.key==='4-6').count,1);
  assert.equal(result.find((bucket)=>bucket.key==='4-6').sg,0.25);
});

test('exposes putting distance rows in round analytics',()=>{
  const analytics=roundAnalytics(samplePutts,[]);
  assert.equal(analytics.puttingDistances.reduce((sum,row)=>sum+row.count,0),6);
  assert.equal(analytics.puttingDistances.find((row)=>row.key==='41-plus').sg,-0.6);
});

test('aggregates putting buckets by total putts and average SG per round',()=>{
  const firstRoundShots=[
    putt({
      id:'first-long',
      shotNumber:1,
      startDistance:3,
      finishDistance:1,
      holed:false,
      sg:-0.2
    }),
    putt({id:'first-short',shotNumber:2,startDistance:1,sg:0})
  ];
  const secondRoundShots=[
    putt({id:'second',shotNumber:1,startDistance:3,sg:0.05})
  ];
  const rounds=[
    {status:'complete',shots:firstRoundShots,holes:[{number:1,par:4,teeDistance:400}],holeCount:1},
    {status:'complete',shots:secondRoundShots,holes:[{number:1,par:4,teeDistance:400}],holeCount:1}
  ];
  const analytics=aggregateRoundsAnalytics(rounds,5);
  const bucket=analytics.puttingDistances.find((row)=>row.key==='0-3');

  assert.equal(analytics.roundCount,2);
  assert.equal(analytics.puttingCount,3);
  assert.ok(Math.abs(analytics.puttingSgPerRound-(-0.075))<1e-10);
  assert.equal(bucket.count,3);
  assert.ok(Math.abs(bucket.totalSg-(-0.15))<1e-10);
  assert.ok(Math.abs(bucket.sg-(-0.075))<1e-10);
  assert.ok(Math.abs(bucket.average-(-0.05))<1e-10);
});

test('renders counts, per-putt values, and aggregate semantics',()=>{
  const html=puttingDistanceChartHtml([
    {label:'7–10 ft',count:4,sg:0.8,average:0.2}
  ],{aggregate:true});
  assert.match(html,/7–10 ft/);
  assert.match(html,/4 putts/);
  assert.match(html,/\+0\.20 \/ putt/);
  assert.match(html,/average SG per selected round/);
});

test('recognizes completed rounds defensively',()=>{
  assert.equal(roundIsCompleteForPutting({status:'complete'}),true);
  assert.equal(roundIsCompleteForPutting({
    status:'in-progress',
    holeCount:1,
    holes:[{number:1}],
    shots:[putt({id:'done'})]
  }),true);
  assert.equal(roundIsCompleteForPutting({
    status:'in-progress',
    holeCount:1,
    holes:[{number:1}],
    shots:[putt({id:'open',holed:false,finishDistance:1})]
  }),false);
});

test('the existing landing-page module installs the putting extension',async()=>{
  const launcher=await readFile(new URL('../js/round-list-delete.js',import.meta.url),'utf8');
  const styles=await readFile(new URL('../round-list-delete.css',import.meta.url),'utf8');
  assert.match(launcher,/installPuttingAnalytics/);
  assert.match(styles,/putting-distance-chart/);
  assert.match(styles,/aggregate-putting-chart/);
});
