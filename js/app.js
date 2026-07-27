import {
  BENCHMARK_VERSION,
  calculateShot,
  drivingSummary,
  inferShotType,
  missParts,
  nextShotStart,
  penaltyForLocation,
  scoreLabel,
  summarizeHole
} from './calculations.js';
import {createCourseCache} from './course-cache.js';
import {createOpenGolfApiProvider,OPENGOLF_ATTRIBUTION} from './course-providers/opengolfapi.js';
import {applyCourseTee,teeIsSelectable} from './course-round.js';
import {remainingDistanceFromShot,shotDistanceFromRemaining} from './distance-input.js';
import {importPgaFixture} from './pga-fixture-import.js';
import {createRoundStore} from './round-store.js';

const LEGACY_ROUND_KEYS=[
  'golf-strokes-gained-round-v8',
  'golf-strokes-gained-round-v7',
  'golf-strokes-gained-round-v6',
  'golf-strokes-gained-round-v5',
  'golf-strokes-gained-round-v4',
  'golf-strokes-gained-round-v3',
  'golf-strokes-gained-round-v2'
];
const zones=['long-left','long','long-right','left','target','right','short-left','short','short-right'];
const RELIEF_LOCATIONS=new Set(['penalty-area','unplayable']);
const FINISH_OPTIONS={
  drive:new Set(['fairway','first-cut','rough','deep-rough','fairway-bunker','greenside-bunker','fringe','recovery','penalty-area','out-of-bounds','unplayable','green','holed']),
  approach:new Set(['green','fringe','fairway','rough','deep-rough','fairway-bunker','greenside-bunker','recovery','penalty-area','out-of-bounds','unplayable','holed']),
  chip:new Set(['green','fringe','fairway','rough','deep-rough','greenside-bunker','recovery','penalty-area','out-of-bounds','unplayable','holed']),
  putt:new Set(['green','fringe','fairway','rough','holed'])
};
const DEFAULT_CLUBS={drive:'Driver',approach:'',chip:'Sand wedge',putt:'Putter'};
const DEFAULT_DISTANCE_BY_PAR={3:170,4:400,5:520};
const courseProvider=createOpenGolfApiProvider();
const courseCache=createCourseCache(localStorage);
const roundStore=createRoundStore(localStorage);

function localDate(){
  const now=new Date();
  return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
}

const defaultDraft=()=>({
  shotType:'auto',
  startLie:'tee',
  startDistance:400,
  club:'',
  endDistance:150,
  zone:null,
  location:null,
  reliefLie:'rough',
  intendedShape:'',
  contact:'',
  notes:'',
  basedOnShotCount:null
});
const defaultHole=(number)=>({number,par:4,teeDistance:400,draft:defaultDraft()});
const defaultRound=()=>({
  schemaVersion:9,
  id:id(),
  createdAt:new Date().toISOString(),
  updatedAt:new Date().toISOString(),
  status:'in-progress',
  courseName:'',
  courseData:null,
  testData:null,
  date:localDate(),
  holeCount:18,
  currentHole:1,
  holes:Array.from({length:18},(_,index)=>defaultHole(index+1)),
  shots:[],
  recentClubs:{...DEFAULT_CLUBS}
});

let round=defaultRound();
let activeView='home';
let roundReadOnly=false;
let creatingRound=false;
let selectedZone=null;
let selectedLocation=null;
let editingShotId=null;
let selectedCourse=null;
let selectedTeeKey=null;
let courseRequestController=null;

const $=(selector)=>document.querySelector(selector);
const elements={
  home:$('#rounds-home'),
  roundList:$('#round-list'),
  roundEmpty:$('#round-empty'),
  pgaFixtureFile:$('#pga-fixture-file'),
  pgaImportStatus:$('#pga-import-status'),
  setupPanel:$('#round-setup-panel'),
  homeButton:$('#home-button'),
  newRoundButton:$('#new-round-button'),
  workspaceSections:[...document.querySelectorAll('.workspace-section')],
  workspaceCourseName:$('#workspace-course-name'),
  workspaceRoundMeta:$('#workspace-round-meta'),
  workspaceRoundStatus:$('#workspace-round-status'),
  workspaceDate:$('#workspace-date'),
  workspaceCourseSource:$('#workspace-course-source'),
  editRoundButton:$('#edit-round-button'),
  deleteRoundButton:$('#delete-round-button'),
  date:$('#round-date'),
  courseSearchForm:$('#course-search-form'),
  courseSearch:$('#course-search'),
  courseSearchButton:$('#course-search-button'),
  courseSearchStatus:$('#course-search-status'),
  courseResults:$('#course-results'),
  recentCourseSection:$('#recent-course-section'),
  recentCourses:$('#recent-courses'),
  selectedCoursePanel:$('#selected-course-panel'),
  selectedCourseName:$('#selected-course-name'),
  selectedCourseDetail:$('#selected-course-detail'),
  teeSelector:$('#tee-selector'),
  importCourseButton:$('#import-course-button'),
  manualCourseButton:$('#manual-course-button'),
  courseSourceNote:$('#course-source-note'),
  par:$('#hole-par'),
  holeDistance:$('#hole-distance'),
  holeSelector:$('#hole-selector'),
  holeSaveState:$('#hole-save-state'),
  holeScore:$('#hole-score-value'),
  holeSg:$('#hole-sg'),
  holeLogTitle:$('#hole-log-title'),
  holeShotList:$('#hole-shot-list'),
  shotType:$('#shot-type'),
  missFieldset:$('#miss-fieldset'),
  startLie:$('#start-lie'),
  startDistance:$('#start-distance'),
  startUnit:$('#start-unit'),
  club:$('#club'),
  endDistance:$('#end-distance'),
  endUnit:$('#end-unit'),
  endDistanceLabel:$('#end-distance-label'),
  endDistanceTitle:$('#end-distance-title'),
  shotDistance:$('#shot-distance'),
  shotUnit:$('#shot-unit'),
  shotDistanceLabel:$('#shot-distance-label'),
  reliefLie:$('#relief-lie'),
  reliefLieLabel:$('#relief-lie-label'),
  distancePresets:$('#distance-presets'),
  penaltyGuidance:$('#penalty-guidance'),
  intendedShape:$('#intended-shape'),
  contact:$('#contact'),
  notes:$('#notes'),
  shapeLabel:$('#shape-label'),
  contactLabel:$('#contact-label'),
  moreDetails:$('#more-details'),
  form:$('#shot-form'),
  message:$('#form-message'),
  sequenceMessage:$('#sequence-message'),
  finishPreview:$('#finish-hole-preview'),
  finishPreviewScore:$('#finish-preview-score'),
  finishPreviewLabel:$('#finish-preview-label'),
  complete:$('#hole-complete'),
  completeTitle:$('#complete-title'),
  completeScore:$('#complete-score'),
  completeResult:$('#complete-result'),
  completeSg:$('#complete-sg'),
  completeDetail:$('#complete-detail'),
  nextHoleButton:$('#next-hole-button'),
  editLastShotButton:$('#edit-last-shot-button'),
  entryPanel:$('#shot-entry-panel'),
  total:$('#total-sg'),
  driveSg:$('#sg-off-tee'),
  fairwayRate:$('#fairway-rate'),
  playableRate:$('#playable-rate'),
  penalties:$('#drive-penalties'),
  missSummary:$('#miss-summary'),
  saveStatus:$('#save-status'),
  title:$('#shot-title'),
  context:$('#shot-context-text'),
  formMode:$('#form-mode-label'),
  saveShotButton:$('#save-shot-button'),
  cancelEditButton:$('#cancel-edit-button')
};

