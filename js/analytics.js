import { drivingSummary, shotCost, summarizeHole } from './calculations.js';

export const SHOT_CATEGORIES=Object.freeze([
  {key:'drive',label:'Off the tee'},
  {key:'approach',label:'Approach'},
  {key:'chip',label:'Around the green'},
  {key:'putt',label:'Putting'}
]);

export const DISTANCE_BUCKETS=Object.freeze([
  {key:'0-30',label:'≤30 yd',min:0,max:30},
  {key:'31-75',label:'31–75 yd',min:30,max:75},
  {key:'76-125',label:'76–125 yd',min:75,max:125},
  {key:'126-175',label:'126–175 yd',min:125,max:175},
  {key:'176-225',label:'176–225 yd',min:175,max:225},
  {key:'226-plus',label:'226+ yd',min:225,max:Infinity}
]);

export const MISS_ZONES=Object.freeze([
  'long-left','long','long-right',
  'left','target','right',
  'short-left','short','short-right'
]);

const number=(value)=>Number.isFinite(Number(value))?Number(value):0;
const sumSg=(shots)=>shots.reduce(
  (total,shot)=>total+number(shot?.calculation?.strokesGained),
  0
);

export function categoryBreakdown(shots=[]) {
  return SHOT_CATEGORIES.map(({key,label})=>{
    const matching=shots.filter((shot)=>shot.type===key);
    const sg=sumSg(matching);
    return {
      key,
      label,
      count:matching.length,
      sg,
      average:matching.length?sg/matching.length:null
    };
  });
}

export function distanceBreakdown(shots=[]) {
  const eligible=shots.filter((shot)=>
    shot?.start?.lie!=='green'
    && shot?.type!=='putt'
    && Number.isFinite(Number(shot?.start?.distance))
  );

  return DISTANCE_BUCKETS.map((bucket)=>{
    const matching=eligible.filter((shot)=>{
      const distance=Number(shot.start.distance);
      return distance>bucket.min&&distance<=bucket.max;
    });
    const sg=sumSg(matching);
    return {
      ...bucket,
      count:matching.length,
      sg,
      average:matching.length?sg/matching.length:null
    };
  });
}

export function missZoneBreakdown(shots=[],type='drive') {
  const eligible=shots.filter((shot)=>
    (type==='all'||shot.type===type)
    && shot?.miss?.zone
  );
  return MISS_ZONES.map((zone)=>{
    const matching=eligible.filter((shot)=>shot.miss.zone===zone);
    const sg=sumSg(matching);
    return {
      zone,
      count:matching.length,
      sg,
      average:matching.length?sg/matching.length:null
    };
  });
}

export function rankedShots(shots=[],filter='all') {
  const filtered=shots.filter((shot)=>{
    if(!Number.isFinite(Number(shot?.calculation?.strokesGained))) return false;
    if(filter==='all') return true;
    if(filter==='bunker'){
      return shot?.start?.lie==='sand'
        || shot?.finish?.benchmarkLie==='sand'
        || String(shot?.finish?.location||'').includes('bunker');
    }
    if(filter==='penalty'){
      return number(shot?.calculation?.penaltyStrokes??shot?.penalty?.strokes)>0;
    }
    return shot?.type===filter;
  });
  return filtered.sort((left,right)=>
    number(right.calculation.strokesGained)-number(left.calculation.strokesGained)
    || number(left.hole)-number(right.hole)
    || number(left.shotNumber)-number(right.shotNumber)
  );
}

function holeReachedGreenInRegulation(shots,hole) {
  let strokesUsed=0;
  const target=Number(hole?.par)-2;
  for(const shot of shots){
    strokesUsed+=shotCost(shot);
    if(
      shot?.finish?.benchmarkLie==='green'
      || shot?.finish?.location==='holed'
    ) return strokesUsed<=target;
  }
  return false;
}

function shotHighlight(shot) {
  if(!shot) return null;
  return {
    id:shot.id,
    hole:Number(shot.hole),
    shotNumber:Number(shot.shotNumber),
    type:shot.type,
    startLie:shot.start?.lie||'',
    startDistance:number(shot.start?.distance),
    startUnit:shot.start?.unit||'yards',
    finishLocation:shot.finish?.location||'',
    sg:number(shot.calculation?.strokesGained)
  };
}

