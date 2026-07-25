import { calculateShot, drivingSummary, missParts, penaltyForLocation } from './calculations.js';

const STORAGE_KEY='golf-strokes-gained-round-v2';
const LEGACY_KEY='golf-strokes-gained-round-v1';
const zones=['long-left','long','long-right','left','target','right','short-left','short','short-right'];
const defaultRound=()=>({schemaVersion:2,courseName:'',date:new Date().toISOString().slice(0,10),shots:[]});
let round=loadRound();
let selectedZone=null;
let selectedLocation=null;

const $=(selector)=>document.querySelector(selector);
const elements={
  course:$('#course-name'),date:$('#round-date'),hole:$('#hole-number'),par:$('#hole-par'),shotType:$('#shot-type'),
  startLie:$('#start-lie'),startDistance:$('#start-distance'),club:$('#club'),endDistance:$('#end-distance'),
  penaltyType:$('#penalty-type'),penaltyLabel:$('#penalty-type-label'),intendedShape:$('#intended-shape'),contact:$('#contact'),notes:$('#notes'),
  form:$('#shot-form'),message:$('#form-message'),list:$('#shot-list'),total:$('#total-sg'),driveSg:$('#sg-off-tee'),
  fairwayRate:$('#fairway-rate'),playableRate:$('#playable-rate'),penalties:$('#drive-penalties'),missSummary:$('#miss-summary'),
  saveStatus:$('#save-status'),title:$('#shot-title'),context:$('#shot-context-text')
};

function id(){ return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function inferType(){
  if(elements.shotType.value!=='auto') return elements.shotType.value;
  const holeShots=round.shots.filter((s)=>s.hole===Number(elements.hole.value));
  return elements.startLie.value==='tee' && Number(elements.par.value)>=4 && holeShots.length===0 ? 'drive' : 'approach';
}
function save(){
  round.courseName=elements.course.value.trim(); round.date=elements.date.value;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(round)); elements.saveStatus.textContent='Saved locally';
}
function loadRound(){
  try {
    const current=localStorage.getItem(STORAGE_KEY); if(current) return JSON.parse(current);
    const legacy=localStorage.getItem(LEGACY_KEY); if(!legacy) return defaultRound();
    const old=JSON.parse(legacy);
    return {schemaVersion:2,courseName:old.courseName||'',date:old.date||new Date().toISOString().slice(0,10),shots:[]};
  } catch { return defaultRound(); }
}
function formatSg(value){ const v=Math.abs(value)<0.005?0:value; return `${v>0?'+':''}${v.toFixed(2)}`; }
function rate(value){ return value===null?'—':`${Math.round(value*100)}%`; }
function titleCase(value){ return value.split('-').map((part)=>part[0].toUpperCase()+part.slice(1)).join(' '); }

function updateContext(){
  const type=inferType(); elements.title.textContent=type==='drive'?'Drive':'Approach';
  elements.context.textContent=`Hole ${elements.hole.value} · Par ${elements.par.value} · ${elements.startDistance.value} yd`;
  document.querySelector('.target-zone').textContent=type==='drive'?'Target':'On target';
}
function selectButton(containerSelector, dataName, value){
  document.querySelectorAll(`${containerSelector} button`).forEach((button)=>button.classList.toggle('selected',button.dataset[dataName]===value));
}
function chooseLocation(location){
  selectedLocation=location; selectButton('#finish-location-grid','location',location);
  const isPenalty=['penalty-area','out-of-bounds'].includes(location);
  elements.penaltyLabel.classList.toggle('hidden',!isPenalty);
  if(location==='out-of-bounds') elements.penaltyType.value='out-of-bounds';
  if(location==='penalty-area') elements.penaltyType.value='penalty-area';
}

