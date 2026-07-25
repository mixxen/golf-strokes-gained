import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShot, drivingSummary, expectedStrokes, missParts, penaltyForLocation } from '../js/calculations.js';

test('interpolates expected strokes',()=>{
  assert.equal(expectedStrokes('tee',125),2.985);
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
  assert.deepEqual(drivingSummary(shots),{count:3,fairwayRate:1/3,playableRate:2/3,penalties:1,sg:-1.3});
});
