import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  formatSgScale,
  MINIMUM_SG_CHART_DOMAIN,
  SG_CHART_DOMAIN_STEP,
  sgBarWidth,
  sgChartDomain
} from '../js/sg-chart-scale.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('uses a symmetric minimum domain of plus or minus two SG',()=>{
  assert.equal(MINIMUM_SG_CHART_DOMAIN,2);
  assert.equal(SG_CHART_DOMAIN_STEP,.5);
  assert.equal(sgChartDomain([.2,-.1,0]),2);
  assert.equal(sgChartDomain([1.99,-1.5]),2);
  assert.equal(formatSgScale(2),'2.0');
});

test('expands rather than clips values outside the minimum domain',()=>{
  assert.equal(sgChartDomain([2]),2);
  assert.equal(sgChartDomain([2.01]),2.5);
  assert.equal(sgChartDomain([-2.5]),2.5);
  assert.equal(sgChartDomain([3.78]),4);
});

test('maps SG values to one half of the diverging track',()=>{
  assert.equal(sgBarWidth(0,2),0);
  assert.equal(sgBarWidth(.2,2),5);
  assert.equal(sgBarWidth(1,2),25);
  assert.equal(sgBarWidth(-2,2),50);
  assert.equal(sgBarWidth(4,2),50);
});

test('allows explicit scale overrides without losing safe defaults',()=>{
  assert.equal(sgChartDomain([.2],{minimum:2.5}),2.5);
  assert.equal(sgChartDomain([2.6],{minimum:2.5,step:.5}),3);
  assert.equal(sgBarWidth(.25,2.5),5);
});

test('the landing-page enhancement installs and labels the common chart scale',async()=>{
  const launcher=await read('js/round-list-delete.js');
  const styles=await read('round-list-delete.css');
  const scale=await read('js/sg-chart-scale.js');
  assert.match(launcher,/installSgChartScale/);
  assert.match(scale,/querySelectorAll\('\.diverging-chart'\)/);
  assert.match(scale,/sg-chart-scale/);
  assert.match(styles,/\.sg-chart-scale/);
});