function addShot(){
  if(!selectedZone || !selectedLocation){ elements.message.textContent='Choose both a miss zone and finishing location.'; return; }
  const hole=Number(elements.hole.value);
  const shotNumber=round.shots.filter((s)=>s.hole===hole).length+1;
  const type=inferType();
  let penalty=penaltyForLocation(selectedLocation);
  if(!penalty && elements.penaltyType.value==='unplayable' && !elements.penaltyLabel.classList.contains('hidden')) penalty={type:'unplayable',strokes:1,strokeAndDistance:false};
  const calculation=calculateShot({startLie:elements.startLie.value,startDistance:Number(elements.startDistance.value),finishLocation:selectedLocation,endDistance:Number(elements.endDistance.value),penalty});
  round.shots.push({
    id:id(),hole,par:Number(elements.par.value),shotNumber,type,club:elements.club.value.trim(),
    start:{lie:elements.startLie.value,distance:Number(elements.startDistance.value),unit:'yards'},
    target:{type:type==='drive'?'landing-area':'flag'},miss:missParts(selectedZone),
    finish:{location:selectedLocation,benchmarkLie:calculation.benchmarkLie,distance:Number(elements.endDistance.value),unit:calculation.benchmarkLie==='green'?'feet':'yards'},
    penalty,details:{intendedShape:elements.intendedShape.value,contact:elements.contact.value,notes:elements.notes.value.trim()},
    calculation:{...calculation,benchmarkVersion:'prototype-v1'}
  });
  save(); carryForward(); render();
}
function carryForward(){
  const last=round.shots.at(-1); if(!last) return;
  elements.startLie.value=last.finish.benchmarkLie==='green'?'green':last.finish.benchmarkLie;
  if(![...elements.startLie.options].some((o)=>o.value===elements.startLie.value)) elements.startLie.value='rough';
  elements.startDistance.value=last.finish.distance;
  elements.endDistance.value=Math.max(1,Math.round(last.finish.distance/3));
  selectedZone=null; selectedLocation=null; selectButton('#miss-grid','zone',''); selectButton('#finish-location-grid','location','');
  elements.club.value=''; elements.notes.value=''; elements.penaltyLabel.classList.add('hidden'); elements.message.textContent='Choose a miss zone and finishing location.';
}

function renderMissSummary(){
  const drives=round.shots.filter((s)=>s.type==='drive');
  elements.missSummary.innerHTML=zones.map((zone)=>{const count=drives.filter((s)=>s.miss.zone===zone).length;return `<div>${titleCase(zone)}<strong>${count}</strong></div>`;}).join('');
}
function render(){
  elements.course.value=round.courseName; elements.date.value=round.date;
  const totals=round.shots.reduce((sum,s)=>sum+s.calculation.strokesGained,0);
  const driving=drivingSummary(round.shots);
  elements.total.textContent=formatSg(totals); elements.driveSg.textContent=formatSg(driving.sg);
  elements.fairwayRate.textContent=rate(driving.fairwayRate); elements.playableRate.textContent=rate(driving.playableRate); elements.penalties.textContent=String(driving.penalties);
  elements.list.innerHTML=round.shots.length?round.shots.map((s)=>`<tr><td>${s.hole}</td><td>${s.shotNumber}</td><td>${titleCase(s.miss.zone)}</td><td>${titleCase(s.finish.location)} · ${s.finish.distance} ${s.finish.unit==='feet'?'ft':'yd'}</td><td class="${s.calculation.strokesGained>=0?'sg-positive':'sg-negative'}">${formatSg(s.calculation.strokesGained)}</td></tr>`).join(''):'<tr class="empty-row"><td colspan="5">No shots recorded yet.</td></tr>';
  renderMissSummary(); updateContext();
}

document.querySelectorAll('#miss-grid button').forEach((button)=>button.addEventListener('click',()=>{selectedZone=button.dataset.zone;selectButton('#miss-grid','zone',selectedZone);}));
document.querySelectorAll('#finish-location-grid button').forEach((button)=>button.addEventListener('click',()=>chooseLocation(button.dataset.location)));
elements.form.addEventListener('submit',(event)=>{event.preventDefault();try{addShot();}catch(error){elements.message.textContent=error.message;}});
[elements.hole,elements.par,elements.shotType,elements.startLie,elements.startDistance].forEach((element)=>element.addEventListener('change',updateContext));
[elements.course,elements.date].forEach((element)=>{element.addEventListener('change',save);element.addEventListener('input',()=>elements.saveStatus.textContent='Unsaved changes');});
$('#undo-button').addEventListener('click',()=>{round.shots.pop();save();render();});
$('#new-round-button').addEventListener('click',()=>{if(!confirm('Start a new round and erase the locally saved round?'))return;round=defaultRound();localStorage.removeItem(STORAGE_KEY);selectedZone=null;selectedLocation=null;render();});
render();
