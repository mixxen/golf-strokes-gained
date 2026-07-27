const FEET_PER_YARD=3;

function distanceNumber(value){
  if(value===null||value===undefined||value==='') return null;
  const distance=Number(value);
  return Number.isFinite(distance)?distance:null;
}

export function convertDistance(value,fromUnit,toUnit){
  const distance=distanceNumber(value);
  if(distance===null) return null;
  if(fromUnit===toUnit) return distance;
  if(fromUnit==='feet'&&toUnit==='yards') return distance/FEET_PER_YARD;
  if(fromUnit==='yards'&&toUnit==='feet') return distance*FEET_PER_YARD;
  return distance;
}

export function shotDistanceFromRemaining({
  startDistance,
  startUnit,
  remainingDistance,
  remainingUnit
}){
  const start=distanceNumber(startDistance);
  const remaining=convertDistance(remainingDistance,remainingUnit,startUnit);
  if(start===null||remaining===null) return null;
  return Math.max(0,start-remaining);
}

export function remainingDistanceFromShot({
  startDistance,
  startUnit,
  shotDistance,
  remainingUnit
}){
  const start=distanceNumber(startDistance);
  const shot=distanceNumber(shotDistance);
  if(start===null||shot===null) return null;
  return Math.max(0,convertDistance(start-shot,startUnit,remainingUnit));
}
