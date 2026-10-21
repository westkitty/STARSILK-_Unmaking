/* Feature test suite for the newly added capabilities:
   chain cancellation on reset, undo, persistence, board summary,
   high contrast, export, and keyboard shortcuts. */
const { window, shot, settle } = require('./harness.js');
const S = window.__DBG.Sim;
const D = window.__DBG;
const doc = window.document;

let pass = 0, fail = 0;
const ck = (n, c, d = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + '  ' + d); }
};
const c = () => S.counters();
const st = (id) => S.nodes.get(id).state;

console.log('--- #1/#4 chain reactions: reset cancels pending chains ---');
S.reset();
S.pendingChains.push({ id: 'sys2', source: 'sys1', t: 1.0 });
S.reset();                       // <-- must cancel
S.update(3.0);
ck('reset cancels a pending chain reaction', st('sys2') === 'INTACT', 'state=' + st('sys2'));

S.reset();
S.pendingChains.push({ id: 'sys2', source: 'sys1', t: 1.0 });
S.update(3.0);                   // positive control: without reset it fires
ck('chain fires when NOT reset (control)', st('sys2') === 'ABSENCE', 'state=' + st('sys2'));
ck('chain records its source', S.nodes.get('sys2').collapseSource === 'sys1');

console.log('\n--- #24 undo restores the last collapse ---');
S.reset();
S.commitCollapse('sys1', 'direct', null); settle();
const before = c();
ck('collapsed: total=1', before.total === 1, JSON.stringify(before));
ck('collapsed: planetsLost=2', before.planetsLost === 2, JSON.stringify(before));
ck('undo is available', S.canUndo());
const okUndo = S.undoLastCollapse();
const after = c();
ck('undo returns true', okUndo === true);
ck('undo restores INTACT', st('sys1') === 'INTACT', 'state=' + st('sys1'));
ck('undo restores counters to zero', after.total === 0 && after.direct === 0, JSON.stringify(after));
ck('undo restores planets', after.planetsLost === 0, JSON.stringify(after));
ck('undo restores moons', after.moonsLost === 0, JSON.stringify(after));
ck('undo restores intact count', after.intact === 5, JSON.stringify(after));
ck('undo restores bodies alive', S.nodes.get('sys1').planets.every(p => p.alive));

console.log('\n--- undo of a chain collapse ---');
S.reset();
S.commitCollapse('sys1', 'direct', null); settle();
S.commitCollapse('sys2', 'chain', 'sys1', null); settle();
ck('chain total=2', c().total === 2, JSON.stringify(c()));
S.undoLastCollapse();
ck('undoing chain leaves total=1', c().total === 1, JSON.stringify(c()));
ck('chain counter decremented', c().chain === 0, JSON.stringify(c()));
S.undoLastCollapse();
ck('undoing direct leaves total=0', c().total === 0, JSON.stringify(c()));
ck('undo stack empty afterwards', S.canUndo() === false);

console.log('\n--- undo with nothing to undo is safe ---');
S.reset();
ck('undoStack empty after reset', S.canUndo() === false);
ck('undo returns false on empty stack', S.undoLastCollapse() === false);

console.log('\n--- #23 session persistence ---');
S.reset();
try { window.localStorage.clear(); } catch (e) {}
S.commitCollapse('sys1', 'direct', null); settle();
const wrote = D.persistNow();
ck('persistNow writes to storage', wrote === true);
const raw = window.localStorage.getItem('starsilk.unmaking.v1');
ck('saved payload exists', !!raw);
const saved = JSON.parse(raw || '{}');
ck('saved payload records the absent system',
   Array.isArray(saved.absent) && saved.absent.length === 1 && saved.absent[0].id === 'sys1',
   JSON.stringify(saved.absent));

S.reset();
ck('reset clears the board (pre-restore)', c().total === 0);
const restored = D.restoreSession();
ck('restoreSession reports 1 system', restored === 1, 'got=' + restored);
ck('restored system is ABSENT', st('sys1') === 'ABSENCE', 'state=' + st('sys1'));
ck('restored counters reconcile', c().total === 1 && c().planetsLost === 2, JSON.stringify(c()));
ck('restore is undoable', S.canUndo() === true);

console.log('\n--- persistence survives corrupt data ---');
try {
  window.localStorage.setItem('starsilk.unmaking.v1', '{not json');
  ck('corrupt save does not throw', D.restoreSession() === 0);
  window.localStorage.setItem('starsilk.unmaking.v1', JSON.stringify({ v: 99, absent: [] }));
  ck('unknown version is ignored', D.restoreSession() === 0);
} catch (e) {
  ck('corrupt save does not throw', false, String(e.message));
}

console.log('\n--- #11 board summary (text equivalent) ---');
S.reset();
shot('bs', 2);
const bt0 = D.boardText;
ck('summary mentions 0 of 5 when pristine', /0 of 5 collapsed/.test(bt0), bt0);
ck('summary mentions all five systems', /SYSTEM I/.test(bt0) && /SYSTEM V/.test(bt0), bt0);
ck('summary element is populated', doc.getElementById('boardSummary').textContent.length > 40);
S.commitCollapse('sys3', 'direct', null); settle();
shot('bs2', 2);
const bt1 = D.boardText;
ck('summary updates to 1 of 5', /1 of 5 collapsed/.test(bt1), bt1);
ck('summary marks the absent system', /SYSTEM III is now an absence node/.test(bt1), bt1);

console.log('\n--- #12 high contrast ---');
D.setContrast(true);
ck('body gets .hc class', doc.body.classList.contains('hc'));
ck('canvas contrast boost active', D.Visual.boost > 1, 'boost=' + D.Visual.boost);
ck('contrast button aria-pressed', doc.getElementById('contrastBtn').getAttribute('aria-pressed') === 'true');
D.setContrast(false);
ck('toggles back off', !doc.body.classList.contains('hc'));
ck('boost returns to 1', D.Visual.boost === 1);

console.log('\n--- #25 export ---');
try {
  const el = doc.getElementById('stage');
  // jsdom's own toDataURL returns null without the native canvas package, so
  // read from the backing @napi-rs canvas the harness installed.
  const url = (el.__napi ? el.__napi : el).toDataURL('image/png');
  ck('canvas exports a PNG data URL', typeof url === 'string' && url.startsWith('data:image/png'), String(url).slice(0, 30));
} catch (e) {
  ck('canvas exports a PNG data URL', false, e.message);
}

console.log('\n--- #13 keyboard shortcuts ---');
S.reset();
S.commitCollapse('sys1', 'direct', null); settle();
shot('kb', 2);
ck('precondition: 1 collapsed', c().total === 1);
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'u', bubbles: true }));
ck('pressing U undoes the collapse', c().total === 0, JSON.stringify(c()));
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'c', bubbles: true }));
ck('pressing C toggles contrast', D.highContrast === true);
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'c', bubbles: true }));
ck('pressing C toggles back', D.highContrast === false);
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'h', bubbles: true }));
ck('pressing H reveals the board summary',
   doc.getElementById('boardSummary').classList.contains('expanded'));
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'h', bubbles: true }));
ck('pressing H hides it again',
   !doc.getElementById('boardSummary').classList.contains('expanded'));

console.log('\n--- shortcuts do not hijack modifier combos ---');
S.reset();
S.commitCollapse('sys1', 'direct', null); settle();
shot('kb2', 2);
const t0 = c().total;
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'u', ctrlKey: true, bubbles: true }));
ck('Ctrl+U is ignored', c().total === t0);

console.log(`\n==> ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
