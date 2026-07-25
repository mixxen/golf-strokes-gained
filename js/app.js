import { calculateShot, drivingSummary, missParts, penaltyForLocation } from './calculations.js';

const STORAGE_KEY='golf-strokes-gained-round-v3';
const PRIOR_KEY='golf-strokes-gained-round-v2';
const zones=['long-left','long','long-right','left','target','right','short-left','short','short-right'];
const defaultHole=(number)=>({number,par:number===1?4:4,teeDistance:400,draft:{shotType:'auto',startLie:'tee',startDistance:400,club:'',endDistance:150,zone:null,location:null,penaltyType:'penalty-area',intendedShape:'',contact:'',notes:''}});
const defaultRound=()=>({schemaVersion:3,courseName:'',date:new Date().toISOString().slice(0,10),currentHole:1,holes:Array.from({length:18},(_,i)=>defaultHole(i+1)),shots:[]});
let round=loadRound();
let selectedZone=null;
let selectedLocation=null;
let editingShotId=null;

const $=(selector)=>document.querySelector(selector);
const elements={
  course:$('#course-name'),date:$('#round-date'),par:$('#hole-par'),holeDistance:$('#hole-distance'),holeSelector:$('#hole-selector'),holeSaveState:$('#hole-save-state'),
  holeShotCount:$('#hole-shot-count'),holeSg:$('#hole-sg'),holeLogTitle:$('#hole-log-title'),holeShotList:$('#hole-shot-list'),shotType:$('#shot-type'),
  startLie:$('#start-lie'),startDistance:$('#start-distance'),club:$('#club'),endDistance:$('#end-distance'),penaltyType:$('#penalty-type'),penaltyLabel:$('#penalty-type-label'),
  intendedShape:$('#intended-shape'),contact:$('#contact'),notes:$('#notes'),form:$('#shot-form'),message:$('#form-message'),total:$('#total-sg'),driveSg:$('#sg-off-tee'),
  fairwayRate:$('#fairway-rate'),playableRate:$('#playable-rate'),penalties:$('#drive-penalties'),missSummary:$('#miss-summary'),saveStatus:$('#save-status'),
  title:$('#shot-title'),context:$('#shot-context-text'),formMode:$('#form-mode-label'),saveShotButton:$('#save-shot-button'),cancelEditButton:$('#cancel-edit-button')
};

