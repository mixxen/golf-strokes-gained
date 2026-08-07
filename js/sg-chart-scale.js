export const MINIMUM_SG_CHART_DOMAIN=2;
export const SG_CHART_DOMAIN_STEP=.5;

const number=(value)=>Number.isFinite(Number(value))?Number(value):0;

export function sgChartDomain(values=[],{
  minimum=MINIMUM_SG_CHART_DOMAIN,
  step=SG_CHART_DOMAIN_STEP
}={}) {
  const safeMinimum=Math.max(.01,Math.abs(number(minimum))||MINIMUM_SG_CHART_DOMAIN);
  const safeStep=Math.max(.01,Math.abs(number(step))||SG_CHART_DOMAIN_STEP);
  const maximum=Math.max(0,...values.map((value)=>Math.abs(number(value))));
  if(maximum<=safeMinimum) return safeMinimum;
  return Math.ceil((maximum-Number.EPSILON)/safeStep)*safeStep;
}

export function sgBarWidth(value,domain=MINIMUM_SG_CHART_DOMAIN) {
  const safeDomain=Math.max(.01,Math.abs(number(domain))||MINIMUM_SG_CHART_DOMAIN);
  return Math.min(50,Math.max(0,(Math.abs(number(value))/safeDomain)*50));
}

export function formatSgScale(value) {
  return number(value).toFixed(1);
}

function parseDisplayedSg(row) {
  const label=row?.querySelector?.('.sg-bar-label strong');
  if(!label) return null;
  const parsed=Number.parseFloat(
    String(label.textContent||'')
      .replace(/−/g,'-')
      .replace(/[^0-9+\-.]/g,'')
  );
  return Number.isFinite(parsed)?parsed:null;
}

function directChildWithClass(element,className) {
  return [...(element?.children||[])].find((child)=>child.classList?.contains(className))||null;
}

function chartRows(chart) {
  return [...(chart?.children||[])].filter((child)=>child.classList?.contains('sg-bar-row'));
}

function ensureScaleLabel(chart,domain) {
  const documentRef=chart?.ownerDocument;
  if(!documentRef) return null;
  let scale=directChildWithClass(chart,'sg-chart-scale');
  if(!scale){
    scale=documentRef.createElement('div');
    scale.className='sg-chart-scale';
    scale.setAttribute('aria-hidden','true');
    chart.insertBefore(scale,chart.firstChild||null);
  }

  const domainKey=String(domain);
  if(scale.dataset.sgDomain!==domainKey){
    scale.dataset.sgDomain=domainKey;
    scale.innerHTML=`<span>−${formatSgScale(domain)}</span><span>0</span><span>+${formatSgScale(domain)}</span>`;
    scale.title=`Symmetric chart scale: −${formatSgScale(domain)} to +${formatSgScale(domain)} strokes gained`;
  }
  return scale;
}

export function rescaleDivergingChart(chart,options={}) {
  if(!chart) return null;
  const rows=chartRows(chart);
  if(!rows.length){
    directChildWithClass(chart,'sg-chart-scale')?.remove();
    delete chart.dataset.sgDomain;
    return null;
  }

  const values=rows.map(parseDisplayedSg).filter((value)=>value!==null);
  if(!values.length) return null;
  const domain=sgChartDomain(values,options);
  chart.dataset.sgDomain=String(domain);
  ensureScaleLabel(chart,domain);

  rows.forEach((row,index)=>{
    const value=parseDisplayedSg(row);
    const fill=row.querySelector?.('.sg-bar-fill');
    if(value===null||!fill) return;
    const width=sgBarWidth(value,domain);
    fill.style.width=`${width.toFixed(2)}%`;
    const track=row.querySelector?.('.sg-bar-track');
    if(track){
      track.dataset.sgValue=String(value);
      track.dataset.sgDomain=String(domain);
    }
  });

  return domain;
}

export function rescaleAllSgCharts(documentRef=globalThis.document,options={}) {
  if(!documentRef?.querySelectorAll) return [];
  return [...documentRef.querySelectorAll('.diverging-chart')]
    .map((chart)=>rescaleDivergingChart(chart,options))
    .filter((domain)=>domain!==null);
}

export function installSgChartScale({
  documentRef=globalThis.document,
  windowRef=globalThis.window,
  minimum=MINIMUM_SG_CHART_DOMAIN,
  step=SG_CHART_DOMAIN_STEP
}={}) {
  if(!documentRef||!windowRef) return null;
  let scheduled=false;
  const options={minimum,step};

  function render(){
    scheduled=false;
    rescaleAllSgCharts(documentRef,options);
  }

  function scheduleRender(){
    if(scheduled) return;
    scheduled=true;
    const schedule=windowRef.requestAnimationFrame
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : (callback)=>setTimeout(callback,0);
    schedule(render);
  }

  const Observer=windowRef.MutationObserver;
  const observer=Observer&&documentRef.body
    ? new Observer(scheduleRender)
    : null;
  observer?.observe(documentRef.body,{childList:true,subtree:true,characterData:true});
  windowRef.addEventListener('hashchange',scheduleRender);
  windowRef.addEventListener('storage',scheduleRender);
  scheduleRender();

  return ()=>{
    observer?.disconnect();
    windowRef.removeEventListener('hashchange',scheduleRender);
    windowRef.removeEventListener('storage',scheduleRender);
  };
}
