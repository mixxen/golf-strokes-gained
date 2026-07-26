import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOpenGolfApiProvider,
  normalizeCourseDetail,
  OPENGOLF_API_BASE
} from '../js/course-providers/opengolfapi.js';

const fixture={
  id:'course-1',
  course_name:'Example Golf Club',
  city:'Honolulu',
  state:'HI',
  type:'Public',
  par:72,
  holes:2,
  tees:[
    {tee_key:'blue-male',tee_name:'Blue',tee_color:'blue',gender:'Male',course_rating:72.1,slope:130,par:72,yardage:6400},
    {tee_key:'white-female',tee_name:'White',tee_color:'white',gender:'Female',course_rating:74.2,slope:128,par:72,yardage:5800}
  ],
  holes_data:[
    {number:1,par:4,handicap_index:3,yardages:{blue:410,white:365}},
    {number:2,par:3,handicap_index:17,yardages:{blue:180,white:145}}
  ]
};

function response(body,{ok=true,status=200}={}){
  return {ok,status,json:async()=>body};
}

test('normalizes tees and hole-by-hole yardages from the full API schema',()=>{
  const course=normalizeCourseDetail(fixture);
  assert.equal(course.name,'Example Golf Club');
  assert.equal(course.tees[0].key,'blue-male');
  assert.equal(course.tees[0].usableHoleCount,2);
  assert.deepEqual(course.tees[0].holes,[
    {number:1,par:4,handicap:3,yardage:410},
    {number:2,par:3,handicap:17,yardage:180}
  ]);
  assert.equal(course.tees[1].holes[1].yardage,145);
  assert.equal(course.attribution.license,'ODbL-1.0');
});

test('search and detail requests stay behind the provider adapter',async()=>{
  const calls=[];
  const fetchFn=async(url,options)=>{
    calls.push({url,options});
    if(url.includes('/search?')) return response({courses:[{id:'course-1',course_name:'Example Golf Club',city:'Honolulu',state:'HI',par:72,holes:18}]});
    return response(fixture);
  };
  const provider=createOpenGolfApiProvider({fetchFn});
  const results=await provider.searchCourses('Example & Club');
  const detail=await provider.getCourse('course-1');

  assert.equal(results[0].name,'Example Golf Club');
  assert.equal(detail.tees[0].holes[0].yardage,410);
  assert.equal(calls[0].url,`${OPENGOLF_API_BASE}/courses/search?q=Example%20%26%20Club`);
  assert.equal(calls[1].url,`${OPENGOLF_API_BASE}/courses/course-1`);
  assert.equal(calls[0].options.headers.Accept,'application/json');
});

test('provider returns useful errors for rate limits, network failures, and bad schemas',async()=>{
  const limited=createOpenGolfApiProvider({fetchFn:async()=>response({}, {ok:false,status:429})});
  await assert.rejects(()=>limited.searchCourses('test'),/request limit reached/);

  const offline=createOpenGolfApiProvider({fetchFn:async()=>{ throw new TypeError('offline'); }});
  await assert.rejects(()=>offline.getCourse('course-1'),/Check your connection/);

  const malformed=createOpenGolfApiProvider({fetchFn:async()=>response({unexpected:true})});
  await assert.rejects(()=>malformed.searchCourses('test'),/unexpected search response/);
});

test('tees with partial data remain visible and report usable yardages',()=>{
  const course=normalizeCourseDetail({
    ...fixture,
    holes_data:[
      fixture.holes_data[0],
      {...fixture.holes_data[1],yardages:{white:145}}
    ]
  });
  assert.equal(course.tees[0].usableHoleCount,1);
  assert.equal(course.tees[0].holes[1].yardage,null);
});
