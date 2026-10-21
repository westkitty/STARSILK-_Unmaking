/* Functional regression suite — the original acceptance criteria, re-verified
   against the current build. Gameplay mechanics, controls and simulation rules
   must not change as the presentation layer is improved. */
const { window, shot, settle } = require('./harness.js');
const S = window.__DBG.Sim;
let pass = 0, fail = 0;
const ck = (n, c, d = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + '  ' + d); }
};
const c = () => S.counters();

console.log('--- initial state ---');
ck('exactly 5 intact systems on load', c().intact === 5, JSON.stringify(c()));
ck('ledger all zeros: total', c().total === 0);
ck('ledger all zeros: direct', c().direct === 0);
ck('ledger all zeros: chain', c().chain === 0);
ck('ledger all zeros: planetsLost', c().planetsLost === 0);
ck('ledger all zeros: moonsLost', c().moonsLost === 0);
ck('every system has planets', [...S.nodes.values()].every(n => n.planets.length > 0));
ck('every system has >=1 filament', [...S.nodes.values()].every(n => {
  let deg = 0;
  S.edges.forEach(e => { if (e.a === n.id || e.b === n.id) deg++; });
  return deg > 0;
}));

console.log('--- direct collapse ---');
shot('warmup', 3);
S.commitCollapse('sys1', 'direct', null); settle();
let a = c();
ck('sys1 reaches ABSENCE', S.nodes.get('sys1').state === 'ABSENCE');
ck('direct=1', a.direct === 1, JSON.stringify(a));
ck('total=1', a.total === 1, JSON.stringify(a));
ck('intact=4', a.intact === 4, JSON.stringify(a));
ck('sys1 planets lost = 2', a.planetsLost === 2, JSON.stringify(a));
ck('sys1 moons lost = 1', a.moonsLost === 1, JSON.stringify(a));
ck('collapsed system bodies marked dead',
   S.nodes.get('sys1').planets.every(p => !p.alive));

console.log('--- chain reaction (neighbour primed to the threshold) ---');
S.reset();
// Prime sys2 to one stress increment below the threshold. Collapsing its
// neighbour sys1 must then schedule a chain reaction on the sim clock.
S.nodes.get('sys2').stress = window.__DBG.CFG.chainStressThreshold - 1;
S.commitCollapse('sys1', 'direct', null);
ck('over-threshold neighbour schedules a pending chain',
   S.pendingChains.some(pc => pc.id === 'sys2'), JSON.stringify(S.pendingChains));
settle();
ck('chained system collapses', S.nodes.get('sys2').state === 'ABSENCE');
ck('chain cause recorded', S.nodes.get('sys2').collapseCause === 'chain');
ck('chain source identified', S.nodes.get('sys2').collapseSource === 'sys1');
let b = c();
ck('chain=1', b.chain === 1, JSON.stringify(b));
ck('total=2', b.total === 2, JSON.stringify(b));
ck('chainReactionCount=1', b.chainReactionCount === 1, JSON.stringify(b));

console.log('--- no chain while below threshold ---');
S.reset();
S.commitCollapse('sys1', 'direct', null); settle();
ck('below-threshold neighbours do not chain', c().chain === 0, JSON.stringify(c()));
ck('only the direct collapse is counted', c().total === 1, JSON.stringify(c()));

console.log('--- all five systems, no deadlock ---');
S.reset();
['sys1', 'sys2', 'sys3', 'sys4', 'sys5'].forEach(id => { S.commitCollapse(id, 'direct', null); settle(); });
let d = c();
ck('total=5', d.total === 5, JSON.stringify(d));
ck('intact=0', d.intact === 0, JSON.stringify(d));
ck('no system left mid-collapse (no deadlock)',
   [...S.nodes.values()].every(n => n.state === 'ABSENCE'));
ck('reconcile planetsLost=13', d.planetsLost === 13, JSON.stringify(d));
ck('reconcile moonsLost=5', d.moonsLost === 5, JSON.stringify(d));

console.log('--- absence lattice ---');
const absNodes = [...S.nodes.values()].filter(n => n.state === 'ABSENCE');
let absEdges = 0;
S.edges.forEach(e => {
  const na = S.nodes.get(e.a), nb = S.nodes.get(e.b);
  if (na.state === 'ABSENCE' && nb.state === 'ABSENCE') absEdges++;
});
ck('all 5 nodes are absence', absNodes.length === 5);
ck('absence spans exist between absence nodes', absEdges > 0, 'edges=' + absEdges);

console.log('--- no double counting ---');
S.reset();
S.commitCollapse('sys1', 'direct', null); settle();
const before = c().total;
S.commitCollapse('sys1', 'direct', null); settle();
ck('re-collapsing an absence node does not double count',
   c().total === before, `before=${before} after=${c().total}`);

console.log('--- reset ---');
S.reset();
let e = c();
ck('reset total=0', e.total === 0, JSON.stringify(e));
ck('reset intact=5', e.intact === 5, JSON.stringify(e));
ck('reset planetsLost=0', e.planetsLost === 0, JSON.stringify(e));
ck('reset moonsLost=0', e.moonsLost === 0, JSON.stringify(e));
ck('reset restores all INTACT', [...S.nodes.values()].every(n => n.state === 'INTACT'));
ck('reset restores all bodies alive',
   [...S.nodes.values()].every(n => n.planets.every(p => p.alive)));
ck('reset clears pending chains', S.pendingChains.length === 0);
ck('reset clears the undo stack', S.canUndo() === false);

console.log(`\n==> ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
