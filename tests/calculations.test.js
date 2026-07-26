import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BENCHMARKS,
  calculateShot,
  drivingSummary,
  expectedStrokes,
  inferShotType,
  missParts,
  nextShotStart,
  penaltyForLocation,
  resolveFinishPosition,
  scoreLabel,
  summarizeHole
} from '../js/calculations.js';

const closeTo=(actual,expected,tolerance=1e-10)=>assert.ok(
  Math.abs(actual-expected)<tolerance,
  `${actual} was not close to ${expected}`
);

function makeShot({shotNumber,start,finishLocation,endDistance,finishLie,penalty,type='approach'}) {
  const calculation=calculateShot({
    startLie:start.lie,
    startDistance:start.distance,
    finishLocation,
    endDistance,
    finishLie,
    penalty
  });
  return {
    shotNumber,
    type,
    start:{...start,unit:start.lie==='green'?'feet':'yards'},
    finish:{
      location:finishLocation,
      benchmarkLie:calculation.benchmarkLie,
      distance:calculation.endDistance,
      unit:calculation.benchmarkLie==='green'?'feet':'yards'
    },
    penalty,
    calculation
  };
}

test('interpolates expected strokes',()=>{
  closeTo(expectedStrokes('tee',125),2.985);
});

test('benchmark distances and expected strokes are monotonic',()=>{
  for(const [lie,table] of Object.entries(BENCHMARKS)){
    for(let index=1;index<table.length;index+=1){
      assert.ok(table[index][0]>table[index-1][0],`${lie} distances must increase`);
      assert.ok(table[index][1]>=table[index-1][1],`${lie} expected strokes must not decrease`);
    }
  }
});

test('parses all dimensions of a miss',()=>{
  assert.deepEqual(missParts('short-right'),{zone:'short-right',depth:'short',lateral:'right'});
  assert.deepEqual(missParts('left'),{zone:'left',depth:'target',lateral:'left'});
});

test('uses start minus cost minus finish for a normal shot',()=>{
  const result=calculateShot({
    startLie:'fairway',
    startDistance:150,
    finishLocation:'green',
    endDistance:20,
    penalty:null
  });
  closeTo(result.strokesGained,result.expectedBefore-1-result.expectedAfter);
  assert.equal(result.strokeCost,1);
});

test('applies a lateral penalty and the actual relief lie',()=>{
  const penalty=penaltyForLocation('penalty-area');
  const result=calculateShot({
    startLie:'fairway',
    startDistance:150,
    finishLocation:'penalty-area',
    finishLie:'rough',
    endDistance:100,
    penalty
  });
  assert.equal(result.benchmarkLie,'rough');
  assert.equal(result.endDistance,100);
  assert.equal(result.penaltyStrokes,1);
  closeTo(result.strokesGained,result.expectedBefore-2-result.expectedAfter);
});

test('makes stroke-and-distance exactly minus two strokes from any starting position',()=>{
  const penalty=penaltyForLocation('out-of-bounds');
  const result=calculateShot({
    startLie:'fairway',
    startDistance:150,
    finishLocation:'out-of-bounds',
    endDistance:12,
    finishLie:'tee',
    penalty
  });
  assert.equal(result.benchmarkLie,'fairway');
  assert.equal(result.endDistance,150);
  closeTo(result.expectedAfter,result.expectedBefore);
  closeTo(result.strokesGained,-2);
});

test('resolves an unplayable ball to the selected relief position',()=>{
  const position=resolveFinishPosition({
    startLie:'recovery',
    startDistance:80,
    finishLocation:'unplayable',
    finishLie:'rough',
    endDistance:75,
    penalty:penaltyForLocation('unplayable')
  });
  assert.deepEqual(position,{benchmarkLie:'rough',endDistance:75});
});

test('infers shots in playing order',()=>{
  assert.equal(inferShotType({lie:'tee',distance:410,par:4,shotNumber:1}),'drive');
  assert.equal(inferShotType({lie:'tee',distance:410,par:4,shotNumber:2}),'drive');
  assert.equal(inferShotType({lie:'tee',distance:25,par:3,shotNumber:1}),'approach');
  assert.equal(inferShotType({lie:'fairway',distance:155,par:4,shotNumber:2}),'approach');
  assert.equal(inferShotType({lie:'rough',distance:22,par:4,shotNumber:3}),'chip');
  assert.equal(inferShotType({lie:'green',distance:14,par:4,shotNumber:4}),'putt');
});

