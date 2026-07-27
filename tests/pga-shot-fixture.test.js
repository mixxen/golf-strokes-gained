import test from 'node:test';
import assert from 'node:assert/strict';
import {
  benchmarkLieForLocation,
  buildPgaFixture,
  normalizePgaStroke,
  parsePgaDistance,
  summarizePgaFixture
} from '../scripts/pga-shot-fixture.js';

test('normalizes PGA yard, foot, and inch distances',()=>{
  assert.deepEqual(parsePgaDistance('276 yds'),{
    raw:'276 yds',
    value:276,
    unit:'yards'
  });
  assert.deepEqual(parsePgaDistance('7 ft 2 in.'),{
    raw:'7 ft 2 in.',
    value:7+2/12,
    unit:'feet'
  });
  assert.deepEqual(parsePgaDistance('6 in.'),{
    raw:'6 in.',
    value:0.5,
    unit:'feet'
  });
  assert.equal(parsePgaDistance(''),null);
});

test('maps PGA locations to the benchmark lies used by the app',()=>{
  assert.equal(benchmarkLieForLocation('OTB','Tee Box'),'tee');
  assert.equal(benchmarkLieForLocation('OFW','Fairway'),'fairway');
  assert.equal(benchmarkLieForLocation('ORO','Primary Rough'),'rough');
  assert.equal(benchmarkLieForLocation('OST','Fairway Bunker'),'sand');
  assert.equal(benchmarkLieForLocation('OGS','Greenside Bunker'),'sand');
  assert.equal(benchmarkLieForLocation('OTO','Tree Outline'),'recovery');
  assert.equal(benchmarkLieForLocation('ERW','Right Water'),'penalty-area');
  assert.equal(benchmarkLieForLocation('OGR','Green'),'green');
});

test('normalizes a shot and preserves the source description',()=>{
  const shot=normalizePgaStroke({
    strokeNumber:2,
    playByPlay:'137 yds to left green, 7 ft 2 in. to hole',
    distance:'137 yds',
    distanceRemaining:'7 ft 2 in.',
    strokeType:'STROKE',
    fromLocation:'Fairway',
    fromLocationCode:'OFW',
    toLocation:'Left Green',
    toLocationCode:'ELG',
    finalStroke:false
  },{roundNumber:1,holeNumber:1});

  assert.equal(shot.start.benchmarkLie,'fairway');
  assert.equal(shot.start.distanceToHole,null);
  assert.equal(shot.finish.benchmarkLie,'green');
  assert.equal(shot.finish.lateral,'left');
  assert.equal(shot.remainingDistance.value,7+2/12);
  assert.equal(shot.countsAsPhysicalStroke,true);
  assert.match(shot.playByPlay,/left green/);
});

test('distinguishes physical strokes, penalties, and drops',()=>{
  const sourceHole={
    holeNumber:9,
    par:5,
    yardage:587,
    score:'3',
    status:'PAR',
    strokes:[
      {
        strokeNumber:1,
        playByPlay:'321 yds to right water, 259 yds to hole',
        distance:'321 yds',
        distanceRemaining:'259 yds',
        strokeType:'STROKE',
        fromLocation:'Tee Box',
        fromLocationCode:'OTB',
        toLocation:'Right Water',
        toLocationCode:'ERW'
      },
      {
        strokeNumber:2,
        playByPlay:'Penalty',
        distance:'-1 in',
        distanceRemaining:'',
        strokeType:'PENALTY',
        fromLocation:'Tee Box',
        fromLocationCode:'OTB'
      },
      {
        strokeNumber:2,
        playByPlay:'Drop in right fairway, 271 yds to hole',
        distance:'37 ft 0 in.',
        distanceRemaining:'271 yds',
        strokeType:'DROP',
        fromLocation:'Fairway',
        fromLocationCode:'OFW',
        toLocation:'Right Fairway',
        toLocationCode:'ERF'
      },
      {
        strokeNumber:3,
        playByPlay:'In the hole',
        distance:'4 ft 3 in.',
        distanceRemaining:'',
        strokeType:'STROKE',
        fromLocation:'Green',
        fromLocationCode:'OGR',
        toLocation:'Green',
        toLocationCode:'OGR',
        finalStroke:true
      }
    ]
  };
  const fixture=buildPgaFixture({
    tournamentId:'RTEST',
    playerId:'PTEST',
    playerName:'Test Player',
    eventName:'Test Event',
    startDate:'2026-07-23',
    fetchedAt:'2026-07-26T00:00:00.000Z',
    roundPayloads:[{round:1,holes:[sourceHole]}]
  });
  const summary=summarizePgaFixture(fixture);

  assert.deepEqual(summary,{
    rounds:1,
    holes:1,
    actions:4,
    physicalStrokes:2,
    penaltyStrokes:1,
    drops:1,
    score:3,
    actionTypes:{stroke:2,penalty:1,drop:1},
    scoreFromActions:3,
    scoreMatchesActions:true
  });
  assert.equal(fixture.rounds[0].holes[0].actions[0].start.distanceToHole.value,587);
  assert.equal(fixture.rounds[0].holes[0].actions[0].finish.benchmarkLie,'penalty-area');
  assert.equal(fixture.rounds[0].holes[0].actions[1].countsAsPenaltyStroke,true);
  assert.equal(fixture.rounds[0].holes[0].actions[2].countsAsPhysicalStroke,false);
  assert.equal(fixture.rounds[0].holes[0].actions[3].finish.benchmarkLie,'holed');
  assert.equal(fixture.rounds[0].holes[0].actions[3].remainingDistance.value,0);
  assert.equal(fixture.tournament.startDate,'2026-07-23');
});
