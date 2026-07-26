export const OPENGOLF_API_BASE='https://api.opengolfapi.org/api/v1';
export const OPENGOLF_ATTRIBUTION={
  name:'OpenGolfAPI',
  url:'https://opengolfapi.org/',
  license:'ODbL-1.0',
  licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/'
};

function text(value){
  return typeof value==='string'?value.trim():'';
}

function number(value){
  if(value===null||value===undefined||value==='') return null;
  if(typeof value==='object'){
    return number(value.yards??value.yardage??value.distance_yards??value.value);
  }
  const result=Number(value);
  return Number.isFinite(result)?result:null;
}

function slug(value){
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function normalizeSearchCourse(course){
  return {
    id:text(course.id),
    name:text(course.course_name||course.name),
    city:text(course.city),
    state:text(course.state),
    type:text(course.type||course.course_type),
    par:number(course.par??course.par_total),
    holes:number(course.holes),
    latitude:number(course.lat??course.latitude),
    longitude:number(course.lng??course.longitude)
  };
}

function teeYardageKeys(tee){
  return [...new Set([
    tee.tee_key,
    tee.tee_color,
    tee.tee_name,
    text(tee.tee_key).replace(/-(male|female)$/i,'')
  ].map(slug).filter(Boolean))];
}

function yardageForTee(hole,tee){
  const yardages=hole?.yardages&&typeof hole.yardages==='object'?hole.yardages:
    hole?.tee_yardages&&typeof hole.tee_yardages==='object'?hole.tee_yardages:{};
  const normalized=Object.fromEntries(Object.entries(yardages).map(([key,value])=>[slug(key),number(value)]));
  for(const key of teeYardageKeys(tee)){
    if(normalized[key]!==null&&normalized[key]>0) return normalized[key];
  }
  return null;
}

export function normalizeCourseDetail(course){
  course=course?.course&&typeof course.course==='object'?course.course:course;
  if(!course||typeof course!=='object') throw new Error('OpenGolfAPI returned an invalid course.');
  const id=text(course.id);
  const name=text(course.course_name||course.name);
  if(!id||!name) throw new Error('OpenGolfAPI returned a course without an id or name.');

  const sourceHoles=Array.isArray(course.holes_data)?course.holes_data:
    Array.isArray(course.scorecard)?course.scorecard:
    Array.isArray(course.holes)?course.holes:[];
  const tees=(Array.isArray(course.tees)?course.tees:[]).map((tee,index)=>{
    const normalized={
      key:text(tee.tee_key)||`${slug(tee.tee_name)||'tee'}-${index+1}`,
      name:text(tee.tee_name)||text(tee.tee_color)||`Tee ${index+1}`,
      color:text(tee.tee_color),
      gender:text(tee.gender),
      rating:number(tee.course_rating),
      slope:number(tee.slope),
      par:number(tee.par),
      yardage:number(tee.yardage)
    };
    const directHoles=Array.isArray(tee.holes)?tee.holes:
      Array.isArray(tee.scorecard)?tee.scorecard:[];
    const directByNumber=new Map(directHoles.map((hole)=>[
      number(hole.number??hole.hole),
      hole
    ]));
    const holeNumbers=[...new Set([
      ...sourceHoles.map((hole)=>number(hole.number??hole.hole)),
      ...directHoles.map((hole)=>number(hole.number??hole.hole))
    ].filter(Boolean))].sort((a,b)=>a-b);
    normalized.holes=holeNumbers.map((holeNumber)=>{
      const source=sourceHoles.find((hole)=>number(hole.number??hole.hole)===holeNumber)||{};
      const direct=directByNumber.get(holeNumber)||{};
      return {
        number:holeNumber,
        par:number(direct.par??source.par),
        handicap:number(direct.handicap_index??direct.handicap??source.handicap_index??source.handicap),
        yardage:number(direct.yardage??direct.yards??direct.distance_yards)??yardageForTee(source,tee)
      };
    }).filter((hole)=>hole.number&&(hole.par||hole.yardage));
    normalized.usableHoleCount=normalized.holes.filter((hole)=>hole.yardage).length;
    return normalized;
  });

  return {
    id,
    name,
    city:text(course.city),
    state:text(course.state),
    type:text(course.type),
    par:number(course.par),
    holeCount:number(course.hole_count)||
      (Array.isArray(course.holes)?course.holes.length:number(course.holes))||
      sourceHoles.length,
    tees,
    attribution:OPENGOLF_ATTRIBUTION
  };
}

async function requestJson(url,{fetchFn=globalThis.fetch,signal}={}){
  if(typeof fetchFn!=='function') throw new Error('Course lookup is unavailable in this browser.');
  let response;
  try {
    response=await fetchFn(url,{headers:{Accept:'application/json'},signal});
  } catch(error){
    if(error?.name==='AbortError') throw error;
    throw new Error('Could not reach OpenGolfAPI. Check your connection or enter the course manually.');
  }
  if(!response?.ok){
    if(response?.status===429) throw new Error('OpenGolfAPI request limit reached. Try again later or enter the course manually.');
    throw new Error(`OpenGolfAPI could not complete the request${response?.status?` (${response.status})`:''}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('OpenGolfAPI returned an unreadable response.');
  }
}

export function createOpenGolfApiProvider({baseUrl=OPENGOLF_API_BASE,fetchFn=globalThis.fetch}={}){
  const base=baseUrl.replace(/\/$/,'');
  return {
    id:'opengolfapi',
    attribution:OPENGOLF_ATTRIBUTION,
    async searchCourses(query,{signal}={}){
      const cleaned=text(query);
      if(cleaned.length<2) throw new Error('Enter at least two characters to search.');
      const data=await requestJson(`${base}/courses/search?q=${encodeURIComponent(cleaned)}`,{fetchFn,signal});
      if(!Array.isArray(data?.courses)) throw new Error('OpenGolfAPI returned an unexpected search response.');
      return data.courses.map(normalizeSearchCourse).filter((course)=>course.id&&course.name);
    },
    async getCourse(courseId,{signal}={}){
      const id=text(courseId);
      if(!id) throw new Error('Choose a course first.');
      const data=await requestJson(`${base}/courses/${encodeURIComponent(id)}`,{fetchFn,signal});
      return normalizeCourseDetail(data);
    }
  };
}
