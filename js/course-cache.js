// Bump when normalized course objects change so old cached scorecards cannot
// silently appear selectable while carrying no usable hole data.
const CACHE_KEY='golf-strokes-gained-course-cache-v2';
const RECENT_KEY='golf-strokes-gained-recent-courses-v1';
const SEARCH_TTL=24*60*60*1000;
const COURSE_TTL=30*24*60*60*1000;

function parse(storage,key,fallback){
  try {
    const value=JSON.parse(storage.getItem(key)||'null');
    return value&&typeof value==='object'?value:fallback;
  } catch {
    return fallback;
  }
}

function write(storage,key,value){
  try { storage.setItem(key,JSON.stringify(value)); }
  catch { /* Storage may be disabled or full; course lookup should still work. */ }
}

export function createCourseCache(storage,{now=()=>Date.now()}={}){
  function readCache(){ return parse(storage,CACHE_KEY,{searches:{},courses:{}}); }
  function saveCache(cache){ write(storage,CACHE_KEY,cache); }
  function fresh(entry,ttl){ return entry&&now()-Number(entry.savedAt)<ttl; }

  return {
    getSearch(query,{allowExpired=false}={}){
      const entry=readCache().searches?.[query.trim().toLowerCase()];
      return entry&&(allowExpired||fresh(entry,SEARCH_TTL))?entry.value:null;
    },
    setSearch(query,value){
      const cache=readCache();
      cache.searches=cache.searches||{};
      cache.searches[query.trim().toLowerCase()]={savedAt:now(),value};
      const entries=Object.entries(cache.searches).sort((a,b)=>b[1].savedAt-a[1].savedAt).slice(0,20);
      cache.searches=Object.fromEntries(entries);
      saveCache(cache);
    },
    getCourse(id,{allowExpired=false}={}){
      const entry=readCache().courses?.[id];
      return entry&&(allowExpired||fresh(entry,COURSE_TTL))?entry.value:null;
    },
    setCourse(course){
      const cache=readCache();
      cache.courses=cache.courses||{};
      cache.courses[course.id]={savedAt:now(),value:course};
      const entries=Object.entries(cache.courses).sort((a,b)=>b[1].savedAt-a[1].savedAt).slice(0,12);
      cache.courses=Object.fromEntries(entries);
      saveCache(cache);
    },
    recent(){
      const recent=parse(storage,RECENT_KEY,[]);
      return Array.isArray(recent)?recent:[];
    },
    remember(course,tee){
      const recent=this.recent().filter((item)=>!(item.courseId===course.id&&item.teeKey===tee.key));
      recent.unshift({
        courseId:course.id,
        courseName:course.name,
        location:[course.city,course.state].filter(Boolean).join(', '),
        teeKey:tee.key,
        teeName:tee.name,
        teeGender:tee.gender,
        yardage:tee.yardage,
        usedAt:new Date(now()).toISOString()
      });
      write(storage,RECENT_KEY,recent.slice(0,6));
    }
  };
}

export const COURSE_CACHE_KEYS={cache:CACHE_KEY,recent:RECENT_KEY};
