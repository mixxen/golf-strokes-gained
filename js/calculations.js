export const BENCHMARKS = {
  tee:[[100,2.92],[150,3.05],[200,3.22],[250,3.45],[300,3.72],[350,3.98],[400,4.20],[450,4.42],[500,4.65],[550,4.88],[600,5.10]],
  fairway:[[20,2.40],[30,2.48],[50,2.62],[75,2.75],[100,2.88],[125,3.00],[150,3.13],[175,3.26],[200,3.42],[225,3.58],[250,3.75],[300,4.05]],
  rough:[[20,2.55],[30,2.64],[50,2.78],[75,2.93],[100,3.08],[125,3.22],[150,3.37],[175,3.52],[200,3.68],[225,3.84],[250,4.00],[300,4.30]],
  sand:[[10,2.62],[20,2.73],[30,2.83],[50,3.00],[75,3.18],[100,3.36],[125,3.53],[150,3.70],[175,3.87],[200,4.05]],
  recovery:[[20,2.85],[50,3.10],[75,3.32],[100,3.52],[125,3.70],[150,3.90],[175,4.08],[200,4.25]],
  green:[[1,1.00],[2,1.05],[3,1.15],[4,1.28],[5,1.40],[6,1.50],[8,1.65],[10,1.78],[15,2.00],[20,2.15],[30,2.35],[40,2.50],[60,2.70],[90,2.95]]
};

export const LOCATION_TO_LIE = {
  fairway:"fairway", "first-cut":"rough", rough:"rough", "deep-rough":"recovery",
  "fairway-bunker":"sand", "greenside-bunker":"sand", fringe:"fairway", recovery:"recovery",
  "penalty-area":"rough", "out-of-bounds":"tee", green:"green", holed:"holed"
};

export function expectedStrokes(lie, distance, benchmarks = BENCHMARKS) {
  if (lie === "holed") return 0;
  const table = benchmarks[lie];
  if (!table) throw new Error(`No benchmark data for ${lie}`);
  const value = Number(distance);
  if (!Number.isFinite(value) || value < 0) throw new Error("Distance must be non-negative");
  if (value <= table[0][0]) return table[0][1];
  if (value >= table.at(-1)[0]) return table.at(-1)[1];
  for (let i=1;i<table.length;i+=1) {
    const [upperDistance, upperExpected] = table[i];
    const [lowerDistance, lowerExpected] = table[i-1];
    if (value <= upperDistance) {
      const ratio=(value-lowerDistance)/(upperDistance-lowerDistance);
      return lowerExpected + ratio*(upperExpected-lowerExpected);
    }
  }
  return table.at(-1)[1];
}

export function missParts(zone) {
  const [first, second] = zone.split("-");
  if (second) return { zone, depth:first, lateral:second };
  if (["long","short"].includes(first)) return { zone, depth:first, lateral:"target" };
  if (["left","right"].includes(first)) return { zone, depth:"target", lateral:first };
  return { zone:"target", depth:"target", lateral:"target" };
}

export function penaltyForLocation(location) {
  if (location === "penalty-area") return { type:"penalty-area", strokes:1, strokeAndDistance:false };
  if (location === "out-of-bounds") return { type:"out-of-bounds", strokes:1, strokeAndDistance:true };
  return null;
}

export function calculateShot({ startLie, startDistance, finishLocation, endDistance, penalty }) {
  const benchmarkLie = LOCATION_TO_LIE[finishLocation];
  if (!benchmarkLie) throw new Error("Choose a finishing location");
  const expectedBefore = expectedStrokes(startLie, startDistance);
  const expectedAfter = expectedStrokes(benchmarkLie, finishLocation === "holed" ? 0 : endDistance);
  const penaltyStrokes = Number(penalty?.strokes || 0);
  return { benchmarkLie, expectedBefore, expectedAfter, penaltyStrokes, strokesGained:expectedBefore-1-penaltyStrokes-expectedAfter };
}

export function inferShotType({ lie, distance, par, shotNumber }) {
  if (lie === "green") return "putt";
  if (lie === "tee" && Number(par) >= 4 && Number(shotNumber) === 1) return "drive";
  if (Number(distance) <= 30) return "chip";
  return "approach";
}

export function nextShotStart(shot) {
  if (!shot || shot.finish.location === "holed") return null;
  return {
    lie: shot.finish.benchmarkLie,
    distance: shot.finish.distance,
    unit: shot.finish.benchmarkLie === "green" ? "feet" : "yards"
  };
}

export function drivingSummary(shots) {
  const drives=shots.filter((shot)=>shot.type==="drive");
  const fairways=drives.filter((shot)=>shot.finish.location==="fairway").length;
  const playable=drives.filter((shot)=>["fairway","first-cut","rough"].includes(shot.finish.location)).length;
  const penalties=drives.reduce((sum,shot)=>sum+(shot.penalty?.strokes||0),0);
  const sg=drives.reduce((sum,shot)=>sum+shot.calculation.strokesGained,0);
  return { count:drives.length, fairwayRate:drives.length?fairways/drives.length:null, playableRate:drives.length?playable/drives.length:null, penalties, sg };
}
