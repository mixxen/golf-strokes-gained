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
  holes:[
    {number:1,par:5,teeDistance:500,draft:{old:true}},
    {number:2,par:4,teeDistance:400,draft:{old:true}}
  ]
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
