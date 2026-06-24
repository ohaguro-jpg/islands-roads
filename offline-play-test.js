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
  showModal() { this.open = true; }
  close() { this.open = false; }
}

const dynamic = [];
const ids = {};
'board turnName turnDot turnScore roundLabel playersList resourceGrid cardCount handLabel rollBtn endTurnBtn npcControlBtn playerTradeBtn playerTradeAllBtn tradeBtn setupGuide setupGuideTitle setupGuideText toast modalContent modal modalClose newGameBtn rulesBtn bgmBtn fullscreenBtn tradeGive tradeGet flexTrade playerTradeTarget zoomIn zoomOut soundBtn diceResult playDevBtn devCount devCardsList bankRate myHarbors robberConfirmOverlay startScreen playerNameInput startMusic startGameBtn offlineDiceOverlay offlineDicePlayer offlineDiceA offlineDiceB offlineDiceTotal rollLog rollLogList cancelCardBtn passScreen passName passSubtitle passAvatar passConfirmBtn extraNames humanName2 humanName3 humanName4 npcHint moveShipBtn shipBuildBtn pirateConfirmOverlay expansionHeroes expansionBarbarians barbPanel barbTrack barbInfo recoverBtn confirmDiscardBtn discard-wood discard-brick discard-wheat discard-sheep discard-ore gamblerKeep gamblerReroll acceptProposalBtn rejectProposalBtn'.split(' ').forEach(id => ids[id] = new Element(id));
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

// 称号(最大騎士力/最長交易路 +2)で「手番でない」プレイヤーが目標点に到達したら、
// updateAwards内のcheckAnyWinで勝利画面が出ること（出ないバグの回帰防止）。
run(`(() => {
  const snap = state.players.map(p => ({ vp: p.vp, knights: p.playedKnights }));
  const savedTurn = state.turn, savedOver = state.gameOver, savedArmy = state.largestArmyOwner;
  state.gameOver = false;
  state.turn = 0;                                    // 手番は player0
  state.players.forEach(p => { p.playedKnights = 0; });
  state.largestArmyOwner = null;
  state.players[2].vp = 8;                           // player2 は見かけ8点
  state.players[2].playedKnights = 3;               // 騎士3 → 最大騎士力(+2)で10点
  updateAwards();                                    // 非手番でも全員チェックされる
  if (state.largestArmyOwner !== 2) throw new Error('称号勝利: 最大騎士力がplayer2に付与されない');
  if (totalVP(2) !== 10) throw new Error('称号勝利: player2が10点でない got=' + totalVP(2));
  if (!state.gameOver) throw new Error('称号勝利: 非手番の到達で勝利判定されない（バグ再発）');
  // 後片付け
  state.players.forEach((p, i) => { p.vp = snap[i].vp; p.playedKnights = snap[i].knights; });
  state.turn = savedTurn; state.gameOver = savedOver; state.largestArmyOwner = savedArmy;
})()`);
console.log('award-driven win test: PASS');

