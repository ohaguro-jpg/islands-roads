// Full-game stress test: play many complete offline games (player 0 = auto-human, rest bots)
// across RNG seeds × board sizes × difficulties, and detect any FREEZE:
//   - the human's turn never returns (a bot turn hung — heartbeat is stubbed here, so a hang
//     that the live game only papers over is caught as a real stall),
//   - resolvingSeven stays stuck (endTurn would be permanently disabled),
//   - an exception is thrown.
// The human only rolls + (handles a 7) + ends turn, so games end when a bot wins.
const fs = require('node:fs');
const vm = require('node:vm');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...v) { if (v.some(x => !x)) throw new SyntaxError('empty token'); v.forEach(x => this.values.add(x)); }
  remove(...v) { v.forEach(x => this.values.delete(x)); }
  toggle(value, force) { if (force === true) this.values.add(value); else if (force === false) this.values.delete(value); else if (this.values.has(value)) this.values.delete(value); else this.values.add(value); }
  contains(value) { return this.values.has(value); }
}
class Style { setProperty(k, v) { this[k] = v; } removeProperty(k) { delete this[k]; } }
class Element {
  constructor(id = '') { this.id = id; this.dataset = {}; this.style = new Style(); this.classList = new ClassList(); this.value = 'wood'; this.options = []; this.hidden = false; }
  set className(value) { this._className = value; this.classList = new ClassList(); value.split(/\s+/).filter(Boolean).forEach(i => this.classList.add(i)); }
  get className() { return this._className || ''; }
  set innerHTML(value) { this._html = value; if (this.id === 'board') dynamic.length = 0; }
  get innerHTML() { return this._html || ''; }
  append(element) { dynamic.push(element); }
  remove() { const i = dynamic.indexOf(this); if (i >= 0) dynamic.splice(i, 1); }
  add(option) { this.options.push(option); if (this.options.length === 1) this.value = option.value; }
  showModal() {} close() {}
}
const dynamic = [];
const ids = {};
'board turnName turnDot turnScore roundLabel playersList resourceGrid cardCount handLabel rollBtn endTurnBtn npcControlBtn playerTradeBtn playerTradeAllBtn tradeBtn setupGuide setupGuideTitle setupGuideText toast modalContent modal modalClose newGameBtn rulesBtn bgmBtn fullscreenBtn tradeGive tradeGet flexTrade playerTradeTarget zoomIn zoomOut soundBtn diceResult playDevBtn devCount devCardsList bankRate myHarbors robberConfirmOverlay startScreen playerNameInput startMusic startGameBtn offlineDiceOverlay offlineDicePlayer offlineDiceA offlineDiceB offlineDiceTotal rollLog rollLogList cancelCardBtn passScreen passName passSubtitle passAvatar passConfirmBtn extraNames humanName2 humanName3 humanName4 npcHint moveShipBtn shipBuildBtn pirateConfirmOverlay expansionHeroes expansionBarbarians barbPanel barbTrack barbInfo recoverBtn confirmDiscardBtn discard-wood discard-brick discard-wheat discard-sheep discard-ore'.split(' ').forEach(id => ids[id] = new Element(id));
const buildButtons = ['road', 'settlement', 'city', 'development'].map(type => { const b = new Element(); b.className = 'build-card'; b.dataset.build = type; return b; });
function queryAll(selector) {
  if (selector === '.build-card') return buildButtons;
  if (selector === '.node') return dynamic.filter(e => e.classList.contains('node'));
  if (selector === '.edge') return dynamic.filter(e => e.classList.contains('edge'));
  if (selector === '.hex') return dynamic.filter(e => e.classList.contains('hex'));
  if (selector === '.node,.edge') return dynamic.filter(e => e.classList.contains('node') || e.classList.contains('edge'));
  if (selector === '.persistent-piece') return dynamic.filter(e => e.classList.contains('persistent-piece'));
  return [];
}
const document = { querySelector: s => ids[s.slice(1)] || dynamic.find(e => e.id === s.slice(1)), querySelectorAll: queryAll, createElement: () => new Element() };
let rng = Math.random;
const testMath = Object.create(Math); testMath.random = () => rng();
const timers = [];
const context = { document, Option: function (t, v) { this.value = v; }, console, Math: testMath, Date, window: {}, confirm: () => true, setTimeout: cb => { timers.push(cb); return timers.length; }, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
const run = c => vm.runInContext(c, context);
// NPC→human trade proposals open a modal the mock can't render; they are not what this test
// exercises. Disable them so we can drive thousands of turns and focus on the 7/freeze path.
run('maybeProposeNpcTrade = function(){ return false; };');
function flush() { let g = 0; while (timers.length && g++ < 20000) timers.shift()(); }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function avail(type) { return dynamic.filter(e => e.classList.contains(type) && e.classList.contains('available')); }

function setupPhase(tag) {
  let guard = 0;
  while (run("state.phase==='setup'") && guard++ < 400) {
    if (run('currentIsBot()')) { flush(); continue; }
    if (run('state.setupPart') === 'settlement') {
      const nodes = avail('node');
      if (!nodes.length) throw new Error(`${tag} 開拓地候補ゼロ`);
      run(`placeBuilding(${nodes[0].dataset.node})`); run('primaryAction()');
      const edges = avail('edge');
      if (!edges.length) throw new Error(`${tag} 初期街道候補ゼロ＝詰み`);
      run(`placeRoad(${edges[0].dataset.edge})`); run('primaryAction()'); flush();
    } else {
      const edges = avail('edge');
      if (!edges.length) throw new Error(`${tag} 街道候補ゼロ(road)`);
      run(`placeRoad(${edges[0].dataset.edge})`); run('primaryAction()'); flush();
    }
  }
  if (run("state.phase==='setup'")) throw new Error(`${tag} セットアップ無限ループ`);
}

// Drive every human 7-interaction that may be pending (discard dialog, robber move, steal),
// regardless of whose turn rolled the 7. Returns true if it did something.
function resolveHumanInterrupts(tag) {
  let acted = false, g = 0;
  while (run('state.resolvingSeven') && g++ < 60) {
    // human discard dialog up?
    if (run("!!(state.discardQueue && state.discardQueue.length && !state.players[state.discardQueue[0]].bot)")) {
      run(`(function(){const who=state.discardQueue[0],r=state.players[who].resources,K=['wood','brick','wheat','sheep','ore'];let need=Math.floor(K.reduce((a,k)=>a+r[k],0)/2);K.forEach(k=>document.querySelector('#discard-'+k).value=0);for(const k of K){while(need>0&&Number(document.querySelector('#discard-'+k).value)<r[k]){document.querySelector('#discard-'+k).value=Number(document.querySelector('#discard-'+k).value)+1;need--;}}})()`);
      run('document.querySelector("#confirmDiscardBtn").onclick()');
      flush(); acted = true; continue;
    }
    const mode = run('state.mode');
    if (mode === 'robber' || mode === 'pirate') {
      const t = run('(function(){for(let i=0;i<tiles.length;i++){if(i!==state.robberTile&&tiles[i].type!=="sea")return i;}return -1;})()');
      if (t < 0) { run('state.resolvingSeven=false'); break; }
      run(`state.mode='robber';placeRobber(${t});confirmRobberPlacement()`);
      if (run('state.resolvingSeven') && !run('state.mode')) {
        run('(function(){const v=[...new Set(tiles[state.robberTile].vertices.map(x=>state.buildings[x]&&state.buildings[x].player).filter(p=>p!=null&&p!==state.turn&&randomOwnedResource(p)))];if(v.length)stealFromVictim(v[0]);else state.resolvingSeven=false;})()');
      }
      flush(); acted = true; continue;
    }
    break; // resolvingSeven true but waiting on a bot — let flush handle it
  }
  return acted;
}
function drain(tag) { let g = 0; do { flush(); } while (resolveHumanInterrupts(tag) && g++ < 80); }

function playGame(size, diff, seed) {
  const tag = `[${size}/${diff}/seed${seed}]`;
  rng = mulberry32(seed >>> 0);
  run(`gameConfig={playerName:'T',humanCount:1,humanNames:['T'],npcCount:3,boardMode:'random',boardSize:${JSON.stringify(size)},difficulty:${JSON.stringify(diff)},botSpeed:'fast',targetScore:10,music:false,expansion:null,expansionHeroes:false,expansionBarbarians:false};`);
  run('newGame()'); flush();
  setupPhase(tag);
  let round = 0;
  while (run('!state.gameOver') && round < 300) {
    if (run('state.turn') !== 0) throw new Error(`${tag} 人間(0)に手番が戻らない turn=${run('state.turn')} round=${round}（ボット停止の疑い）`);
    if (run('currentIsBot()')) throw new Error(`${tag} player0がbot扱い`);
    // keep hand <=7 so no discard dialog is needed
    run('(function(){const r=state.players[0].resources,k=Object.keys(r);let t=k.reduce((a,x)=>a+r[x],0),gi=0;while(t>7){const key=k[gi%k.length];if(r[key]>0){r[key]--;t--;}gi++;}})()');
    if (!run('state.rolled')) run('rollDice()');
    drain(tag);
    if (run('state.resolvingSeven')) throw new Error(`${tag} ★resolvingSevenが解除されず詰み（人間の手番・endTurn永久無効）`);
    if (!run('state.rolled')) throw new Error(`${tag} ダイス後にrolledが立たない`);
    run('endTurn()'); drain(tag);
    if (run('state.resolvingSeven') && !run('state.gameOver')) throw new Error(`${tag} ★ボットの7処理後にresolvingSevenが残る（次手番が詰む）`);
    round++;
  }
  return { round, over: run('state.gameOver'), winner: run('state.gameOver ? state.players[[0,1,2,3].reduce((b,i)=>totalVP(i)>totalVP(b)?i:b,0)].name : null') };
}

const sizes = ['standard', 'large', 'huge'];
const diffs = ['normal', 'hard', 'master'];
const SEEDS = Number(process.argv[2] || 40);
let ok = 0, finished = 0;
const failures = [];
for (const size of sizes) for (const diff of diffs) for (let s = 1; s <= SEEDS; s++) {
  try { const r = playGame(size, diff, s * 40503 + 7); ok++; if (r.over) finished++; }
  catch (e) { failures.push(e.message); }
}
console.log(`play stress: ${ok} ok (${finished} reached gameOver), ${failures.length} fail  [sizes ${sizes.length} × diffs ${diffs.length} × seeds ${SEEDS}]`);
[...new Set(failures)].slice(0, 25).forEach(m => console.log('  ✗ ' + m));
process.exit(failures.length ? 1 : 0);
