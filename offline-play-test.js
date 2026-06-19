const fs = require('node:fs');
const vm = require('node:vm');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...values) {
    if (values.some(value => !value)) throw new SyntaxError('DOMTokenList cannot add an empty token');
    values.forEach(value => this.values.add(value));
  }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  toggle(value, force) { if (force === true) this.values.add(value); else if (force === false) this.values.delete(value); else if (this.values.has(value)) this.values.delete(value); else this.values.add(value); }
  contains(value) { return this.values.has(value); }
}
class Style {
  setProperty(key, value) { this[key] = value; }
  removeProperty(key) { delete this[key]; }
}
class Element {
  constructor(id = '') { this.id = id; this.dataset = {}; this.style = new Style(); this.classList = new ClassList(); this.value = 'wood'; this.options = []; this.hidden = false; }
  set className(value) { this._className = value; this.classList = new ClassList(); value.split(/\s+/).filter(Boolean).forEach(item => this.classList.add(item)); }
  get className() { return this._className || ''; }
  set innerHTML(value) { this._html = value; if (this.id === 'board') dynamic.length = 0; }
  get innerHTML() { return this._html || ''; }
  append(element) { dynamic.push(element); }
  remove() { const index = dynamic.indexOf(this); if (index >= 0) dynamic.splice(index, 1); }
  add(option) { this.options.push(option); if (this.options.length === 1) this.value = option.value; }
  showModal() {}
  close() {}
}

