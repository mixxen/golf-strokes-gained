export function applyCourseTee(round,course,tee,{
  makeDraft,
  attribution,
  importedAt=new Date().toISOString()
}={}){
  if(!round||!course||!tee) throw new Error('A round, course, and tee set are required.');
  let imported=0;
  let updated=0;

  for(const importedHole of tee.holes||[]){
    const hole=round.holes?.[Number(importedHole.number)-1];
    if(!hole) continue;
    if(Number(importedHole.par)>0){
      hole.par=Number(importedHole.par);
      updated+=1;
    }
    if(Number(importedHole.yardage)>0){
      hole.teeDistance=Number(importedHole.yardage);
      imported+=1;
    }
    if(makeDraft) hole.draft=makeDraft();
  }

  round.courseName=course.name;
  round.courseData={
    provider:'opengolfapi',
    courseId:course.id,
    courseName:course.name,
    teeKey:tee.key,
    teeName:`${tee.name}${tee.gender?` · ${tee.gender}`:''}`,
    rating:tee.rating,
    slope:tee.slope,
    yardage:tee.yardage,
    importedHoleCount:imported,
    sourceLicense:attribution?.license||'ODbL-1.0',
    importedAt,
    modified:false
  };

  return {
    imported,
    updated,
    missing:Math.max(0,Number(course.holeCount||round.holes?.length||18)-imported)
  };
}

export function teeIsSelectable(tee){
  return Boolean(tee?.holes?.some((hole)=>Number(hole.par)>0||Number(hole.yardage)>0));
}

export function savedTeeKey(round,course){
  return round?.courseData?.courseId===course?.id?round.courseData.teeKey:null;
}
