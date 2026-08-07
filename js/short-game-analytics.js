import { selectAggregateRounds } from './analytics.js';
import { createRoundStore } from './round-store.js';

export const SHORT_GAME_DISTANCE_BUCKETS=Object.freeze([
  {key:'0-5',label:'≤5 yd',min:0,max:5},
  {key:'6-10',label:'6–10 yd',min:5,max:10},
  {key:'11-20',label:'11–20 yd',min:10,max:20},
  {key:'21-30',label:'21–30 yd',min:20,max:30},
  {key:'31-plus',label:'31+ yd',min:30,max:Infinity}
]);

const number=(value)=>Number.isFinite(Number(value))?Number(value):0;
const sumSg=(shots)=>shots.reduce(
  (total,shot)=>total+number(shot?.calculation?.strokesGained),
  0
);

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g,(character)=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[character]);
}

function startingDistanceYards(shot) {
  if(shot?.type!=='chip') return null;
  const distance=Number(shot?.start?.distance);
  if(!Number.isFinite(distance)||distance<=0) return null;
  const unit=String(shot?.start?.unit||'yards').toLowerCase();
  return unit==='feet'||unit==='ft'?distance/3:distance;
}

function belongsToGroup(shot,group) {
  if(shot?.type!=='chip') return false;
  if(group==='sand') return shot?.start?.lie==='sand';
  if(group==='chip-pitch'){
    return shot?.start?.lie!=='sand'&&shot?.start?.lie!=='green';
  }
  return false;
}

export function shortGameDistanceBreakdown(shots=[],group='chip-pitch') {
  const eligible=shots
    .filter((shot)=>belongsToGroup(shot,group))
    .map((shot)=>({shot,distance:startingDistanceYards(shot)}))
    .filter((item)=>item.distance!==null);

  return SHORT_GAME_DISTANCE_BUCKETS.map((bucket)=>{
    const matching=eligible.filter((item)=>
      item.distance>bucket.min&&item.distance<=bucket.max
    );
    const matchingShots=matching.map((item)=>item.shot);
    const sg=sumSg(matchingShots);
    return {
      ...bucket,
      count:matchingShots.length,
      sg,
      average:matchingShots.length?sg/matchingShots.length:null
    };
  });
}

function aggregateGroup(selected,group) {
  const roundCount=selected.length;
  const breakdowns=selected.map((round)=>
    shortGameDistanceBreakdown(
      Array.isArray(round?.shots)?round.shots:[],
      group
    )
  );

  return SHORT_GAME_DISTANCE_BUCKETS.map((bucket)=>{
    const values=breakdowns.map((breakdown)=>
      breakdown.find((item)=>item.key===bucket.key)
    );
    const totalSg=values.reduce((total,item)=>total+number(item?.sg),0);
    const count=values.reduce((total,item)=>total+number(item?.count),0);
    return {
      ...bucket,
      count,
      totalSg,
      sg:roundCount?totalSg/roundCount:0,
      average:count?totalSg/count:null
    };
  });
}

export function aggregateShortGameDistance(rounds=[],limit=3) {
  const selected=rounds.slice(0,Math.max(1,Number(limit)||3));
  return {
    roundCount:selected.length,
    sand:aggregateGroup(selected,'sand'),
    chipPitch:aggregateGroup(selected,'chip-pitch')
  };
}

export function formatShortGameSg(value) {
  const numeric=number(value);
  const rounded=Math.abs(numeric)<0.005?0:numeric;
  return `${rounded>0?'+':''}${rounded.toFixed(2)}`;
}

export function shortGameDistanceChartHtml(rows=[],{
  aggregate=false,
  emptyLabel='No around-the-green strokes recorded for this range.'
}={}) {
  const totalCount=rows.reduce((total,row)=>total+number(row?.count),0);
  if(!totalCount){
    return `<p class="empty-state short-game-empty-state">${escapeHtml(emptyLabel)}</p>`;
  }

  const maximum=Math.max(.01,...rows.map((row)=>Math.abs(number(row?.sg))));
  return rows.map((row)=>{
    const sg=number(row?.sg);
    const count=number(row?.count);
    const average=row?.average===null||row?.average===undefined
      ? null
      : number(row.average);
    const width=(Math.abs(sg)/maximum)*50;
    const direction=sg>=0?'positive':'negative';
    const countLabel=`${count} stroke${count===1?'':'s'}`;
    const averageLabel=average===null?'':` · ${formatShortGameSg(average)} / stroke`;
    const valueDescription=aggregate
      ? 'average SG per selected round'
      : 'total SG for this round';
    return `<div class="sg-bar-row ${count?'':'empty-bar'}">
      <div class="sg-bar-label">
        <span>${escapeHtml(row.label)}</span>
        <small>${countLabel}${averageLabel}</small>
        <strong class="${direction==='positive'?'sg-positive':'sg-negative'}">${formatShortGameSg(sg)}</strong>
      </div>
      <div class="sg-bar-track" aria-label="${escapeHtml(row.label)}: ${formatShortGameSg(sg)} ${valueDescription} over ${countLabel}">
        <span class="sg-bar-axis"></span>
        <span class="sg-bar-fill ${direction}" style="width:${width.toFixed(2)}%"></span>
      </div>
    </div>`;
  }).join('');
}

