// Setup-phase stress test: across many RNG seeds × board sizes × difficulties, run the
// initial-placement phase with player 0 as a human (auto-played) and the rest as bots,
// and assert the human is NEVER stuck — there is always an available settlement node, and
// after placing a settlement there is always an available road edge. Also assert bots never
// place a "phantom" road (roads['undefined']) when their settlement vertex had no free edge.
const fs = require('node:fs');
const vm = require('node:vm');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...values) { if (values.some(v => !v)) throw new SyntaxError('empty token'); values.forEach(v => this.values.add(v)); }
  remove(...values) { values.forEach(v => this.values.delete(v)); }
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
'board turnName turnDot turnScore roundLabel playersList resourceGrid cardCount handLabel rollBtn endTurnBtn npcControlBtn playerTradeBtn playerTradeAllBtn tradeBtn setupGuide setupGuideTitle setupGuideText toast modalContent modal modalClose newGameBtn rulesBtn bgmBtn fullscreenBtn tradeGive tradeGet flexTrade playerTradeTarget zoomIn zoomOut soundBtn diceResult playDevBtn devCount devCardsList bankRate myHarbors robberConfirmOverlay startScreen playerNameInput startMusic startGameBtn offlineDiceOverlay offlineDicePlayer offlineDiceA offlineDiceB offlineDiceTotal rollLog rollLogList cancelCardBtn passScreen passName passSubtitle passAvatar passConfirmBtn extraNames humanName2 humanName3 humanName4 npcHint moveShipBtn shipBuildBtn pirateConfirmOverlay expansionHeroes expansionBarbarians barbPanel barbTrack barbInfo recoverBtn'.split(' ').forEach(id => ids[id] = new Element(id));
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
function flush() { let g = 0; while (timers.length && g++ < 5000) timers.shift()(); }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function avail(type) { return dynamic.filter(e => e.classList.contains(type) && e.classList.contains('available')); }

function playSetup(size, diff, seed) {
  rng = mulberry32(seed >>> 0);
  run(`gameConfig={playerName:'T',humanCount:1,humanNames:['T'],npcCount:3,boardMode:'random',boardSize:${JSON.stringify(size)},difficulty:${JSON.stringify(diff)},botSpeed:'fast',targetScore:10,music:false,expansion:null,expansionHeroes:false,expansionBarbarians:false};`);
  run('newGame()');
  flush();
  let guard = 0;
  while (run("state.phase==='setup'") && guard++ < 400) {
    if (run('currentIsBot()')) { flush(); continue; }
    const part = run('state.setupPart');
    if (part === 'settlement') {
      const nodes = avail('node');
      if (!nodes.length) throw new Error(`[${size}/${diff}/seed${seed}] 開拓地候補ゼロ step=${run('state.setupStep')}`);
      // 罠頂点＝候補なのに「空き・非海の隣接辺」が無い頂点。人間が選ぶと初期街道を置けず詰む。
      const trap = run(`(function(){const c=vertices.map((_,i)=>i).filter(canPlaceInitialSettlement);return c.filter(v=>!edges.some((e,i)=>state.roads[i]===undefined&&!isSeaEdge(i)&&(e.a===v||e.b===v)));})()`);
      const pick = trap.length ? trap[0] : Number(nodes[0].dataset.node);
      run(`placeBuilding(${pick})`);
      run('primaryAction()');
      const edges = avail('edge');
      if (!edges.length) throw new Error(`[${size}/${diff}/seed${seed}] ★開拓地は置けたが初期街道の候補ゼロ＝詰み vertex=${pick} 罠候補数=${trap.length} step=${run('state.setupStep')}`);
      run(`placeRoad(${edges[0].dataset.edge})`);
      run('primaryAction()');
      flush();
    } else {
      const edges = avail('edge');
      if (!edges.length) throw new Error(`[${size}/${diff}/seed${seed}] 街道候補ゼロ(road part)`);
      run(`placeRoad(${edges[0].dataset.edge})`);
      run('primaryAction()');
      flush();
    }
  }
  if (run("state.phase==='setup'")) throw new Error(`[${size}/${diff}/seed${seed}] セットアップが終わらない(ループ上限)`);
  if (run("Object.keys(state.roads).includes('undefined')")) throw new Error(`[${size}/${diff}/seed${seed}] ★幻の街道 roads['undefined']＝ボットが街道を置けなかった`);
  const b = run('Object.keys(state.buildings).length'), r = run('Object.keys(state.roads).length');
  if (b !== 8 || r !== 8) throw new Error(`[${size}/${diff}/seed${seed}] 初期配置不整合 buildings=${b} roads=${r}`);
}

const sizes = ['standard', 'large', 'huge'];
const diffs = ['normal', 'master'];
const SEEDS = Number(process.argv[2] || 150);
let ok = 0;
const failures = [];
for (const size of sizes) for (const diff of diffs) for (let s = 1; s <= SEEDS; s++) {
  try { playSetup(size, diff, s * 2654435761); ok++; }
  catch (e) { failures.push(e.message); }
}
console.log(`setup stress: ${ok} ok, ${failures.length} fail (sizes=${sizes.length}×diffs=${diffs.length}×seeds=${SEEDS})`);
failures.slice(0, 20).forEach(m => console.log('  ✗ ' + m));
process.exit(failures.length ? 1 : 0);