export function roundAnalytics(shots=[],holes=[]) {
  const playedHoles=holes
    .map((hole)=>{
      const holeShots=shots
        .filter((shot)=>Number(shot.hole)===Number(hole.number))
        .sort((a,b)=>a.shotNumber-b.shotNumber);
      if(!holeShots.length) return null;
      const summary=summarizeHole(holeShots,hole);
      return {
        hole,
        shots:holeShots,
        summary,
        gir:holeReachedGreenInRegulation(holeShots,hole)
      };
    })
    .filter(Boolean);
  const completed=playedHoles.filter((item)=>item.summary.complete);
  const score=completed.reduce((total,item)=>total+item.summary.score,0);
  const par=completed.reduce((total,item)=>total+Number(item.hole.par||0),0);
  const girCount=completed.filter((item)=>item.gir).length;
  const missedGreens=completed.filter((item)=>!item.gir);
  const scrambles=missedGreens.filter((item)=>item.summary.score<=Number(item.hole.par)).length;
  const putts=shots.filter((shot)=>shot.type==='putt').length;
  const completedPutts=completed.reduce(
    (total,item)=>total+item.shots.filter((shot)=>shot.type==='putt').length,
    0
  );
  const penalties=shots.reduce((total,shot)=>
    total+number(shot?.calculation?.penaltyStrokes??shot?.penalty?.strokes),
  0);
  const ranked=shots
    .filter((shot)=>Number.isFinite(Number(shot?.calculation?.strokesGained)))
    .sort((a,b)=>number(b.calculation.strokesGained)-number(a.calculation.strokesGained));
  const driving=drivingSummary(shots);

  return {
    totalSg:sumSg(shots),
    holesStarted:playedHoles.length,
    holesCompleted:completed.length,
    score,
    par,
    toPar:completed.length?score-par:null,
    categories:categoryBreakdown(shots),
    distances:distanceBreakdown(shots),
    fairwayRate:driving.fairwayRate,
    fairwayCount:driving.fairwayRate===null?0:driving.fairwayRate*driving.count,
    driveCount:driving.count,
    girRate:completed.length?girCount/completed.length:null,
    girCount,
    scramblingRate:missedGreens.length?scrambles/missedGreens.length:null,
    scramblingCount:scrambles,
    scramblingAttempts:missedGreens.length,
    putts,
    completedPutts,
    puttsPerHole:completed.length?completedPutts/completed.length:null,
    penalties,
    bestShot:shotHighlight(ranked[0]),
    worstShot:shotHighlight(ranked.at(-1))
  };
}

export function aggregateRoundsAnalytics(rounds=[],limit=3) {
  const selected=rounds.slice(0,Math.max(1,Number(limit)||3));
  const summaries=selected.map((item)=>roundAnalytics(
    Array.isArray(item.shots)?item.shots:[],
    Array.isArray(item.holes)?item.holes.slice(0,Number(item.holeCount)||item.holes.length):[]
  ));
  const roundCount=summaries.length;
  const totalSg=summaries.reduce((total,item)=>total+item.totalSg,0);
  const holesCompleted=summaries.reduce((total,item)=>total+item.holesCompleted,0);
  const driveCount=summaries.reduce((total,item)=>total+item.driveCount,0);
  const fairwayCount=summaries.reduce((total,item)=>total+item.fairwayCount,0);
  const girCount=summaries.reduce((total,item)=>total+item.girCount,0);
  const scramblingCount=summaries.reduce((total,item)=>total+item.scramblingCount,0);
  const scramblingAttempts=summaries.reduce((total,item)=>total+item.scramblingAttempts,0);
  const completedPutts=summaries.reduce((total,item)=>total+item.completedPutts,0);
  const penalties=summaries.reduce((total,item)=>total+item.penalties,0);

  const categories=SHOT_CATEGORIES.map(({key,label})=>{
    const values=summaries.map((item)=>
      item.categories.find((category)=>category.key===key)
    );
    const categoryTotal=values.reduce((total,item)=>total+number(item?.sg),0);
    const count=values.reduce((total,item)=>total+number(item?.count),0);
    return {
      key,
      label,
      count,
      totalSg:categoryTotal,
      sg:roundCount?categoryTotal/roundCount:0,
      average:count?categoryTotal/count:null
    };
  });

  return {
    requestedLimit:Number(limit)||3,
    roundCount,
    totalSg,
    averageSg:roundCount?totalSg/roundCount:null,
    holesCompleted,
    categories,
    fairwayRate:driveCount?fairwayCount/driveCount:null,
    girRate:holesCompleted?girCount/holesCompleted:null,
    scramblingRate:scramblingAttempts?scramblingCount/scramblingAttempts:null,
    puttsPerHole:holesCompleted?completedPutts/holesCompleted:null,
    penalties
  };
}