// Seafarers expansion: board, ships, gold, island discovery, NPC sailing AI, ship movement
const seafarers = run(`(function seafarersTests() {
  const savedConfig = JSON.stringify(gameConfig);
  const savedExpansion = gameConfig.expansion || null;
  gameConfig.expansion = 'seafarers'; gameConfig.humanCount = 1; gameConfig.boardMode = 'default';
  newGame();
  const LAND = new Set(['forest','hills','pasture','fields','mountains','desert','gold']);

  // Board shape
  const seaCount = tiles.filter(t => t.type === 'sea').length;
  const goldCount = tiles.filter(t => t.type === 'gold').length;
  const islands = [...new Set(tiles.map(t => t.island))];
  if (seaCount < 10) throw new Error('航海者: 海タイルが少なすぎる ' + seaCount);
  if (goldCount !== 2) throw new Error('航海者: 金鉱が2枚でない ' + goldCount);
  if (!islands.includes(1) || !islands.includes(2)) throw new Error('航海者: 発見島がない ' + JSON.stringify(islands));

  // Enter play, give player 0 a coastal home settlement
  state.phase = 'play'; state.rolled = true; state.turn = 0;
  state.buildings = {}; state.ships = {}; state.roads = {}; state.islandSettlers = {};
  state.players.forEach(p => { p.islandVP = 0; p.vp = 0; });
  const coastal = vertices.findIndex((_, i) => {
    const ts = vertices[i].tiles.map(t => tiles[t]);
    return ts.some(t => t.island === 0 && LAND.has(t.type)) && ts.some(t => t.type === 'sea');
  });
  if (coastal < 0) throw new Error('航海者: 沿岸頂点が見つからない');
  state.buildings[coastal] = { player: 0, type: 'settlement' };

  // Ship placement from a coastal settlement; roads cannot use sea edges
  const seaEdge = edges.findIndex((e, i) => (e.a === coastal || e.b === coastal) && isSeaEdge(i));
  if (seaEdge < 0) throw new Error('航海者: 海辺が見つからない');
  if (!canPlaceShip(seaEdge, 0)) throw new Error('航海者: 沿岸開拓地から船を置けない');
  if (isSeaEdge(seaEdge) && roadConnected(seaEdge, 0) && state.mode === 'road') { /* land-only enforced in UI filter */ }
  state.mode = 'ship'; placeShip(seaEdge);
  if (state.ships[seaEdge] !== 0) throw new Error('航海者: 船が配置されない');
  if (longestRoadLength(0) < 1) throw new Error('航海者: 船が交易路に数えられない');

  // Island discovery bonus VP (first settler only)
  const islandV = vertices.findIndex((_, i) => vertices[i].tiles.some(t => tiles[t].island === 1 && LAND.has(tiles[t].type)));
  state.buildings[islandV] = { player: 0, type: 'settlement' };
  grantIslandDiscovery(islandV, 0);
  if (state.players[0].islandVP !== 1) throw new Error('航海者: 新島発見ボーナスが付かない');
  if (state.islandSettlers[1] !== 0) throw new Error('航海者: 発見者が記録されない');
  grantIslandDiscovery(islandV, 0);
  if (state.players[0].islandVP !== 1) throw new Error('航海者: 発見ボーナスが二重に付く');

  // NPC sailing AI: a resource-rich NPC on the coast should build ships
  state.buildings = {}; state.ships = {}; state.islandSettlers = {};
  state.players.forEach(p => { p.islandVP = 0; });
  state.buildings[coastal] = { player: 2, type: 'settlement' };
  Object.keys(state.players[2].resources).forEach(k => state.players[2].resources[k] = 30);
  state.turn = 2;
  runBotActions(2);
  const npcShipsBuilt = countShips(2);
  if (npcShipsBuilt < 1) throw new Error('航海者: NPCが船を建設しない');

  // Ship movement: an open-end ship is movable, can relocate once per turn
  state.buildings = {}; state.ships = {}; state.turn = 0; state.movedShipThisTurn = false; state.shipsBuiltThisTurn = [];
  state.buildings[coastal] = { player: 0, type: 'settlement' };
  state.ships[seaEdge] = 0; // pre-existing (not built this turn)
  if (!isMovableShip(seaEdge, 0)) throw new Error('航海者: 先端の船が移動可能と判定されない');
  const newlyBuilt = edges.findIndex((e, i) => i !== seaEdge && canPlaceShip(i, 0));
  state.shipsBuiltThisTurn = [seaEdge + 1000]; // sanity: unrelated entry
  beginMoveShip();
  if (state.mode !== 'moveShip') throw new Error('航海者: 船移動モードに入れない');
  pickShipToMove(seaEdge);
  if (state.ships[seaEdge] !== undefined) throw new Error('航海者: 動かす船が取り上げられない');
  const dest = edges.findIndex((e, i) => canPlaceShip(i, 0));
  relocateShipTo(dest);
  if (state.ships[dest] !== 0) throw new Error('航海者: 移動先に船が置かれない');
  if (!state.movedShipThisTurn) throw new Error('航海者: 移動済みフラグが立たない');
  // Second move blocked same turn
  const before = state.mode;
  beginMoveShip();
  if (state.mode === 'moveShip') throw new Error('航海者: 1ターンに2回移動できてしまう');

  const result = { seaCount, goldCount, islands: islands.filter(x => x != null).sort(), npcShips: npcShipsBuilt };
  // Restore base game so nothing leaks
  Object.assign(gameConfig, JSON.parse(savedConfig));
  gameConfig.expansion = savedExpansion;
  newGame();
  return JSON.stringify(result);
})()`);

