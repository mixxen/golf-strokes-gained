export const ROUND_EXPORT_FORMAT='golf-strokes-gained-rounds';
export const ROUND_EXPORT_VERSION=1;
export const MAX_IMPORTED_ROUND_SCHEMA_VERSION=9;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateRound(round,index) {
  const label=`Round ${index+1}`;
  if(!round||typeof round!=='object'||Array.isArray(round)){
    throw new Error(`${label} is not a valid round record.`);
  }
  if(typeof round.id!=='string'||!round.id.trim()){
    throw new Error(`${label} is missing its round id.`);
  }

  const schemaVersion=Number(round.schemaVersion);
  if(!Number.isInteger(schemaVersion)||schemaVersion<1){
    throw new Error(`${label} has an invalid round schema version.`);
  }
  if(schemaVersion>MAX_IMPORTED_ROUND_SCHEMA_VERSION){
    throw new Error(`${label} was created by a newer app version and cannot be restored here.`);
  }
  if(!Array.isArray(round.holes)||round.holes.length===0){
    throw new Error(`${label} does not contain a scorecard.`);
  }
  if(!Array.isArray(round.shots)){
    throw new Error(`${label} does not contain a valid stroke list.`);
  }

  return clone(round);
}

export function createRoundsExport(rounds=[],exportedAt=new Date().toISOString()) {
  return {
    format:ROUND_EXPORT_FORMAT,
    version:ROUND_EXPORT_VERSION,
    exportedAt,
    roundCount:rounds.length,
    rounds:clone(rounds)
  };
}

export function parseRoundsExport(payload) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload)){
    throw new Error('Choose a valid Golf Strokes Gained rounds backup JSON file.');
  }
  if(payload.format!==ROUND_EXPORT_FORMAT){
    throw new Error('This file is not a Golf Strokes Gained rounds backup.');
  }
  if(payload.version!==ROUND_EXPORT_VERSION){
    throw new Error('This rounds backup version is not supported.');
  }
  if(!Array.isArray(payload.rounds)||payload.rounds.length===0){
    throw new Error('This rounds backup does not contain any rounds.');
  }
  if(payload.roundCount!==undefined&&Number(payload.roundCount)!==payload.rounds.length){
    throw new Error('This rounds backup is incomplete: its round count does not match its contents.');
  }

  const rounds=payload.rounds.map(validateRound);
  const ids=new Set();
  for(const round of rounds){
    if(ids.has(round.id)) throw new Error(`This rounds backup contains the duplicate round id ${round.id}.`);
    ids.add(round.id);
  }
  return rounds;
}

export function importRoundsExport(payload,roundStore) {
  if(!roundStore?.save||!roundStore?.get){
    throw new Error('Round storage is unavailable.');
  }

  // Validate the complete archive before writing anything so a malformed later
  // record cannot leave the browser with only a partially restored backup.
  const rounds=parseRoundsExport(payload);
  let added=0;
  let updated=0;
  const savedRounds=[];

  for(const round of rounds){
    if(roundStore.get(round.id)) updated+=1;
    else added+=1;
    savedRounds.push(roundStore.save(round));
  }

  return {
    kind:'round-backup',
    rounds:savedRounds,
    added,
    updated
  };
}

export function roundsExportFilename(exportedAt=new Date().toISOString()) {
  const date=String(exportedAt).slice(0,10)||'backup';
  return `golf-strokes-gained-rounds-${date}.json`;
}
