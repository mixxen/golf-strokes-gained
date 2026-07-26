import {
  BENCHMARKS,
  BENCHMARK_VERSION,
  BROADIE_BENCHMARK
} from './benchmark-broadie.js';

export { BENCHMARKS, BENCHMARK_VERSION, BROADIE_BENCHMARK };

export const LOCATION_TO_LIE = Object.freeze({
  fairway:"fairway",
  "first-cut":"rough",
  rough:"rough",

  // Broadie's recovery condition means the route to the hole is obstructed.
  // Deep rough with a direct shot remains rough.
  "deep-rough":"rough",

  "fairway-bunker":"sand",
  "greenside-bunker":"sand",

  // Broadie's public table has no separate fringe condition. Fairway is the
  // documented proxy until a dedicated fringe benchmark is added.
  fringe:"fairway",

  recovery:"recovery",
  "penalty-area":"rough",
  unplayable:"rough",
  "out-of-bounds":"tee",
  green:"green",
  holed:"holed"
});

export function expectedStrokesLookup(lie, distance, benchmarks = BENCHMARKS) {
  if (lie === "holed") {
    return {
      value:0,
      lie:"holed",
      distance:0,
      method:"holed",
      clamped:false,
      publishedMin:0,
      publishedMax:0
    };
  }

  const table = benchmarks[lie];
  if (!table) throw new Error(`No benchmark data for ${lie}`);

  const value = Number(distance);
  if (!Number.isFinite(value) || value < 0) throw new Error("Distance must be non-negative");

  const first = table[0];
  const last = table.at(-1);

  if (value < first[0]) {
    return {
      value:first[1],
      lie,
      distance:value,
      method:"clamped-low",
      clamped:true,
      lowerDistance:first[0],
      upperDistance:first[0],
      publishedMin:first[0],
      publishedMax:last[0]
    };
  }

  if (value === first[0]) {
    return {
      value:first[1],
      lie,
      distance:value,
      method:"exact",
      clamped:false,
      lowerDistance:first[0],
      upperDistance:first[0],
      publishedMin:first[0],
      publishedMax:last[0]
    };
  }

  if (value > last[0]) {
    return {
      value:last[1],
      lie,
      distance:value,
      method:"clamped-high",
      clamped:true,
      lowerDistance:last[0],
      upperDistance:last[0],
      publishedMin:first[0],
      publishedMax:last[0]
    };
  }

  for (let index = 1; index < table.length; index += 1) {
    const [upperDistance, upperExpected] = table[index];
    const [lowerDistance, lowerExpected] = table[index - 1];

    if (value === upperDistance) {
      return {
        value:upperExpected,
        lie,
        distance:value,
        method:"exact",
        clamped:false,
        lowerDistance:upperDistance,
        upperDistance,
        publishedMin:first[0],
        publishedMax:last[0]
      };
    }

    if (value < upperDistance) {
      const ratio = (value - lowerDistance) / (upperDistance - lowerDistance);
      return {
        value:lowerExpected + ratio * (upperExpected - lowerExpected),
        lie,
        distance:value,
        method:"interpolated",
        clamped:false,
        lowerDistance,
        upperDistance,
        publishedMin:first[0],
        publishedMax:last[0]
      };
    }
  }

  return {
    value:last[1],
    lie,
    distance:value,
    method:"exact",
    clamped:false,
    lowerDistance:last[0],
    upperDistance:last[0],
    publishedMin:first[0],
    publishedMax:last[0]
  };
}

export function expectedStrokes(lie, distance, benchmarks = BENCHMARKS) {
  return expectedStrokesLookup(lie, distance, benchmarks).value;
}

export function missParts(zone = "target") {
  const [first, second] = zone.split("-");
  if (second) return { zone, depth:first, lateral:second };
  if (["long","short"].includes(first)) return { zone, depth:first, lateral:"target" };
  if (["left","right"].includes(first)) return { zone, depth:"target", lateral:first };
  return { zone:"target", depth:"target", lateral:"target" };
}

export function penaltyForLocation(location) {
  if (location === "penalty-area") return { type:"penalty-area", strokes:1, strokeAndDistance:false };
  if (location === "out-of-bounds") return { type:"out-of-bounds", strokes:1, strokeAndDistance:true };
  if (location === "unplayable") return { type:"unplayable", strokes:1, strokeAndDistance:false };
  return null;
}

