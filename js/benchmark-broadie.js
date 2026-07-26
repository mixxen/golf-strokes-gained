/**
 * Historical PGA TOUR strokes-to-hole benchmark published by Mark Broadie.
 *
 * Off-green values are transcribed from Table B.1 of:
 *   Broadie, M. (2012), "Assessing Golfer Performance on the PGA TOUR,"
 *   Interfaces 42(2), 146-165. The table uses ShotLink data from 2003-2010.
 *
 * Putting values are transcribed from Figure 1 / its accompanying table in:
 *   Broadie, M. (2011), "Putts Gained: Measuring Putting on the PGA TOUR."
 *
 * Distances are yards off the green and feet on the green. The application
 * linearly interpolates between published points. Values outside a published
 * range are clamped and marked in the lookup metadata.
 */

export const BROADIE_BENCHMARK = Object.freeze({
  id:"broadie-pga-tour-2003-2010-v1",
  label:"PGA TOUR — Broadie 2003–2010",
  population:"PGA TOUR golfers",
  period:"2003–2010",
  adjustment:"Unadjusted for course and round difficulty",
  interpolation:"Linear between published points; endpoint clamp outside the published range",
  sources:Object.freeze([
    Object.freeze({
      title:"Assessing Golfer Performance on the PGA TOUR",
      citation:"Broadie (2012), Interfaces 42(2), 146–165, Table B.1",
      url:"https://business.columbia.edu/sites/default/files-efs/pubfiles/4996/assessing_golfer_performance.full.pdf"
    }),
    Object.freeze({
      title:"Putts Gained: Measuring Putting on the PGA TOUR",
      citation:"Broadie (2011), Figure 1 and accompanying table",
      url:"https://www.columbia.edu/~mnb2/broadie/Assets/putting_strokes_gained_20110113.pdf"
    })
  ]),
  tables:Object.freeze({
    tee:Object.freeze([
      [100,2.92],[120,2.99],[140,2.97],[160,2.99],[180,3.05],
      [200,3.12],[220,3.17],[240,3.25],[260,3.45],[280,3.65],
      [300,3.71],[320,3.79],[340,3.86],[360,3.92],[380,3.96],
      [400,3.99],[420,4.02],[440,4.08],[460,4.17],[480,4.28],
      [500,4.41],[520,4.54],[540,4.65],[560,4.74],[580,4.79],
      [600,4.82]
    ]),
    fairway:Object.freeze([
      [10,2.18],[20,2.40],[30,2.52],[40,2.60],[50,2.66],
      [60,2.70],[70,2.72],[80,2.75],[90,2.77],[100,2.80],
      [120,2.85],[140,2.91],[160,2.98],[180,3.08],[200,3.19],
      [220,3.32],[240,3.45],[260,3.58],[280,3.69],[300,3.78],
      [320,3.84],[340,3.88],[360,3.95],[380,4.03],[400,4.11],
      [420,4.19],[440,4.27],[460,4.34],[480,4.42],[500,4.50],
      [520,4.58],[540,4.66],[560,4.74],[580,4.82],[600,4.89]
    ]),
    rough:Object.freeze([
      [10,2.34],[20,2.59],[30,2.70],[40,2.78],[50,2.87],
      [60,2.91],[70,2.93],[80,2.96],[90,2.99],[100,3.02],
      [120,3.08],[140,3.15],[160,3.23],[180,3.31],[200,3.42],
      [220,3.53],[240,3.64],[260,3.74],[280,3.83],[300,3.90],
      [320,3.95],[340,4.02],[360,4.11],[380,4.21],[400,4.30],
      [420,4.40],[440,4.49],[460,4.58],[480,4.68],[500,4.77],
      [520,4.87],[540,4.96],[560,5.06],[580,5.15],[600,5.25]
    ]),
    sand:Object.freeze([
      [10,2.43],[20,2.53],[30,2.66],[40,2.82],[50,2.92],
      [60,3.15],[70,3.21],[80,3.24],[90,3.24],[100,3.23],
      [120,3.21],[140,3.22],[160,3.28],[180,3.40],[200,3.55],
      [220,3.70],[240,3.84],[260,3.93],[280,4.00],[300,4.04],
      [320,4.12],[340,4.26],[360,4.41],[380,4.55],[400,4.69],
      [420,4.83],[440,4.97],[460,5.11],[480,5.25],[500,5.40],
      [520,5.54],[540,5.68],[560,5.82],[580,5.96],[600,6.10]
    ]),
    recovery:Object.freeze([
      [10,3.45],[20,3.51],[30,3.57],[40,3.71],[50,3.79],
      [60,3.83],[70,3.84],[80,3.84],[90,3.82],[100,3.80],
      [120,3.78],[140,3.80],[160,3.81],[180,3.82],[200,3.87],
      [220,3.92],[240,3.97],[260,4.03],[280,4.10],[300,4.20],
      [320,4.31],[340,4.44],[360,4.56],[380,4.66],[400,4.75],
      [420,4.84],[440,4.94],[460,5.03],[480,5.13],[500,5.22],
      [520,5.32],[540,5.41],[560,5.51],[580,5.60],[600,5.70]
    ]),
    green:Object.freeze([
      // A one-foot tap-in anchor is included so sub-two-foot putts do not
      // inherit the two-foot value. Published values begin at two feet.
      [1,1.00],[2,1.01],[3,1.05],[4,1.14],[5,1.24],[6,1.34],
      [7,1.43],[8,1.50],[9,1.56],[10,1.61],[15,1.78],[20,1.87],
      [30,1.98],[40,2.06],[50,2.14],[60,2.21],[90,2.36]
    ])
  })
});

export const BENCHMARK_VERSION = BROADIE_BENCHMARK.id;
export const BENCHMARKS = BROADIE_BENCHMARK.tables;
