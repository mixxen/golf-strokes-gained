import { gunzipSync } from 'node:zlib';
import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,relative,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPgaFixture } from './pga-shot-fixture.js';

const GRAPHQL_URL='https://orchestrator.pgatour.com/graphql';
const DEFAULTS=Object.freeze({
  tournamentId:'R2025011',
  playerId:'28237',
  playerName:'Rory McIlroy',
  eventName:'2025 THE PLAYERS Championship',
  courseName:'TPC Sawgrass (THE PLAYERS Stadium Course)',
  startDate:'2025-03-13',
  rounds:[1,2,3,4],
  output:'data/private/rory-mcilroy-2025-players.json'
});

const QUERY=`query shotDetailsV4Compressed(
  $tournamentId: ID!
  $playerId: ID!
  $round: Int!
  $includeRadar: Boolean
) {
  shotDetailsV4Compressed(
    tournamentId: $tournamentId
    playerId: $playerId
    round: $round
    includeRadar: $includeRadar
  ) {
    payload
  }
}`;

function parseArguments(args) {
  const values={...DEFAULTS};
  for(let index=0;index<args.length;index+=1){
    const argument=args[index];
    const next=args[index+1];
    if(argument==='--tournament'&&next) values.tournamentId=next;
    else if(argument==='--player'&&next) values.playerId=next;
    else if(argument==='--player-name'&&next) values.playerName=next;
    else if(argument==='--event-name'&&next) values.eventName=next;
    else if(argument==='--course-name'&&next) values.courseName=next;
    else if(argument==='--start-date'&&next) values.startDate=next;
    else if(argument==='--rounds'&&next){
      values.rounds=next.split(',').map(Number).filter((round)=>Number.isInteger(round)&&round>0);
    } else if(argument==='--output'&&next) values.output=next;
    else continue;
    index+=1;
  }
  return values;
}

function privateOutputPath(output) {
  const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const privateRoot=resolve(repositoryRoot,'data/private');
  const outputPath=resolve(repositoryRoot,output);
  const pathFromPrivateRoot=relative(privateRoot,outputPath);
  if(pathFromPrivateRoot.startsWith('..')||resolve(outputPath)===privateRoot){
    throw new Error('Fixture output must be a file inside data/private/.');
  }
  return outputPath;
}

async function fetchRound({ apiKey,tournamentId,playerId,round }) {
  const response=await fetch(GRAPHQL_URL,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      accept:'application/json',
      'x-api-key':apiKey,
      'x-pgat-platform':'web',
      origin:'https://www.pgatour.com',
      referer:'https://www.pgatour.com/',
      'user-agent':'golf-strokes-gained-private-fixture/1.0'
    },
    body:JSON.stringify({
      query:QUERY,
      variables:{
        tournamentId,
        playerId,
        round,
        includeRadar:false
      },
      operationName:'shotDetailsV4Compressed'
    })
  });

  if(!response.ok){
    throw new Error(`PGA shot-detail request failed for round ${round}: HTTP ${response.status}`);
  }

  const body=await response.json();
  if(body.errors?.length){
    throw new Error(`PGA shot-detail request failed for round ${round}: ${body.errors.map((error)=>error.message).join('; ')}`);
  }
  const compressed=body?.data?.shotDetailsV4Compressed?.payload;
  if(!compressed) throw new Error(`PGA shot-detail response had no payload for round ${round}.`);
  return JSON.parse(gunzipSync(Buffer.from(compressed,'base64')).toString('utf8'));
}

async function main() {
  const apiKey=String(process.env.PGA_API_KEY||'').trim();
  if(!apiKey){
    throw new Error('Set PGA_API_KEY for this one-time private import. The key is never written to disk.');
  }

  const options=parseArguments(process.argv.slice(2));
  if(!options.rounds.length) throw new Error('Choose at least one round.');
  const outputPath=privateOutputPath(options.output);
  const roundPayloads=[];
  for(const round of options.rounds){
    roundPayloads.push(await fetchRound({...options,apiKey,round}));
  }

  const fixture=buildPgaFixture({
    ...options,
    fetchedAt:new Date().toISOString(),
    roundPayloads
  });
  await mkdir(dirname(outputPath),{recursive:true});
  await writeFile(outputPath,`${JSON.stringify(fixture,null,2)}\n`,'utf8');

  console.log(`Saved private fixture: ${outputPath}`);
  console.log(JSON.stringify(fixture.summary,null,2));
}

main().catch((error)=>{
  console.error(error.message);
  process.exitCode=1;
});
