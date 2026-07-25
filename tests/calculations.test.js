import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShot, drivingSummary, expectedStrokes, inferShotType, missParts, nextShotStart, penaltyForLocation } from '../js/calculations.js';

const closeTo=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} was not close to ${expected}`);

test('interpolates expected strokes',()=>{
  closeTo(expectedStrokes('tee',125),2.985);
});

test('parses all dimensions of a miss',()=>{
  assert.deepEqual(missParts('short-right'),{zone:'short-right',depth:'short',lateral:'right'});
  assert.deepEqual(missParts('left'),{zone:'left',depth:'target',lateral:'left'});
});

test('applies a penalty stroke',()=>{
  const penalty=penaltyForLocation('penalty-area');
  const result=calculateShot({startLie:'tee',startDistance:400,finishLocation:'penalty-area',endDistance:180,penalty});
  assert.equal(result.penaltyStrokes,1);
  assert.ok(result.strokesGained<0);
});

test('infers shots in playing order',()=>{
  assert.equal(inferShotType({lie:'tee',distance:410,par:4,shotNumber:1}),'drive');
  assert.equal(inferShotType({lie:'fairway',distance:155,par:4,shotNumber:2}),'approach');
  assert.equal(inferShotType({lie:'rough',distance:22,par:4,shotNumber:3}),'chip');
  assert.equal(inferShotType({lie:'green',distance:14,par:4,shotNumber:4}),'putt');
});

test('uses a finish as the next shot start',()=>{
  const approach={finish:{location:'green',benchmarkLie:'green',distance:18}};
  assert.deepEqual(nextShotStart(approach),{lie:'green',distance:18,unit:'feet'});
  assert.equal(nextShotStart({finish:{location:'holed',benchmarkLie:'holed',distance:0}}),null);
});

test('calculates a holed putt',()=>{
  const result=calculateShot({startLie:'green',startDistance:5,finishLocation:'holed',endDistance:0,penalty:null});
  closeTo(result.strokesGained,0.4);
  assert.equal(result.expectedAfter,0);
});

test('summarizes drive outcomes',()=>{
  const shots=[
    {type:'drive',finish:{location:'fairway'},penalty:null,calculation:{strokesGained:0.2}},
    {type:'drive',finish:{location:'rough'},penalty:null,calculation:{strokesGained:-0.1}},
    {type:'drive',finish:{location:'out-of-bounds'},penalty:{strokes:1},calculation:{strokesGained:-1.4}},
    {type:'approach',finish:{location:'green'},penalty:null,calculation:{strokesGained:0.3}}
  ];
  const summary=drivingSummary(shots);
  assert.equal(summary.count,3);
  closeTo(summary.fairwayRate,1/3);
  closeTo(summary.playableRate,2/3);
  assert.equal(summary.penalties,1);
  closeTo(summary.sg,-1.3);
});