// Base game must remain ship-free after restore
if (run('tiles.filter(t => t.type === "sea").length') !== 0) throw new Error('基本ゲームに海タイルが残っている');
if (run('state.expansion') != null) throw new Error('基本ゲームに復帰していない');

console.log('seafarers expansion test: PASS');
console.log(seafarers);

// 盤面サイズ: 標準19/大型31/巨大37のタイル数と、頂点dedupの健全性（長さ0の辺＝重複頂点が無い、
// どの頂点も最大3タイル接触）。unitを変えても幾何が壊れないことの回帰防止。
const boardSizes = run(`(() => {
  const savedSize = gameConfig.boardSize, savedMode = gameConfig.boardMode;
  gameConfig.boardMode = 'random';
  const expect = { standard: 19, large: 31, huge: 37 };
  const out = {};
  for (const size in expect) {
    gameConfig.boardSize = size;
    buildBoard();
    if (tiles.length !== expect[size]) throw new Error('盤面' + size + ': タイル数 ' + tiles.length + ' != ' + expect[size]);
    const zeroEdges = edges.filter(e => Math.hypot(vertices[e.a].x - vertices[e.b].x, vertices[e.a].y - vertices[e.b].y) < 1).length;
    if (zeroEdges) throw new Error('盤面' + size + ': 長さ0の辺=頂点dedup失敗 x' + zeroEdges);
    if (vertices.some(v => v.tiles.length > 3)) throw new Error('盤面' + size + ': 4タイル超に接する頂点');
    if (Object.keys(state.harbors).length < 2) throw new Error('盤面' + size + ': 港が生成されない');
    out[size] = { tiles: tiles.length, vertices: vertices.length, edges: edges.length };
  }
  gameConfig.boardSize = savedSize; gameConfig.boardMode = savedMode;
  buildBoard();
  return JSON.stringify(out);
})()`);
console.log('board size test: PASS');
console.log(boardSizes);

// 詰まり回帰: ボットが7を出し、人間が捨て札を迫られている間、ボットは手番を進めてはいけない。
// （進めると resolvingSeven が宙に浮き、人間の endTurn が永久に無効化されて「進めない」）。
run(`(() => {
  state.phase = 'play'; state.gameOver = false; state.resolvingSeven = false;
  state.turn = 1; state.rolled = false; state.botBusy = true; state.mode = null; state.discardQueue = null;
  state.players.forEach((p, i) => { p.resources = { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 }; });
  state.players[0].resources = { wood: 3, brick: 3, wheat: 3, sheep: 0, ore: 0 }; // 9枚 → 4枚捨てが必要
  distributeRoll(3, 4); // 合計7
  if (!state.resolvingSeven) throw new Error('7なのに resolvingSeven が立たない');
  if (!(state.discardQueue && state.discardQueue.length === 1 && state.discardQueue[0] === 0)) throw new Error('人間の捨て札キューが作られない');
  continueBotTurn(1, gameVersion); // 捨て札待ちなら早期return（修正点）。未修正だと runBotActions が走り botBusy を解除する
  if (!state.botBusy) throw new Error('★ボットが捨て札待ち中に手番処理を実行した（botBusy解除＝バグ再発）');
  if (!state.resolvingSeven) throw new Error('★捨て札完了前に resolvingSeven が解除された');
  // 人間が4枚捨てる（wood3 + brick1）
  ['wood','brick','wheat','sheep','ore'].forEach(k => document.querySelector('#discard-' + k).value = 0);
  document.querySelector('#discard-wood').value = 3;
  document.querySelector('#discard-brick').value = 1;
  document.querySelector('#confirmDiscardBtn').onclick();
  if (state.resolvingSeven) throw new Error('★捨て札後も resolvingSeven が残る（盗賊が動かず詰み）');
  if (state.players[0].resources.wood !== 0 || state.players[0].resources.brick !== 2) throw new Error('捨て札が正しく反映されない');
})()`);
console.log('seven-discard wait test: PASS');

