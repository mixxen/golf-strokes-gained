import {
  DISTANCE_BUCKETS,
  distanceBreakdown,
  selectAggregateRounds
} from './analytics.js';
import { createRoundStore } from './round-store.js';

const number=(value)=>Number.isFinite(Number(value))?Number(value):0;

export function formatDistanceSg(value) {
  const numeric=number(value);
  const rounded=Math.abs(numeric)<0.005?0:numeric;
  return `${rounded>0?'+':''}${rounded.toFixed(2)}`;
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g,(character)=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[character]);
}

export function aggregateStartingDistance(rounds=[],limit=3) {
  const selected=rounds.slice(0,Math.max(1,Number(limit)||3));
  const roundCount=selected.length;
  const breakdowns=selected.map((round)=>
    distanceBreakdown(Array.isArray(round?.shots)?round.shots:[])
  );

  const rows=DISTANCE_BUCKETS.map((bucket)=>{
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

  return {roundCount,rows};
}

export function startingDistanceChartHtml(rows=[]) {
  const totalCount=rows.reduce((total,row)=>total+number(row?.count),0);
  if(!totalCount){
    return '<p class="empty-state">No off-green strokes recorded for this range.</p>';
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
    const averageLabel=average===null?'':` · ${formatDistanceSg(average)} / stroke`;
    return `<div class="sg-bar-row ${count?'':'empty-bar'}">
      <div class="sg-bar-label">
        <span>${escapeHtml(row.label)}</span>
        <small>${countLabel}${averageLabel}</small>
        <strong class="${direction==='positive'?'sg-positive':'sg-negative'}">${formatDistanceSg(sg)}</strong>
      </div>
      <div class="sg-bar-track" aria-label="${escapeHtml(row.label)}: ${formatDistanceSg(sg)} average SG per selected round over ${countLabel}">
        <span class="sg-bar-axis"></span>
        <span class="sg-bar-fill ${direction}" style="width:${width.toFixed(2)}%"></span>
      </div>
    </div>`;
  }).join('');
}

export function roundIsCompleteForDistance(round) {
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

function ensureAggregateChart(documentRef) {
  let panel=documentRef.querySelector('#aggregate-starting-distance-panel');
  if(panel) return panel.querySelector('[data-aggregate-starting-distance-chart]');

  const categoryChart=documentRef.querySelector('#aggregate-category-chart');
  const categoryPanel=categoryChart?.closest('.analytics-chart');
  const aggregateContent=documentRef.querySelector('#aggregate-content');
  if(!categoryPanel||!aggregateContent) return null;

  panel=documentRef.createElement('article');
  panel.id='aggregate-starting-distance-panel';
  panel.className='analytics-chart aggregate-chart aggregate-starting-distance-chart';
  panel.innerHTML='<div class="chart-heading"><h3>SG by starting distance</h3><span>Average per selected round · off-green shots</span></div><div class="diverging-chart" data-aggregate-starting-distance-chart></div>';
  categoryPanel.insertAdjacentElement('afterend',panel);
  return panel.querySelector('[data-aggregate-starting-distance-chart]');
}

function selectedRoundLimit(documentRef) {
  const selected=documentRef.querySelector('[data-round-limit].selected')
    || documentRef.querySelector('[data-round-limit][aria-pressed="true"]');
  return Math.max(1,Number(selected?.dataset?.roundLimit)||3);
}

export function installAggregateStartingDistanceAnalytics({
  documentRef=globalThis.document,
  windowRef=globalThis.window,
  storage=globalThis.localStorage
}={}) {
  if(!documentRef||!windowRef||!storage) return null;
  const roundStore=createRoundStore(storage);
  let scheduled=false;

  function render() {
    scheduled=false;
    const chart=ensureAggregateChart(documentRef);
    if(!chart) return;
    const selection=selectAggregateRounds(
      roundStore.list(),
      roundIsCompleteForDistance
    );
    const analytics=aggregateStartingDistance(
      selection.rounds,
      selectedRoundLimit(documentRef)
    );
    chart.innerHTML=startingDistanceChartHtml(analytics.rows);
  }

  function scheduleRender() {
    if(scheduled) return;
    scheduled=true;
    const schedule=windowRef.requestAnimationFrame
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : (callback)=>setTimeout(callback,0);
    schedule(render);
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
    for(const selector of ['#aggregate-category-chart','#round-list']){
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
