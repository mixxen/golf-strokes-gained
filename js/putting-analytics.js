import {
  aggregateRoundsAnalytics,
  roundAnalytics,
  selectAggregateRounds
} from './analytics.js';
import { createRoundStore } from './round-store.js';

const number=(value)=>Number.isFinite(Number(value))?Number(value):0;

export function formatPuttingSg(value) {
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

export function puttingDistanceChartHtml(rows=[], { aggregate=false } = {}) {
  const totalCount=rows.reduce((total,row)=>total+number(row?.count),0);
  if(!totalCount){
    return '<p class="empty-state putting-empty-state">No putts recorded for this range.</p>';
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
    const countLabel=`${count} putt${count===1?'':'s'}`;
    const averageLabel=average===null?'':` · ${formatPuttingSg(average)} / putt`;
    const valueDescription=aggregate?'average SG per selected round':'total SG for this round';
    return `<div class="sg-bar-row ${count?'':'empty-bar'}">
      <div class="sg-bar-label">
        <span>${escapeHtml(row.label)}</span>
        <small>${countLabel}${averageLabel}</small>
        <strong class="${direction==='positive'?'sg-positive':'sg-negative'}">${formatPuttingSg(sg)}</strong>
      </div>
      <div class="sg-bar-track" aria-label="${escapeHtml(row.label)}: ${formatPuttingSg(sg)} ${valueDescription} over ${countLabel}">
        <span class="sg-bar-axis"></span>
        <span class="sg-bar-fill ${direction}" style="width:${width.toFixed(2)}%"></span>
      </div>
    </div>`;
  }).join('');
}