function id(){ return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function currentHole(){ return round.holes[round.currentHole-1]; }
function shotsForHole(hole=round.currentHole){ return round.shots.filter((shot)=>shot.hole===hole).sort((a,b)=>a.shotNumber-b.shotNumber); }
function titleCase(value){ return value.split('-').map((part)=>part[0].toUpperCase()+part.slice(1)).join(' '); }
function formatSg(value){ const v=Math.abs(value)<0.005?0:value; return `${v>0?'+':''}${v.toFixed(2)}`; }
function rate(value){ return value===null?'—':`${Math.round(value*100)}%`; }

function migrateRound(data){
  const base=defaultRound();
  if(!data) return base;
  base.courseName=data.courseName||''; base.date=data.date||base.date; base.shots=Array.isArray(data.shots)?data.shots:[];
  if(Array.isArray(data.holes)) base.holes=base.holes.map((hole,index)=>({...hole,...data.holes[index],draft:{...hole.draft,...data.holes[index]?.draft}}));
  base.currentHole=Number(data.currentHole)||1;
  base.shots.forEach((shot)=>{const hole=base.holes[shot.hole-1];if(hole){hole.par=shot.par||hole.par;if(shot.shotNumber===1)hole.teeDistance=shot.start?.distance||hole.teeDistance;}});
  return base;
}
function loadRound(){
  try { return migrateRound(JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(PRIOR_KEY)||'null')); }
  catch { return defaultRound(); }
}
function persist(message='Saved locally'){
  round.courseName=elements.course.value.trim(); round.date=elements.date.value;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(round)); elements.saveStatus.textContent=message;
}
function selectButton(containerSelector,dataName,value){
  document.querySelectorAll(`${containerSelector} button`).forEach((button)=>button.classList.toggle('selected',button.dataset[dataName]===value));
}
function chooseLocation(location){
  selectedLocation=location; selectButton('#finish-location-grid','location',location);
  const isPenalty=['penalty-area','out-of-bounds'].includes(location); elements.penaltyLabel.classList.toggle('hidden',!isPenalty);
  if(isPenalty) elements.penaltyType.value=location;
  saveDraft();
}
function inferType(){
  if(elements.shotType.value!=='auto') return elements.shotType.value;
  return elements.startLie.value==='tee' && Number(elements.par.value)>=4 && shotsForHole().length===0 ? 'drive' : 'approach';
}
function updateContext(){
  const type=inferType(); elements.title.textContent=type==='drive'?'Drive':'Approach';
  elements.context.textContent=`Hole ${round.currentHole} · Par ${elements.par.value} · ${elements.startDistance.value} yd`;
  $('.target-zone').textContent=type==='drive'?'Target':'On target';
}
function captureDraft(){
  return {shotType:elements.shotType.value,startLie:elements.startLie.value,startDistance:Number(elements.startDistance.value),club:elements.club.value,endDistance:Number(elements.endDistance.value),zone:selectedZone,location:selectedLocation,penaltyType:elements.penaltyType.value,intendedShape:elements.intendedShape.value,contact:elements.contact.value,notes:elements.notes.value};
}
function saveDraft(){
  const hole=currentHole(); hole.par=Number(elements.par.value); hole.teeDistance=Number(elements.holeDistance.value); hole.draft=captureDraft();
  persist(`Hole ${round.currentHole} saved`); elements.holeSaveState.textContent=`Hole ${round.currentHole} saved`;
}
function restoreDraft(){
  const hole=currentHole(); const draft=hole.draft||defaultHole(hole.number).draft;
  elements.par.value=hole.par; elements.holeDistance.value=hole.teeDistance; elements.shotType.value=draft.shotType; elements.startLie.value=draft.startLie;
  elements.startDistance.value=draft.startDistance; elements.club.value=draft.club; elements.endDistance.value=draft.endDistance; elements.penaltyType.value=draft.penaltyType;
  elements.intendedShape.value=draft.intendedShape; elements.contact.value=draft.contact; elements.notes.value=draft.notes;
  selectedZone=draft.zone; selectedLocation=draft.location; selectButton('#miss-grid','zone',selectedZone); selectButton('#finish-location-grid','location',selectedLocation);
  elements.penaltyLabel.classList.toggle('hidden',!['penalty-area','out-of-bounds'].includes(selectedLocation));
  updateContext();
}
function switchHole(number){
  if(number===round.currentHole) return;
  saveDraft(); cancelEdit(false); round.currentHole=number; restoreDraft(); persist(`Hole ${number} loaded`); render();
}
function renumberHole(hole){ shotsForHole(hole).forEach((shot,index)=>{shot.shotNumber=index+1;}); }
function buildShot(){
  if(!selectedZone||!selectedLocation) throw new Error('Choose both a miss zone and finishing location.');
  const existing=editingShotId?round.shots.find((shot)=>shot.id===editingShotId):null;
  const shotNumber=existing?.shotNumber||shotsForHole().length+1; const type=inferType();
  let penalty=penaltyForLocation(selectedLocation);
  if(!penalty&&elements.penaltyType.value==='unplayable'&&!elements.penaltyLabel.classList.contains('hidden')) penalty={type:'unplayable',strokes:1,strokeAndDistance:false};
  const calculation=calculateShot({startLie:elements.startLie.value,startDistance:Number(elements.startDistance.value),finishLocation:selectedLocation,endDistance:Number(elements.endDistance.value),penalty});
  return {id:existing?.id||id(),hole:round.currentHole,par:Number(elements.par.value),shotNumber,type,club:elements.club.value.trim(),
    start:{lie:elements.startLie.value,distance:Number(elements.startDistance.value),unit:'yards'},target:{type:type==='drive'?'landing-area':'flag'},miss:missParts(selectedZone),
    finish:{location:selectedLocation,benchmarkLie:calculation.benchmarkLie,distance:Number(elements.endDistance.value),unit:calculation.benchmarkLie==='green'?'feet':'yards'},penalty,
    details:{intendedShape:elements.intendedShape.value,contact:elements.contact.value,notes:elements.notes.value.trim()},calculation:{...calculation,benchmarkVersion:'prototype-v1'}};
}
function saveShot(){
  const shot=buildShot(); const index=round.shots.findIndex((item)=>item.id===shot.id);
  if(index>=0) round.shots[index]=shot; else round.shots.push(shot);
  editingShotId=null; currentHole().draft={...defaultHole(round.currentHole).draft,startLie:shot.finish.benchmarkLie,startDistance:shot.finish.distance,endDistance:Math.max(1,Math.round(shot.finish.distance/3))};
  persist(); restoreDraft(); render();
}
function editShot(idToEdit){
  saveDraft(); const shot=round.shots.find((item)=>item.id===idToEdit); if(!shot) return;
  editingShotId=idToEdit; elements.formMode.textContent=`Editing shot ${shot.shotNumber}`; elements.saveShotButton.textContent='Save changes'; elements.cancelEditButton.classList.remove('hidden');
  elements.shotType.value=shot.type; elements.startLie.value=shot.start.lie; elements.startDistance.value=shot.start.distance; elements.club.value=shot.club||''; elements.endDistance.value=shot.finish.distance;
  elements.intendedShape.value=shot.details?.intendedShape||''; elements.contact.value=shot.details?.contact||''; elements.notes.value=shot.details?.notes||'';
  selectedZone=shot.miss.zone; selectedLocation=shot.finish.location; selectButton('#miss-grid','zone',selectedZone); chooseLocation(selectedLocation); updateContext(); elements.form.scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelEdit(restore=true){ editingShotId=null; elements.formMode.textContent='Next shot'; elements.saveShotButton.textContent='Save shot'; elements.cancelEditButton.classList.add('hidden'); if(restore) restoreDraft(); }
function deleteShot(idToDelete){
  const shot=round.shots.find((item)=>item.id===idToDelete); if(!shot||!confirm(`Delete shot ${shot.shotNumber} from hole ${shot.hole}?`)) return;
  round.shots=round.shots.filter((item)=>item.id!==idToDelete); renumberHole(shot.hole); if(editingShotId===idToDelete) cancelEdit(); persist(); render();
}
function undoHole(){ const shots=shotsForHole(); if(!shots.length)return; round.shots=round.shots.filter((shot)=>shot.id!==shots.at(-1).id); persist(); render(); }

function renderHoleSelector(){
  elements.holeSelector.innerHTML=round.holes.map((hole)=>{const count=shotsForHole(hole.number).length;return `<button type="button" role="tab" aria-selected="${hole.number===round.currentHole}" class="hole-button ${hole.number===round.currentHole?'selected':''} ${count?'has-shots':''}" data-hole="${hole.number}"><strong>${hole.number}</strong><span>${count||'—'}</span></button>`;}).join('');
}
function renderHoleShots(){
  const shots=shotsForHole(); elements.holeLogTitle.textContent=`Hole ${round.currentHole} shots`; elements.holeShotCount.textContent=shots.length;
  const sg=shots.reduce((sum,shot)=>sum+shot.calculation.strokesGained,0); elements.holeSg.textContent=formatSg(sg); elements.holeSg.className=sg>=0?'sg-positive':'sg-negative';
  elements.holeShotList.innerHTML=shots.length?shots.map((shot)=>`<article class="shot-card"><div class="shot-card-main"><span class="shot-number">${shot.shotNumber}</span><div><strong>${shot.club||titleCase(shot.type)}</strong><p>${titleCase(shot.miss.zone)} · ${titleCase(shot.finish.location)} · ${shot.finish.distance} ${shot.finish.unit==='feet'?'ft':'yd'}</p></div><strong class="${shot.calculation.strokesGained>=0?'sg-positive':'sg-negative'}">${formatSg(shot.calculation.strokesGained)}</strong></div><div class="shot-actions"><button type="button" data-edit="${shot.id}">Edit</button><button type="button" data-delete="${shot.id}" class="danger-button">Delete</button></div></article>`).join(''):'<p class="empty-state">No shots recorded on this hole.</p>';
}
function renderMissSummary(){
  const drives=round.shots.filter((shot)=>shot.type==='drive'); elements.missSummary.innerHTML=zones.map((zone)=>`<div>${titleCase(zone)}<strong>${drives.filter((shot)=>shot.miss.zone===zone).length}</strong></div>`).join('');
}
function render(){
  elements.course.value=round.courseName; elements.date.value=round.date; const totals=round.shots.reduce((sum,shot)=>sum+shot.calculation.strokesGained,0); const driving=drivingSummary(round.shots);
  elements.total.textContent=formatSg(totals); elements.driveSg.textContent=formatSg(driving.sg); elements.fairwayRate.textContent=rate(driving.fairwayRate); elements.playableRate.textContent=rate(driving.playableRate); elements.penalties.textContent=String(driving.penalties);
  renderHoleSelector(); renderHoleShots(); renderMissSummary(); updateContext();
}

document.addEventListener('click',(event)=>{
  const holeButton=event.target.closest('[data-hole]'); if(holeButton) switchHole(Number(holeButton.dataset.hole));
  const editButton=event.target.closest('[data-edit]'); if(editButton) editShot(editButton.dataset.edit);
  const deleteButton=event.target.closest('[data-delete]'); if(deleteButton) deleteShot(deleteButton.dataset.delete);
});
document.querySelectorAll('#miss-grid button').forEach((button)=>button.addEventListener('click',()=>{selectedZone=button.dataset.zone;selectButton('#miss-grid','zone',selectedZone);saveDraft();}));
document.querySelectorAll('#finish-location-grid button').forEach((button)=>button.addEventListener('click',()=>chooseLocation(button.dataset.location)));
elements.form.addEventListener('submit',(event)=>{event.preventDefault();try{saveShot();}catch(error){elements.message.textContent=error.message;}});
[elements.par,elements.holeDistance,elements.shotType,elements.startLie,elements.startDistance,elements.club,elements.endDistance,elements.penaltyType,elements.intendedShape,elements.contact,elements.notes].forEach((element)=>{element.addEventListener('change',()=>{saveDraft();updateContext();});element.addEventListener('input',()=>{elements.saveStatus.textContent='Unsaved hole changes';});});
[elements.course,elements.date].forEach((element)=>{element.addEventListener('change',()=>persist());element.addEventListener('input',()=>elements.saveStatus.textContent='Unsaved changes');});
$('#undo-button').addEventListener('click',undoHole); elements.cancelEditButton.addEventListener('click',()=>cancelEdit());
$('#new-round-button').addEventListener('click',()=>{if(!confirm('Start a new round and erase the locally saved round?'))return;round=defaultRound();localStorage.removeItem(STORAGE_KEY);selectedZone=null;selectedLocation=null;editingShotId=null;restoreDraft();render();});
window.addEventListener('beforeunload',saveDraft);
restoreDraft(); render();