export function roundIsCompleteForShortGame(round) {
  if(round?.status==='complete') return true;
  const holeCount=Math.max(0,Number(round?.holeCount)||0);
  const holes=Array.isArray(round?.holes)?round.holes.slice(0,holeCount):[];
  const shots=Array.isArray(round?.shots)?round.shots:[];
  if(!holes.length) return false;
  return holes.every((hole)=>{
    const holeShots=shots
      .filter((shot)=>Number(shot?.hole)===Number(hole?.number))
      .sort((left,right)=>number(left?.shotNumber)-number(right?.shotNumber));
    return holeShots.at(-1)?.finish?.location==='holed';
  });
}

function createPanel(documentRef,{id,title,subtitle,className,group}) {
  const panel=documentRef.createElement('article');
  panel.id=id;
  panel.className=`analytics-chart ${className}`;
  panel.innerHTML=`<div class="chart-heading"><h3>${title}</h3><span>${subtitle}</span></div><div class="diverging-chart" data-short-game-distance-chart="${group}"></div>`;
  return panel;
}

function ensureRoundCharts(documentRef) {
  const distanceChart=documentRef.querySelector('#distance-sg-chart');
  const charts=distanceChart?.closest('.analytics-charts');
  if(!charts) return {};

  let bunker=documentRef.querySelector('#bunker-distance-panel');
  let chipPitch=documentRef.querySelector('#chip-pitch-distance-panel');
  const putting=documentRef.querySelector('#putting-distance-panel');
  const anchor=putting?.parentElement===charts
    ? putting
    : distanceChart?.closest('.analytics-chart');

  if(!bunker){
    bunker=createPanel(documentRef,{
      id:'bunker-distance-panel',
      title:'Bunker SG by starting distance',
      subtitle:'Around-the-green shots starting in sand · total for this round',
      className:'short-game-distance-chart bunker-distance-chart',
      group:'sand'
    });
    if(anchor) anchor.insertAdjacentElement('afterend',bunker);
    else charts.append(bunker);
  }

  if(!chipPitch){
    chipPitch=createPanel(documentRef,{
      id:'chip-pitch-distance-panel',
      title:'Chip & pitch SG by starting distance',
      subtitle:'Non-sand around-the-green shots · total for this round',
      className:'short-game-distance-chart chip-pitch-distance-chart',
      group:'chip-pitch'
    });
    bunker.insertAdjacentElement('afterend',chipPitch);
  }

  return {
    sand:bunker.querySelector('[data-short-game-distance-chart="sand"]'),
    chipPitch:chipPitch.querySelector('[data-short-game-distance-chart="chip-pitch"]')
  };
}

function ensureAggregateCharts(documentRef) {
  const aggregateContent=documentRef.querySelector('#aggregate-content');
  const categoryChart=documentRef.querySelector('#aggregate-category-chart');
  const categoryPanel=categoryChart?.closest('.analytics-chart');
  if(!aggregateContent||!categoryPanel) return {};

  let bunker=documentRef.querySelector('#aggregate-bunker-distance-panel');
  let chipPitch=documentRef.querySelector('#aggregate-chip-pitch-distance-panel');
  const preferredAnchor=documentRef.querySelector('#aggregate-putting-distance-panel')
    || documentRef.querySelector('#aggregate-starting-distance-panel')
    || categoryPanel;

  if(!bunker){
    bunker=createPanel(documentRef,{
      id:'aggregate-bunker-distance-panel',
      title:'Bunker SG by starting distance',
      subtitle:'Average per selected round · around-the-green sand shots',
      className:'aggregate-chart aggregate-short-game-chart',
      group:'sand'
    });
    preferredAnchor.insertAdjacentElement('afterend',bunker);
  }

  if(!chipPitch){
    chipPitch=createPanel(documentRef,{
      id:'aggregate-chip-pitch-distance-panel',
      title:'Chip & pitch SG by starting distance',
      subtitle:'Average per selected round · non-sand around-the-green shots',
      className:'aggregate-chart aggregate-short-game-chart',
      group:'chip-pitch'
    });
    bunker.insertAdjacentElement('afterend',chipPitch);
  }

  return {
    sand:bunker.querySelector('[data-short-game-distance-chart="sand"]'),
    chipPitch:chipPitch.querySelector('[data-short-game-distance-chart="chip-pitch"]')
  };
}

