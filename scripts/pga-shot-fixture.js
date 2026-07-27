const LOCATION_RULES = Object.freeze([
  { pattern:/tee box/i, benchmarkLie:'tee' },
  { pattern:/bunker|sand/i, benchmarkLie:'sand' },
  { pattern:/green/i, benchmarkLie:'green' },
  { pattern:/rough|intermediate/i, benchmarkLie:'rough' },
  { pattern:/tree|recovery|native area/i, benchmarkLie:'recovery' },
  { pattern:/fairway/i, benchmarkLie:'fairway' },
  { pattern:/water|penalty/i, benchmarkLie:'penalty-area' }
]);

function finiteNumber(value) {
  if(value===null||value===undefined||value==='') return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

export function parsePgaDistance(rawValue) {
  const raw=String(rawValue||'').trim();
  if(!raw) return null;

  const yards=raw.match(/^(-?\d+(?:\.\d+)?)\s*yds?\.?$/i);
  if(yards){
    return {
      raw,
      value:Number(yards[1]),
      unit:'yards'
    };
  }

  const feetAndInches=raw.match(/^(-?\d+)\s*ft(?:\s+(\d+)\s*in\.?)?$/i);
  if(feetAndInches){
    const feet=Number(feetAndInches[1]);
    const inches=Number(feetAndInches[2]||0);
    return {
      raw,
      value:feet+(Math.sign(feet||1)*inches/12),
      unit:'feet'
    };
  }

  const inches=raw.match(/^(-?\d+(?:\.\d+)?)\s*in\.?$/i);
  if(inches){
    return {
      raw,
      value:Number(inches[1])/12,
      unit:'feet'
    };
  }

  return { raw, value:null, unit:null };
}

export function benchmarkLieForLocation(locationCode,locationName) {
  const name=String(locationName||'').trim();
  const rule=LOCATION_RULES.find((candidate)=>candidate.pattern.test(name));
  if(rule) return rule.benchmarkLie;

  const code=String(locationCode||'').toUpperCase();
  if(code==='OTB') return 'tee';
  if(code==='OFW') return 'fairway';
  if(code==='OGR') return 'green';
  if(['ORO','OIR'].includes(code)) return 'rough';
  if(['OST','OGS'].includes(code)) return 'sand';
  if(code==='OTO') return 'recovery';
  return null;
}

export function lateralForLocation(locationName) {
  const name=String(locationName||'');
  if(/\bleft\b/i.test(name)) return 'left';
  if(/\bright\b/i.test(name)) return 'right';
  return 'target';
}

function coordinatePoint(point) {
  if(!point||typeof point!=='object') return null;
  const normalized={
    x:finiteNumber(point.x),
    y:finiteNumber(point.y),
    tourcastX:finiteNumber(point.tourcastX),
    tourcastY:finiteNumber(point.tourcastY),
    tourcastZ:finiteNumber(point.tourcastZ)
  };
  return Object.values(normalized).some((value)=>value!==null)?normalized:null;
}

function normalizeCoordinates(overview) {
  if(!overview||typeof overview!=='object') return null;
  const normalized={};
  for(const key of ['leftToRightCoords','bottomToTopCoords']){
    const wrapper=overview[key];
    if(!wrapper||typeof wrapper!=='object') continue;
    normalized[key]={
      from:coordinatePoint(wrapper.fromCoords),
      to:coordinatePoint(wrapper.toCoords)
    };
  }
  return Object.keys(normalized).length?normalized:null;
}

export function normalizePgaStroke(stroke,{ roundNumber,holeNumber,startDistance=null }={}) {
  const strokeType=String(stroke?.strokeType||'UNKNOWN').toUpperCase();
  const finalStroke=Boolean(stroke?.finalStroke);
  const fromLocation=String(stroke?.fromLocation||'');
  const toLocation=String(stroke?.toLocation||'');
  const fromLocationCode=String(stroke?.fromLocationCode||'');
  const toLocationCode=String(stroke?.toLocationCode||'');

  return {
    roundNumber:Number(roundNumber),
    holeNumber:Number(holeNumber),
    strokeNumber:finiteNumber(stroke?.strokeNumber),
    actionType:strokeType.toLowerCase(),
    countsAsPhysicalStroke:strokeType==='STROKE',
    countsAsPenaltyStroke:strokeType==='PENALTY',
    finalStroke,
    playByPlay:String(stroke?.playByPlay||''),
    shotDistance:parsePgaDistance(stroke?.distance),
    remainingDistance:finalStroke
      ? { raw:'', value:0, unit:benchmarkLieForLocation(fromLocationCode,fromLocation)==='green'?'feet':'yards' }
      : parsePgaDistance(stroke?.distanceRemaining),
    start:{
      sourceLocation:fromLocation,
      sourceCode:fromLocationCode,
      benchmarkLie:benchmarkLieForLocation(fromLocationCode,fromLocation),
      distanceToHole:startDistance
    },
    finish:{
      sourceLocation:finalStroke?'Holed':toLocation,
      sourceCode:toLocationCode,
      benchmarkLie:finalStroke?'holed':benchmarkLieForLocation(toLocationCode,toLocation),
      lateral:finalStroke?'target':lateralForLocation(toLocation),
      distanceToHole:finalStroke
        ? { raw:'', value:0, unit:benchmarkLieForLocation(fromLocationCode,fromLocation)==='green'?'feet':'yards' }
        : parsePgaDistance(stroke?.distanceRemaining)
    },
    coordinates:normalizeCoordinates(stroke?.overview)
  };
}

export function normalizePgaRound(roundPayload,roundNumber) {
  const holes=Array.isArray(roundPayload?.holes)?roundPayload.holes:[];
  return {
    roundNumber:Number(roundNumber),
    holes:holes.map((hole)=>{
      let currentDistance={
        raw:`${hole?.yardage} yds`,
        value:finiteNumber(hole?.yardage),
        unit:'yards'
      };
      const actions=(Array.isArray(hole?.strokes)?hole.strokes:[])
        .map((stroke)=>{
          const action=normalizePgaStroke(stroke,{
            roundNumber,
            holeNumber:hole?.holeNumber,
            startDistance:currentDistance
          });
          if(action.finish.distanceToHole&&action.finish.distanceToHole.value!==null){
            currentDistance=action.finish.distanceToHole;
          }
          return action;
        });
      return {
        number:Number(hole?.holeNumber),
        par:finiteNumber(hole?.par),
        yardage:finiteNumber(hole?.yardage),
        score:finiteNumber(hole?.score),
        status:String(hole?.status||''),
        actions
      };
    })
  };
}

export function summarizePgaFixture(fixture) {
  const rounds=Array.isArray(fixture?.rounds)?fixture.rounds:[];
  const holes=rounds.flatMap((round)=>round.holes||[]);
  const actions=holes.flatMap((hole)=>hole.actions||[]);
  const actionTypes=actions.reduce((counts,action)=>{
    counts[action.actionType]=(counts[action.actionType]||0)+1;
    return counts;
  },{});

  const summary={
    rounds:rounds.length,
    holes:holes.length,
    actions:actions.length,
    physicalStrokes:actions.filter((action)=>action.countsAsPhysicalStroke).length,
    penaltyStrokes:actions.filter((action)=>action.countsAsPenaltyStroke).length,
    drops:actionTypes.drop||0,
    score:holes.reduce((total,hole)=>total+Number(hole.score||0),0),
    actionTypes
  };
  summary.scoreFromActions=summary.physicalStrokes+summary.penaltyStrokes;
  summary.scoreMatchesActions=summary.score===summary.scoreFromActions;
  return summary;
}

export function buildPgaFixture({
  tournamentId,
  playerId,
  playerName,
  eventName,
  courseName,
  startDate,
  fetchedAt,
  roundPayloads
}) {
  const rounds=roundPayloads.map((payload,index)=>
    normalizePgaRound(payload,payload?.round||index+1)
  );
  const fixture={
    schemaVersion:1,
    visibility:'private-development-fixture',
    source:{
      provider:'PGA TOUR public leaderboard shot-detail feed',
      tournamentId,
      playerId,
      fetchedAt
    },
    player:{ id:playerId, name:playerName||'' },
    tournament:{
      id:tournamentId,
      name:eventName||'',
      course:courseName||'',
      startDate:startDate||''
    },
    rounds
  };
  fixture.summary=summarizePgaFixture(fixture);
  return fixture;
}
