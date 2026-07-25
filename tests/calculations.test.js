import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShot, drivingSummary, expectedStrokes, missParts, penaltyForLocation } from '../js/calculations.js';

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