function selectedRoundLimit(documentRef) {
  const selected=documentRef.querySelector('[data-round-limit].selected')
    || documentRef.querySelector('[data-round-limit][aria-pressed="true"]');
  return Math.max(1,Number(selected?.dataset?.roundLimit)||3);
}

function roundIdFromLocation(windowRef) {
  const match=String(windowRef?.location?.hash||'').match(/^#\/round\/([^/]+)$/);
  if(!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return match[1]; }
}

export function installShortGameAnalytics({
  documentRef=globalThis.document,
  windowRef=globalThis.window,
  storage=globalThis.localStorage
}={}) {
  if(!documentRef||!windowRef||!storage) return null;
  const roundStore=createRoundStore(storage);
  let scheduled=false;

  function renderHome() {
    const charts=ensureAggregateCharts(documentRef);
    if(!charts.sand&&!charts.chipPitch) return;
    const selection=selectAggregateRounds(
      roundStore.list(),
      roundIsCompleteForShortGame
    );
    const analytics=aggregateShortGameDistance(
      selection.rounds,
      selectedRoundLimit(documentRef)
    );
    if(charts.sand){
      charts.sand.innerHTML=shortGameDistanceChartHtml(analytics.sand,{
        aggregate:true,
        emptyLabel:'No around-the-green bunker shots recorded for this range.'
      });
    }
    if(charts.chipPitch){
      charts.chipPitch.innerHTML=shortGameDistanceChartHtml(analytics.chipPitch,{
        aggregate:true,
        emptyLabel:'No non-sand chips or pitches recorded for this range.'
      });
    }
  }

  function renderRound() {
    const charts=ensureRoundCharts(documentRef);
    if(!charts.sand&&!charts.chipPitch) return;
    const roundId=roundIdFromLocation(windowRef);
    const stored=roundId?roundStore.get(roundId):null;
    const shots=Array.isArray(stored?.shots)?stored.shots:[];
    const sand=shortGameDistanceBreakdown(shots,'sand');
    const chipPitch=shortGameDistanceBreakdown(shots,'chip-pitch');
    if(charts.sand){
      charts.sand.innerHTML=shortGameDistanceChartHtml(sand,{
        emptyLabel:stored
          ? 'No around-the-green bunker shots recorded in this round.'
          : 'Open a saved round to see bunker performance by distance.'
      });
    }
    if(charts.chipPitch){
      charts.chipPitch.innerHTML=shortGameDistanceChartHtml(chipPitch,{
        emptyLabel:stored
          ? 'No non-sand chips or pitches recorded in this round.'
          : 'Open a saved round to see chip and pitch performance by distance.'
      });
    }
  }

  function renderAll() {
    scheduled=false;
    renderHome();
    renderRound();
  }

  function scheduleRender() {
    if(scheduled) return;
    scheduled=true;
    const schedule=windowRef.requestAnimationFrame
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : (callback)=>setTimeout(callback,0);
    schedule(renderAll);
  }

  const clickHandler=(event)=>{
    if(event.target.closest('[data-round-limit],[data-delete-round],[data-open-round]')){
      scheduleRender();
    }
  };
  documentRef.addEventListener('click',clickHandler);
  windowRef.addEventListener('hashchange',scheduleRender);
  windowRef.addEventListener('storage',scheduleRender);

  const Observer=windowRef.MutationObserver;
  const observers=[];
  if(Observer){
    for(const selector of ['#aggregate-category-chart','#distance-sg-chart','#round-list']){
      const target=documentRef.querySelector(selector);
      if(!target) continue;
      const observer=new Observer(scheduleRender);
      observer.observe(target,{childList:true,subtree:true,characterData:true});
      observers.push(observer);
    }
  }

  scheduleRender();

  return ()=>{
    documentRef.removeEventListener('click',clickHandler);
    windowRef.removeEventListener('hashchange',scheduleRender);
    windowRef.removeEventListener('storage',scheduleRender);
    observers.forEach((observer)=>observer.disconnect());
  };
}
