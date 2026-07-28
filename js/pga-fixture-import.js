import {
  BENCHMARK_VERSION,
  calculateShot,
  inferShotType,
  missParts
} from './calculations.js';

const DEFAULT_CLUBS={drive:'Driver',approach:'',chip:'Sand wedge',putt:'Putter'};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function importedDraft() {
  return {
    shotType:'auto',
    startLie:'tee',
    startDistance:400,
    club:'',
    endDistance:150,
    zone:null,
    location:null,
    reliefLie:'rough',
    intendedShape:'',
    contact:'',
    notes:'',
    basedOnShotCount:null
  };
}

function distanceForLie(distance,lie,label) {
  const value=Number(distance?.value);
  if(!Number.isFinite(value)||value<0) throw new Error(`Missing ${label} distance.`);
  if(lie==='green'&&distance?.unit==='yards') return value*3;
  if(lie!=='green'&&distance?.unit==='feet') return value/3;
  return value;
}

function appLocation(action,nextPhysicalAction) {
  if(action.finalStroke) return 'holed';
  const lie=action.finish?.benchmarkLie;
  const source=`${action.finish?.sourceLocation||''} ${nextPhysicalAction?.start?.sourceLocation||''}`;
  if(lie==='fairway') return 'fairway';
  if(lie==='rough') return /intermediate/i.test(source)?'first-cut':'rough';
  if(lie==='green') return 'green';
  if(lie==='recovery') return 'recovery';
  if(lie==='penalty-area') return 'penalty-area';
  if(lie==='sand'){
    if(/greenside/i.test(source)) return 'greenside-bunker';
    if(/fairway bunker/i.test(source)) return 'fairway-bunker';
    const remaining=action.finish?.distanceToHole;
    return remaining?.unit==='feet'||Number(remaining?.value)<=50
      ? 'greenside-bunker'
      : 'fairway-bunker';
  }
  throw new Error(`Unsupported PGA finishing location: ${action.finish?.sourceLocation||'unknown'}.`);
}

function targetForType(type) {
  if(type==='drive') return 'landing-area';
  if(type==='putt') return 'hole';
  return 'flag';
}

function roundDate(startDate,roundNumber) {
  const parsed=new Date(`${startDate}T12:00:00Z`);
  if(Number.isNaN(parsed.valueOf())) return startDate;
  parsed.setUTCDate(parsed.getUTCDate()+Number(roundNumber)-1);
  return parsed.toISOString().slice(0,10);
}

function physicalGroups(actions) {
  const groups=[];
  for(let index=0;index<actions.length;index+=1){
    const action=actions[index];
    if(!action.countsAsPhysicalStroke) continue;
    const following=[];
    let cursor=index+1;
    while(cursor<actions.length&&!actions[cursor].countsAsPhysicalStroke){
      following.push(actions[cursor]);
      cursor+=1;
    }
    groups.push({
      action,
      following,
      nextPhysicalAction:actions[cursor]||null
    });
  }
  return groups;
}

function convertHoleActions(hole,roundNumber) {
  return physicalGroups(hole.actions||[]).map((group,index)=>{
    const {action,following,nextPhysicalAction}=group;
    const penaltyActions=following.filter((item)=>item.countsAsPenaltyStroke);
    const drop=following.find((item)=>item.actionType==='drop');
    const location=appLocation(action,nextPhysicalAction);
    const penalty=penaltyActions.length
      ? {
        type:location==='penalty-area'?'penalty-area':'other',
        strokes:penaltyActions.length,
        strokeAndDistance:false
      }
      : null;
    const finishState=drop?.finish?.distanceToHole?drop.finish:action.finish;
    const startLie=action.start?.benchmarkLie;
    const finishLie=penalty?finishState?.benchmarkLie:undefined;
    const startDistance=distanceForLie(action.start?.distanceToHole,startLie,'starting');
    const resolvedFinishLie=location==='holed'?'holed':finishLie||finishState?.benchmarkLie;
    const endDistance=location==='holed'
      ? 0
      : distanceForLie(finishState?.distanceToHole,resolvedFinishLie,'finishing');
    const calculation=calculateShot({
      startLie,
      startDistance,
      finishLocation:location,
      endDistance,
      finishLie,
      penalty
    });
    const type=inferShotType({
      lie:startLie,
      distance:startDistance,
      par:hole.par,
      shotNumber:index+1
    });
    const zone=action.finish?.lateral||'target';

    return {
      id:`pga-${roundNumber}-${hole.number}-${index+1}`,
      hole:Number(hole.number),
      par:Number(hole.par),
      shotNumber:index+1,
      type,
      typeOverride:null,
      club:'',
      start:{
        lie:startLie,
        distance:startDistance,
        unit:startLie==='green'?'feet':'yards'
      },
      target:{type:targetForType(type)},
      miss:missParts(zone),
      finish:{
        location,
        benchmarkLie:calculation.benchmarkLie,
        distance:calculation.endDistance,
        unit:calculation.benchmarkLie==='green'?'feet':'yards',
        reliefLie:penalty?calculation.benchmarkLie:null
      },
      penalty,
      details:{
        intendedShape:'',
        contact:'',
        notes:action.playByPlay||''
      },
      source:{
        kind:'pga-test-fixture',
        actionType:action.actionType,
        playByPlay:action.playByPlay||'',
        followingActions:following.map((item)=>({
          actionType:item.actionType,
          playByPlay:item.playByPlay||''
        }))
      },
      calculation:{...calculation,benchmarkVersion:BENCHMARK_VERSION}
    };
  });
}