// 英雄の伝説（yuji オリジナル）: 各能力の確定的な部分を検証。
run(`(() => {
  gameConfig.expansionHeroes = true;
  const savedHarbors = state.harbors, savedTurn = state.turn;
  state.players.forEach(p => { p._hero = p.hero; p._bot = p.bot; p._res = p.resources; });
  state.harbors = {};

  // 港の主: 全資源 2:1
  state.players[0].hero = 'harbormaster';
  ['wood','brick','wheat','sheep','ore'].forEach(r => { if (maritimeRate(0, r) !== 2) throw new Error('港の主: ' + r + ' が2:1でない=' + maritimeRate(0, r)); });
  state.players[0].hero = null;
  if (maritimeRate(0, 'wood') !== 4) throw new Error('港なしは4:1のはず=' + maritimeRate(0, 'wood'));

  // 天才建築家: 街道が木材不要（レンガ1のみ）
  state.players[0].hero = 'architect';
  const rc = effectiveCost('road', 0);
  if (rc.wood !== undefined || rc.brick !== 1) throw new Error('建築家: 街道コストが木材不要になっていない ' + JSON.stringify(rc));
  state.players[0].hero = null;

  // 歴戦の将軍: 15枚は捨て不要・16枚で捨て対象
  state.players.forEach(p => { p.bot = true; p.resources = { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 }; });
  state.players[1].hero = 'general'; state.players[1].bot = false; state.turn = 2;
  state.players[1].resources.wood = 15; state.resolvingSeven = false; state.discardQueue = null;
  resolveSeven(2);
  if (state.discardQueue.includes(1)) throw new Error('将軍: 15枚で捨て対象になった');
  state.resolvingSeven = false; state.players[1].resources.wood = 16;
  resolveSeven(2);
  if (!state.discardQueue.includes(1)) throw new Error('将軍: 16枚で捨て対象にならない');
  state.resolvingSeven = false; state.discardQueue = null;

  // 不屈の守人: 盗まれない / 強欲の徴税官: 2枚奪う
  state.players[2].hero = 'guardian';
  if (robbable(2)) throw new Error('守人がrobbable');
  if (!robbable(0)) throw new Error('通常がrobbableでない');
  state.players[3].hero = 'taxman';
  state.players[0].resources = { wood: 3, brick: 0, wheat: 0, sheep: 0, ore: 0 };
  state.players[3].resources = { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 };
  state.turn = 3;
  stealFromVictim(0);
  if (state.players[3].resources.wood !== 2) throw new Error('徴税官が2枚奪わない=' + state.players[3].resources.wood);

  // 後片付け
  state.players.forEach(p => { p.hero = p._hero; p.bot = p._bot; p.resources = p._res; delete p._hero; delete p._bot; delete p._res; });
  state.harbors = savedHarbors; state.turn = savedTurn; state.resolvingSeven = false; state.discardQueue = null;
  gameConfig.expansionHeroes = false;
})()`);
console.log('heroes (yuji original) test: PASS');

// 詰まり回帰: NPCの交換提案など「閉じられない必須モーダル」が開いている間は、
// blockingModalOpen が true になり自動進行（ハートビート/ウォッチドッグ）が止まること。
// また「進まない時」ボタン(recoverGame)で確実に解除できること。
run(`(() => {
  state.phase = 'play'; state.gameOver = false; state.turn = 1; state.botBusy = true; state.resolvingSeven = false; state.rolled = true;
  state.players[0].resources = { wood: 1, brick: 0, wheat: 0, sheep: 0, ore: 0 };
  showNpcProposalDialog(1, 'brick', 'wood', () => {});
  if (!blockingModalOpen()) throw new Error('★必須モーダル中に blockingModalOpen=false（自動進行が止まらず詰まりの原因に）');
  recoverGame();
  if (blockingModalOpen()) throw new Error('★recoverGame後も blockingModalOpen=true（モーダルが閉じない）');
  if ($('#modal').open) throw new Error('★recoverGame後もモーダルが開いている');
  if (state.resolvingSeven) throw new Error('★recoverGameで resolvingSeven が解除されない');
})()`);
console.log('blocking-modal guard test: PASS');