const dynamic = [];
const ids = {};
'board turnName turnDot turnScore roundLabel playersList resourceGrid cardCount handLabel rollBtn endTurnBtn npcControlBtn playerTradeBtn playerTradeAllBtn tradeBtn setupGuide setupGuideTitle setupGuideText toast modalContent modal modalClose newGameBtn rulesBtn bgmBtn fullscreenBtn tradeGive tradeGet flexTrade playerTradeTarget zoomIn zoomOut soundBtn diceResult playDevBtn devCount devCardsList bankRate myHarbors robberConfirmOverlay startScreen playerNameInput startMusic startGameBtn offlineDiceOverlay offlineDicePlayer offlineDiceA offlineDiceB offlineDiceTotal rollLog rollLogList cancelCardBtn passScreen passName passSubtitle passAvatar passConfirmBtn extraNames humanName2 humanName3 humanName4 npcHint'.split(' ').forEach(id => ids[id] = new Element(id));
const buildButtons = ['road', 'settlement', 'city', 'development'].map(type => { const button = new Element(); button.className = 'build-card'; button.dataset.build = type; return button; });
function queryAll(selector) {
  if (selector === '.build-card') return buildButtons;
  if (selector === '.node') return dynamic.filter(element => element.classList.contains('node'));
  if (selector === '.edge') return dynamic.filter(element => element.classList.contains('edge'));
  if (selector === '.hex') return dynamic.filter(element => element.classList.contains('hex'));
  if (selector === '.node,.edge') return dynamic.filter(element => element.classList.contains('node') || element.classList.contains('edge'));
  if (selector === '.persistent-piece') return dynamic.filter(element => element.classList.contains('persistent-piece'));
  return [];
}
const document = { querySelector: selector => ids[selector.slice(1)] || dynamic.find(element => element.id === selector.slice(1)), querySelectorAll: queryAll, createElement: () => new Element() };
const timers = [];
const testMath = Object.create(Math);
testMath.random = () => .2;
const context = { document, Option: function Option(text, value) { this.value = value; }, console, Math: testMath, Date, window: {}, confirm: () => true, setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
const run = code => vm.runInContext(code, context);
function flushTimers() { let guard = 0; while (timers.length && guard++ < 1000) timers.shift()(); }
function available(type) { return dynamic.find(element => element.classList.contains(type) && element.classList.contains('available')); }
function placeHumanPair() {
  const node = available('node');
  if (!node) throw new Error('開拓地候補がありません');
  run(`placeBuilding(${node.dataset.node})`);
  if (run('state.pendingSetupVertex') == null) throw new Error('開拓地が選択されませんでした');
  run('primaryAction()');
  const edge = available('edge');
  if (!edge) throw new Error('街道候補がありません');
  run(`placeRoad(${edge.dataset.edge})`);
  if (run('state.pendingSetupEdge') == null) throw new Error('街道が選択されませんでした');
  run('primaryAction()');
  flushTimers();
}

run('state.setupOrder=[0,1,2,3,3,2,1,0];state.turn=0;state.setupStep=0;state.buildings={};state.roads={};render()');
timers.length = 0;
placeHumanPair();
placeHumanPair();
flushTimers();
const setup = run(`({phase:state.phase,turn:state.turn,buildings:Object.keys(state.buildings).length,roads:Object.keys(state.roads).length,vp:state.players.map((_,i)=>visibleVP(i))})`);
if (setup.phase !== 'play' || setup.turn !== 0 || setup.buildings !== 8 || setup.roads !== 8 || setup.vp.some(score => score !== 2)) throw new Error(`初期配置失敗: ${JSON.stringify(setup)}`);

const savedResources = run('JSON.stringify(state.players.map(player => player.resources))');
run(`state.rolled=true;
  state.players[0].resources={wood:2,brick:0,wheat:0,sheep:0,ore:0};
  state.players[1].resources={wood:0,brick:2,wheat:0,sheep:0,ore:0};
  state.players[2].resources={wood:2,brick:0,wheat:0,sheep:0,ore:0};
  state.players[3].resources={wood:2,brick:0,wheat:0,sheep:0,ore:0}`);
const acceptedTrade = run(`npcTradeDecision(1,{wood:1},{brick:1})`);
const rejectedTrade = run(`npcTradeDecision(1,{wood:1},{brick:2})`);
if (!acceptedTrade.accept || rejectedTrade.accept) throw new Error(`NPC交換判断が不正です: ${JSON.stringify({ acceptedTrade, rejectedTrade })}`);
const singleTrade = run(`completeNpcTrade(1,{wood:1},{brick:1});({human:state.players[0].resources,npc:state.players[1].resources})`);
if (singleTrade.human.wood !== 1 || singleTrade.human.brick !== 1 || singleTrade.npc.wood !== 1 || singleTrade.npc.brick !== 1) throw new Error(`単一資源の交換が成立しません: ${JSON.stringify(singleTrade)}`);
run(`state.players[0].resources={wood:2,brick:0,wheat:1,sheep:0,ore:1};state.players[1].resources={wood:0,brick:0,wheat:0,sheep:3,ore:0}`);
const flexDecision = run(`npcTradeDecision(1,{wheat:1,ore:1},{sheep:1})`);
if (!flexDecision.accept) throw new Error(`複数資源交換が承認されません: ${JSON.stringify(flexDecision)}`);
const flexTrade = run(`completeNpcTrade(1,{wheat:1,ore:1},{sheep:1});({human:state.players[0].resources,npc:state.players[1].resources})`);
if (flexTrade.human.wheat !== 0 || flexTrade.human.ore !== 0 || flexTrade.human.sheep !== 1 || flexTrade.npc.wheat !== 1 || flexTrade.npc.ore !== 1 || flexTrade.npc.sheep !== 2) throw new Error(`複数資源交換が成立しません: ${JSON.stringify(flexTrade)}`);
run(`JSON.parse(${JSON.stringify(savedResources)}).forEach((resources,index)=>state.players[index].resources=resources);state.rolled=false`);

for (let round = 0; round < 12; round++) {
  run('rollDice()');
  if (!run('state.rolled')) throw new Error(`ラウンド${round + 1}: ダイス失敗`);
  run('endTurn()');
  flushTimers();
  if (run('state.turn') !== 0) throw new Error(`ラウンド${round + 1}: NPCから戻りません`);
}
if (run('state.round') !== 13) throw new Error(`NPCは12周していません: round=${run('state.round')}`);

run('render()');
const occupiedNodes = queryAll('.node').filter(element => element.classList.contains('occupied'));
const occupiedEdges = queryAll('.edge').filter(element => element.classList.contains('occupied'));
const buildingPieces = dynamic.filter(element => element.classList.contains('building-piece'));
const roadPieces = dynamic.filter(element => element.classList.contains('road-piece'));
if (occupiedNodes.length !== run('Object.keys(state.buildings).length')) throw new Error('建物の描画が消えています');
if (occupiedEdges.length !== run('Object.keys(state.roads).length')) throw new Error('街道の描画が消えています');
if (occupiedNodes.some(element => !element.style['--player-color'])) throw new Error('建物色がありません');
if (occupiedEdges.some(element => !element.style['--player-color'])) throw new Error('街道色がありません');
if (buildingPieces.length !== run('Object.keys(state.buildings).length')) throw new Error('固定建物レイヤーから駒が消えています');
if (roadPieces.length !== run('Object.keys(state.roads).length')) throw new Error('固定街道レイヤーから駒が消えています');
if (buildingPieces.some(element => !element.style['--piece-color'])) throw new Error('固定建物レイヤーに色がありません');
if (roadPieces.some(element => !element.style['--piece-color'])) throw new Error('固定街道レイヤーに色がありません');

// Phase 4: 最長交易路テスト
run(`(function longestRoadTests() {
  const savedRoads = JSON.parse(JSON.stringify(state.roads));
  const savedBuildings = JSON.parse(JSON.stringify(state.buildings));
  const savedLongest = state.longestRoadOwner;

  function findPath(v, used, depth) {
    if (depth === 5) return [];
    for (let i = 0; i < edges.length; i++) {
      if (used.has(i)) continue;
      if (edges[i].a !== v && edges[i].b !== v) continue;
      const next = edges[i].a === v ? edges[i].b : edges[i].a;
      const newUsed = new Set(used);
      newUsed.add(i);
      const rest = findPath(next, newUsed, depth + 1);
      if (rest !== null) return [i].concat(rest);
    }
    return null;
  }

  let testPath = null, testStart = -1;
  for (let v = 0; v < vertices.length && !testPath; v++) {
    const p = findPath(v, new Set(), 0);
    if (p) { testPath = p; testStart = v; }
  }
  if (!testPath) throw new Error('最長交易路テスト: 5本のパスが見つかりません');

  // テスト1: 4本 → 賞なし
  state.roads = {}; state.buildings = {}; state.longestRoadOwner = null;
  testPath.slice(0, 4).forEach(i => { state.roads[i] = 0; });
  updateAwards();
  if (longestRoadLength(0) < 4) throw new Error('最長交易路: 4本の長さが4未満');
  if (state.longestRoadOwner !== null) throw new Error('最長交易路: 4本で賞が出た');

  // テスト2: 5本 → player0が賞を取り+2VP
  state.roads = {}; state.buildings = {}; state.longestRoadOwner = null;
  testPath.forEach(i => { state.roads[i] = 0; });
  updateAwards();
  if (longestRoadLength(0) < 5) throw new Error('最長交易路: 5本の長さが5未満');
  if (state.longestRoadOwner !== 0) throw new Error('最長交易路: 5本で所有者が0でない got=' + state.longestRoadOwner);
  const base = state.players[0].vp;
  if (totalVP(0) !== base + 2) throw new Error('最長交易路: +2点反映なし got=' + totalVP(0) + ' expected=' + (base + 2));

  // テスト3: 敵の開拓地で道が切られる → 賞喪失
  const e1 = edges[testPath[1]], e2 = edges[testPath[2]];
  const midVertex = (e1.a === e2.a || e1.a === e2.b) ? e1.a : e1.b;
  state.buildings[midVertex] = { player: 1, type: 'settlement' };
  updateAwards();
  if (longestRoadLength(0) >= 5) throw new Error('最長交易路: 敵開拓地で道が切れていない got=' + longestRoadLength(0));
  if (state.longestRoadOwner !== null) throw new Error('最長交易路: カット後も賞が残っている got=' + state.longestRoadOwner);

  // テスト4: タイブレーク - 元所有者が道を失い単独リーダーに移る
  state.roads = {}; state.buildings = {}; state.longestRoadOwner = null;
  testPath.forEach(i => { state.roads[i] = 0; });
  updateAwards();
  if (state.longestRoadOwner !== 0) throw new Error('タイブレーク設定失敗');
  // player1に別の5本パスを割り当て（player0の辺を除外）
  let testPath2 = null;
  for (let v = 0; v < vertices.length && !testPath2; v++) {
    testPath2 = findPath(v, new Set(testPath), 0);
  }
  if (testPath2) {
    testPath2.forEach(i => { state.roads[i] = 1; });
    updateAwards();
    // 同数タイ → 元所有者(0)が保持
    if (state.longestRoadOwner !== 0) throw new Error('最長交易路タイ: 元所有者が失った got=' + state.longestRoadOwner);
    // player0の道を切る → player1が単独リーダー → player1に移る
    state.buildings[midVertex] = { player: 2, type: 'settlement' };
    updateAwards();
    if (state.longestRoadOwner !== 1) throw new Error('最長交易路: 元所有者喪失後の単独リーダーに移らない got=' + state.longestRoadOwner);
  }

  state.roads = savedRoads;
  state.buildings = savedBuildings;
  state.longestRoadOwner = savedLongest;
})()`);

console.log('offline full play test: PASS');
console.log(run(`JSON.stringify({round:state.round,turn:state.turn,buildings:Object.keys(state.buildings).length,roads:Object.keys(state.roads).length,vp:state.players.map((_,i)=>totalVP(i)),developmentDeck:state.devDeck.length})`));