export function resolveFinishPosition({
  startLie,
  startDistance,
  finishLocation,
  endDistance,
  finishLie,
  penalty
}) {
  if (finishLocation === "holed") return { benchmarkLie:"holed", endDistance:0 };

  // Stroke-and-distance means the next stroke is played from the same position.
  // Keeping that position exact makes the shot value exactly -2 for one penalty.
  if (penalty?.strokeAndDistance) {
    return { benchmarkLie:startLie, endDistance:Number(startDistance) };
  }

  const benchmarkLie = finishLie || LOCATION_TO_LIE[finishLocation];
  if (!benchmarkLie || benchmarkLie === "holed") throw new Error("Choose a valid finishing lie");

  const resolvedDistance = Number(endDistance);
  if (!Number.isFinite(resolvedDistance) || resolvedDistance < 0) {
    throw new Error("Remaining distance must be non-negative");
  }
  return { benchmarkLie, endDistance:resolvedDistance };
}

export function calculateShot({
  startLie,
  startDistance,
  finishLocation,
  endDistance,
  finishLie,
  penalty
}) {
  const beforeLookup = expectedStrokesLookup(startLie, startDistance);
  const finish = resolveFinishPosition({
    startLie,
    startDistance,
    finishLocation,
    endDistance,
    finishLie,
    penalty
  });
  const afterLookup = expectedStrokesLookup(finish.benchmarkLie, finish.endDistance);
  const penaltyStrokes = Number(penalty?.strokes || 0);
  const strokeCost = 1 + penaltyStrokes;

  return {
    benchmarkLie:finish.benchmarkLie,
    endDistance:finish.endDistance,
    expectedBefore:beforeLookup.value,
    expectedAfter:afterLookup.value,
    penaltyStrokes,
    strokeCost,
    strokesGained:beforeLookup.value - strokeCost - afterLookup.value,
    benchmarkVersion:BENCHMARK_VERSION,
    benchmarkLookup:{
      before:beforeLookup,
      after:afterLookup
    }
  };
}

export function inferShotType({ lie, distance, par }) {
  if (lie === "green") return "putt";
  if (lie === "tee") return Number(par) >= 4 ? "drive" : "approach";
  if (Number(distance) <= 30) return "chip";
  return "approach";
}

export function nextShotStart(shot) {
  if (!shot || shot.finish.location === "holed") return null;
  return {
    lie:shot.finish.benchmarkLie,
    distance:shot.finish.distance,
    unit:shot.finish.benchmarkLie === "green" ? "feet" : "yards"
  };
}

export function shotCost(shot) {
  return 1 + Number(shot?.calculation?.penaltyStrokes ?? shot?.penalty?.strokes ?? 0);
}

export function summarizeHole(shots, { par, teeDistance } = {}) {
  const ordered = [...shots].sort((a,b)=>a.shotNumber-b.shotNumber);
  const physicalStrokes = ordered.length;
  const penaltyStrokes = ordered.reduce(
    (sum, shot)=>sum + Number(shot?.calculation?.penaltyStrokes ?? shot?.penalty?.strokes ?? 0),
    0
  );
  const score = physicalStrokes + penaltyStrokes;
  const strokesGained = ordered.reduce(
    (sum, shot)=>sum + Number(shot?.calculation?.strokesGained || 0),
    0
  );
  const complete = ordered.at(-1)?.finish?.location === "holed";
  const expectedFromTee = Number.isFinite(Number(teeDistance))
    ? expectedStrokes("tee", Number(teeDistance))
    : null;
  const identityStrokesGained = complete && expectedFromTee !== null
    ? expectedFromTee - score
    : null;

  return {
    physicalStrokes,
    penaltyStrokes,
    score,
    par:Number(par),
    toPar:Number.isFinite(Number(par)) ? score - Number(par) : null,
    strokesGained,
    complete,
    expectedFromTee,
    identityStrokesGained,
    identityError:identityStrokesGained === null
      ? null
      : strokesGained - identityStrokesGained
  };
}

export function scoreLabel(score, par) {
  const relative = Number(score) - Number(par);
  if (Number(score) === 1) return "Hole in one";
  if (relative <= -3) return "Albatross or better";
  if (relative === -2) return "Eagle";
  if (relative === -1) return "Birdie";
  if (relative === 0) return "Par";
  if (relative === 1) return "Bogey";
  if (relative === 2) return "Double bogey";
  if (relative === 3) return "Triple bogey";
  return `${relative} over par`;
}

export function drivingSummary(shots) {
  const drives = shots.filter((shot)=>shot.type === "drive");
  const fairways = drives.filter((shot)=>shot.finish.location === "fairway").length;
  const playable = drives.filter((shot)=>["fairway","first-cut","rough"].includes(shot.finish.location)).length;
  const penalties = drives.reduce((sum, shot)=>sum + Number(shot.penalty?.strokes || 0), 0);
  const sg = drives.reduce((sum, shot)=>sum + Number(shot.calculation.strokesGained || 0), 0);
  return {
    count:drives.length,
    fairwayRate:drives.length ? fairways / drives.length : null,
    playableRate:drives.length ? playable / drives.length : null,
    penalties,
    sg
  };
}