test('uses a finish as the next shot start',()=>{
  const approach={finish:{location:'green',benchmarkLie:'green',distance:18}};
  assert.deepEqual(nextShotStart(approach),{lie:'green',distance:18,unit:'feet'});
  assert.equal(nextShotStart({finish:{location:'holed',benchmarkLie:'holed',distance:0}}),null);
});

test('uses the replay position after out of bounds',()=>{
  const shot=makeShot({
    shotNumber:1,
    type:'drive',
    start:{lie:'tee',distance:400},
    finishLocation:'out-of-bounds',
    endDistance:100,
    penalty:penaltyForLocation('out-of-bounds')
  });
  assert.deepEqual(nextShotStart(shot),{lie:'tee',distance:400,unit:'yards'});
});

test('calculates a holed putt from the configured benchmark',()=>{
  const result=calculateShot({startLie:'green',startDistance:5,finishLocation:'holed',endDistance:0,penalty:null});
  closeTo(result.strokesGained,expectedStrokes('green',5)-1);
  assert.equal(result.expectedAfter,0);
});

test('complete-hole shot values telescope to tee expectation minus actual score',()=>{
  const drive=makeShot({
    shotNumber:1,
    type:'drive',
    start:{lie:'tee',distance:400},
    finishLocation:'fairway',
    endDistance:150
  });
  const approach=makeShot({
    shotNumber:2,
    start:{lie:'fairway',distance:150},
    finishLocation:'green',
    endDistance:20
  });
  const putt=makeShot({
    shotNumber:3,
    type:'putt',
    start:{lie:'green',distance:20},
    finishLocation:'holed',
    endDistance:0
  });
  const summary=summarizeHole([drive,approach,putt],{par:4,teeDistance:400});
  assert.equal(summary.score,3);
  assert.equal(summary.complete,true);
  closeTo(summary.strokesGained,expectedStrokes('tee',400)-3);
  closeTo(summary.identityError,0);
});

test('hole score includes penalty strokes',()=>{
  const ob=makeShot({
    shotNumber:1,
    type:'drive',
    start:{lie:'tee',distance:400},
    finishLocation:'out-of-bounds',
    endDistance:0,
    penalty:penaltyForLocation('out-of-bounds')
  });
  const replay=makeShot({
    shotNumber:2,
    type:'drive',
    start:{lie:'tee',distance:400},
    finishLocation:'holed',
    endDistance:0
  });
  const summary=summarizeHole([ob,replay],{par:4,teeDistance:400});
  assert.equal(summary.physicalStrokes,2);
  assert.equal(summary.penaltyStrokes,1);
  assert.equal(summary.score,3);
  closeTo(summary.strokesGained,expectedStrokes('tee',400)-3);
});

test('labels common hole scores',()=>{
  assert.equal(scoreLabel(1,3),'Hole in one');
  assert.equal(scoreLabel(3,4),'Birdie');
  assert.equal(scoreLabel(4,4),'Par');
  assert.equal(scoreLabel(6,4),'Double bogey');
});

test('summarizes drive outcomes',()=>{
  const shots=[
    {type:'drive',finish:{location:'fairway'},penalty:null,calculation:{strokesGained:0.2}},
    {type:'drive',finish:{location:'rough'},penalty:null,calculation:{strokesGained:-0.1}},
    {type:'drive',finish:{location:'out-of-bounds'},penalty:{strokes:1},calculation:{strokesGained:-2}},
    {type:'approach',finish:{location:'green'},penalty:null,calculation:{strokesGained:0.3}}
  ];
  const summary=drivingSummary(shots);
  assert.equal(summary.count,3);
  closeTo(summary.fairwayRate,1/3);
  closeTo(summary.playableRate,2/3);
  assert.equal(summary.penalties,1);
  closeTo(summary.sg,-1.9);
});