function id(){ return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function currentHole(){ return round.holes[round.currentHole-1]; }
function shotsForHole(hole=round.currentHole){ return round.shots.filter((shot)=>shot.hole===hole).sort((a,b)=>a.shotNumber-b.shotNumber); }
function lastShot(hole=round.currentHole){ return shotsForHole(hole).at(-1)||null; }
function titleCase(value=''){ return value.split('-').map((part)=>part?part[0].toUpperCase()+part.slice(1):'').join(' '); }
function escapeHtml(value=''){ return String(value).replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
function formatSg(value){ const numeric=Number(value)||0; const rounded=Math.abs(numeric)<0.005?0:numeric; return `${rounded>0?'+':''}${rounded.toFixed(2)}`; }
function rate(value){ return value===null?'—':`${Math.round(value*100)}%`; }
function unitForLie(lie){ return lie==='green'?'feet':'yards'; }
function unitLabel(unit){ return unit==='feet'?'ft':'yd'; }
function formatDistance(distance){ return Number.isInteger(Number(distance))?String(Number(distance)):Number(distance).toFixed(1); }
function formatToPar(value){ const numeric=Number(value); return numeric===0?'E':`${numeric>0?'+':''}${numeric}`; }
function typeLabel(type){ return ({drive:'Drive',approach:'Approach',chip:'Chip / short game',putt:'Putt'})[type]||titleCase(type); }
function holeSummary(holeNumber=round.currentHole){ const hole=round.holes[holeNumber-1]; return summarizeHole(shotsForHole(holeNumber),{par:hole.par,teeDistance:hole.teeDistance}); }
function holeIsComplete(holeNumber=round.currentHole){ return holeSummary(holeNumber).complete; }
function nextPlayingStroke(){ return holeSummary().score+1; }
function strokeNumberForShot(shot){ const prior=shotsForHole(shot.hole).filter((item)=>item.shotNumber<shot.shotNumber); return summarizeHole(prior).score+1; }

function normalizeShot(shot){
  if(!shot?.start||!shot?.finish) return shot;
  const penalty=shot.penalty||penaltyForLocation(shot.finish.location);
  let finishLie=shot.finish.benchmarkLie;
  let endDistance=shot.finish.distance;
  if(penalty?.strokeAndDistance){ finishLie=shot.start.lie; endDistance=shot.start.distance; }
  try {
    const calculation=calculateShot({
      startLie:shot.start.lie,
      startDistance:shot.start.distance,
      finishLocation:shot.finish.location,
      endDistance,
      finishLie,
      penalty
    });
    return {
      ...shot,
      start:{...shot.start,unit:unitForLie(shot.start.lie)},
      finish:{
        ...shot.finish,
        benchmarkLie:calculation.benchmarkLie,
        distance:calculation.endDistance,
        unit:unitForLie(calculation.benchmarkLie)
      },
      penalty,
      miss:shot.miss||missParts('target'),
      details:shot.details||{},
      typeOverride:shot.typeOverride||null,
      calculation:{...calculation,benchmarkVersion:BENCHMARK_VERSION}
    };
  } catch {
    return shot;
  }
}

function migrateRound(data){
  const base=defaultRound();
  if(!data) return base;
  base.id=data.id||base.id;
  base.createdAt=data.createdAt||data.updatedAt||base.createdAt;
  base.updatedAt=data.updatedAt||base.updatedAt;
  base.status=data.status||'in-progress';
  base.courseName=data.courseName||'';
  base.courseData=data.courseData||null;
  base.testData=data.testData||null;
  base.date=data.date||base.date;
  base.holeCount=Math.min(18,Math.max(1,Number(data.holeCount||data.courseData?.holeCount)||18));
  base.currentHole=Math.min(base.holeCount,Math.max(1,Number(data.currentHole)||1));
  base.recentClubs={...base.recentClubs,...data.recentClubs};
  if(Array.isArray(data.holes)){
    base.holes=base.holes.map((hole,index)=>({
      ...hole,
      ...data.holes[index],
      draft:{...hole.draft,...data.holes[index]?.draft}
    }));
  }
  base.shots=Array.isArray(data.shots)?data.shots.map(normalizeShot):[];
  base.shots.forEach((shot)=>{
    const hole=base.holes[shot.hole-1];
    if(!hole) return;
    hole.par=shot.par||hole.par;
    if(shot.shotNumber===1) hole.teeDistance=shot.start?.distance||hole.teeDistance;
  });
  if(Array.isArray(data.holes)){
    base.holes.forEach((hole,index)=>{
      if(data.holes[index]?.draft&&hole.draft.basedOnShotCount===null){
        hole.draft.basedOnShotCount=base.shots.filter((shot)=>shot.hole===hole.number).length;
      }
    });
  }
  return base;
}

function summariesFor(targetRound){
  return targetRound.holes.slice(0,targetRound.holeCount).map((hole)=>{
    const shots=targetRound.shots.filter((shot)=>shot.hole===hole.number).sort((a,b)=>a.shotNumber-b.shotNumber);
    return summarizeHole(shots,{par:hole.par,teeDistance:hole.teeDistance});
  });
}

function roundIsComplete(targetRound=round){
  const summaries=summariesFor(targetRound);
  return summaries.length>0&&summaries.every((summary)=>summary.complete);
}

function persist(message='Saved locally'){
  if(!round?.id||activeView==='home') return;
  round.date=elements.workspaceDate?.value||elements.date.value||round.date;
  round.status=roundIsComplete()?'complete':'in-progress';
  round=roundStore.save(round);
  elements.saveStatus.textContent=message;
}

function formatRoundDate(value){
  if(!value) return 'Date not set';
  const parsed=new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.valueOf())?value:new Intl.DateTimeFormat(undefined,{
    weekday:'long',
    month:'long',
    day:'numeric',
    year:'numeric'
  }).format(parsed);
}

function roundDisplayName(targetRound){
  return targetRound.courseName||'Manual round';
}

function renderRoundList(){
  const rounds=roundStore.list();
  elements.roundEmpty.classList.toggle('hidden',rounds.length>0);
  elements.roundList.innerHTML=rounds.map((item)=>{
    const summaries=summariesFor(item);
    const completed=summaries.filter((summary)=>summary.complete).length;
    const score=summaries.reduce((sum,summary)=>sum+summary.score,0);
    const sg=item.shots.reduce((sum,shot)=>sum+Number(shot.calculation?.strokesGained||0),0);
    const complete=roundIsComplete(item);
    const testDetail=item.testData
      ? `PGA test data · ${escapeHtml(item.testData.playerName)} · Round ${item.testData.roundNumber}`
      : null;
    return `<article class="round-card">
      <button type="button" class="round-card-button" data-open-round="${escapeHtml(item.id)}">
        <span class="round-card-date">${escapeHtml(formatRoundDate(item.date))}</span>
        <h3>${escapeHtml(roundDisplayName(item))}</h3>
        ${testDetail?`<span class="test-data-badge">${testDetail}</span>`:''}
        <span class="round-card-detail">${complete?'Completed':`${completed}/${item.holeCount} holes completed`}${item.courseData?.teeName?` · ${escapeHtml(item.courseData.teeName)} tees`:''}</span>
      </button>
      <div class="round-card-metrics">
        <span class="round-card-metric"><span>Score</span><strong>${score||'—'}</strong></span>
        <span class="round-card-metric"><span>Total SG</span><strong class="${sg>=0?'sg-positive':'sg-negative'}">${item.shots.length?formatSg(sg):'—'}</strong></span>
        <button type="button" class="round-card-button round-card-chevron" data-open-round="${escapeHtml(item.id)}" aria-label="Open ${escapeHtml(roundDisplayName(item))}">›</button>
      </div>
    </article>`;
  }).join('');
}

function setVisibleView(view){
  activeView=view;
  elements.home.classList.toggle('hidden',view!=='home');
  elements.setupPanel.classList.toggle('hidden',view!=='setup');
  elements.workspaceSections.forEach((section)=>section.classList.toggle('hidden',view!=='workspace'));
  elements.homeButton.classList.toggle('hidden',view==='home');
  elements.newRoundButton.classList.toggle('hidden',view==='setup');
}

function showHome(){
  if(activeView==='workspace'&&!roundReadOnly) persist();
  creatingRound=false;
  setVisibleView('home');
  renderRoundList();
}

function resetCoursePicker(){
  selectedCourse=null;
  selectedTeeKey=null;
  elements.courseSearch.value='';
  elements.courseResults.innerHTML='';
  elements.selectedCoursePanel.classList.add('hidden');
  elements.courseSearchStatus.textContent="Search for a course and choose tees, or start with manual hole entry.";
}

function beginNewRound(){
  round=defaultRound();
  creatingRound=true;
  roundReadOnly=false;
  selectedZone=null;
  selectedLocation=null;
  editingShotId=null;
  resetCoursePicker();
  elements.date.value=round.date;
  elements.saveStatus.textContent='Not saved yet';
  renderCourseSource();
  renderRecentCourses();
  setVisibleView('setup');
}

function firstIncompleteHole(targetRound){
  const summaries=summariesFor(targetRound);
  const index=summaries.findIndex((summary)=>!summary.complete);
  return index>=0?index+1:targetRound.currentHole||1;
}

function applyWorkspaceMode(){
  const complete=roundIsComplete();
  roundReadOnly=complete&&roundReadOnly;
  elements.workspaceRoundStatus.textContent=round.testData
    ? 'PGA test data'
    : complete
      ? 'Completed round'
      : 'Round in progress';
  elements.editRoundButton.classList.toggle('hidden',!roundReadOnly);
  elements.entryPanel.classList.toggle('hidden',roundReadOnly);
  elements.par.disabled=roundReadOnly;
  elements.holeDistance.disabled=roundReadOnly;
  $('#undo-button').classList.toggle('hidden',roundReadOnly);
  elements.workspaceDate.disabled=roundReadOnly;
}

function renderWorkspaceHeading(){
  elements.workspaceCourseName.textContent=roundDisplayName(round);
  elements.workspaceRoundStatus.textContent=round.testData
    ? 'PGA test data'
    : roundIsComplete()
      ? 'Completed round'
      : 'Round in progress';
  elements.workspaceRoundMeta.textContent=round.testData
    ? `${formatRoundDate(round.date)} · ${round.testData.playerName} · Round ${round.testData.roundNumber}`
    : `${formatRoundDate(round.date)}${round.courseData?.teeName?` · ${round.courseData.teeName} tees`:''}`;
  elements.workspaceDate.value=round.date;
  elements.date.value=round.date;
  elements.workspaceCourseSource.textContent=round.testData
    ? `Private ${round.testData.tournamentName} shot fixture. Imported locally; not uploaded.`
    : round.courseData
      ? `Scorecard from OpenGolfAPI${round.courseData.modified?' with local hole edits':''}.`
      : 'Manually entered scorecard.';
  applyWorkspaceMode();
}

async function importPgaFixtureFile(file) {
  if(!file) return;
  elements.pgaImportStatus.textContent='Reading and validating the PGA fixture…';
  try {
    if(file.size>10_000_000) throw new Error('Choose a PGA fixture smaller than 10 MB.');
    const fixture=JSON.parse(await file.text());
    const result=importPgaFixture(fixture,roundStore);
    renderRoundList();
    const firstRound=result.rounds[0];
    const changed=[
      result.added?`${result.added} added`:null,
      result.updated?`${result.updated} refreshed`:null
    ].filter(Boolean).join(', ');
    elements.pgaImportStatus.innerHTML=`Imported ${result.rounds.length} ${escapeHtml(result.playerName)} round${result.rounds.length===1?'':'s'} from ${escapeHtml(result.tournamentName)} (${changed}). <button type="button" class="text-button inline-button" data-open-round="${escapeHtml(firstRound.id)}">Open round 1</button>`;
  } catch(error){
    elements.pgaImportStatus.textContent=`Could not import the fixture: ${error.message}`;
  } finally {
    elements.pgaFixtureFile.value='';
  }
}

function openRound(roundId){
  const stored=roundStore.get(roundId);
  if(!stored){
    location.hash='#/rounds';
    return;
  }
  round=migrateRound(stored);
  round.currentHole=firstIncompleteHole(round);
  roundReadOnly=roundIsComplete();
  creatingRound=false;
  editingShotId=null;
  selectedZone=null;
  selectedLocation=null;
  round.holes.forEach((hole)=>recalculateHoleShots(hole.number));
  setVisibleView('workspace');
  restoreDraft();
  render();
  renderWorkspaceHeading();
}

function finishRoundSetup(){
  round.date=elements.date.value||localDate();
  round.status='in-progress';
  round=roundStore.save(round);
  creatingRound=false;
  location.hash=`#/round/${encodeURIComponent(round.id)}`;
}

function route(){
  const hash=location.hash||'#/rounds';
  if(hash==='#/round/new'){
    beginNewRound();
    return;
  }
  const match=hash.match(/^#\/round\/([^/]+)$/);
  if(match){
    openRound(decodeURIComponent(match[1]));
    return;
  }
  showHome();
}

function courseLocation(course){
  return [course.city,course.state].filter(Boolean).join(', ');
}

function teeLabel(tee){
  return `${tee.name}${tee.gender?` · ${tee.gender}`:''}`;
}

function renderCourseSource(){
  const source=round.courseData;
  if(!source){
    elements.courseSourceNote.classList.add('hidden');
    elements.courseSourceNote.textContent='';
    return;
  }
  const modified=source.modified?' Hole details have local edits.':'';
  elements.courseSourceNote.innerHTML=`Scorecard loaded from <a href="${OPENGOLF_ATTRIBUTION.url}" target="_blank" rel="noopener">OpenGolfAPI</a> (${escapeHtml(source.teeName)} tees), licensed under <a href="${OPENGOLF_ATTRIBUTION.licenseUrl}" target="_blank" rel="noopener">ODbL 1.0</a>.${modified}`;
  elements.courseSourceNote.classList.remove('hidden');
}

function renderRecentCourses(){
  const recent=courseCache.recent();
  elements.recentCourseSection.classList.toggle('hidden',recent.length===0);
  elements.recentCourses.innerHTML=recent.map((item)=>`<button type="button" class="course-result-button" data-course-id="${escapeHtml(item.courseId)}" data-preferred-tee="${escapeHtml(item.teeKey)}"><strong>${escapeHtml(item.courseName)} · ${escapeHtml(item.teeName)}</strong><span>${escapeHtml(item.location)}${item.yardage?` · ${item.yardage} yd`:''}</span></button>`).join('');
}

function renderCourseResults(courses){
  elements.courseResults.innerHTML=courses.length?courses.slice(0,20).map((course)=>{
    const detail=[courseLocation(course),course.type,course.holes?`${course.holes} holes`:null].filter(Boolean).join(' · ');
    return `<button type="button" class="course-result-button" data-course-id="${escapeHtml(course.id)}"><strong>${escapeHtml(course.name)}</strong><span>${escapeHtml(detail)}</span></button>`;
  }).join(''):'';
}

function chooseTee(teeKey){
  selectedTeeKey=teeKey;
  elements.teeSelector.querySelectorAll('[data-tee-key]').forEach((button)=>{
    const selected=button.dataset.teeKey===teeKey;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  const tee=selectedCourse?.tees.find((item)=>item.key===teeKey);
  const loaded=tee&&round.courseData?.courseId===selectedCourse?.id&&round.courseData?.teeKey===tee.key;
  elements.importCourseButton.disabled=!tee||!teeIsSelectable(tee)||loaded;
  elements.importCourseButton.textContent=loaded
    ? Number(round.courseData?.importedHoleCount)>0
      ? `${teeLabel(tee)} tees loaded`
      : 'Pars loaded · hole yardages unavailable'
    : tee?`Use ${teeLabel(tee)} tees`:'Use selected tees';
}

function renderSelectedCourse(preferredTeeKey=null){
  if(!selectedCourse){
    elements.selectedCoursePanel.classList.add('hidden');
    return;
  }
  elements.selectedCourseName.textContent=selectedCourse.name;
  elements.selectedCourseDetail.textContent=[courseLocation(selectedCourse),selectedCourse.type,`${selectedCourse.holeCount||18} holes`].filter(Boolean).join(' · ');
  elements.teeSelector.innerHTML=selectedCourse.tees.length?selectedCourse.tees.map((tee)=>{
    const details=[
      tee.yardage?`${tee.yardage} yd`:null,
      tee.rating?`Rating ${tee.rating}`:null,
      tee.slope?`Slope ${tee.slope}`:null,
      tee.usableHoleCount
        ? `${tee.usableHoleCount}/${selectedCourse.holeCount||18} yardages`
        : 'No hole yardages from OpenGolfAPI'
    ].filter(Boolean).join(' · ');
    return `<button type="button" class="tee-button" aria-pressed="false" data-tee-key="${escapeHtml(tee.key)}" ${teeIsSelectable(tee)?'':'disabled'}><strong>${escapeHtml(teeLabel(tee))}</strong><span>${escapeHtml(details)}</span></button>`;
  }).join(''):'<p class="helper-text">This course does not currently include tee sets. You can still enter it manually.</p>';
  elements.selectedCoursePanel.classList.remove('hidden');
  const preferred=selectedCourse.tees.find((tee)=>tee.key===preferredTeeKey&&teeIsSelectable(tee));
  const best=selectedCourse.tees.filter(teeIsSelectable).sort((a,b)=>b.usableHoleCount-a.usableHoleCount)[0];
  selectedTeeKey=(preferred||best)?.key||null;
  chooseTee(selectedTeeKey);
}

async function loadCourse(courseId,{preferredTeeKey=null,scroll=true}={}){
  courseRequestController?.abort();
  courseRequestController=new AbortController();
  elements.courseSearchStatus.textContent='Loading course and tee data…';
  elements.courseSearchButton.disabled=true;
  try {
    let course=courseCache.getCourse(courseId);
    if(!course){
      try {
        course=await courseProvider.getCourse(courseId,{signal:courseRequestController.signal});
        courseCache.setCourse(course);
      } catch(error){
        course=courseCache.getCourse(courseId,{allowExpired:true});
        if(!course) throw error;
        elements.courseSearchStatus.textContent='OpenGolfAPI is unavailable. Showing the last locally cached copy.';
      }
    }
    selectedCourse=course;
    renderSelectedCourse(preferredTeeKey);
    if(!elements.courseSearchStatus.textContent.includes('cached')){
      elements.courseSearchStatus.textContent=course.tees.length
        ? 'Choose the tees you are playing.'
        : 'No tee data is available for this course. Continue with manual entry.';
    }
    if(scroll) elements.selectedCoursePanel.scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch(error){
    if(error?.name!=='AbortError') elements.courseSearchStatus.textContent=error.message;
  } finally {
    elements.courseSearchButton.disabled=false;
  }
}

async function searchCourses(){
  const query=elements.courseSearch.value.trim();
  if(query.length<2){
    elements.courseSearchStatus.textContent='Enter at least two characters to search.';
    return;
  }
  courseRequestController?.abort();
  courseRequestController=new AbortController();
  elements.courseSearchButton.disabled=true;
  elements.courseSearchStatus.textContent='Searching OpenGolfAPI…';
  elements.courseResults.innerHTML='';
  selectedCourse=null;
  selectedTeeKey=null;
  elements.selectedCoursePanel.classList.add('hidden');
  try {
    let courses=courseCache.getSearch(query);
    let cached=Boolean(courses);
    if(!courses){
      try {
        courses=await courseProvider.searchCourses(query,{signal:courseRequestController.signal});
        courseCache.setSearch(query,courses);
      } catch(error){
        courses=courseCache.getSearch(query,{allowExpired:true});
        if(!courses) throw error;
        cached=true;
      }
    }
    renderCourseResults(courses);
    elements.courseSearchStatus.textContent=courses.length
      ? `${courses.length} course${courses.length===1?'':'s'} found${cached?' in the local cache':''}. Choose one to see its tees.`
      : 'No matching courses were found. Try a broader search or continue with manual entry.';
  } catch(error){
    if(error?.name!=='AbortError') elements.courseSearchStatus.textContent=error.message;
  } finally {
    elements.courseSearchButton.disabled=false;
  }
}

function importSelectedCourse({teeKey=selectedTeeKey}={}){
  const tee=selectedCourse?.tees.find((item)=>item.key===teeKey);
  if(!selectedCourse||!tee) return false;
  if(round.shots.length&&!confirm('Replace the current pars and tee yardages? Existing strokes will be recalculated from the imported tee positions.')) return false;

  const {imported,updated,missing,missingHoleNumbers}=applyCourseTee(round,selectedCourse,tee,{
    makeDraft:defaultDraft,
    attribution:OPENGOLF_ATTRIBUTION
  });
  round.holes.forEach((hole)=>recalculateHoleShots(hole.number));
  courseCache.remember(selectedCourse,tee);
  selectedTeeKey=tee.key;
  selectedZone=null;
  selectedLocation=null;
  editingShotId=null;
  if(creatingRound){
    finishRoundSetup();
    return true;
  }
  persist(`${imported} hole${imported===1?'':'s'} loaded`);
  restoreDraft();
  render();
  renderRecentCourses();
  chooseTee(tee.key);
  elements.courseSearchStatus.textContent=missing
    ? `${updated} pars and ${imported} tee yardages loaded from ${teeLabel(tee)} tees. Enter yardage manually for hole${missing===1?'':'s'} ${missingHoleNumbers.join(', ')}.`
    : `${imported} holes loaded from ${teeLabel(tee)} tees.`;
  return true;
}

function markCourseModified(){
  if(round.courseData) round.courseData.modified=true;
}

function selectButton(containerSelector,dataName,value){
  document.querySelectorAll(`${containerSelector} button`).forEach((button)=>{
    const selected=button.dataset[dataName]===value;
    button.classList.toggle('selected',selected);
    if(dataName==='zone') button.setAttribute('aria-checked',String(selected));
    if(dataName==='location') button.setAttribute('aria-pressed',String(selected));
  });
}

function expectedStart(){
  const previous=lastShot();
  if(!previous) return {lie:'tee',distance:currentHole().teeDistance,unit:'yards'};
  return nextShotStart(previous);
}

function inferredType(){
  if(elements.shotType.value!=='auto') return elements.shotType.value;
  const shotNumber=editingShotId?(round.shots.find((shot)=>shot.id===editingShotId)?.shotNumber||1):shotsForHole().length+1;
  return inferShotType({
    lie:elements.startLie.value,
    distance:Number(elements.startDistance.value),
    par:Number(elements.par.value),
    shotNumber
  });
}

function suggestedEndDistance(type,start){
  if(type==='drive') return Math.max(40,Math.round(Number(start.distance)-250));
  if(type==='approach') return Math.max(10,Math.min(100,Math.round(Number(start.distance)/4)));
  if(type==='chip') return Math.max(1,Math.min(20,Math.round(Number(start.distance)/2)));
  return Math.max(1,Math.round(Number(start.distance)/3));
}

function defaultClubForType(type){ return round.recentClubs?.[type]||DEFAULT_CLUBS[type]||''; }

function seedNextShot(){
  const start=expectedStart();
  if(!start) return;
  const hole=currentHole();
  const shotCount=shotsForHole().length;
  const existing=hole.draft||defaultDraft();
  const stale=existing.basedOnShotCount!==shotCount||existing.startLie!==start.lie||Number(existing.startDistance)!==Number(start.distance);
  if(!stale) return;

  const type=inferShotType({lie:start.lie,distance:start.distance,par:hole.par,shotNumber:shotCount+1});
  hole.draft={
    ...defaultDraft(),
    startLie:start.lie,
    startDistance:start.distance,
    club:defaultClubForType(type),
    endDistance:suggestedEndDistance(type,start),
    location:type==='putt'?'green':null,
    reliefLie:start.lie==='tee'?'rough':start.lie,
    basedOnShotCount:shotCount
  };
}

function captureDraft(){
  return {
    shotType:elements.shotType.value,
    startLie:elements.startLie.value,
    startDistance:Number(elements.startDistance.value),
    club:elements.club.value,
    endDistance:Number(elements.endDistance.value),
    zone:selectedZone,
    location:selectedLocation,
    reliefLie:elements.reliefLie.value,
    intendedShape:elements.intendedShape.value,
    contact:elements.contact.value,
    notes:elements.notes.value,
    basedOnShotCount:shotsForHole().length
  };
}

function saveDraft(){
  if(editingShotId) return;
  if(holeIsComplete()) return;
  const hole=currentHole();
  hole.par=Number(elements.par.value);
  hole.teeDistance=Number(elements.holeDistance.value);
  hole.draft=captureDraft();
  persist(`Hole ${round.currentHole} saved`);
  elements.holeSaveState.textContent=`Hole ${round.currentHole} saved`;
}

function setLocationAvailability(type){
  const allowed=FINISH_OPTIONS[type]||FINISH_OPTIONS.approach;
  document.querySelectorAll('#finish-location-grid button').forEach((button)=>{
    const available=allowed.has(button.dataset.location);
    button.classList.toggle('unavailable',!available);
    button.disabled=!available;
  });
  if(selectedLocation&&!allowed.has(selectedLocation)){
    selectedLocation=null;
    selectButton('#finish-location-grid','location',null);
  }
}

function setZone(zone){
  selectedZone=zone;
  selectButton('#miss-grid','zone',selectedZone);
}

function renderDistancePresets(type,unit){
  if(!selectedLocation||['holed','out-of-bounds'].includes(selectedLocation)){
    elements.distancePresets.innerHTML='';
    return;
  }
  let values;
  if(unit==='feet') values=[1,2,3,5,8,12,20,30];
  else if(type==='drive') values=[50,100,125,150,175,200];
  else if(type==='approach') values=[5,10,20,30,50,75,100];
  else values=[1,3,5,10,15,20,30];
  elements.distancePresets.innerHTML=values.map((value)=>`<button type="button" data-distance="${value}">${value} ${unitLabel(unit)}</button>`).join('');
}

function roundedDistance(value){
  if(!Number.isFinite(value)) return '';
  return String(Math.round(value*10)/10);
}

function syncShotDistanceFromRemaining(){
  const value=shotDistanceFromRemaining({
    startDistance:elements.startDistance.value,
    startUnit:unitForLie(elements.startLie.value),
    remainingDistance:elements.endDistance.value,
    remainingUnit:elements.endUnit.textContent==='ft'?'feet':'yards'
  });
  if(value!==null) elements.shotDistance.value=roundedDistance(value);
}

function syncRemainingDistanceFromShot(){
  const value=remainingDistanceFromShot({
    startDistance:elements.startDistance.value,
    startUnit:unitForLie(elements.startLie.value),
    shotDistance:elements.shotDistance.value,
    remainingUnit:elements.endUnit.textContent==='ft'?'feet':'yards'
  });
  if(value!==null) elements.endDistance.value=roundedDistance(value);
}

function previewBaseShots(){
  if(!editingShotId) return shotsForHole();
  const editing=round.shots.find((shot)=>shot.id===editingShotId);
  return shotsForHole().filter((shot)=>shot.shotNumber<editing.shotNumber);
}

function updateFinishPreview(){
  if(selectedLocation!=='holed'){
    elements.finishPreview.classList.add('hidden');
    return;
  }
  const before=previewBaseShots();
  const score=summarizeHole(before).score+1;
  const par=Number(elements.par.value);
  try {
    const finishingSg=calculateShot({
      startLie:elements.startLie.value,
      startDistance:Number(elements.startDistance.value),
      finishLocation:'holed',
      endDistance:0,
      penalty:null
    }).strokesGained;
    const projectedSg=before.reduce((sum,shot)=>sum+Number(shot.calculation.strokesGained||0),0)+finishingSg;
    elements.finishPreviewScore.textContent=String(score);
    elements.finishPreviewLabel.textContent=`${scoreLabel(score,par)} · ${formatToPar(score-par)} · Hole SG ${formatSg(projectedSg)}`;
    elements.finishPreview.classList.remove('hidden');
  } catch {
    elements.finishPreview.classList.add('hidden');
  }
}

function updateSubmitButton(){
  const valid=Boolean(selectedLocation&&(selectedZone||selectedLocation==='holed'));
  elements.saveShotButton.disabled=!valid;
  if(editingShotId){
    elements.saveShotButton.textContent=selectedLocation==='holed'?'Save finishing stroke':'Save and rebuild sequence';
  } else if(selectedLocation==='holed'){
    elements.saveShotButton.textContent='Finish hole';
  } else {
    elements.saveShotButton.textContent=`Add stroke ${nextPlayingStroke()}`;
  }
}

function applyLocationControls({focus=false}={}){
  const type=inferredType();
  const location=selectedLocation;
  elements.reliefLieLabel.classList.toggle('hidden',!RELIEF_LOCATIONS.has(location));
  elements.penaltyGuidance.classList.add('hidden');
  elements.endDistanceLabel.classList.remove('hidden');
  elements.shotDistanceLabel.classList.remove('hidden');
  elements.endDistance.disabled=false;
  elements.shotDistance.disabled=false;
  elements.endDistance.min=location==='holed'?'0':'1';

  let unit=type==='putt'?'feet':'yards';
  elements.missFieldset.classList.toggle('hidden',location==='holed');
  if(location==='green'){
    unit='feet';
    elements.endDistanceTitle.textContent='Leave distance';
  } else if(location==='holed'){
    setZone('target');
    elements.endDistance.value=0;
    elements.endDistance.disabled=true;
    elements.endDistanceLabel.classList.add('hidden');
    elements.shotDistance.disabled=true;
  } else if(location==='out-of-bounds'){
    unit=unitForLie(elements.startLie.value);
    elements.endDistanceTitle.textContent='Replay distance';
    elements.endDistance.value=elements.startDistance.value;
    elements.endDistance.disabled=true;
    elements.shotDistance.disabled=true;
    elements.penaltyGuidance.textContent=`Stroke-and-distance: add one penalty stroke and replay from ${elements.startDistance.value} ${unitLabel(unit)} ${titleCase(elements.startLie.value)}. This outcome is exactly -2.00 SG.`;
    elements.penaltyGuidance.classList.remove('hidden');
  } else if(RELIEF_LOCATIONS.has(location)){
    unit='yards';
    elements.endDistanceTitle.textContent='Relief distance';
    elements.penaltyGuidance.textContent=location==='penalty-area'
      ? 'One penalty stroke is added. Enter the lie and distance where the next stroke will be played after relief.'
      : 'One penalty stroke is added. Enter the lie and distance where the next stroke will be played after taking relief.';
    elements.penaltyGuidance.classList.remove('hidden');
  } else {
    unit='yards';
    elements.endDistanceTitle.textContent='Remaining distance';
  }

  elements.endUnit.textContent=unitLabel(unit);
  elements.shotUnit.textContent=unitLabel(unitForLie(elements.startLie.value));
  syncShotDistanceFromRemaining();
  renderDistancePresets(type,unit);
  updateFinishPreview();
  updateSubmitButton();

  if(focus&&location&&!['holed','out-of-bounds'].includes(location)){
    requestAnimationFrame(()=>elements.endDistance.focus());
  }
}

function chooseLocation(location,{focus=true,save=true}={}){
  const previous=selectedLocation;
  selectedLocation=location;
  selectButton('#finish-location-grid','location',location);

  if(location==='green'&&previous!=='green') elements.endDistance.value=inferredType()==='putt'?suggestedEndDistance('putt',{distance:Number(elements.startDistance.value)}):20;
  if(previous==='green'&&location!=='green'&&location!=='holed'){
    elements.endDistance.value=suggestedEndDistance(inferredType(),{distance:Number(elements.startDistance.value)});
  }
  if(location==='unplayable'&&!elements.reliefLie.value) elements.reliefLie.value=elements.startLie.value==='tee'?'rough':elements.startLie.value;
  applyLocationControls({focus});
  if(save) saveDraft();
}

function updateContext(){
  const type=inferredType();
  const playing=editingShotId
    ? strokeNumberForShot(round.shots.find((shot)=>shot.id===editingShotId))
    : nextPlayingStroke();
  elements.title.textContent=typeLabel(type);
  elements.context.textContent=`Hole ${round.currentHole} · Playing ${playing} · ${elements.startDistance.value} ${unitLabel(unitForLie(elements.startLie.value))}`;
  $('.target-zone').textContent=type==='drive'?'Target':type==='putt'?'Holed line':'On target';
  elements.startUnit.textContent=unitLabel(unitForLie(elements.startLie.value));
  elements.startLie.disabled=!editingShotId;
  elements.startDistance.readOnly=!editingShotId;
  elements.club.placeholder=defaultClubForType(type)||typeLabel(type);
  if(!elements.club.value&&!editingShotId) elements.club.value=defaultClubForType(type);
  elements.shapeLabel.classList.toggle('hidden',type==='putt');
  elements.contactLabel.classList.toggle('hidden',type==='putt');
  setLocationAvailability(type);

  if(editingShotId){
    elements.sequenceMessage.textContent='Saving this edit removes every later stroke on the hole so the starting positions and strokes gained remain consistent.';
  } else if(!lastShot()){
    elements.sequenceMessage.textContent=`Start hole ${round.currentHole} from the tee. You are playing stroke 1.`;
  } else if(lastShot().penalty?.strokeAndDistance){
    elements.sequenceMessage.textContent=`Penalty recorded. Replay from the same position; you are now playing stroke ${playing}.`;
  } else {
    elements.sequenceMessage.textContent=`This stroke starts where the previous stroke finished. Save the result to create stroke ${playing+1} automatically.`;
  }
  applyLocationControls();
}

function restoreDraft(){
  const hole=currentHole();
  elements.par.value=hole.par;
  elements.holeDistance.value=hole.teeDistance;

  if(holeIsComplete()&&!editingShotId){
    elements.form.classList.add('hidden');
    elements.finishPreview.classList.add('hidden');
    elements.complete.classList.remove('hidden');
    elements.title.textContent='Hole complete';
    elements.context.textContent=`Hole ${round.currentHole} · Complete`;
    renderCompletePanel();
    return;
  }

  elements.form.classList.remove('hidden');
  elements.complete.classList.add('hidden');
  seedNextShot();
  const draft=hole.draft||defaultDraft();
  elements.shotType.value=draft.shotType;
  elements.startLie.value=draft.startLie;
  elements.startDistance.value=draft.startDistance;
  elements.club.value=draft.club;
  elements.endDistance.value=draft.endDistance;
  syncShotDistanceFromRemaining();
  elements.reliefLie.value=draft.reliefLie||'rough';
  elements.intendedShape.value=draft.intendedShape;
  elements.contact.value=draft.contact;
  elements.notes.value=draft.notes;
  selectedZone=draft.zone;
  selectedLocation=draft.location;
  selectButton('#miss-grid','zone',selectedZone);
  selectButton('#finish-location-grid','location',selectedLocation);
  updateContext();
}

function switchHole(number){
  if(roundReadOnly){
    round.currentHole=number;
    restoreDraft();
    render();
    return;
  }
  if(number===round.currentHole) return;
  if(!editingShotId&&!holeIsComplete()) saveDraft();
  cancelEdit(false);
  round.currentHole=number;
  restoreDraft();
  persist(`Hole ${number} loaded`);
  render();
}

function renumberHole(hole){ shotsForHole(hole).forEach((shot,index)=>{shot.shotNumber=index+1;}); }

function buildShot(){
  if(!selectedLocation) throw new Error('Choose a finishing result.');
  if(!selectedZone&&selectedLocation!=='holed') throw new Error('Choose a miss zone.');
  const existing=editingShotId?round.shots.find((shot)=>shot.id===editingShotId):null;
  const shotNumber=existing?.shotNumber||shotsForHole().length+1;
  const type=inferredType();
  const penalty=penaltyForLocation(selectedLocation);
  const startDistance=Number(elements.startDistance.value);
  if(!Number.isFinite(startDistance)||startDistance<=0) throw new Error('Starting distance must be greater than zero.');
  const endDistance=selectedLocation==='holed'?0:Number(elements.endDistance.value);
  if(selectedLocation!=='holed'&&selectedLocation!=='out-of-bounds'&&(!Number.isFinite(endDistance)||endDistance<=0)){
    throw new Error('Enter a remaining distance greater than zero, or choose Holed out.');
  }
  const finishLie=RELIEF_LOCATIONS.has(selectedLocation)?elements.reliefLie.value:undefined;
  const calculation=calculateShot({
    startLie:elements.startLie.value,
    startDistance,
    finishLocation:selectedLocation,
    endDistance,
    finishLie,
    penalty
  });

  return {
    id:existing?.id||id(),
    hole:round.currentHole,
    par:Number(elements.par.value),
    shotNumber,
    type,
    typeOverride:elements.shotType.value==='auto'?null:type,
    club:elements.club.value.trim(),
    start:{
      lie:elements.startLie.value,
      distance:startDistance,
      unit:unitForLie(elements.startLie.value)
    },
    target:{type:type==='drive'?'landing-area':type==='putt'?'hole':'flag'},
    miss:missParts(selectedZone||'target'),
    finish:{
      location:selectedLocation,
      benchmarkLie:calculation.benchmarkLie,
      distance:calculation.endDistance,
      unit:unitForLie(calculation.benchmarkLie),
      reliefLie:RELIEF_LOCATIONS.has(selectedLocation)?calculation.benchmarkLie:null
    },
    penalty,
    details:{
      intendedShape:elements.intendedShape.value,
      contact:elements.contact.value,
      notes:elements.notes.value.trim()
    },
    calculation:{...calculation,benchmarkVersion:BENCHMARK_VERSION}
  };
}

function recalculateHoleShots(holeNumber=round.currentHole){
  const hole=round.holes[holeNumber-1];
  if(!hole) return;
  let start={lie:'tee',distance:Number(hole.teeDistance),unit:'yards'};
  const ordered=shotsForHole(holeNumber);
  const validIds=new Set();

  for(const [index,shot] of ordered.entries()){
    if(!start) break;
    const penalty=shot.penalty||penaltyForLocation(shot.finish.location);
    const finishLie=RELIEF_LOCATIONS.has(shot.finish.location)
      ? shot.finish.reliefLie||shot.finish.benchmarkLie
      : undefined;
    const calculation=calculateShot({
      startLie:start.lie,
      startDistance:start.distance,
      finishLocation:shot.finish.location,
      endDistance:shot.finish.distance,
      finishLie,
      penalty
    });
    shot.shotNumber=index+1;
    shot.par=Number(hole.par);
    shot.start={...start,unit:unitForLie(start.lie)};
    shot.type=shot.typeOverride||inferShotType({lie:start.lie,distance:start.distance,par:hole.par,shotNumber:index+1});
    shot.finish={
      ...shot.finish,
      benchmarkLie:calculation.benchmarkLie,
      distance:calculation.endDistance,
      unit:unitForLie(calculation.benchmarkLie),
      reliefLie:RELIEF_LOCATIONS.has(shot.finish.location)?calculation.benchmarkLie:null
    };
    shot.penalty=penalty;
    shot.calculation={...calculation,benchmarkVersion:BENCHMARK_VERSION};
    validIds.add(shot.id);
    start=nextShotStart(shot);
  }

  round.shots=round.shots.filter((shot)=>shot.hole!==holeNumber||validIds.has(shot.id));
}

function saveShot(){
  const shot=buildShot();
  const existingIndex=round.shots.findIndex((item)=>item.id===shot.id);
  if(existingIndex>=0){
    round.shots=round.shots.filter((item)=>item.hole!==shot.hole||item.shotNumber<=shot.shotNumber);
    const replacementIndex=round.shots.findIndex((item)=>item.id===shot.id);
    round.shots[replacementIndex]=shot;
  } else {
    round.shots.push(shot);
  }

  if(shot.club) round.recentClubs[shot.type]=shot.club;
  editingShotId=null;
  currentHole().draft=defaultDraft();
  seedNextShot();
  persist();
  restoreDraft();
  render();
  elements.message.textContent=shot.finish.location==='holed'
    ? `Hole ${round.currentHole} complete.`
    : `Stroke saved. You are now playing ${nextPlayingStroke()}.`;
  if(shot.finish.location==='holed') elements.entryPanel.scrollIntoView({behavior:'smooth',block:'start'});
}

function editShot(idToEdit){
  if(roundReadOnly) return;
  const shot=round.shots.find((item)=>item.id===idToEdit);
  if(!shot) return;
  editingShotId=idToEdit;
  elements.form.classList.remove('hidden');
  elements.complete.classList.add('hidden');
  elements.formMode.textContent=`Editing stroke ${strokeNumberForShot(shot)}`;
  elements.cancelEditButton.classList.remove('hidden');
  elements.shotType.value=shot.typeOverride||'auto';
  elements.startLie.value=shot.start.lie;
  elements.startDistance.value=shot.start.distance;
  elements.club.value=shot.club||'';
  elements.endDistance.value=shot.finish.distance;
  elements.reliefLie.value=shot.finish.reliefLie||shot.finish.benchmarkLie||'rough';
  elements.intendedShape.value=shot.details?.intendedShape||'';
  elements.contact.value=shot.details?.contact||'';
  elements.notes.value=shot.details?.notes||'';
  selectedZone=shot.miss.zone;
  selectedLocation=shot.finish.location;
  selectButton('#miss-grid','zone',selectedZone);
  selectButton('#finish-location-grid','location',selectedLocation);
  updateContext();
  elements.entryPanel.scrollIntoView({behavior:'smooth',block:'start'});
}

function cancelEdit(restore=true){
  editingShotId=null;
  elements.formMode.textContent='Next stroke';
  elements.cancelEditButton.classList.add('hidden');
  if(restore) restoreDraft();
}

function deleteShot(idToDelete){
  if(roundReadOnly) return;
  const shot=round.shots.find((item)=>item.id===idToDelete);
  if(!shot) return;
  const later=shotsForHole(shot.hole).filter((item)=>item.shotNumber>shot.shotNumber).length;
  if(!confirm(`Delete this stroke${later?` and ${later} later stroke${later===1?'':'s'}`:''} from hole ${shot.hole}?`)) return;
  round.shots=round.shots.filter((item)=>item.hole!==shot.hole||item.shotNumber<shot.shotNumber);
  renumberHole(shot.hole);
  currentHole().draft=defaultDraft();
  seedNextShot();
  cancelEdit(false);
  persist();
  restoreDraft();
  render();
}

function undoHole(){
  if(roundReadOnly) return;
  const shot=lastShot();
  if(!shot) return;
  round.shots=round.shots.filter((item)=>item.id!==shot.id);
  currentHole().draft=defaultDraft();
  seedNextShot();
  persist();
  restoreDraft();
  render();
}

function nextIncompleteHole(){
  for(let hole=round.currentHole+1;hole<=round.holeCount;hole+=1) if(!holeIsComplete(hole)) return hole;
  for(let hole=1;hole<round.currentHole;hole+=1) if(!holeIsComplete(hole)) return hole;
  return null;
}

function renderCompletePanel(){
  const summary=holeSummary();
  elements.completeTitle.textContent=`Hole ${round.currentHole} complete`;
  elements.completeScore.textContent=String(summary.score);
  elements.completeResult.textContent=scoreLabel(summary.score,currentHole().par);
  elements.completeSg.textContent=formatSg(summary.strokesGained);
  elements.completeSg.className=summary.strokesGained>=0?'sg-positive':'sg-negative';
  elements.completeDetail.textContent=`${summary.physicalStrokes} played stroke${summary.physicalStrokes===1?'':'s'}${summary.penaltyStrokes?` + ${summary.penaltyStrokes} penalty stroke${summary.penaltyStrokes===1?'':'s'}`:''}. SG check: ${summary.expectedFromTee.toFixed(2)} expected from the tee − ${summary.score} actual = ${formatSg(summary.identityStrokesGained)}.`;
  const next=nextIncompleteHole();
  if(next){
    elements.nextHoleButton.disabled=false;
    elements.nextHoleButton.textContent=`Continue to hole ${next}`;
    elements.nextHoleButton.dataset.nextHole=String(next);
  } else {
    elements.nextHoleButton.disabled=true;
    elements.nextHoleButton.textContent='Round complete';
    delete elements.nextHoleButton.dataset.nextHole;
  }
}

function finishDescription(shot){
  if(shot.finish.location==='holed') return 'Holed out';
  const position=`${titleCase(shot.finish.benchmarkLie)} ${formatDistance(shot.finish.distance)} ${unitLabel(shot.finish.unit)}`;
  if(shot.finish.location==='out-of-bounds') return `OB / lost · replay from ${position}`;
  if(RELIEF_LOCATIONS.has(shot.finish.location)) return `${titleCase(shot.finish.location)} · relief to ${position}`;
  return `${titleCase(shot.finish.location)} ${formatDistance(shot.finish.distance)} ${unitLabel(shot.finish.unit)}`;
}

function renderHoleSelector(){
  elements.holeSelector.innerHTML=round.holes.slice(0,round.holeCount).map((hole)=>{
    const summary=holeSummary(hole.number);
    const score=summary.complete?'✓':summary.score?`Score ${summary.score}`:'';
    const detail=`Par ${hole.par} · ${hole.teeDistance} yd${score?` · ${score}`:''}`;
    return `<button type="button" role="tab" aria-selected="${hole.number===round.currentHole}" aria-label="Hole ${hole.number}, ${detail}" title="${detail}" class="hole-button ${hole.number===round.currentHole?'selected':''} ${summary.score?'has-shots':''} ${summary.complete?'complete':''}" data-hole="${hole.number}"><strong>${hole.number}</strong><span>Par ${hole.par}</span><small>${hole.teeDistance} yd${summary.complete?' · ✓':''}</small></button>`;
  }).join('');
}

function renderHoleShots(){
  const shots=shotsForHole();
  const summary=holeSummary();
  elements.holeLogTitle.textContent=`Hole ${round.currentHole} strokes`;
  elements.holeScore.textContent=String(summary.score);
  elements.holeSg.textContent=formatSg(summary.strokesGained);
  elements.holeSg.className=summary.strokesGained>=0?'sg-positive':'sg-negative';

  elements.holeShotList.innerHTML=shots.length?shots.map((shot)=>{
    const playing=strokeNumberForShot(shot);
    const penalty=Number(shot.calculation.penaltyStrokes||0);
    const actions=roundReadOnly?'':`<div class="shot-actions"><button type="button" data-edit="${shot.id}">Edit</button><button type="button" data-delete="${shot.id}" class="danger-button">Delete from here</button></div>`;
    return `<article class="shot-card"><div class="shot-card-main"><span class="shot-number">${playing}</span><div><strong>${typeLabel(shot.type)}${shot.club?` · ${shot.club}`:''}${penalty?` · +${penalty} penalty`:''}</strong><p>${titleCase(shot.start.lie)} ${formatDistance(shot.start.distance)} ${unitLabel(shot.start.unit)} → ${finishDescription(shot)}</p><p class="calculation-line">Expected ${shot.calculation.expectedBefore.toFixed(2)} → ${shot.calculation.expectedAfter.toFixed(2)} · cost ${shot.calculation.strokeCost} · SG ${formatSg(shot.calculation.strokesGained)}</p></div><strong class="${shot.calculation.strokesGained>=0?'sg-positive':'sg-negative'}">${formatSg(shot.calculation.strokesGained)}</strong></div>${actions}</article>`;
  }).join(''):'<p class="empty-state">No strokes recorded on this hole. Add the tee shot above.</p>';
}

function renderMissSummary(){
  const drives=round.shots.filter((shot)=>shot.type==='drive');
  elements.missSummary.innerHTML=zones.map((zone)=>`<div>${titleCase(zone)}<strong>${drives.filter((shot)=>shot.miss.zone===zone).length}</strong></div>`).join('');
}

function render(){
  elements.date.value=round.date;
  elements.workspaceDate.value=round.date;
  renderCourseSource();
  renderRecentCourses();
  const totals=round.shots.reduce((sum,shot)=>sum+Number(shot.calculation.strokesGained||0),0);
  const driving=drivingSummary(round.shots);
  elements.total.textContent=formatSg(totals);
  elements.driveSg.textContent=formatSg(driving.sg);
  elements.fairwayRate.textContent=rate(driving.fairwayRate);
  elements.playableRate.textContent=rate(driving.playableRate);
  elements.penalties.textContent=String(driving.penalties);
  renderHoleSelector();
  renderHoleShots();
  renderMissSummary();
  if(holeIsComplete()&&!editingShotId) renderCompletePanel();
  else updateContext();
  if(activeView==='workspace') renderWorkspaceHeading();
}

document.addEventListener('click',(event)=>{
  const openRoundButton=event.target.closest('[data-open-round]');
  if(openRoundButton){
    location.hash=`#/round/${encodeURIComponent(openRoundButton.dataset.openRound)}`;
    return;
  }
  const courseButton=event.target.closest('[data-course-id]');
  if(courseButton) loadCourse(courseButton.dataset.courseId,{preferredTeeKey:courseButton.dataset.preferredTee||null});
  const teeButton=event.target.closest('[data-tee-key]');
  if(teeButton){
    const priorTeeKey=selectedTeeKey;
    chooseTee(teeButton.dataset.teeKey);
    const changingLoadedCourse=round.courseData?.courseId===selectedCourse?.id
      && round.courseData?.teeKey!==selectedTeeKey;
    if(changingLoadedCourse&&!importSelectedCourse({teeKey:selectedTeeKey})) chooseTee(priorTeeKey);
  }
  const holeButton=event.target.closest('[data-hole]');
  if(holeButton) switchHole(Number(holeButton.dataset.hole));
  const editButton=event.target.closest('[data-edit]');
  if(editButton) editShot(editButton.dataset.edit);
  const deleteButton=event.target.closest('[data-delete]');
  if(deleteButton) deleteShot(deleteButton.dataset.delete);
  const distanceButton=event.target.closest('[data-distance]');
  if(distanceButton){
    elements.endDistance.value=distanceButton.dataset.distance;
    syncShotDistanceFromRemaining();
    saveDraft();
  }
});

document.querySelectorAll('#miss-grid button').forEach((button)=>button.addEventListener('click',()=>{
  setZone(button.dataset.zone);
  updateFinishPreview();
  updateSubmitButton();
  saveDraft();
}));

document.querySelectorAll('#finish-location-grid button').forEach((button)=>button.addEventListener('click',()=>chooseLocation(button.dataset.location)));

elements.form.addEventListener('submit',(event)=>{
  event.preventDefault();
  try { saveShot(); }
  catch(error){ elements.message.textContent=error.message; }
});

elements.courseSearchForm.addEventListener('submit',(event)=>{
  event.preventDefault();
  searchCourses();
});
elements.importCourseButton.addEventListener('click',importSelectedCourse);
elements.manualCourseButton.addEventListener('click',()=>{
  selectedCourse=null;
  selectedTeeKey=null;
  elements.selectedCoursePanel.classList.add('hidden');
  elements.courseResults.innerHTML='';
  round.courseData=null;
  round.courseName='Manual round';
  if(creatingRound){
    finishRoundSetup();
    return;
  }
  persist('Manual course entry enabled');
  renderCourseSource();
  elements.courseSearchStatus.textContent='Manual entry is active. Edit the par and tee distance for each hole below; changes save locally.';
  elements.par.focus();
});

elements.shotType.addEventListener('change',()=>{ updateContext(); saveDraft(); });
elements.reliefLie.addEventListener('change',saveDraft);
[elements.startLie,elements.startDistance,elements.club,elements.intendedShape,elements.contact,elements.notes].forEach((element)=>{
  element.addEventListener('change',()=>{ saveDraft(); updateContext(); });
  element.addEventListener('input',()=>{ elements.saveStatus.textContent='Unsaved hole changes'; });
});
elements.endDistance.addEventListener('input',()=>{
  syncShotDistanceFromRemaining();
  elements.saveStatus.textContent='Unsaved hole changes';
});
elements.endDistance.addEventListener('change',()=>{ saveDraft(); updateContext(); });
elements.shotDistance.addEventListener('input',()=>{
  syncRemainingDistanceFromShot();
  elements.saveStatus.textContent='Unsaved hole changes';
});
elements.shotDistance.addEventListener('change',()=>{ saveDraft(); updateContext(); });

elements.par.addEventListener('change',()=>{
  markCourseModified();
  const hole=currentHole();
  const previousPar=Number(hole.par);
  const nextPar=Number(elements.par.value);
  const priorDefault=DEFAULT_DISTANCE_BY_PAR[previousPar];
  hole.par=nextPar;
  if(!shotsForHole().length&&Number(hole.teeDistance)===priorDefault){
    hole.teeDistance=DEFAULT_DISTANCE_BY_PAR[nextPar];
    elements.holeDistance.value=hole.teeDistance;
  }
  if(shotsForHole().length) recalculateHoleShots();
  hole.draft=defaultDraft();
  seedNextShot();
  persist(`Hole ${round.currentHole} updated`);
  restoreDraft();
  render();
});

elements.holeDistance.addEventListener('change',()=>{
  markCourseModified();
  const hole=currentHole();
  hole.teeDistance=Number(elements.holeDistance.value);
  if(shotsForHole().length) recalculateHoleShots();
  hole.draft=defaultDraft();
  seedNextShot();
  persist(`Hole ${round.currentHole} updated`);
  restoreDraft();
  render();
});

elements.date.addEventListener('change',()=>{
  round.date=elements.date.value;
  if(!creatingRound) persist();
});
elements.date.addEventListener('input',()=>{ elements.saveStatus.textContent='Unsaved changes'; });
elements.workspaceDate.addEventListener('change',()=>{
  round.date=elements.workspaceDate.value;
  elements.date.value=round.date;
  persist();
  renderWorkspaceHeading();
});

$('#undo-button').addEventListener('click',undoHole);
elements.cancelEditButton.addEventListener('click',()=>cancelEdit());
elements.editLastShotButton.addEventListener('click',()=>{ const shot=lastShot(); if(shot) editShot(shot.id); });
elements.nextHoleButton.addEventListener('click',()=>{ const next=Number(elements.nextHoleButton.dataset.nextHole); if(next) switchHole(next); });
function startNewRound(){ location.hash='#/round/new'; }

elements.newRoundButton.addEventListener('click',startNewRound);
$('#home-new-round-button').addEventListener('click',startNewRound);
$('#empty-new-round-button').addEventListener('click',startNewRound);
elements.pgaFixtureFile.addEventListener('change',()=>{
  importPgaFixtureFile(elements.pgaFixtureFile.files?.[0]);
});
elements.homeButton.addEventListener('click',()=>{ location.hash='#/rounds'; });
elements.editRoundButton.addEventListener('click',()=>{
  roundReadOnly=false;
  applyWorkspaceMode();
  restoreDraft();
  renderHoleShots();
});
elements.deleteRoundButton.addEventListener('click',()=>{
  if(!confirm(`Delete ${roundDisplayName(round)}? This round cannot be recovered.`)) return;
  roundStore.remove(round.id);
  activeView='home';
  location.hash='#/rounds';
});
window.addEventListener('beforeunload',()=>{
  if(activeView==='workspace'&&!roundReadOnly&&!editingShotId&&!holeIsComplete()) saveDraft();
});
window.addEventListener('hashchange',route);

roundStore.migrateLegacy(LEGACY_ROUND_KEYS,migrateRound);
if(!location.hash) location.hash='#/rounds';
else route();
