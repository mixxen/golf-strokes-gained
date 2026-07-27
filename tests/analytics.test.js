import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateRoundsAnalytics,
  categoryBreakdown,
  distanceBreakdown,
  missZoneBreakdown,
  rankedShots,
  roundAnalytics
} from '../js/analytics.js';

function shot({
  id,
  hole=1,
  shotNumber,
  type,
  startLie,
  startDistance,
  finishLocation,
  finishLie,
  sg,
  zone='target',
  penaltyStrokes=0
}) {
  return {
    id,
    hole,
    shotNumber,
    type,
    start:{lie:startLie,distance:startDistance,unit:startLie==='green'?'feet':'yards'},
    finish:{
      location:finishLocation,
      benchmarkLie:finishLie,
      distance:finishLocation==='holed'?0:10,
      unit:finishLie==='green'?'feet':'yards'
    },
    miss:{zone},
    penalty:penaltyStrokes?{strokes:penaltyStrokes}:null,
    calculation:{strokesGained:sg,penaltyStrokes}
  };
}

const shots=[
  shot({
    id:'drive',
    shotNumber:1,
    type:'drive',
    startLie:'tee',
    startDistance:400,
    finishLocation:'fairway',
    finishLie:'fairway',
    sg:0.25,
    zone:'right'
  }),
  shot({
    id:'approach',
    shotNumber:2,
    type:'approach',
    startLie:'fairway',
    startDistance:140,
    finishLocation:'green',
    finishLie:'green',
    sg:-0.1,
    zone:'short-right'
  }),
  shot({
    id:'putt',
    shotNumber:3,
    type:'putt',
    startLie:'green',
    startDistance:8,
    finishLocation:'holed',
    finishLie:'holed',
    sg:0.5
  })
];

test('summarizes strokes gained by shot category',()=>{
  const result=categoryBreakdown(shots);
  assert.deepEqual(
    result.map(({key,count,sg})=>({key,count,sg})),
    [
      {key:'drive',count:1,sg:0.25},
      {key:'approach',count:1,sg:-0.1},
      {key:'chip',count:0,sg:0},
      {key:'putt',count:1,sg:0.5}
    ]
  );
});

test('bins off-green shots by starting distance without mixing in putts',()=>{
  const result=distanceBreakdown(shots);
  assert.equal(result.find((bucket)=>bucket.key==='126-175').count,1);
  assert.equal(result.find((bucket)=>bucket.key==='126-175').sg,-0.1);
  assert.equal(result.find((bucket)=>bucket.key==='226-plus').count,1);
  assert.equal(result.reduce((total,bucket)=>total+bucket.count,0),2);
});

test('summarizes miss zones for a selected shot type',()=>{
  const drives=missZoneBreakdown(shots,'drive');
  const right=drives.find((item)=>item.zone==='right');
  assert.equal(right.count,1);
  assert.equal(right.average,0.25);

  const approaches=missZoneBreakdown(shots,'approach');
  assert.equal(approaches.find((item)=>item.zone==='short-right').count,1);
  assert.equal(approaches.find((item)=>item.zone==='right').count,0);
});

test('ranks all shots from best to worst and filters categories',()=>{
  assert.deepEqual(rankedShots(shots).map((item)=>item.id),['putt','drive','approach']);
  assert.deepEqual(rankedShots(shots,'drive').map((item)=>item.id),['drive']);
  assert.deepEqual(rankedShots(shots,'approach').map((item)=>item.id),['approach']);
  assert.deepEqual(rankedShots(shots,'putt').map((item)=>item.id),['putt']);
});

test('filters bunker-related and penalty shots',()=>{
  const bunkerShot=shot({
    id:'bunker-result',
    shotNumber:4,
    type:'approach',
    startLie:'rough',
    startDistance:80,
    finishLocation:'greenside-bunker',
    finishLie:'sand',
    sg:-0.7
  });
  const penaltyShot=shot({
    id:'penalty-result',
    shotNumber:5,
    type:'drive',
    startLie:'tee',
    startDistance:420,
    finishLocation:'out-of-bounds',
    finishLie:'tee',
    sg:-2,
    penaltyStrokes:1
  });
  const sample=[...shots,bunkerShot,penaltyShot];
  assert.deepEqual(rankedShots(sample,'bunker').map((item)=>item.id),['bunker-result']);
  assert.deepEqual(rankedShots(sample,'penalty').map((item)=>item.id),['penalty-result']);
});