function validateFixture(fixture) {
  if(!fixture||typeof fixture!=='object') throw new Error('Choose a valid PGA fixture JSON file.');
  if(fixture.schemaVersion!==1) throw new Error('This PGA fixture version is not supported.');
  if(!fixture.player?.id||!fixture.tournament?.id) throw new Error('The PGA fixture is missing player or tournament details.');
  if(!Array.isArray(fixture.rounds)||fixture.rounds.length===0) throw new Error('The PGA fixture does not contain any rounds.');
}

export function convertPgaFixtureToRounds(fixture,{ now=()=>new Date().toISOString() }={}) {
  validateFixture(fixture);
  const createdAt=now();
  const startDate=fixture.tournament.startDate||String(fixture.source?.fetchedAt||createdAt).slice(0,10);

  return fixture.rounds.map((sourceRound)=>{
    const playedDate=sourceRound.date||roundDate(startDate,sourceRound.roundNumber);
    const sourceHoles=Array.isArray(sourceRound.holes)?sourceRound.holes:[];
    if(!sourceHoles.length) throw new Error(`PGA round ${sourceRound.roundNumber} has no holes.`);
    const holeCount=Math.max(...sourceHoles.map((hole)=>Number(hole.number)||0));
    const holes=Array.from({length:holeCount},(_,index)=>{
      const sourceHole=sourceHoles.find((hole)=>Number(hole.number)===index+1);
      if(!sourceHole) throw new Error(`PGA round ${sourceRound.roundNumber} is missing hole ${index+1}.`);
      return {
        number:index+1,
        par:Number(sourceHole.par),
        teeDistance:Number(sourceHole.yardage),
        draft:importedDraft()
      };
    });
    const shots=sourceHoles.flatMap((hole)=>
      convertHoleActions(hole,sourceRound.roundNumber)
    );
    const sourceScore=sourceHoles.reduce((sum,hole)=>sum+Number(hole.score||0),0);
    const importedScore=shots.reduce(
      (sum,shot)=>sum+1+Number(shot.penalty?.strokes||0),
      0
    );
    if(sourceScore!==importedScore){
      throw new Error(`PGA round ${sourceRound.roundNumber} score mismatch: source ${sourceScore}, imported ${importedScore}.`);
    }

    return {
      schemaVersion:9,
      id:`pga-${fixture.tournament.id}-${fixture.player.id}-r${sourceRound.roundNumber}`,
      createdAt,
      updatedAt:createdAt,
      status:'complete',
      courseName:fixture.tournament.course||fixture.tournament.name||'PGA test round',
      courseData:null,
      testData:{
        kind:'pga-shot-fixture',
        playerId:fixture.player.id,
        playerName:fixture.player.name||'PGA player',
        tournamentId:fixture.tournament.id,
        tournamentName:fixture.tournament.name||'PGA tournament',
        tournamentStartDate:startDate,
        roundNumber:Number(sourceRound.roundNumber),
        playedDate,
        sourceScore
      },
      date:playedDate,
      holeCount,
      currentHole:1,
      holes,
      shots,
      recentClubs:clone(DEFAULT_CLUBS)
    };
  });
}

export function importPgaFixture(fixture,roundStore,options={}) {
  if(!roundStore?.save||!roundStore?.get) throw new Error('Round storage is unavailable.');
  const rounds=convertPgaFixtureToRounds(fixture,options);
  let added=0;
  let updated=0;
  for(const round of rounds){
    if(roundStore.get(round.id)) updated+=1;
    else added+=1;
    roundStore.save(round);
  }
  return {
    rounds,
    added,
    updated,
    playerName:fixture.player.name||'PGA player',
    tournamentName:fixture.tournament.name||'PGA tournament'
  };
}
