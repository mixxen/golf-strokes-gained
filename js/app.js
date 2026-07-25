import { calculateShot, drivingSummary, inferShotType, missParts, nextShotStart, penaltyForLocation } from './calculations.js';

const STORAGE_KEY='golf-strokes-gained-round-v4';
const PRIOR_KEYS=['golf-strokes-gained-round-v3','golf-strokes-gained-round-v2'];
const zones=['long-left','long','long-right','left','target','right','short-left','short','short-right'];
const defaultDraft=()=>({shotType:'auto',startLie:'tee',startDistance:400,club:'',endDistance:150,zone:null,location:null,penaltyType:'penalty-area',intendedShape:'',contact:'',notes:''});
const defaultHole=(number)=>({number,par:4,teeDistance:400,draft:defaultDraft()});
const defaultRound=()=>({schemaVersion:4,courseName:'',date:new Date().toISOString().slice(0,10),currentHole:1,holes:Array.from({length:18},(_,i)=>defaultHole(i+1)),shots:[]});

let round=loadRound();
let selectedZone=null;
let selectedLocation=null;
let editingShotId=null;

const $=(selector)=>document.querySelector(selector);
const elements={
  course:$('#course-name'),date:$('#round-date'),par:$('#hole-par'),holeDistance:$('#hole-distance'),holeSelector:$('#hole-selector'),holeSaveState:$('#hole-save-state'),
  holeShotCount:$('#hole-shot-count'),holeSg:$('#hole-sg'),holeLogTitle:$('#hole-log-title'),holeShotList:$('#hole-shot-list'),shotType:$('#shot-type'),
  startLie:$('#start-lie'),startDistance:$('#start-distance'),startUnit:$('#start-unit'),club:$('#club'),endDistance:$('#end-distance'),endUnit:$('#end-unit'),endDistanceLabel:$('#end-distance-label'),
  penaltyType:$('#penalty-type'),penaltyLabel:$('#penalty-type-label'),intendedShape:$('#intended-shape'),contact:$('#contact'),notes:$('#notes'),form:$('#shot-form'),
  message:$('#form-message'),sequenceMessage:$('#sequence-message'),complete:$('#hole-complete'),entryPanel:$('#shot-entry-panel'),total:$('#total-sg'),driveSg:$('#sg-off-tee'),
  fairwayRate:$('#fairway-rate'),playableRate:$('#playable-rate'),penalties:$('#drive-penalties'),missSummary:$('#miss-summary'),saveStatus:$('#save-status'),
  title:$('#shot-title'),context:$('#shot-context-text'),formMode:$('#form-mode-label'),saveShotButton:$('#save-shot-button'),cancelEditButton:$('#cancel-edit-button')
};

