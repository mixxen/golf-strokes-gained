import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoundStore } from '../js/round-store.js';
import { convertPgaFixtureToRounds,importPgaFixture } from '../js/pga-fixture-import.js';

function memoryStorage() {
  const values=new Map();
  return {
    getItem:(key)=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value)
  };
}

function action({
  strokeNumber,
  type='stroke',
  startLie,
  startDistance,
  startUnit='yards',
  finishLie,
  finishDistance,
  finishUnit='yards',
  lateral='target',
  finalStroke=false,
  startLocation='',
  finishLocation='',
  playByPlay=''
}) {
  return {
    strokeNumber,
    actionType:type,
    countsAsPhysicalStroke:type==='stroke',
    countsAsPenaltyStroke:type==='penalty',
    finalStroke,
    playByPlay,
    start:{
      benchmarkLie:startLie,
      sourceLocation:startLocation,
      distanceToHole:startDistance===null?null:{value:startDistance,unit:startUnit}
    },
    finish:{
      benchmarkLie:finalStroke?'holed':finishLie,
      sourceLocation:finishLocation,
      lateral,
      distanceToHole:finalStroke?{value:0,unit:startUnit}:finishDistance===null?null:{value:finishDistance,unit:finishUnit}
    }
  };
}

function fixture() {
  return {
    schemaVersion:1,
    source:{fetchedAt:'2026-07-26T00:00:00.000Z'},
    player:{id:'28237',name:'Rory McIlroy'},
    tournament:{
      id:'R2025011',
      name:'2025 THE PLAYERS Championship',
      course:'TPC Sawgrass',
      startDate:'2025-03-13'
    },
    rounds:[{
      roundNumber:1,
      holes:[{
        number:1,
        par:4,
        yardage:417,
        score:3,
        actions:[
          action({
            strokeNumber:1,
            startLie:'tee',
            startDistance:417,
            finishLie:'fairway',
            finishDistance:139,
            lateral:'right',
            startLocation:'Tee Box',
            finishLocation:'Right Fairway',
            playByPlay:'276 yds to right fairway, 139 yds to hole'
          }),
          action({
            strokeNumber:2,
            startLie:'fairway',
            startDistance:139,
            finishLie:'green',
            finishDistance:7+2/12,
            finishUnit:'feet',
            lateral:'left',
            startLocation:'Fairway',
            finishLocation:'Left Green'
          }),
          action({
            strokeNumber:3,
            startLie:'green',
            startDistance:7+2/12,
            startUnit:'feet',
            finishLie:'holed',
            finishDistance:0,
            finishUnit:'feet',
            finalStroke:true,
            startLocation:'Green',
            finishLocation:'Holed'
          })
        ]
      }]
    },{
      roundNumber:2,
      holes:[{
        number:1,
        par:4,
        yardage:400,
        score:4,
        actions:[
          action({
            strokeNumber:1,
            startLie:'tee',
            startDistance:400,
            finishLie:'penalty-area',
            finishDistance:180,
            lateral:'right',
            finishLocation:'Right Water'
          }),
          action({
            strokeNumber:2,
            type:'penalty',
            startLie:'tee',
            startDistance:180,
            finishLie:null,
            finishDistance:null,
            playByPlay:'Penalty'
          }),
          action({
            strokeNumber:2,
            type:'drop',
            startLie:'fairway',
            startDistance:180,
            finishLie:'fairway',
            finishDistance:175,
            finishLocation:'Right Fairway',
            playByPlay:'Drop in right fairway, 175 yds to hole'
          }),
          action({
            strokeNumber:3,
            startLie:'fairway',
            startDistance:175,
            finishLie:'sand',
            finishDistance:30,
            finishUnit:'feet',
            finishLocation:'Left Bunker'
          }),
          action({
            strokeNumber:4,
            startLie:'sand',
            startDistance:30,
            startUnit:'feet',
            finishLie:'holed',
            finishDistance:0,
            finishUnit:'feet',
            finalStroke:true,
            startLocation:'Green'
          })
        ]
      }]
    }]
  };
}

test('converts PGA rounds into complete app rounds',()=>{
  const rounds=convertPgaFixtureToRounds(fixture(),{
    now:()=> '2026-07-26T12:00:00.000Z'
  });

  assert.equal(rounds.length,2);
  assert.equal(rounds[0].id,'pga-R2025011-28237-r1');
  assert.equal(rounds[0].date,'2025-03-13');
  assert.equal(rounds[1].date,'2025-03-14');
  assert.equal(rounds[0].testData.playedDate,'2025-03-13');
  assert.equal(rounds[1].testData.playedDate,'2025-03-14');
  assert.equal(rounds[0].testData.tournamentStartDate,'2025-03-13');
  assert.equal(rounds[0].courseName,'TPC Sawgrass');
  assert.equal(rounds[0].testData.playerName,'Rory McIlroy');
  assert.equal(rounds[0].holes[0].teeDistance,417);
  assert.equal(rounds[0].shots.length,3);
  assert.equal(rounds[0].shots.at(-1).finish.location,'holed');
  assert.equal(rounds[0].shots.reduce((sum,shot)=>sum+1+Number(shot.penalty?.strokes||0),0),3);
});

test('combines a PGA penalty and drop with the preceding physical stroke',()=>{
  const round=convertPgaFixtureToRounds(fixture())[1];
  const penaltyShot=round.shots[0];

  assert.equal(round.shots.length,3);
  assert.deepEqual(penaltyShot.penalty,{
    type:'penalty-area',
    strokes:1,
    strokeAndDistance:false
  });
  assert.equal(penaltyShot.finish.location,'penalty-area');
  assert.equal(penaltyShot.finish.benchmarkLie,'fairway');
  assert.equal(penaltyShot.finish.distance,175);
  assert.equal(round.shots[1].start.distance,175);
  assert.equal(round.shots[1].finish.location,'greenside-bunker');
  assert.equal(round.shots[1].finish.distance,10);
  assert.equal(round.shots[2].start.lie,'sand');
  assert.equal(round.shots[2].start.distance,10);
  assert.equal(round.shots.reduce((sum,shot)=>sum+1+Number(shot.penalty?.strokes||0),0),4);
});

test('imports idempotently and replaces the same round identities',()=>{
  const store=createRoundStore(memoryStorage(),{
    now:()=> '2026-07-26T12:00:00.000Z'
  });
  const first=importPgaFixture(fixture(),store);
  const second=importPgaFixture(fixture(),store);

  assert.deepEqual({added:first.added,updated:first.updated},{added:2,updated:0});
  assert.deepEqual({added:second.added,updated:second.updated},{added:0,updated:2});
  assert.equal(store.list().length,2);
  assert.equal(store.get('pga-R2025011-28237-r1').date,'2025-03-13');
  assert.equal(store.get('pga-R2025011-28237-r2').date,'2025-03-14');
  assert.equal(store.get('pga-R2025011-28237-r1').testData.playedDate,'2025-03-13');
});

test('uses a source round date when the fixture provides one',()=>{
  const source=fixture();
  source.rounds[0].date='2025-03-15';
  const round=convertPgaFixtureToRounds(source)[0];
  assert.equal(round.date,'2025-03-15');
  assert.equal(round.testData.playedDate,'2025-03-15');
});
