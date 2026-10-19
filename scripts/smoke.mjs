import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:3000';
assert.equal((await fetch(base+'/home')).status,200);
async function signIn(userId){const r=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,password:'Practice123!'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const hrCookie=await signIn('hr');
const d=await(await fetch(base+'/api/lab',{headers:{cookie:hrCookie}})).json();
assert.equal(d.workers.length,300);assert.equal(d.prehires.length,40);assert.equal(d.processes.length,10);assert.equal(d.positions.filter(p=>p.status==='Open').length,50);
const managerCookie=await signIn('manager-1');
const m=await(await fetch(base+'/api/lab',{headers:{cookie:managerCookie}})).json();
assert.equal(m.workers.length,12);assert.equal(JSON.stringify(m.workers).includes('annualAmount'),false);
assert.equal((await fetch(base+'/api/reports?pay=true',{headers:{cookie:managerCookie}})).status,403);
assert.equal((await fetch(base+'/api/session',{method:'DELETE',headers:{cookie:managerCookie}})).status,200);
assert.equal((await fetch(base+'/api/lab',{headers:{cookie:managerCookie}})).status,401);
console.log('PASS: '+base+' — production/development routes, fresh seed, scope, salary denial, session revocation.');