function id(){ return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function currentHole(){ return round.holes[round.currentHole-1]; }
function shotsForHole(hole=round.currentHole){ return round.shots.filter((shot)=>shot.hole===hole).sort((a,b)=>a.shotNumber-b.shotNumber); }
function titleCase(value=''){ return value.split('-').map((part)=>part ? part[0].toUpperCase()+part.slice(1) : '').join(' '); }
function formatSg(value){ const v=Math.abs(value)<0.005?0:value; return `${v>0?'+':''}${v.toFixed(2)}`; }
function rate(value){ return value===null?'—':`${Math.round(value*100)}%`; }
function unitForLie(lie){ return lie==='green'?'feet':'yards'; }
function unitLabel(unit){ return unit==='feet'?'ft':'yd'; }

function migrateRound(data){
  const base=defaultRound();
  if(!data) return base;
  base.courseName=data.courseName||''; base.date=data.date||base.date; base.shots=Array.isArray(data.shots)?data.shots:[];
  if(Array.isArray(data.holes)) base.holes=base.holes.map((hole,index)=>({...hole,...data.holes[index],draft:{...hole.draft,...data.holes[index]?.draft}}));
  base.currentHole=Math.min(18,Math.max(1,Number(data.currentHole)||1));
  base.shots.forEach((shot)=>{ const hole=base.holes[shot.hole-1]; if(hole){ hole.par=shot.par||hole.par; if(shot.shotNumber===1) hole.teeDistance=shot.start?.distance||hole.teeDistance; }});
  return base;
}
function loadRound(){
  try {
    const raw=localStorage.getItem(STORAGE_KEY)||PRIOR_KEYS.map((key)=>localStorage.getItem(key)).find(Boolean)||'null';
    return migrateRound(JSON.parse(raw));
  } catch { return defaultRound(); }
}
function persist(message='Saved locally'){
  round.courseName=elements.course.value.trim(); round.date=elements.date.value;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(round)); elements.saveStatus.textContent=message;
}
function selectButton(containerSelector,dataName,value){
  document.querySelectorAll(`${containerSelector} button`).forEach((button)=>button.classList.toggle('selected',button.dataset[dataName]===value));
}
function lastShot(){ return shotsForHole().at(-1)||null; }
function holeIsComplete(){ return lastShot()?.finish.location==='holed'; }
function expectedStart(){
  const last=lastShot();
  if(!last) return {lie:'tee',distance:currentHole().teeDistance,unit:'yards'};
  return nextShotStart(last);
}
function inferredType(){
  if(elements.shotType.value!=='auto') return elements.shotType.value;
  return inferShotType({lie:elements.startLie.value,distance:Number(elements.startDistance.value),par:Number(elements.par.value),shotNumber:editingShotId?(round.shots.find((s)=>s.id===editingShotId)?.shotNumber||1):shotsForHole().length+1});
}
function typeLabel(type){ return ({drive:'Drive',approach:'Approach',chip:'Chip / short game',putt:'Putt'})[type]||titleCase(type); }

