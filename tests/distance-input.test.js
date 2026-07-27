import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertDistance,
  remainingDistanceFromShot,
  shotDistanceFromRemaining
} from '../js/distance-input.js';

test('calculates shot distance from a yardage remaining',()=>{
  assert.equal(shotDistanceFromRemaining({
    startDistance:400,
    startUnit:'yards',
    remainingDistance:150,
    remainingUnit:'yards'
  }),250);
});

test('calculates remaining distance when shot distance is entered',()=>{
  assert.equal(remainingDistanceFromShot({
    startDistance:400,
    startUnit:'yards',
    shotDistance:275,
    remainingUnit:'yards'
  }),125);
});

test('converts a green leave in feet before calculating an approach distance',()=>{
  assert.equal(convertDistance(18,'feet','yards'),6);
  assert.equal(shotDistanceFromRemaining({
    startDistance:150,
    startUnit:'yards',
    remainingDistance:18,
    remainingUnit:'feet'
  }),144);
});

test('uses feet for a putt and prevents negative remaining distances',()=>{
  assert.equal(remainingDistanceFromShot({
    startDistance:20,
    startUnit:'feet',
    shotDistance:8,
    remainingUnit:'feet'
  }),12);
  assert.equal(remainingDistanceFromShot({
    startDistance:20,
    startUnit:'feet',
    shotDistance:25,
    remainingUnit:'feet'
  }),0);
});