test('builds useful round overview metrics and shot highlights',()=>{
  const result=roundAnalytics(shots,[{number:1,par:4,teeDistance:400}]);
  assert.equal(result.holesCompleted,1);
  assert.equal(result.score,3);
  assert.equal(result.toPar,-1);
  assert.equal(result.girRate,1);
  assert.equal(result.scramblingRate,null);
  assert.equal(result.putts,1);
  assert.equal(result.puttsPerHole,1);
  assert.equal(result.penalties,0);
  assert.equal(result.bestShot.id,'putt');
  assert.equal(result.worstShot.id,'approach');
  assert.ok(Math.abs(result.totalSg-0.65)<1e-10);
});

test('calculates scrambling and penalties on a missed green',()=>{
  const missedGreenShots=[
    shot({
      id:'drive-2',
      hole:2,
      shotNumber:1,
      type:'drive',
      startLie:'tee',
      startDistance:410,
      finishLocation:'rough',
      finishLie:'rough',
      sg:-1,
      penaltyStrokes:1
    }),
    shot({
      id:'approach-2',
      hole:2,
      shotNumber:2,
      type:'approach',
      startLie:'rough',
      startDistance:160,
      finishLocation:'rough',
      finishLie:'rough',
      sg:-0.2
    }),
    shot({
      id:'chip-2',
      hole:2,
      shotNumber:3,
      type:'chip',
      startLie:'rough',
      startDistance:18,
      finishLocation:'green',
      finishLie:'green',
      sg:0.3
    }),
    shot({
      id:'putt-2',
      hole:2,
      shotNumber:4,
      type:'putt',
      startLie:'green',
      startDistance:4,
      finishLocation:'holed',
      finishLie:'holed',
      sg:0.1
    })
  ];
  const result=roundAnalytics(missedGreenShots,[{number:2,par:5,teeDistance:510}]);
  assert.equal(result.score,5);
  assert.equal(result.girRate,0);
  assert.equal(result.scramblingRate,1);
  assert.equal(result.scramblingAttempts,1);
  assert.equal(result.penalties,1);
});

test('aggregates recent rounds with weighted rates and per-round category SG',()=>{
  const secondRoundShots=[
    shot({
      id:'drive-aggregate',
      shotNumber:1,
      type:'drive',
      startLie:'tee',
      startDistance:400,
      finishLocation:'rough',
      finishLie:'rough',
      sg:-0.4,
      penaltyStrokes:1
    }),
    shot({
      id:'approach-aggregate',
      shotNumber:2,
      type:'approach',
      startLie:'rough',
      startDistance:150,
      finishLocation:'rough',
      finishLie:'rough',
      sg:-0.2
    }),
    shot({
      id:'chip-aggregate',
      shotNumber:3,
      type:'chip',
      startLie:'rough',
      startDistance:15,
      finishLocation:'green',
      finishLie:'green',
      sg:0.1
    }),
    shot({
      id:'putt-aggregate',
      shotNumber:4,
      type:'putt',
      startLie:'green',
      startDistance:5,
      finishLocation:'holed',
      finishLie:'holed',
      sg:-0.3
    })
  ];
  const result=aggregateRoundsAnalytics([
    {shots,holes:[{number:1,par:4,teeDistance:400}],holeCount:1},
    {shots:secondRoundShots,holes:[{number:1,par:5,teeDistance:500}],holeCount:1}
  ],5);

  assert.equal(result.roundCount,2);
  assert.equal(result.holesCompleted,2);
  assert.ok(Math.abs(result.totalSg-(-0.15))<1e-10);
  assert.ok(Math.abs(result.averageSg-(-0.075))<1e-10);
  assert.equal(result.fairwayRate,0.5);
  assert.equal(result.girRate,0.5);
  assert.equal(result.scramblingRate,1);
  assert.equal(result.puttsPerHole,1);
  assert.equal(result.penalties,1);
  assert.equal(result.categories.find((item)=>item.key==='drive').count,2);
  assert.ok(Math.abs(result.categories.find((item)=>item.key==='drive').sg-(-0.075))<1e-10);
});

test('limits the aggregate to the requested number of recent rounds',()=>{
  const rounds=Array.from({length:10},(_,index)=>({
    shots:[{...shots[0],calculation:{...shots[0].calculation,strokesGained:index+1}}],
    holes:[{number:1,par:4,teeDistance:400}],
    holeCount:1
  }));
  const result=aggregateRoundsAnalytics(rounds,5);
  assert.equal(result.roundCount,5);
  assert.equal(result.totalSg,15);
});

test('defaults the recent-form aggregate to three rounds',()=>{
  const rounds=Array.from({length:5},()=>({
    shots,
    holes:[{number:1,par:4,teeDistance:400}],
    holeCount:1
  }));
  assert.equal(aggregateRoundsAnalytics(rounds).roundCount,3);
});
