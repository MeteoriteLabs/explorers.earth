import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {parseArguments,assertEnvironment,validateManifest,validateLaneReceipt,qualifyLanes,capturedChild,decodeProtectedReport} from './replatform-e2e.mjs';
const ack='TASK4_FIXTURE_OWNED_DISPOSABLE_PG15';
const manifest=()=>JSON.parse(readFileSync(new URL('../explorers-earth/e2e/replatform/suite-manifest.json',import.meta.url)));
const provenance={commit:'a'.repeat(40),sourceHash:'b'.repeat(64),manifestHash:'c'.repeat(64),dirty:true};
const child=(lane)=>({status:0,signal:null,error:null,receipt:{version:1,lane:lane.name,provenance,config:lane.config,spec:lane.spec,projects:lane.projects,discovery:lane.identities,results:lane.identities.map(identity=>({identity,expectedStatus:'passed',status:'expected',attempts:[{status:'passed',retry:0}]})),errors:[],cleanup:{status:'passed'},authority:{owned:true,database:'music_uat_'+'d'.repeat(32),containerId:'e'.repeat(64),imageId:'sha256:'+'f'.repeat(64)},child:{status:0,signal:null},startedAt:'2026-10-02T00:00:00.000Z',endedAt:'2026-10-02T00:00:01.000Z',playwright:'1.61.1'}});
test('only named delivered scope and fresh owned temporary output are accepted',()=>{
 const args=['--milestone','delivered-auth-profile-books','--ack',ack,'--receipt',join(tmpdir(),'replatform-e2e-contract-12345678')];
 assert.equal(parseArguments(args).milestone,'delivered-auth-profile-books');
 for(const patch of [[],[...args,'--ack',ack],args.map(x=>x===ack?'wrong':x),args.map(x=>x==='delivered-auth-profile-books'?'full-parity':x),args.map(x=>x.startsWith(tmpdir())?'../outside':x),[...args,'--grep','auth']])assert.throws(()=>parseArguments(patch));
});
test('ambient hosted/database/production authority is rejected before any child',()=>{
 for(const key of ['DATABASE_URL','DATABASE_URL_TEST','DOCKER_HOST','DOCKER_CONTEXT','PLAYWRIGHT_EXTERNAL_BASE_URL','GATE_PROD','MUSIC_C10_STANDALONE_POSTGRES_ACK'])assert.throws(()=>assertEnvironment({[key]:'unowned'}));
 assert.throws(()=>assertEnvironment({NODE_ENV:'production'}));assert.doesNotThrow(()=>assertEnvironment({}));
});
test('manifest requires exactly four nonempty unique delivered lanes and pending obligations',()=>{
 assert.equal(validateManifest(manifest()),true);
 for(const change of [m=>m.lanes.pop(),m=>m.lanes.push(m.lanes[0]),m=>m.lanes[0].identities.pop(),m=>m.lanes[0].identities[0].file='../escape',m=>m.lanes[0].identities[0].titlePath=[],m=>m.pending=[],m=>m.version=2]){const m=manifest();change(m);assert.throws(()=>validateManifest(m));}
});
test('fake children qualify only scoped delivery while full milestone remains incomplete',async()=>{
 const m=manifest();const seen=[];const receipt=await qualifyLanes({manifest:m,provenance,runLane:async lane=>{seen.push(lane.name);return child(lane);}});
 assert.deepEqual(seen,['auth','profile','books','lifecycle']);assert.equal(receipt.deliveredSlice,'passed');assert.equal(receipt.overallMilestone,'incomplete');assert.equal(receipt.releaseEligible,false);assert.equal(receipt.identities,38);
});
for(const [name,change] of [
 ['nonzero',c=>c.status=1],['signal',c=>c.signal='SIGTERM'],['spawn error',c=>c.error='failed'],['missing receipt',c=>delete c.receipt],['wrong source',c=>c.receipt.provenance.commit='0'.repeat(40)],['source hash',c=>c.receipt.provenance.sourceHash='0'.repeat(64)],['wrong config',c=>c.receipt.config='other.config.ts'],['wrong project',c=>c.receipt.projects=['other']],['loader error',c=>c.receipt.errors.push({message:'missing module'})],['missing discovery',c=>c.receipt.discovery.pop()],['extra discovery',c=>c.receipt.discovery.push({...c.receipt.discovery[0],titlePath:['extra']})],['duplicate discovery',c=>c.receipt.discovery.push(c.receipt.discovery[0])],['missing result',c=>c.receipt.results.pop()],['extra result',c=>c.receipt.results.push(c.receipt.results[0])],['dynamic skip',c=>c.receipt.results[0].attempts[0].status='skipped'],['fixme',c=>c.receipt.results[0].expectedStatus='skipped'],['timeout',c=>c.receipt.results[0].attempts[0].status='timedOut'],['interrupted',c=>c.receipt.results[0].attempts[0].status='interrupted'],['retry pass',c=>c.receipt.results[0].attempts.push({status:'passed',retry:1})],['flaky',c=>c.receipt.results[0].status='flaky'],['empty attempts',c=>c.receipt.results[0].attempts=[]],['cleanup failure',c=>c.receipt.cleanup.status='failed'],['unowned database',c=>c.receipt.authority.owned=false],['failed browser child',c=>c.receipt.child.status=1]
])test(`lane evidence rejects ${name}`,()=>{const lane=manifest().lanes[0],c=structuredClone(child(lane));change(c);assert.throws(()=>validateLaneReceipt(lane,c,provenance));});
test('failed lane prevents later child execution and cannot yield green aggregate',async()=>{
 const m=manifest(),seen=[];await assert.rejects(()=>qualifyLanes({manifest:m,provenance,runLane:async lane=>{seen.push(lane.name);const c=child(lane);c.status=1;return c;}}));assert.deepEqual(seen,['auth']);
});
test('unknown receipt fields cannot archive credentials as passing evidence',()=>{const lane=manifest().lanes[0],c=child(lane);c.receipt.cookie='not-allowed';assert.throws(()=>validateLaneReceipt(lane,c,provenance));});
test('private IPC cancellation waits for controlled child cleanup and still fails the child signal',async()=>{
 const controller=new AbortController(),capability='test-owned-capability';
 const timer=setTimeout(()=>controller.abort(),200);
 try{const c=await capturedChild(process.execPath,['-e',`process.on('message',m=>{if(m.type==='replatform-cancel'&&m.capability==='${capability}'){process.stdout.write('fake owned cleanup completed');process.disconnect();process.exitCode=0;}});`],process.cwd(),process.env,capability,controller.signal);assert.equal(c.status,0);assert.equal(c.signal,'SIGTERM');assert.match(c.stdout,/fake owned cleanup completed/);}
 finally{clearTimeout(timer);}
});
const rawReport=(lane,execution=false)=>({errors:[],config:{workers:1,shard:null,forbidOnly:true,rootDir:join(process.cwd(),'explorers-earth/e2e/replatform'),configFile:join(process.cwd(),lane.config),projects:[...lane.projects.map(name=>({name,repeatEach:1,retries:0})),{name:'unselected-music',repeatEach:1,retries:2}],version:'1.61.1'},suites:[{title:basename(lane.spec),specs:lane.identities.map(identity=>({file:basename(identity.file),title:identity.titlePath[0],tests:[{projectName:identity.project,expectedStatus:'passed',annotations:[],status:execution?'expected':'skipped',results:execution?[{status:'passed',retry:0}]:[]}]}))}]});
test('actual reporter contract permits unselected configured projects but requires selected exact tuples',()=>{const lane=manifest().lanes[0];assert.deepEqual(decodeProtectedReport(rawReport(lane),lane,process.cwd(),false).results,lane.identities);});
for(const [name,change] of [['loader errors',r=>r.errors.push({message:'loader'})],['missing selected project',r=>r.config.projects.shift()],['selected retries',r=>r.config.projects[0].retries=1],['sharding',r=>r.config.shard={current:1,total:2}],['only allowed',r=>r.config.forbidOnly=false],['wrong spec',r=>r.suites[0].specs[0].file='other.spec.ts'],['unknown project',r=>r.suites[0].specs[0].tests[0].projectName='unselected-music'],['skip annotation',r=>r.suites[0].specs[0].tests[0].annotations=[{type:'skip'}]],['stdout/incomplete JSON',r=>delete r.errors]])test(`raw discovery rejects ${name}`,()=>{const lane=manifest().lanes[0],r=rawReport(lane);change(r);assert.throws(()=>decodeProtectedReport(r,lane,process.cwd(),false));});
test('raw dynamic skip cannot qualify even if process succeeds',()=>{const lane=manifest().lanes[0],r=rawReport(lane,true);r.suites[0].specs[0].tests[0].results[0].status='skipped';const c=child(lane);c.receipt.results=decodeProtectedReport(r,lane,process.cwd(),true).results;assert.throws(()=>validateLaneReceipt(lane,c,provenance));});
