import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCourseTee,savedTeeKey,teeIsSelectable} from '../js/course-round.js';

const course={
  id:'course-1',
  name:'Test Links',
  holeCount:2,
  tees:[
    {key:'blue',name:'Blue',gender:'Male',rating:72.1,slope:130,yardage:760,holes:[
      {number:1,par:4,yardage:410},
      {number:2,par:3,yardage:170}
    ]},
    {key:'white',name:'White',gender:'Male',rating:69.2,slope:124,yardage:680,holes:[
      {number:1,par:4,yardage:365},
      {number:2,par:3,yardage:150}
    ]}
  ]
};

const newRound=()=>({
  courseName:'',
  courseData:null,
  holeCount:18,
  currentHole:1,
  holes:[
    {number:1,par:5,teeDistance:500,draft:{old:true}},
    {number:2,par:4,teeDistance:400,draft:{old:true}}
  ]
});

const pars18=[4,5,4,3,4,5,4,3,4,4,5,3,4,4,5,3,4,4];
const blueYardages18=[410,525,390,175,420,545,405,165,430,415,535,180,400,425,550,170,395,440];
const whiteYardages18=[375,490,355,145,385,505,370,135,395,380,500,150,365,390,515,140,360,405];
const fullCourse={
  id:'course-18',
  name:'Eighteen Hole Club',
  holeCount:18,
  tees:[
    {key:'blue',name:'Blue',holes:pars18.map((par,index)=>({number:index+1,par,yardage:blueYardages18[index]}))},
    {key:'white',name:'White',holes:pars18.map((par,index)=>({number:index+1,par,yardage:whiteYardages18[index]}))}
  ]
};
const fullRound=()=>({
  courseName:'',
  courseData:null,
  holeCount:18,
  currentHole:7,
  holes:Array.from({length:18},(_,index)=>({
    number:index+1,
    par:3,
    teeDistance:100,
    draft:{old:true}
  }))
});

test('loading a tee replaces every hole 1 through 18 and stores a refresh-safe scorecard snapshot',()=>{
  const round=fullRound();
  const result=applyCourseTee(round,fullCourse,fullCourse.tees[0],{
    makeDraft:()=>({fresh:true}),
    importedAt:'2026-07-26T00:00:00.000Z'
  });

  assert.deepEqual(round.holes.map((hole)=>hole.par),pars18);
  assert.deepEqual(round.holes.map((hole)=>hole.teeDistance),blueYardages18);
  assert.equal(result.imported,18);
  assert.equal(result.missing,0);
  assert.equal(round.courseData.courseId,'course-18');
  assert.equal(round.courseData.teeKey,'blue');
  assert.deepEqual(round.courseData.holes.map((hole)=>hole.yardage),blueYardages18);

  const refreshed=JSON.parse(JSON.stringify(round));
  assert.deepEqual(refreshed.holes.map((hole)=>hole.teeDistance),blueYardages18);
  assert.deepEqual(refreshed.courseData.holes.map((hole)=>hole.par),pars18);
});

test('switching tees repopulates every hole rather than retaining the prior tee yardages',()=>{
  const round=fullRound();
  applyCourseTee(round,fullCourse,fullCourse.tees[0]);
  applyCourseTee(round,fullCourse,fullCourse.tees[1]);

  assert.deepEqual(round.holes.map((hole)=>hole.par),pars18);
  assert.deepEqual(round.holes.map((hole)=>hole.teeDistance),whiteYardages18);
  assert.equal(round.courseData.teeKey,'white');
  assert.deepEqual(round.courseData.holes.map((hole)=>hole.yardage),whiteYardages18);
});

test('changing tees reapplies hole pars and yardages and persists the selected tee',()=>{
  const round=newRound();
  applyCourseTee(round,course,course.tees[0],{makeDraft:()=>({fresh:true})});
  assert.deepEqual(round.holes.map(({par,teeDistance})=>({par,teeDistance})),[
    {par:4,teeDistance:410},
    {par:3,teeDistance:170}
  ]);
  assert.equal(round.courseData.teeKey,'blue');

  applyCourseTee(round,course,course.tees[1],{makeDraft:()=>({fresh:true})});
  assert.deepEqual(round.holes.map(({par,teeDistance})=>({par,teeDistance})),[
    {par:4,teeDistance:365},
    {par:3,teeDistance:150}
  ]);
  assert.equal(round.courseData.teeKey,'white');
  assert.equal(round.courseData.teeName,'White · Male');
  assert.equal(savedTeeKey(JSON.parse(JSON.stringify(round)),course),'white');
});

test('a saved tee is only restored for its matching course',()=>{
  const round=newRound();
  applyCourseTee(round,course,course.tees[0]);
  assert.equal(savedTeeKey(round,course),'blue');
  assert.equal(savedTeeKey(round,{id:'another-course'}),null);
});

test('tees with pars remain selectable when OpenGolfAPI has no per-hole yardages',()=>{
  const parOnly={key:'blue',name:'Blue',holes:[
    {number:1,par:4,yardage:null},
    {number:2,par:3,yardage:null}
  ]};
  assert.equal(teeIsSelectable(parOnly),true);

  const round=newRound();
  const result=applyCourseTee(round,course,parOnly);
  assert.equal(result.updated,2);
  assert.equal(result.imported,0);
  assert.deepEqual(round.holes.map((hole)=>hole.par),[4,3]);
  assert.deepEqual(round.holes.map((hole)=>hole.teeDistance),[500,400]);
  assert.equal(round.courseData.teeKey,'blue');
});

test('nine-hole and incomplete scorecards update available values without counting a missing back nine',()=>{
  const round=fullRound();
  round.currentHole=18;
  const nineHoleCourse={
    id:'nine',
    name:'Nine Hole Club',
    holeCount:9
  };
  const partialTee={
    key:'red',
    name:'Red',
    holes:pars18.slice(0,9).map((par,index)=>({
      number:index+1,
      par,
      yardage:index===4?null:250+index*10
    }))
  };

  const result=applyCourseTee(round,nineHoleCourse,partialTee);

  assert.equal(round.holeCount,9);
  assert.equal(round.currentHole,9);
  assert.equal(result.imported,8);
  assert.equal(result.missing,1);
  assert.deepEqual(result.missingHoleNumbers,[5]);
  assert.equal(round.holes[4].teeDistance,100);
  assert.equal(round.courseData.holes.length,9);
  assert.deepEqual(round.courseData.missingHoleNumbers,[5]);
});