export function roundIsCompleteForPutting(round) {
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

function createSummaryCard(documentRef,{key,label,strongId,detailId}) {
  const card=documentRef.createElement('article');
  card.dataset.puttingSummaryCard=key;
  card.innerHTML=`<span>${label}</span><strong id="${strongId}">—</strong><small id="${detailId}"></small>`;
  return card;
}

function ensureAggregateSummary(documentRef) {
  const overview=documentRef.querySelector('.aggregate-overview');
  if(!overview) return null;

  let puttingSg=overview.querySelector('[data-putting-summary-card="sg"]');
  if(!puttingSg){
    puttingSg=createSummaryCard(documentRef,{
      key:'sg',
      label:'Putting SG / round',
      strongId:'aggregate-putting-sg',
      detailId:'aggregate-putting-sg-detail'
    });
    overview.append(puttingSg);
  }

  let puttsPerHole=overview.querySelector('[data-putting-summary-card="putts"]');
  if(!puttsPerHole){
    puttsPerHole=createSummaryCard(documentRef,{
      key:'putts',
      label:'Putts / hole',
      strongId:'aggregate-putts-per-hole',
      detailId:'aggregate-putts-per-hole-detail'
    });
    overview.append(puttsPerHole);
  }

  return {
    puttingSg:puttingSg.querySelector('strong'),
    puttingSgDetail:puttingSg.querySelector('small'),
    puttsPerHole:puttsPerHole.querySelector('strong'),
    puttsPerHoleDetail:puttsPerHole.querySelector('small')
  };
}

function createPuttingChartPanel(documentRef,{id,title,subtitle,className}) {
  const panel=documentRef.createElement('article');
  panel.id=id;
  panel.className=`analytics-chart ${className}`;
  panel.innerHTML=`<div class="chart-heading"><h3>${title}</h3><span>${subtitle}</span></div><div class="diverging-chart" data-putting-distance-chart></div>`;
  return panel;
}

function ensureRoundChart(documentRef) {
  let panel=documentRef.querySelector('#putting-distance-panel');
  if(panel) return panel.querySelector('[data-putting-distance-chart]');

  const distanceChart=documentRef.querySelector('#distance-sg-chart');
  const charts=distanceChart?.closest('.analytics-charts');
  if(!charts) return null;

  panel=createPuttingChartPanel(documentRef,{
    id:'putting-distance-panel',
    title:'Putting SG by starting distance',
    subtitle:'Total for this round · feet',
    className:'putting-distance-chart'
  });
  charts.append(panel);
  return panel.querySelector('[data-putting-distance-chart]');
}

function ensureAggregateChart(documentRef) {
  let panel=documentRef.querySelector('#aggregate-putting-distance-panel');
  if(panel) return panel.querySelector('[data-putting-distance-chart]');

  const categoryChart=documentRef.querySelector('#aggregate-category-chart');
  const categoryPanel=categoryChart?.closest('.analytics-chart');
  const aggregateContent=documentRef.querySelector('#aggregate-content');
  if(!categoryPanel||!aggregateContent) return null;

  panel=createPuttingChartPanel(documentRef,{
    id:'aggregate-putting-distance-panel',
    title:'Putting SG by starting distance',
    subtitle:'Average per selected round · feet',
    className:'aggregate-chart aggregate-putting-chart'
  });
  categoryPanel.insertAdjacentElement('afterend',panel);
  return panel.querySelector('[data-putting-distance-chart]');
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

function applySgMetric(element,value,available=true) {
  if(!element) return;
  element.textContent=available?formatPuttingSg(value):'—';
  element.className=!available?'':number(value)>=0?'sg-positive':'sg-negative';
}

export function installPuttingAnalytics({
  documentRef=globalThis.document,
  windowRef=globalThis.window,
  storage=globalThis.localStorage
}={}) {
  if(!documentRef||!windowRef||!storage) return null;
  const roundStore=createRoundStore(storage);
  let scheduled=false;

  function renderHomePutting() {
    const cards=ensureAggregateSummary(documentRef);
    const chart=ensureAggregateChart(documentRef);
    if(!cards&&!chart) return;

    const selection=selectAggregateRounds(
      roundStore.list(),
      roundIsCompleteForPutting
    );
    const analytics=aggregateRoundsAnalytics(
      selection.rounds,
      selectedRoundLimit(documentRef)
    );
    const available=analytics.roundCount>0;

    applySgMetric(cards?.puttingSg,analytics.puttingSgPerRound,available);
    if(cards?.puttingSgDetail){
      cards.puttingSgDetail.textContent=available
        ? `${analytics.puttingCount} putt${analytics.puttingCount===1?'':'s'} tracked`
        : 'Completed rounds only';
    }
    if(cards?.puttsPerHole){
      cards.puttsPerHole.textContent=available&&analytics.puttsPerHole!==null
        ? analytics.puttsPerHole.toFixed(1)
        : '—';
    }
    if(cards?.puttsPerHoleDetail){
      cards.puttsPerHoleDetail.textContent=available
        ? `${analytics.holesCompleted} completed hole${analytics.holesCompleted===1?'':'s'}`
        : 'Completed rounds only';
    }
    if(chart){
      chart.innerHTML=puttingDistanceChartHtml(
        analytics.puttingDistances,
        {aggregate:true}
      );
    }
  }

  function renderRoundPutting() {
    const chart=ensureRoundChart(documentRef);
    if(!chart) return;
    const roundId=roundIdFromLocation(windowRef);
    const stored=roundId?roundStore.get(roundId):null;
    if(!stored){
      chart.innerHTML='<p class="empty-state putting-empty-state">Open a saved round to see putting by distance.</p>';
      return;
    }
    const analytics=roundAnalytics(
      Array.isArray(stored.shots)?stored.shots:[],
      Array.isArray(stored.holes)
        ? stored.holes.slice(0,Number(stored.holeCount)||stored.holes.length)
        : []
    );
    chart.innerHTML=puttingDistanceChartHtml(analytics.puttingDistances);
  }

  function renderAll() {
    scheduled=false;
    renderHomePutting();
    renderRoundPutting();
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