function chooseLocation(location){
  selectedLocation=location; selectButton('#finish-location-grid','location',location);
  const isPenalty=['penalty-area','out-of-bounds'].includes(location); elements.penaltyLabel.classList.toggle('hidden',!isPenalty);
  if(isPenalty) elements.penaltyType.value=location;
  const holed=location==='holed'; elements.endDistance.disabled=holed; if(holed) elements.endDistance.value=0;
  const finishUnit=location==='green'?'feet':'yards'; elements.endUnit.textContent=unitLabel(finishUnit);
  saveDraft();
}
function updateContext(){
  const type=inferredType(); const shotNumber=editingShotId?(round.shots.find((s)=>s.id===editingShotId)?.shotNumber||1):shotsForHole().length+1;
  elements.title.textContent=typeLabel(type); elements.context.textContent=`Hole ${round.currentHole} · Shot ${shotNumber} · ${elements.startDistance.value} ${unitLabel(unitForLie(elements.startLie.value))}`;
  $('.target-zone').textContent=type==='drive'?'Target':type==='putt'?'Holed line':'On target';
  elements.startUnit.textContent=unitLabel(unitForLie(elements.startLie.value));
  elements.startLie.disabled=!editingShotId; elements.startDistance.readOnly=!editingShotId;
  elements.sequenceMessage.textContent=editingShotId?'Editing this shot will remove any later shots on the hole so the sequence remains consistent.':`Shot ${shotNumber} starts where shot ${Math.max(0,shotNumber-1)} finished. Save the result to create the next shot automatically.`;
}
function captureDraft(){
  return {shotType:elements.shotType.value,startLie:elements.startLie.value,startDistance:Number(elements.startDistance.value),club:elements.club.value,endDistance:Number(elements.endDistance.value),zone:selectedZone,location:selectedLocation,penaltyType:elements.penaltyType.value,intendedShape:elements.intendedShape.value,contact:elements.contact.value,notes:elements.notes.value};
}
function saveDraft(){
  const hole=currentHole(); hole.par=Number(elements.par.value); hole.teeDistance=Number(elements.holeDistance.value); hole.draft=captureDraft();
  persist(`Hole ${round.currentHole} saved`); elements.holeSaveState.textContent=`Hole ${round.currentHole} saved`;
}
function seedNextShot(){
  const start=expectedStart();
  if(!start) return;
  const draft=currentHole().draft||defaultDraft();
  draft.startLie=start.lie; draft.startDistance=start.distance; draft.shotType='auto'; draft.club=''; draft.endDistance=start.lie==='green'?Math.max(1,Math.round(start.distance/2)):Math.max(1,Math.round(start.distance/3));
  draft.zone=null; draft.location=null; draft.notes=''; currentHole().draft=draft;
}
function restoreDraft(){
  if(holeIsComplete()){ elements.form.classList.add('hidden'); elements.complete.classList.remove('hidden'); updateContext(); return; }
  elements.form.classList.remove('hidden'); elements.complete.classList.add('hidden'); seedNextShot();
  const hole=currentHole(); const draft=hole.draft||defaultDraft();
  elements.par.value=hole.par; elements.holeDistance.value=hole.teeDistance; elements.shotType.value=draft.shotType; elements.startLie.value=draft.startLie; elements.startDistance.value=draft.startDistance;
  elements.club.value=draft.club; elements.endDistance.value=draft.endDistance; elements.endDistance.disabled=false; elements.penaltyType.value=draft.penaltyType;
  elements.intendedShape.value=draft.intendedShape; elements.contact.value=draft.contact; elements.notes.value=draft.notes;
  selectedZone=draft.zone; selectedLocation=draft.location; selectButton('#miss-grid','zone',selectedZone); selectButton('#finish-location-grid','location',selectedLocation);
  elements.penaltyLabel.classList.toggle('hidden',!['penalty-area','out-of-bounds'].includes(selectedLocation));
  elements.endUnit.textContent=unitLabel(selectedLocation==='green'?'feet':'yards'); updateContext();
}
function switchHole(number){
  if(number===round.currentHole) return;
  if(!editingShotId) saveDraft(); cancelEdit(false); round.currentHole=number; restoreDraft(); persist(`Hole ${number} loaded`); render();
}
function renumberHole(hole){ shotsForHole(hole).forEach((shot,index)=>{shot.shotNumber=index+1;}); }
function buildShot(){
  if(!selectedZone||!selectedLocation) throw new Error('Choose both a miss zone and finishing location.');
  const existing=editingShotId?round.shots.find((shot)=>shot.id===editingShotId):null;
  const shotNumber=existing?.shotNumber||shotsForHole().length+1; const type=inferredType();
  let penalty=penaltyForLocation(selectedLocation);
  if(!penalty&&elements.penaltyType.value==='unplayable'&&!elements.penaltyLabel.classList.contains('hidden')) penalty={type:'unplayable',strokes:1,strokeAndDistance:false};
  const endDistance=selectedLocation==='holed'?0:Number(elements.endDistance.value);
  const calculation=calculateShot({startLie:elements.startLie.value,startDistance:Number(elements.startDistance.value),finishLocation:selectedLocation,endDistance,penalty});
  return {id:existing?.id||id(),hole:round.currentHole,par:Number(elements.par.value),shotNumber,type,club:elements.club.value.trim(),
    start:{lie:elements.startLie.value,distance:Number(elements.startDistance.value),unit:unitForLie(elements.startLie.value)},target:{type:type==='drive'?'landing-area':type==='putt'?'hole':'flag'},miss:missParts(selectedZone),
    finish:{location:selectedLocation,benchmarkLie:calculation.benchmarkLie,distance:endDistance,unit:calculation.benchmarkLie==='green'?'feet':'yards'},penalty,
    details:{intendedShape:elements.intendedShape.value,contact:elements.contact.value,notes:elements.notes.value.trim()},calculation:{...calculation,benchmarkVersion:'prototype-v1'}};
}
function saveShot(){
  const shot=buildShot(); const existingIndex=round.shots.findIndex((item)=>item.id===shot.id);
  if(existingIndex>=0){ round.shots=round.shots.filter((item)=>item.hole!==shot.hole||item.shotNumber<=shot.shotNumber); const replaceIndex=round.shots.findIndex((item)=>item.id===shot.id); round.shots[replaceIndex]=shot; }
  else round.shots.push(shot);
  editingShotId=null; currentHole().draft=defaultDraft(); seedNextShot(); persist(); restoreDraft(); render();
  elements.message.textContent=shot.finish.location==='holed'?'Hole complete.':'Shot saved. Add the next shot from the new position.';
}
function editShot(idToEdit){
  const shot=round.shots.find((item)=>item.id===idToEdit); if(!shot) return;
  editingShotId=idToEdit; elements.form.classList.remove('hidden'); elements.complete.classList.add('hidden'); elements.formMode.textContent=`Editing shot ${shot.shotNumber}`; elements.saveShotButton.textContent='Save and rebuild sequence'; elements.cancelEditButton.classList.remove('hidden');
  elements.shotType.value=shot.type; elements.startLie.value=shot.start.lie; elements.startDistance.value=shot.start.distance; elements.club.value=shot.club||''; elements.endDistance.value=shot.finish.distance;
  elements.intendedShape.value=shot.details?.intendedShape||''; elements.contact.value=shot.details?.contact||''; elements.notes.value=shot.details?.notes||'';
  selectedZone=shot.miss.zone; selectedLocation=shot.finish.location; selectButton('#miss-grid','zone',selectedZone); chooseLocation(selectedLocation); updateContext(); elements.entryPanel.scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelEdit(restore=true){ editingShotId=null; elements.formMode.textContent='Next shot'; elements.saveShotButton.textContent='Add next shot'; elements.cancelEditButton.classList.add('hidden'); if(restore) restoreDraft(); }
function deleteShot(idToDelete){
  const shot=round.shots.find((item)=>item.id===idToDelete); if(!shot) return;
  const later=shotsForHole(shot.hole).filter((item)=>item.shotNumber>shot.shotNumber).length;
  if(!confirm(`Delete shot ${shot.shotNumber}${later?` and ${later} later shot${later===1?'':'s'}`:''} from hole ${shot.hole}?`)) return;
  round.shots=round.shots.filter((item)=>item.hole!==shot.hole||item.shotNumber<shot.shotNumber); renumberHole(shot.hole); currentHole().draft=defaultDraft(); seedNextShot(); cancelEdit(false); persist(); restoreDraft(); render();
}
function undoHole(){ const shot=lastShot(); if(!shot)return; round.shots=round.shots.filter((item)=>item.id!==shot.id); currentHole().draft=defaultDraft(); seedNextShot(); persist(); restoreDraft(); render(); }

function renderHoleSelector(){
  elements.holeSelector.innerHTML=round.holes.map((hole)=>{const count=shotsForHole(hole.number).length;const complete=shotsForHole(hole.number).at(-1)?.finish.location==='holed';return `<button type="button" role="tab" aria-selected="${hole.number===round.currentHole}" class="hole-button ${hole.number===round.currentHole?'selected':''} ${count?'has-shots':''} ${complete?'complete':''}" data-hole="${hole.number}"><strong>${hole.number}</strong><span>${complete?'✓':count||'—'}</span></button>`;}).join('');
}
function renderHoleShots(){
  const shots=shotsForHole(); elements.holeLogTitle.textContent=`Hole ${round.currentHole} shots`; elements.holeShotCount.textContent=shots.length;
  const sg=shots.reduce((sum,shot)=>sum+shot.calculation.strokesGained,0); elements.holeSg.textContent=formatSg(sg); elements.holeSg.className=sg>=0?'sg-positive':'sg-negative';
  elements.holeShotList.innerHTML=shots.length?shots.map((shot)=>`<article class="shot-card"><div class="shot-card-main"><span class="shot-number">${shot.shotNumber}</span><div><strong>${typeLabel(shot.type)}${shot.club?` · ${shot.club}`:''}</strong><p>${titleCase(shot.start.lie)} ${shot.start.distance} ${unitLabel(shot.start.unit)} → ${titleCase(shot.finish.location)}${shot.finish.location==='holed'?'':` ${shot.finish.distance} ${unitLabel(shot.finish.unit)}`}</p></div><strong class="${shot.calculation.strokesGained>=0?'sg-positive':'sg-negative'}">${formatSg(shot.calculation.strokesGained)}</strong></div><div class="shot-actions"><button type="button" data-edit="${shot.id}">Edit</button><button type="button" data-delete="${shot.id}" class="danger-button">Delete from here</button></div></article>`).join(''):'<p class="empty-state">No shots recorded on this hole. Add the tee shot above.</p>';
}
function renderMissSummary(){ const drives=round.shots.filter((shot)=>shot.type==='drive'); elements.missSummary.innerHTML=zones.map((zone)=>`<div>${titleCase(zone)}<strong>${drives.filter((shot)=>shot.miss.zone===zone).length}</strong></div>`).join(''); }
function render(){
  elements.course.value=round.courseName; elements.date.value=round.date; const totals=round.shots.reduce((sum,shot)=>sum+shot.calculation.strokesGained,0); const driving=drivingSummary(round.shots);
  elements.total.textContent=formatSg(totals); elements.driveSg.textContent=formatSg(driving.sg); elements.fairwayRate.textContent=rate(driving.fairwayRate); elements.playableRate.textContent=rate(driving.playableRate); elements.penalties.textContent=String(driving.penalties);
  renderHoleSelector(); renderHoleShots(); renderMissSummary(); updateContext();
}

document.addEventListener('click',(event)=>{ const holeButton=event.target.closest('[data-hole]'); if(holeButton) switchHole(Number(holeButton.dataset.hole)); const editButton=event.target.closest('[data-edit]'); if(editButton) editShot(editButton.dataset.edit); const deleteButton=event.target.closest('[data-delete]'); if(deleteButton) deleteShot(deleteButton.dataset.delete); });
document.querySelectorAll('#miss-grid button').forEach((button)=>button.addEventListener('click',()=>{selectedZone=button.dataset.zone;selectButton('#miss-grid','zone',selectedZone);saveDraft();}));
document.querySelectorAll('#finish-location-grid button').forEach((button)=>button.addEventListener('click',()=>chooseLocation(button.dataset.location)));
elements.form.addEventListener('submit',(event)=>{event.preventDefault();try{saveShot();}catch(error){elements.message.textContent=error.message;}});
[elements.par,elements.holeDistance,elements.shotType,elements.startLie,elements.startDistance,elements.club,elements.endDistance,elements.penaltyType,elements.intendedShape,elements.contact,elements.notes].forEach((element)=>{element.addEventListener('change',()=>{saveDraft();updateContext();});element.addEventListener('input',()=>{elements.saveStatus.textContent='Unsaved hole changes';});});
[elements.course,elements.date].forEach((element)=>{element.addEventListener('change',()=>persist());element.addEventListener('input',()=>elements.saveStatus.textContent='Unsaved changes');});
$('#undo-button').addEventListener('click',undoHole); elements.cancelEditButton.addEventListener('click',()=>cancelEdit());
$('#new-round-button').addEventListener('click',()=>{if(!confirm('Start a new round and erase the locally saved round?'))return;round=defaultRound();localStorage.removeItem(STORAGE_KEY);selectedZone=null;selectedLocation=null;editingShotId=null;restoreDraft();render();});
window.addEventListener('beforeunload',()=>{if(!editingShotId)saveDraft();});
restoreDraft(); render();
