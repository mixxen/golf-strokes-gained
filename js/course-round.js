export function applyCourseTee(round,course,tee,{
  makeDraft,
  attribution,
  importedAt=new Date().toISOString()
}={}){
  if(!round||!course||!tee) throw new Error('A round, course, and tee set are required.');
  const importedHoles=new Map(
    (tee.holes||[])
      .map((hole)=>[Number(hole.number),hole])
      .filter(([number])=>Number.isInteger(number)&&number>0)
  );
  const highestImportedHole=Math.max(0,...importedHoles.keys());
  const requestedHoleCount=Number(course.holeCount)||highestImportedHole||round.holeCount||18;
  const holeCount=Math.min(round.holes?.length||18,Math.max(1,requestedHoleCount));
  let imported=0;
  let updated=0;
  const missingHoleNumbers=[];

  for(let number=1;number<=holeCount;number+=1){
    const importedHole=importedHoles.get(number);
    const hole=round.holes?.[number-1];
    if(!hole||!importedHole){
      missingHoleNumbers.push(number);
      continue;
    }
    if(Number(importedHole.par)>0){
      hole.par=Number(importedHole.par);
      updated+=1;
    }
    if(Number(importedHole.yardage)>0){
      hole.teeDistance=Number(importedHole.yardage);
      imported+=1;
    } else {
      missingHoleNumbers.push(number);
    }
    if(makeDraft) hole.draft=makeDraft();
  }

  round.holeCount=holeCount;
  round.currentHole=Math.min(Math.max(1,Number(round.currentHole)||1),holeCount);
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
    holeCount,
    importedHoleCount:imported,
    holes:Array.from({length:holeCount},(_,index)=>{
      const source=importedHoles.get(index+1);
      const hole=round.holes[index];
      return {
        number:index+1,
        par:Number(source?.par)>0?Number(source.par):Number(hole?.par)||null,
        yardage:Number(source?.yardage)>0?Number(source.yardage):null
      };
    }),
    missingHoleNumbers:[...new Set(missingHoleNumbers)].sort((a,b)=>a-b),
    sourceLicense:attribution?.license||'ODbL-1.0',
    importedAt,
    modified:false
  };

  return {
    imported,
    updated,
    holeCount,
    missing:missingHoleNumbers.length,
    missingHoleNumbers:[...new Set(missingHoleNumbers)].sort((a,b)=>a-b)
  };
}

export function teeIsSelectable(tee){
  return Boolean(tee?.holes?.some((hole)=>Number(hole.par)>0||Number(hole.yardage)>0));
}

export function savedTeeKey(round,course){
  return round?.courseData?.courseId===course?.id?round.courseData.teeKey:null;
}
