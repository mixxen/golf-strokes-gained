import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourseCache,COURSE_CACHE_KEYS} from '../js/course-cache.js';

function memoryStorage(){
  const values=new Map();
  return {
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value),
    values
  };
}

test('caches searches and details with an offline stale fallback',()=>{
  const storage=memoryStorage();
  let time=1_000_000;
  const cache=createCourseCache(storage,{now:()=>time});
  const results=[{id:'a',name:'A Course'}];
  const course={id:'a',name:'A Course',tees:[]};
  cache.setSearch('A',results);
  cache.setCourse(course);

  assert.deepEqual(cache.getSearch('a'),results);
  assert.deepEqual(cache.getCourse('a'),course);
  time+=31*24*60*60*1000;
  assert.equal(cache.getSearch('a'),null);
  assert.equal(cache.getCourse('a'),null);
  assert.deepEqual(cache.getSearch('a',{allowExpired:true}),results);
  assert.deepEqual(cache.getCourse('a',{allowExpired:true}),course);
});

test('remembers the latest course and tee without duplicates',()=>{
  const storage=memoryStorage();
  let time=1_000;
  const cache=createCourseCache(storage,{now:()=>time});
  const course={id:'a',name:'A Course',city:'Kailua',state:'HI'};
  const blue={key:'blue-male',name:'Blue',gender:'Male',yardage:6400};
  cache.remember(course,blue);
  time+=100;
  cache.remember(course,blue);

  assert.equal(cache.recent().length,1);
  assert.equal(cache.recent()[0].teeKey,'blue-male');
  assert.match(cache.recent()[0].usedAt,/1970/);
  assert.ok(storage.values.has(COURSE_CACHE_KEYS.recent));
});

test('ignores corrupt or unavailable browser storage',()=>{
  const storage={
    getItem:()=>'{not-json',
    setItem:()=>{ throw new Error('disabled'); }
  };
  const cache=createCourseCache(storage);
  assert.deepEqual(cache.recent(),[]);
  assert.doesNotThrow(()=>cache.setSearch('test',[]));
  assert.doesNotThrow(()=>cache.setCourse({id:'a'}));
});
