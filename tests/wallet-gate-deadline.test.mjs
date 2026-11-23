// NEW regressions for the actual early-timer-wakeup defect. No old suite imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {WalletReadGate} from '../deployment-wallet-view.js';

test('NEW gate retries a fractional early wake until the exact deadline',async()=>{
  let now=0;const sleeps=[],starts=[];
  const gate=new WalletReadGate({clock:()=>now,sleep:async delay=>{sleeps.push(delay);now=sleeps.length===1?999.75:1000.25;}});
  await gate.run(()=>starts.push(now));now=.25;
  await gate.run(()=>starts.push(now));
  assert.deepEqual(sleeps,[1000,1]);assert.deepEqual(starts,[0,1000.25]);
});

test('NEW gate tolerates several advancing early wakes without shorter spacing',async()=>{
  let now=0;const wakes=[250,499,750,999.875,1000],starts=[],sleeps=[];
  const gate=new WalletReadGate({clock:()=>now,sleep:async delay=>{sleeps.push(delay);now=wakes.shift();}});
  await gate.run(()=>starts.push(now));await gate.run(()=>starts.push(now));
  assert.deepEqual(starts,[0,1000]);assert.deepEqual(sleeps,[1000,750,501,250,1]);
});

test('NEW real timers preserve exact one-second reserved starts',async()=>{
  let observed;const starts=[];
  const gate=new WalletReadGate({clock:()=>{observed=performance.now();return observed;}});
  await Promise.all(Array.from({length:4},()=>gate.run(()=>starts.push(observed))));
  assert.equal(starts.length,4);
  for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=1000,JSON.stringify(starts));
});

test('NEW cancellation between early-wake waits never starts cancelled work',async()=>{
  let now=0,waits=0,starts=0;const controller=new AbortController();
  const gate=new WalletReadGate({clock:()=>now,sleep:async()=>{if(++waits===1)now=999;else controller.abort();}});
  await gate.run(()=>{starts++;});
  await assert.rejects(gate.run(()=>{starts++;},controller.signal),/cancelled/);
  assert.equal(starts,1);assert.equal(waits,2);
  now=1000;await gate.run(()=>{starts++;});assert.equal(starts,2);
});

test('NEW cancellation interrupts a real pacing timer promptly',async()=>{
  const gate=new WalletReadGate(),controller=new AbortController();let starts=0;
  await gate.run(()=>{starts++;});
  const pending=gate.run(()=>{starts++;},controller.signal);
  const abort=setTimeout(()=>controller.abort(),20);
  try{await assert.rejects(pending,/cancelled/);}finally{clearTimeout(abort);}
  assert.equal(starts,1);
});

test('NEW backward wake and between-job clock regressions fail closed',async()=>{
  let now=1000,waits=0,starts=0;
  const gate=new WalletReadGate({clock:()=>now,sleep:async()=>{waits++;now=999;}});
  await gate.run(()=>{starts++;});
  await assert.rejects(gate.run(()=>{starts++;}),/scheduler clock/);
  assert.equal(starts,1);assert.equal(waits,1);
  let other=1000;const second=new WalletReadGate({clock:()=>other,sleep:async()=>{throw Error('must not wait');}});
  await second.run(()=>{});other=999;
  await assert.rejects(second.run(()=>{throw Error('must not run');}),/scheduler clock/);
});

test('NEW stalled and endlessly advancing early clocks are bounded',async()=>{
  let now=0,waits=0,starts=0;
  const stalled=new WalletReadGate({clock:()=>now,sleep:async()=>{waits++;}});
  await stalled.run(()=>{starts++;});await assert.rejects(stalled.run(()=>{starts++;}),/scheduler clock/);
  assert.equal(waits,1);assert.equal(starts,1);
  waits=0;const slow=new WalletReadGate({clock:()=>now,sleep:async()=>{waits++;now+=.01;}});
  await slow.run(()=>{starts++;});await assert.rejects(slow.run(()=>{starts++;}),/scheduler clock/);
  assert.equal(waits,8);assert.equal(starts,2);
});

test('NEW nonfinite and unrepresentable clocks cannot authorize a start',async()=>{
  for(const initial of [NaN,Infinity,-Infinity,Number.MAX_VALUE]){
    const gate=new WalletReadGate({clock:()=>initial});let ran=false;
    await assert.rejects(gate.run(()=>{ran=true;}),/clock/);assert.equal(ran,false);
  }
  let now=0;const gate=new WalletReadGate({clock:()=>now,sleep:async()=>{now=NaN;}});let starts=0;
  await gate.run(()=>{starts++;});await assert.rejects(gate.run(()=>{starts++;}),/clock/);assert.equal(starts,1);
});

test('NEW early-wake fix retains FIFO, serial work and the 32-job ceiling',async()=>{
  let now=0,release,active=0,maximum=0;const order=[],starts=[];
  const held=new Promise(resolve=>{release=resolve;});
  const gate=new WalletReadGate({clock:()=>now,sleep:async delay=>{now+=delay;}});
  const jobs=Array.from({length:32},(_,id)=>gate.run(async()=>{
    active++;maximum=Math.max(maximum,active);order.push(id);starts.push(now);
    if(id===0)await held;active--;
  }));
  await assert.rejects(gate.run(()=>{}),/Too many wallet reads/);
  release();await Promise.all(jobs);
  assert.deepEqual(order,Array.from({length:32},(_,i)=>i));assert.equal(maximum,1);
  assert.equal(gate.queued,0);assert.ok(starts.every((value,i)=>i===0||value-starts[i-1]>=1000));
});
