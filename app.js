const RESOURCES = {
  wood: { name: '木材', icon: '🌲' },
  brick: { name: 'レンガ', icon: '🧱' },
  wheat: { name: '小麦', icon: '🌾' },
  sheep: { name: '羊毛', icon: '🐑' },
  ore: { name: '鉱石', icon: '⛏' }
};
const TILE_TYPES = [...Array(4).fill('forest'), ...Array(3).fill('hills'), ...Array(4).fill('pasture'), ...Array(4).fill('fields'), ...Array(3).fill('mountains'), 'desert'];
const DEFAULT_TYPES = ['mountains', 'pasture', 'forest', 'fields', 'hills', 'pasture', 'mountains', 'forest', 'fields', 'desert', 'fields', 'forest', 'mountains', 'forest', 'pasture', 'hills', 'fields', 'pasture', 'hills'];
const DEFAULT_NUMBERS = [4, 9, 6, 4, 12, 10, 11, 10, 8, null, 3, 2, 9, 3, 8, 11, 6, 5, 5];
const TYPE_DATA = { forest: { res: 'wood', icon: '🌲' }, hills: { res: 'brick', icon: '🧱' }, pasture: { res: 'sheep', icon: '🐑' }, fields: { res: 'wheat', icon: '🌾' }, mountains: { res: 'ore', icon: '⛏' }, desert: { res: null, icon: '☀' }, sea: { res: null, icon: '🌊' }, gold: { res: null, icon: '✨' } };
const NUMBERS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
const COLORS = ['#c95642', '#3d7181', '#d9a838', '#577b59'];
const NAMES = ['あなた', 'ミナト', 'アオイ', 'ハル'];
const NPC_NAMES = ['ミナト', 'アオイ', 'ハル', 'カイ'];
const COSTS = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1 }, city: { wheat: 2, ore: 3 }, development: { wheat: 1, sheep: 1, ore: 1 }, ship: { wood: 1, sheep: 1 } };
const PIECE_LIMITS = { road: 15, settlement: 5, city: 4, ship: 15 };
// Selectable board sizes. `n` is the axial hexagon radius; `trimCorners` drops the 6 corner
// hexes for a rounded mid-size board. `unit` is the hex radius in px — smaller for bigger
// boards so they fit the same on-screen envelope (sea-ring / .board are fixed size).
const BOARD_SIZES = {
  standard: { label: '標準', n: 2, trimCorners: false, unit: 64, deserts: 1, harbors: 9,  pieces: { road: 15, settlement: 5, city: 4, ship: 15 } },
  large:    { label: '大型', n: 3, trimCorners: true,  unit: 52, deserts: 2, harbors: 11, pieces: { road: 21, settlement: 7, city: 5, ship: 21 } },
  huge:     { label: '巨大', n: 3, trimCorners: false, unit: 49, deserts: 2, harbors: 13, pieces: { road: 26, settlement: 8, city: 6, ship: 26 } }
};
function boardSizeConfig() { return BOARD_SIZES[gameConfig.boardSize] || BOARD_SIZES.standard; }
// Axial coords of all hexes for a size (optionally trimming the 6 corners of the hexagon).
function boardCoords(cfg) {
  const N = cfg.n, coords = [];
  for (let r = -N; r <= N; r++) {
    for (let q = Math.max(-N, -r - N); q <= Math.min(N, -r + N); q++) {
      if (cfg.trimCorners && [Math.abs(q), Math.abs(r), Math.abs(-q - r)].filter(v => v === N).length >= 2) continue;
      coords.push({ q, r });
    }
  }
  return coords;
}
// Resource terrain for `count` hexes: deserts + the 5 resources spread as evenly as possible.
function boardResourceTypes(cfg, count) {
  const order = ['forest', 'pasture', 'fields', 'hills', 'mountains'];
  const types = [];
  for (let i = 0; i < count - cfg.deserts; i++) types.push(order[i % order.length]);
  for (let i = 0; i < cfg.deserts; i++) types.push('desert');
  return shuffle(types);
}
// Harbor mix: each of the 5 resource (2:1) harbors at least once, the rest generic 3:1.
function harborTypeList(count) {
  const list = ['wood', 'brick', 'wheat', 'sheep', 'ore'];
  while (list.length < count) list.push(null);
  return shuffle(list);
}
const SETUP_ORDER = [0, 1, 2, 3, 3, 2, 1, 0];
// Hero Pack (Claude Original) — each player receives one passive hero ability
const HEROES = [
  { id: 'farmer',    icon: '🌾', name: '豊穣の農夫',   desc: '農地タイルが出るたびに隣接する建物から +1 小麦追加' },
  { id: 'smith',     icon: '⚒',  name: '熟練の鍛冶師', desc: '都市へ発展するコストが鉱石 2（通常 3 より −1）' },
  { id: 'merchant',  icon: '🛒', name: '旅の商人',      desc: '銀行・港との交換レートが常時 3:1' },
  { id: 'general',   icon: '🗡',  name: '歴戦の将軍',   desc: '手札が 8 枚以下なら 7 が出ても捨て不要' },
  { id: 'architect', icon: '🏗',  name: '天才建築家',   desc: '街道の建設コストがレンガ 1 枚のみ（木材不要）' },
  { id: 'sage',      icon: '🔮', name: '古の賢者',      desc: '発展カード購入時に 2 枚引いて好きな 1 枚を選べる' },
];
// Barbarian Pack (Cities & Knights inspired) — barbarians invade every N turns
const BARBARIAN_STEPS = 7;
// Seafarers expansion constants
const SEA_HEX_SIZE = 52;
const ISLAND_BONUS_VP = 1;
const SEAFARERS_HOME = new Set(['-1,-1','0,-1','1,-1','-1,0','0,0','1,0','-1,1','0,1','1,1']);
const SEAFARERS_DISC1 = new Set(['1,-3','2,-3','3,-3','3,-2']);
const SEAFARERS_DISC2 = new Set(['-3,2','-3,3','-2,3']);
const SEAFARERS_TILE_TYPES = ['fields','hills','forest','pasture','mountains','fields','pasture','forest','desert','mountains','hills','forest','gold','pasture','fields','gold'];
const SEAFARERS_TILE_NUMBERS = [9,6,4,3,12,10,8,5,null,2,11,8,5,9,6,10];
let state;
let vertices = [];
let edges = [];
let tiles = [];
let scale = 1;
let gameVersion = 0;
let botTimer = null;
let botWatchdog = null;
let gameConfig = { playerName: 'あなた', boardMode: 'default', boardSize: 'standard', music: true, difficulty: 'normal', botSpeed: 'normal' };
const BOT_SPEED = { slow: 1.7, normal: 1, fast: .35 };
const botDelay = ms => Math.round(ms * (BOT_SPEED[gameConfig.botSpeed] || 1));
const DIFFICULTY = {
  easy:   { label: 'やさしい',   actions: 2,  smartRoad: false, bankTrade: false, devBuy: false, devChance: .15, smart: false },
  normal: { label: 'ふつう',     actions: 4,  smartRoad: false, bankTrade: true,  devBuy: true,  devChance: .5,  smart: false },
  hard:   { label: '強い',       actions: 6,  smartRoad: true,  bankTrade: true,  devBuy: true,  devChance: .85, smart: false },
  expert: { label: 'もっと強い', actions: 9,  smartRoad: true,  bankTrade: true,  devBuy: true,  devChance: 1,   smart: true },
  master: { label: '最強',       actions: 16, smartRoad: true,  bankTrade: true,  devBuy: true,  devChance: 1,   smart: true }
};
const botRules = () => DIFFICULTY[gameConfig.difficulty] || DIFFICULTY.normal;
let audioContext = null;
let audioEnabled = false;
let bgmTimer = null;
let npcHeartbeat = null;
let diceOverlayTimer = null;
const activeSounds = new Set();
let cardActionSnapshot = null;
function cloneState() { return JSON.parse(JSON.stringify(state)); }
function clearCardAction() { cardActionSnapshot = null; if (state) state.pendingCard = null; }
function cancelCardAction() {
  if (!cardActionSnapshot) return;
  state = cardActionSnapshot;
  cardActionSnapshot = null;
  if ($('#modal').open) $('#modal').close();
  $('#modalClose').hidden = false;
  render();
  toast('カードの使用を取り消しました');
}
const $ = selector => document.querySelector(selector);
function currentIsBot() { return !!(state && state.players && state.players[state.turn] && state.players[state.turn].bot); }
function beginHumanTurn(message) {
  // Multi-human (hotseat) shows a "pass the device" screen so hands stay hidden until the right player confirms.
  if (state && state.humanCount > 1 && !currentIsBot()) {
    state.awaitingPass = true;
    render(); // hides the hand bar while the device is being passed
    const player = state.players[state.turn];
    showPassScreen(player.name, message || 'あなたの番です。準備ができたら手札を見ましょう。', () => {
      state.awaitingPass = false;
      render();
      if (message) toast(message);
    }, player.color);
    return;
  }
  if (message) toast(message);
}

// Full-screen handoff: "○○ さんですか？" — hides everything until the named player confirms.
function showPassScreen(name, subtitle, onConfirm, color) {
  const overlay = $('#passScreen');
  if (!overlay) { if (onConfirm) onConfirm(); return; }
  if ($('#passName')) $('#passName').textContent = `${name} さんですか？`;
  if ($('#passSubtitle')) $('#passSubtitle').textContent = subtitle || '';
  const avatar = $('#passAvatar');
  if (avatar) {
    avatar.textContent = (name || '?')[0];
    if (color) avatar.style.background = color;
  }
  overlay.style.display = 'grid';
  overlay.classList.remove('hidden');
  const confirmBtn = $('#passConfirmBtn');
  if (confirmBtn) confirmBtn.onclick = () => {
    overlay.style.display = 'none';
    overlay.classList.add('hidden');
    if (onConfirm) onConfirm();
  };
}
const $$ = selector => [...document.querySelectorAll(selector)];
const shuffle = source => {
  const result = [...source];
  for (let i = result.length - 1; i; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

function emptyResources() {
  return { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 };
}

function playTone(frequency, duration = .12, volume = .08, type = 'sine', delay = 0) {
  if (!audioEnabled || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  activeSounds.add(oscillator);
  oscillator.onended = () => activeSounds.delete(oscillator);
  oscillator.start(start);
  oscillator.stop(start + duration + .03);
}

function soundEffect(kind) {
  if (kind === 'dice') [196, 247, 294, 370].forEach((note, i) => playTone(note, .1, .035, 'triangle', i * .055));
  if (kind === 'build') [392, 523, 659, 784].forEach((note, i) => playTone(note, .22, .045, i % 2 ? 'sine' : 'triangle', i * .065));
  if (kind === 'trade') [659, 784, 988].forEach((note, i) => playTone(note, .2, .035, 'sine', i * .08));
  if (kind === 'turn') [523, 659, 784].forEach((note, i) => playTone(note, .28, .03, 'sine', i * .1));
  if (kind === 'robber') [196, 165, 131].forEach((note, i) => playTone(note, .32, .04, 'triangle', i * .1));
}

// 少し激しめのBGM（速いテンポ・マイナーキー・強いベースとキック）
const BGM_TRACKS = [
  { name: '荒波の戦い', wave: 'sawtooth', tempo: 400, kick: true,
    notes: [329.63, 493.88, 587.33, 493.88, 392, 587.33, 659.25, 493.88, 440, 659.25, 587.33, 440, 392, 493.88, 329.63, 246.94],
    bass: [82.41, 82.41, 110, 98] },
  { name: '島の襲撃', wave: 'square', tempo: 360, kick: true,
    notes: [440, 523.25, 659.25, 523.25, 587.33, 659.25, 783.99, 659.25, 523.25, 659.25, 587.33, 523.25, 493.88, 440, 392, 440],
    bass: [110, 110, 87.31, 98] },
  { name: '嵐の航海', wave: 'sawtooth', tempo: 440, kick: true,
    notes: [293.66, 349.23, 440, 587.33, 440, 349.23, 392, 466.16, 587.33, 466.16, 392, 349.23, 293.66, 349.23, 261.63, 293.66],
    bass: [73.42, 73.42, 98, 87.31] },
  { name: '決戦の刻', wave: 'square', tempo: 380, kick: true,
    notes: [261.63, 311.13, 392, 466.16, 392, 311.13, 349.23, 415.3, 523.25, 415.3, 349.23, 311.13, 392, 311.13, 261.63, 233.08],
    bass: [65.41, 65.41, 87.31, 77.78] }
];
let currentTrack = 0;

function startBackgroundMusic() {
  clearInterval(bgmTimer);
  if (!audioEnabled) return;
  const track = BGM_TRACKS[currentTrack];
  const melodyVol = track.wave === 'sawtooth' || track.wave === 'square' ? .008 : .013;
  let step = 0;
  bgmTimer = setInterval(() => {
    const note = track.notes[step % track.notes.length];
    if (note) playTone(note, track.tempo / 1000 * .82, melodyVol, track.wave);
    if (track.bass && step % 2 === 0) {
      const low = track.bass[(step / 2) % track.bass.length];
      if (low) playTone(low, track.tempo / 1000 * 1.4, .016, 'triangle');
    }
    if (track.kick) playTone(64, .055, .022, 'square');        // ドラム風キック（毎拍）
    if (track.kick && step % 2 === 1) playTone(1200, .03, .006, 'square'); // ハイハット風
    step++;
  }, track.tempo);
}

function cycleBgm() {
  currentTrack = (currentTrack + 1) % BGM_TRACKS.length;
  if (audioEnabled) startBackgroundMusic();
  toast(`BGM：${BGM_TRACKS[currentTrack].name}`);
}

function setAudioEnabled(enabled) {
  audioEnabled = enabled;
  if (enabled) {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    startBackgroundMusic();
  } else {
    clearInterval(bgmTimer);
    activeSounds.forEach(sound => { try { sound.stop(); } catch {} });
    activeSounds.clear();
    if (audioContext?.state === 'running') audioContext.suspend();
  }
  $('#soundBtn').classList.toggle('muted', !enabled);
  $('#soundBtn').textContent = enabled ? '♪' : '×';
}

function createFairNumbers(coords, types) {
  const isNeighbor = (a, b) => {
    const dq = a.q - b.q;
    const dr = a.r - b.r;
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) === 1;
  };
  // Build a number pool sized to the non-desert hex count, repeating the balanced base
  // distribution (each number twice, 2 & 12 once) so larger boards have enough tokens.
  const base = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  const landCount = types.filter(type => type !== 'desert').length;
  const makePool = () => { const pool = []; while (pool.length < landCount) pool.push(...base); return shuffle(pool).slice(0, landCount); };
  for (let attempt = 0; attempt < 300; attempt++) {
    const pool = makePool();
    const result = [];
    let cursor = 0;
    coords.forEach((_, index) => result[index] = types[index] === 'desert' ? null : pool[cursor++]);
    const fair = result.every((number, index) => ![6, 8].includes(number) || result.every((other, otherIndex) => index === otherIndex || ![6, 8].includes(other) || !isNeighbor(coords[index], coords[otherIndex])));
    if (fair) return result;
  }
  const pool = makePool();
  let cursor = 0;
  return types.map(type => type === 'desert' ? null : pool[cursor++]);
}

function newGame() {
  clearTimeout(botTimer);
  clearTimeout(botWatchdog);
  gameVersion++;
  cardActionSnapshot = null;
  const humanCount = Math.min(4, Math.max(1, gameConfig.humanCount || 1));
  const npcCount = Math.max(0, gameConfig.npcCount != null ? gameConfig.npcCount : 4 - humanCount);
  const total = Math.min(4, Math.max(2, humanCount + npcCount));
  const humanNames = gameConfig.humanNames || [gameConfig.playerName || 'あなた'];
  const players = [];
  for (let i = 0; i < total; i++) {
    const bot = i >= humanCount;
    const name = bot ? (NPC_NAMES[i - humanCount] || `NPC${i - humanCount + 1}`) : ((humanNames[i] || '').trim() || `プレイヤー${i + 1}`);
    players.push({ name, color: COLORS[i % COLORS.length], bot, vp: 0, resources: emptyResources(), dev: [], newDev: [], playedKnights: 0, devPlayed: false, islandVP: 0, hero: null });
  }
  if (gameConfig.expansionHeroes) {
    const heroPool = shuffle(HEROES.map(h => h.id));
    players.forEach((p, i) => { p.hero = heroPool[i % HEROES.length]; });
  }
  const base = shuffle(players.map((_, i) => i));
  const setupOrder = [...base, ...[...base].reverse()];
  state = {
    phase: 'setup', setupStep: 0, setupPart: 'settlement', setupVertex: null, pendingSetupVertex: null, pendingSetupEdge: null,
    turn: setupOrder[0], setupOrder, round: 1, rolled: false, mode: 'setup-settlement',
    targetScore: gameConfig.targetScore || 10, humanCount,
    players,
    buildings: {}, roads: {}, harbors: {}, ships: {}, bank: { wood: 19, brick: 19, wheat: 19, sheep: 19, ore: 19 }, robberTile: null, pendingRobberTile: null, pirateTile: null, pendingPirateTile: null, freeRoads: 0, recentBotMoves: [], longestRoadOwner: null, largestArmyOwner: null,
    devDeck: shuffle([...Array(14).fill('knight'), ...Array(5).fill('victory'), ...Array(2).fill('roadBuilding'), ...Array(2).fill('plenty'), ...Array(2).fill('monopoly')]),
    gameOver: false, botBusy: false, resolvingSeven: false, rollLog: [], pendingCard: null, awaitingPass: false,
    islandSettlers: {}, goldPickQueue: [], expansion: gameConfig.expansion || null,
    movedShipThisTurn: false, shipsBuiltThisTurn: [], barbarianStep: 0
  };
  scale = .82;
  buildBoard();
  $('#board').style.transform = `scale(${scale})`;
  render();
  if (currentIsBot()) { toast(`${state.players[state.turn].name}から配置します`); scheduleBotSetup(); }
  else beginHumanTurn('最初の開拓地を置いてください');
  startNpcHeartbeat();
}

function startNpcHeartbeat() {
  clearInterval(npcHeartbeat);
  npcHeartbeat = setInterval(() => {
    if (!state || !currentIsBot() || state.gameOver) return;
    const elapsed = Date.now() - (state.botTurnStartedAt || 0);
    if (state.phase === 'setup') {
      if (elapsed > 3000) forceSetupNpc();
      return;
    }
    if (state.phase !== 'play') return;
    if (state.resolvingSeven) return; // a human discard / robber move is pending — never auto-advance past it
    if (!state.botBusy && !state.rolled) botTurn();
    else if (!state.botBusy && state.rolled && elapsed > 2200) advanceTurn();
    else if (state.botBusy && elapsed > 5000) {
      state.botBusy = false;
      advanceTurn();
    }
  }, 1000);
}

function buildBoard() {
  if (gameConfig.expansion === 'seafarers') { buildSeafarersBoard(); return; }
  const cfg = boardSizeConfig();
  const U = cfg.unit, hexH = Math.sqrt(3) * U;
  const isStandard = (gameConfig.boardSize || 'standard') === 'standard';
  Object.assign(PIECE_LIMITS, cfg.pieces);
  const board = $('#board');
  board.innerHTML = '<div class="sea-ring"></div>';
  board.dataset.size = gameConfig.boardSize || 'standard';
  vertices = [];
  edges = [];
  tiles = [];
  state.robberTile = null;
  const coords = boardCoords(cfg);
  const useDefault = gameConfig.boardMode === 'default' && isStandard;
  const types = useDefault ? [...DEFAULT_TYPES] : boardResourceTypes(cfg, coords.length);
  const numbers = useDefault ? [...DEFAULT_NUMBERS] : createFairNumbers(coords, types);
  coords.forEach((coord, i) => {
    const x = 345 + 1.5 * U * coord.q;
    const y = 325 + Math.sqrt(3) * U * (coord.r + coord.q / 2);
    const type = types[i];
    const num = numbers[i];
    tiles.push({ x, y, type, num, vertices: [] });
    if (type === 'desert' && state.robberTile == null) state.robberTile = i;
    const element = document.createElement('div');
    element.className = `hex ${type}`;
    element.dataset.tile = i;
    element.style.left = `${x - U}px`;
    element.style.top = `${y - hexH / 2}px`;
    element.style.width = `${2 * U}px`;
    element.style.height = `${hexH}px`;
    element.innerHTML = `<span class="tile-icon">${TYPE_DATA[type].icon}</span>${num ? `<span class="token ${num === 6 || num === 8 ? 'hot' : ''}">${num}<small>${'•'.repeat(6 - Math.abs(7 - num))}</small></span>` : ''}`;
    element.onclick = () => placeRobber(i);
    board.append(element);
  });
  const vertexMap = new Map();
  tiles.forEach((tile, tileIndex) => {
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI / 3 * corner;
      const x = Math.round(tile.x + U * Math.cos(angle));
      const y = Math.round(tile.y + U * Math.sin(angle));
      const key = `${x},${y}`;
      let vertexIndex = vertexMap.get(key);
      if (vertexIndex == null) {
        vertexIndex = vertices.length;
        vertexMap.set(key, vertexIndex);
        vertices.push({ x, y, tiles: [] });
      }
      vertices[vertexIndex].tiles.push(tileIndex);
      tile.vertices.push(vertexIndex);
    }
  });
  const edgeMap = new Map();
  tiles.forEach(tile => {
    for (let corner = 0; corner < 6; corner++) {
      const a = tile.vertices[corner];
      const b = tile.vertices[(corner + 1) % 6];
      const key = [a, b].sort((x, y) => x - y).join('-');
      if (!edgeMap.has(key)) {
        edgeMap.set(key, edges.length);
        edges.push({ a, b });
      }
    }
  });
  edges.forEach((edge, i) => {
    const a = vertices[edge.a];
    const b = vertices[edge.b];
    const element = document.createElement('div');
    element.className = 'edge';
    element.dataset.edge = i;
    element.style.left = `${a.x}px`;
    element.style.top = `${a.y - 4}px`;
    element.style.width = `${Math.hypot(b.x - a.x, b.y - a.y)}px`;
    element.style.transform = `rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`;
    element.onclick = () => placeRoad(i);
    board.append(element);
  });
  vertices.forEach((vertex, i) => {
    const element = document.createElement('div');
    element.className = 'node';
    element.dataset.node = i;
    element.style.left = `${vertex.x}px`;
    element.style.top = `${vertex.y}px`;
    element.onclick = () => placeBuilding(i);
    board.append(element);
  });
  const coastal = new Set(vertices.map((vertex, index) => vertex.tiles.length < 3 ? index : null).filter(index => index != null));
  const boundaryEdges = edges.map((edge, index) => ({ edge, index, angle: Math.atan2((vertices[edge.a].y + vertices[edge.b].y) / 2 - 325, (vertices[edge.a].x + vertices[edge.b].x) / 2 - 345) })).filter(item => coastal.has(item.edge.a) && coastal.has(item.edge.b) && vertices[item.edge.a].tiles.filter(tile => vertices[item.edge.b].tiles.includes(tile)).length === 1).sort((a, b) => a.angle - b.angle);
  const harborCount = cfg.harbors;
  const harborTypes = useDefault ? [null, 'wood', null, 'brick', null, 'wheat', 'sheep', null, 'ore'] : harborTypeList(harborCount);
  const usedHarborVertices = new Set();
  for (let i = 0; i < harborCount; i++) {
    const target = Math.floor(i * boundaryEdges.length / harborCount);
    let offset = 0;
    while (offset < boundaryEdges.length && [boundaryEdges[(target + offset) % boundaryEdges.length].edge.a, boundaryEdges[(target + offset) % boundaryEdges.length].edge.b].some(vertex => usedHarborVertices.has(vertex))) offset++;
    const harborEdge = boundaryEdges[(target + offset) % boundaryEdges.length].edge;
    usedHarborVertices.add(harborEdge.a);
    usedHarborVertices.add(harborEdge.b);
    state.harbors[harborEdge.a] = harborTypes[i];
    state.harbors[harborEdge.b] = harborTypes[i];
    const midpoint = { x: (vertices[harborEdge.a].x + vertices[harborEdge.b].x) / 2, y: (vertices[harborEdge.a].y + vertices[harborEdge.b].y) / 2 };
    const length = Math.hypot(midpoint.x - 345, midpoint.y - 325) || 1;
    const cx = midpoint.x + (midpoint.x - 345) / length * 42;
    const cy = midpoint.y + (midpoint.y - 325) / length * 42;
    [harborEdge.a, harborEdge.b].forEach(v => {
      const dock = document.createElement('div');
      dock.className = 'harbor-dock';
      dock.style.left = `${cx}px`;
      dock.style.top = `${cy}px`;
      dock.style.width = `${Math.hypot(vertices[v].x - cx, vertices[v].y - cy)}px`;
      dock.style.transform = `rotate(${Math.atan2(vertices[v].y - cy, vertices[v].x - cx)}rad)`;
      board.append(dock);
    });
    const marker = document.createElement('div');
    marker.className = 'harbor';
    marker.style.left = `${cx - 25}px`;
    marker.style.top = `${cy - 25}px`;
    marker.textContent = harborTypes[i] ? `2${RESOURCES[harborTypes[i]].icon}` : '3:1';
    board.append(marker);
  }
  const robber = document.createElement('div');
  robber.id = 'robber';
  robber.className = 'robber';
  robber.textContent = '♟';
  board.append(robber);
}

function buildSeafarersBoard() {
  const board = $('#board');
  board.innerHTML = '';
  board.dataset.expansion = 'seafarers';
  vertices = [];
  edges = [];
  tiles = [];
  const S = SEA_HEX_SIZE;
  const HS = S * 1.5, VS = S * Math.sqrt(3), CX = 350, CY = 335;
  const allCoords = [];
  for (let r = -3; r <= 3; r++) {
    for (let q = Math.max(-3, -r - 3); q <= Math.min(3, -r + 3); q++) allCoords.push({ q, r });
  }
  const landTypes = gameConfig.boardMode === 'default' ? [...SEAFARERS_TILE_TYPES] : shuffle([...SEAFARERS_TILE_TYPES]);
  const landNumbers = [...SEAFARERS_TILE_NUMBERS];
  let landIdx = 0;
  allCoords.forEach((coord, i) => {
    const key = `${coord.q},${coord.r}`;
    const islandId = SEAFARERS_HOME.has(key) ? 0 : SEAFARERS_DISC1.has(key) ? 1 : SEAFARERS_DISC2.has(key) ? 2 : null;
    const isSea = islandId === null;
    const x = Math.round(CX + HS * coord.q);
    const y = Math.round(CY + VS * (coord.r + coord.q / 2));
    const type = isSea ? 'sea' : landTypes[landIdx];
    const num = isSea ? null : landNumbers[landIdx];
    if (!isSea) landIdx++;
    tiles.push({ x, y, type, num, vertices: [], island: islandId, coord });
    if (!isSea && type === 'desert') state.robberTile = i;
    const el = document.createElement('div');
    el.className = `hex ${type}`;
    el.dataset.tile = i;
    el.style.left = `${x - S}px`;
    el.style.top = `${y - Math.round(S * Math.sqrt(3) / 2)}px`;
    el.style.width = `${S * 2}px`;
    el.style.height = `${Math.round(S * Math.sqrt(3))}px`;
    if (!isSea) {
      el.innerHTML = `<span class="tile-icon" style="font-size:24px">${TYPE_DATA[type].icon}</span>${num ? `<span class="token ${num === 6 || num === 8 ? 'hot' : ''}" style="width:28px;height:28px;font-size:13px">${num}<small>${'•'.repeat(6 - Math.abs(7 - num))}</small></span>` : ''}`;
      el.onclick = () => placeRobber(i);
    }
    board.append(el);
  });
  const vertexMap = new Map();
  tiles.forEach((tile, tileIndex) => {
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI / 3 * corner;
      const x = Math.round(tile.x + S * Math.cos(angle));
      const y = Math.round(tile.y + S * Math.sin(angle));
      const key = `${x},${y}`;
      let vi = vertexMap.get(key);
      if (vi == null) { vi = vertices.length; vertexMap.set(key, vi); vertices.push({ x, y, tiles: [] }); }
      vertices[vi].tiles.push(tileIndex);
      tile.vertices.push(vi);
    }
  });
  const edgeMap = new Map();
  tiles.forEach(tile => {
    for (let corner = 0; corner < 6; corner++) {
      const a = tile.vertices[corner], b = tile.vertices[(corner + 1) % 6];
      const key = [a, b].sort((x, y) => x - y).join('-');
      if (!edgeMap.has(key)) { edgeMap.set(key, edges.length); edges.push({ a, b }); }
    }
  });
  const LAND_TYPES = new Set(['forest','hills','pasture','fields','mountains','desert','gold']);
  const isLandVertex = vi => vertices[vi].tiles.some(t => LAND_TYPES.has(tiles[t].type));
  edges.forEach((edge, i) => {
    const a = vertices[edge.a], b = vertices[edge.b];
    const el = document.createElement('div');
    el.className = 'edge';
    el.dataset.edge = i;
    el.style.left = `${a.x}px`;
    el.style.top = `${a.y - 4}px`;
    el.style.width = `${Math.hypot(b.x - a.x, b.y - a.y)}px`;
    el.style.transform = `rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`;
    el.onclick = () => { placeRoad(i); placeShip(i); };
    board.append(el);
  });
  vertices.forEach((vertex, i) => {
    if (!isLandVertex(i)) return;
    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.node = i;
    el.style.left = `${vertex.x}px`;
    el.style.top = `${vertex.y}px`;
    el.onclick = () => placeBuilding(i);
    board.append(el);
  });
  // Harbors on coastal edges (land↔sea boundary)
  const coastalEdges = edges.map((edge, i) => {
    const shared = vertices[edge.a].tiles.filter(t => vertices[edge.b].tiles.includes(t));
    const types = shared.map(t => tiles[t].type);
    const hasLand = types.some(t => LAND_TYPES.has(t));
    const hasSea = types.some(t => t === 'sea');
    if (!hasLand || !hasSea) return null;
    const mx = (vertices[edge.a].x + vertices[edge.b].x) / 2;
    const my = (vertices[edge.a].y + vertices[edge.b].y) / 2;
    return { i, edge, angle: Math.atan2(my - CY, mx - CX) };
  }).filter(Boolean).sort((a, b) => a.angle - b.angle);
  const harborTypes = gameConfig.boardMode === 'default'
    ? [null, 'wood', null, 'brick', null, 'wheat', 'sheep', null, 'ore']
    : shuffle([null, null, null, null, 'wood', 'brick', 'wheat', 'sheep', 'ore']);
  const usedHV = new Set();
  for (let i = 0; i < Math.min(9, coastalEdges.length); i++) {
    const target = Math.floor(i * coastalEdges.length / Math.min(9, coastalEdges.length));
    let offset = 0;
    while (offset < coastalEdges.length && [coastalEdges[(target + offset) % coastalEdges.length].edge.a, coastalEdges[(target + offset) % coastalEdges.length].edge.b].some(v => usedHV.has(v))) offset++;
    const { edge } = coastalEdges[(target + offset) % coastalEdges.length];
    usedHV.add(edge.a); usedHV.add(edge.b);
    state.harbors[edge.a] = harborTypes[i];
    state.harbors[edge.b] = harborTypes[i];
    const midpoint = { x: (vertices[edge.a].x + vertices[edge.b].x) / 2, y: (vertices[edge.a].y + vertices[edge.b].y) / 2 };
    const len = Math.hypot(midpoint.x - CX, midpoint.y - CY) || 1;
    const cx = midpoint.x + (midpoint.x - CX) / len * 36;
    const cy = midpoint.y + (midpoint.y - CY) / len * 36;
    [edge.a, edge.b].forEach(v => {
      const dock = document.createElement('div');
      dock.className = 'harbor-dock';
      dock.style.left = `${cx}px`; dock.style.top = `${cy}px`;
      dock.style.width = `${Math.hypot(vertices[v].x - cx, vertices[v].y - cy)}px`;
      dock.style.transform = `rotate(${Math.atan2(vertices[v].y - cy, vertices[v].x - cx)}rad)`;
      board.append(dock);
    });
    const marker = document.createElement('div');
    marker.className = 'harbor';
    marker.style.left = `${cx - 25}px`; marker.style.top = `${cy - 25}px`;
    marker.textContent = harborTypes[i] ? `2${RESOURCES[harborTypes[i]].icon}` : '3:1';
    board.append(marker);
  }
  const robber = document.createElement('div');
  robber.id = 'robber'; robber.className = 'robber'; robber.textContent = '♟';
  board.append(robber);
  const pirate = document.createElement('div');
  pirate.id = 'pirate'; pirate.className = 'robber pirate-token'; pirate.textContent = '⛵';
  board.append(pirate);
}

function renderPersistentPieces() {
  $$('.persistent-piece').forEach(element => element.remove());
  const board = $('#board');
  const recentRoads = new Set(state.recentBotMoves.filter(move => move.kind === 'road').map(move => move.id));
  const recentBuildings = new Set(state.recentBotMoves.filter(move => move.kind === 'building').map(move => move.id));
  Object.entries(state.roads).forEach(([edgeIndex, player]) => {
    const edge = edges[Number(edgeIndex)];
    if (!edge || !state.players[player]) return;
    const a = vertices[edge.a];
    const b = vertices[edge.b];
    const piece = document.createElement('div');
    piece.className = `persistent-piece road-piece${recentRoads.has(Number(edgeIndex)) ? ' recent-move' : ''}`;
    piece.dataset.edge = edgeIndex;
    piece.dataset.player = player;
    piece.style.left = `${a.x}px`;
    piece.style.top = `${a.y - 6}px`;
    piece.style.width = `${Math.hypot(b.x - a.x, b.y - a.y)}px`;
    piece.style.transform = `rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`;
    piece.style.setProperty('--piece-color', state.players[player].color);
    board.append(piece);
  });
  Object.entries(state.ships || {}).forEach(([edgeIndex, player]) => {
    const edge = edges[Number(edgeIndex)];
    if (!edge || !state.players[player]) return;
    const a = vertices[edge.a], b = vertices[edge.b];
    const piece = document.createElement('div');
    piece.className = 'persistent-piece ship-piece';
    piece.dataset.edge = edgeIndex;
    piece.dataset.player = player;
    piece.style.left = `${a.x}px`;
    piece.style.top = `${a.y - 6}px`;
    piece.style.width = `${Math.hypot(b.x - a.x, b.y - a.y)}px`;
    piece.style.transform = `rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`;
    piece.style.setProperty('--piece-color', state.players[player].color);
    board.append(piece);
  });
  Object.entries(state.buildings).forEach(([vertexIndex, building]) => {
    const vertex = vertices[Number(vertexIndex)];
    if (!vertex || !state.players[building.player]) return;
    const piece = document.createElement('div');
    piece.className = `persistent-piece building-piece ${building.type === 'city' ? 'city-piece' : ''}${recentBuildings.has(Number(vertexIndex)) ? ' recent-move' : ''}`;
    piece.dataset.node = vertexIndex;
    piece.dataset.player = building.player;
    piece.style.left = `${vertex.x}px`;
    piece.style.top = `${vertex.y}px`;
    piece.style.setProperty('--piece-color', state.players[building.player].color);
    board.append(piece);
  });
}

function render() {
  const player = state.players[state.turn];
  const setup = state.phase === 'setup';
  $('#board').classList.toggle('setup-mode', setup);
  if (document.body) document.body.classList.toggle('expansion-seafarers', state.expansion === 'seafarers');
  $('#turnName').textContent = player.name;
  $('#turnDot').style.background = player.color;
  $('#turnScore').textContent = setup ? `${Math.floor(state.setupStep / 4) + 1}個目を配置` : (state.gameOver ? `${totalVP(state.turn)} VP` : `最低 ${visibleVP(state.turn)} VP`);
  $('#roundLabel').textContent = setup ? '初期配置' : `ROUND ${state.round}`;
  const botTurnNow = currentIsBot();
  const viewer = state.humanCount === 1 ? 0 : ((botTurnNow || state.awaitingPass) ? null : state.turn);
  $('#playersList').innerHTML = state.players.map((item, i) => {
    const isMe = viewer != null && i === viewer;
    const breakdown = (isMe && !setup) ? vpBreakdown(i) : '';
    const vpText = state.gameOver ? `${totalVP(i)} / ${state.targetScore}` : `${visibleVP(i)} / ${state.targetScore}`;
    const handCount = Object.values(item.resources).reduce((a, b) => a + b, 0);
    const devCount = item.dev.length + item.newDev.length;
    const stats = `手札${handCount} · 開拓地${countPieces(i, 'settlement')} · 都市${countPieces(i, 'city')} · 道${countPieces(i, 'road')} · 発展${devCount} · 騎士${item.playedKnights}`;
    const heroData = item.hero ? HEROES.find(h => h.id === item.hero) : null;
    const badges = [
      state.longestRoadOwner === i ? '<span class="award-badge road-award">🛣 最長交易路</span>' : '',
      state.largestArmyOwner === i ? '<span class="award-badge army-award">⚔ 最大騎士力</span>' : '',
      heroData ? `<span class="award-badge hero-badge" title="${heroData.desc}">${heroData.icon} ${heroData.name}</span>` : ''
    ].join('');
    return `<div class="player-row ${i === state.turn ? 'active' : ''}"><span class="avatar" style="background:${item.color}">${item.name[0]}</span><span class="player-name"><b>${item.name}${isMe ? ' (YOU)' : ''}${item.bot ? ' <small class="npc-tag">NPC</small>' : ''}</b><small>${stats}</small>${badges ? `<small class="award-row">${badges}</small>` : ''}${breakdown ? `<small class="vp-breakdown">${breakdown}</small>` : ''}</span><span class="vp"><small>${state.gameOver ? '勝利点' : '最低点'}</small>${vpText}</span></div>`;
  }).join('');
  const me = viewer != null ? state.players[viewer] : null;
  $('#handLabel').textContent = me ? `${me.name}の手札` : 'NPCの手番';
  $('#resourceGrid').innerHTML = Object.entries(RESOURCES).map(([key, resource]) => `<div class="resource${me ? '' : ' hand-hidden'}"><b>${me ? me.resources[key] : '–'}</b><i>${resource.icon}</i><small>${resource.name}</small></div>`).join('');
  $('#cardCount').textContent = me ? `${Object.values(me.resources).reduce((a, b) => a + b, 0)} CARDS` : '';
  $('#devCount').textContent = `${me ? me.dev.length + me.newDev.length : 0}枚`;
  $('#playDevBtn').disabled = setup || botTurnNow || !me || !state.rolled || state.resolvingSeven || me.devPlayed || !me.dev.some(card => card !== 'victory');
  renderDevelopmentCards();
  renderRollLog();
  $('#cancelCardBtn').hidden = !state.pendingCard;
  $$('.node').forEach(element => {
    const building = state.buildings[element.dataset.node];
    element.className = 'node';
    if (building) {
      element.classList.add('occupied');
      if (building.type === 'city') element.classList.add('city');
      element.dataset.player = building.player;
      element.style.setProperty('--player-color', state.players[building.player].color);
      element.style.background = state.players[building.player].color;
    } else {
      delete element.dataset.player;
      element.style.removeProperty('--player-color');
      element.style.background = '';
    }
  });
  $$('.edge').forEach(element => {
    const owner = state.roads[element.dataset.edge];
    element.className = 'edge';
    if (owner !== undefined) {
      element.classList.add('occupied');
      element.dataset.player = owner;
      element.style.setProperty('--player-color', state.players[owner].color);
      element.style.background = state.players[owner].color;
    } else {
      delete element.dataset.player;
      element.style.removeProperty('--player-color');
      element.style.background = '';
    }
  });
  renderPersistentPieces();
  const robber = $('#robber');
  if (robber) {
    const displayTile = state.pendingRobberTile ?? state.robberTile;
    if (displayTile != null) {
      robber.style.left = `${tiles[displayTile].x - 14}px`;
      robber.style.top = `${tiles[displayTile].y - 42}px`;
    }
    robber.classList.toggle('pending', state.pendingRobberTile != null);
  }
  const pirateTok = $('#pirate');
  if (pirateTok) {
    const displayTile = state.pendingPirateTile ?? state.pirateTile;
    pirateTok.hidden = displayTile == null;
    if (displayTile != null) {
      pirateTok.style.left = `${tiles[displayTile].x - 14}px`;
      pirateTok.style.top = `${tiles[displayTile].y - 22}px`;
    }
    pirateTok.classList.toggle('pending', state.pendingPirateTile != null);
  }
  const confirmOverlay = $('#robberConfirmOverlay');
  if (confirmOverlay) {
    const show = state.mode === 'robber' && state.pendingRobberTile != null;
    confirmOverlay.style.display = show ? 'flex' : 'none';
  }
  const pirateOverlay = $('#pirateConfirmOverlay');
  if (pirateOverlay) {
    const show = state.mode === 'pirate' && state.pendingPirateTile != null;
    pirateOverlay.style.display = show ? 'flex' : 'none';
  }
  $$('.build-card').forEach(button => {
    const buildType = button.dataset.build;
    if (setup) button.disabled = botTurnNow || buildType !== state.setupPart;
    else if (buildType === 'ship') button.disabled = state.resolvingSeven || botTurnNow || !state.rolled || !canAfford('ship', state.turn) || !hasPieceAvailable(state.turn, 'ship') || state.expansion !== 'seafarers';
    else button.disabled = state.resolvingSeven || botTurnNow || !state.rolled || !canAfford(buildType, state.turn) || !hasPieceAvailable(state.turn, buildType);
  });
  const moveShipBtn = $('#moveShipBtn');
  if (moveShipBtn) {
    const inMove = state.mode === 'moveShip';
    const canMove = state.expansion === 'seafarers' && !setup && !state.resolvingSeven && !botTurnNow && state.rolled && !state.movedShipThisTurn && edges.some((_, i) => isMovableShip(i, state.turn));
    moveShipBtn.disabled = !inMove && !canMove;
    moveShipBtn.classList.toggle('active', inMove);
    moveShipBtn.textContent = inMove ? '✕ 船の移動をやめる' : '⛵ 船を移動（1ターン1回）';
  }
  const setupSelectionReady = state.setupPart === 'settlement' ? state.pendingSetupVertex != null : state.pendingSetupEdge != null;
  $('#rollBtn').disabled = setup ? botTurnNow || !setupSelectionReady : state.rolled || botTurnNow;
  $('#endTurnBtn').disabled = setup || state.resolvingSeven || (!botTurnNow && !state.rolled);
  $('#endTurnBtn').innerHTML = !setup && botTurnNow ? 'NPCを進める <b>→</b>' : 'ターン終了 <b>→</b>';
  $('#npcControlBtn').hidden = !botTurnNow || state.gameOver;
  $('#npcControlBtn').textContent = setup ? 'NPCの初期配置を進める →' : 'NPCを今すぐ進める →';
  if (!setup) refreshTradeTargets();
  const noTradePartners = !setup && allOpponents().length === 0;
  $('#playerTradeBtn').disabled = setup || state.resolvingSeven || botTurnNow || !state.rolled || noTradePartners;
  $('#playerTradeAllBtn').disabled = setup || state.resolvingSeven || botTurnNow || !state.rolled || noTradePartners;
  $('#tradeBtn').disabled = setup || state.resolvingSeven || botTurnNow || !state.rolled;
  if (!setup) $('#bankRate').textContent = `${maritimeRate(state.turn, $('#tradeGive').value)} : 1`;
  $('#myHarbors').innerHTML = myHarborSummary();
  $('#setupGuide').hidden = !setup;
  if (setup) {
    const humanTurn = !botTurnNow;
    const placingSettlement = state.setupPart === 'settlement';
    $('#setupGuideTitle').textContent = humanTurn ? (placingSettlement ? '開拓地を置こう' : '街道を置こう') : `${player.name}が配置中…`;
    $('#setupGuideText').textContent = humanTurn ? (placingSettlement ? '小さい白い丸を選び、下の決定ボタンを押してください' : '白い線を選び、下の決定ボタンを押してください') : '少し待ってください';
    const selected = placingSettlement ? state.pendingSetupVertex != null : state.pendingSetupEdge != null;
    $('#rollBtn').innerHTML = `<span class="dice-icon">${placingSettlement ? '⌂' : '━'}</span><span><small>${selected ? '選択済み' : '① 盤面から選択'}</small>${selected ? '② ここに決定' : (placingSettlement ? '開拓地の場所を選ぶ' : '街道の場所を選ぶ')}</span>`;
  } else {
    $('#rollBtn').innerHTML = '<span class="dice-icon">⚄</span><span><small>アクション</small>ダイスを振る</span>';
  }
  updateAvailable();
  renderBarbarian();
}

function adjacentNodes(vertex) {
  return edges.filter(edge => edge.a === vertex || edge.b === vertex).map(edge => edge.a === vertex ? edge.b : edge.a);
}

function canPlaceInitialSettlement(vertex) {
  if (state.expansion === 'seafarers') {
    const LAND = new Set(['forest','hills','pasture','fields','mountains','desert','gold']);
    if (!vertices[vertex].tiles.some(t => LAND.has(tiles[t].type))) return false;
  }
  return !state.buildings[vertex] && !adjacentNodes(vertex).some(neighbor => state.buildings[neighbor]);
}

function effectiveCost(type, player) {
  const base = { ...COSTS[type] };
  if (!state || !state.players[player]) return base;
  const hero = state.players[player].hero;
  if (type === 'city' && hero === 'smith') base.ore = Math.max(0, (base.ore || 0) - 1);
  if (type === 'road' && hero === 'architect') delete base.wood;
  return base;
}
function canAfford(type, player = 0) {
  return Object.entries(effectiveCost(type, player)).every(([resource, amount]) => state.players[player].resources[resource] >= amount);
}

function pay(type, player = 0) {
  Object.entries(effectiveCost(type, player)).forEach(([resource, amount]) => {
    state.players[player].resources[resource] -= amount;
    state.bank[resource] += amount;
  });
}

function countPieces(player, type) {
  if (type === 'road') return Object.values(state.roads).filter(owner => owner === player).length;
  return Object.values(state.buildings).filter(building => building.player === player && building.type === type).length;
}

function hasPieceAvailable(player, type) {
  if (type === 'development') return state.devDeck.length > 0;
  return countPieces(player, type) < PIECE_LIMITS[type];
}

function myHarborSummary(player = state.turn) {
  const owned = new Set();
  Object.entries(state.harbors).forEach(([vertex, type]) => {
    if (state.buildings[vertex]?.player === player) owned.add(type);
  });
  if (!owned.size) return '保有する港はありません（すべて<b>4:1</b>）';
  const generic = owned.has(null) ? '<b>3:1</b> どの資源でも' : '';
  const specific = [...owned].filter(t => t).map(t => `<b>2:1</b> ${RESOURCES[t].icon}${RESOURCES[t].name}`);
  return '保有する港：' + [generic, ...specific].filter(Boolean).join(' ／ ');
}

function maritimeRate(player, resource) {
  let rate = 4;
  Object.entries(state.harbors).forEach(([vertex, type]) => {
    if (state.buildings[vertex]?.player !== player) return;
    if (type === resource) rate = 2;
    else if (type == null) rate = Math.min(rate, 3);
  });
  if (state.players[player]?.hero === 'merchant') rate = Math.min(rate, 3);
  return rate;
}

function visibleVP(player) {
  const islandVP = state.players[player].islandVP || 0;
  return state.players[player].vp + (state.longestRoadOwner === player ? 2 : 0) + (state.largestArmyOwner === player ? 2 : 0) + islandVP;
}

function vpBreakdown(player) {
  const p = state.players[player];
  const settlements = Object.values(state.buildings).filter(b => b.player === player && b.type === 'settlement').length;
  const cities = Object.values(state.buildings).filter(b => b.player === player && b.type === 'city').length;
  const parts = [];
  if (settlements) parts.push(`開拓地×${settlements}`);
  if (cities) parts.push(`都市×${cities}`);
  if (state.longestRoadOwner === player) parts.push('最長交易路+2');
  if (state.largestArmyOwner === player) parts.push('最大騎士力+2');
  if (p.islandVP) parts.push(`新島発見+${p.islandVP}`);
  const secretCards = [...p.dev, ...p.newDev].filter(c => c === 'victory').length;
  if (secretCards) parts.push(`勝利点カード×${secretCards}`);
  return parts.join('・');
}

function totalVP(player) {
  return visibleVP(player) + [...state.players[player].dev, ...state.players[player].newDev].filter(card => card === 'victory').length;
}

function updateAvailable() {
  $$('.node,.edge').forEach(element => { element.classList.remove('available', 'upgrade-target'); delete element.dataset.tip; });
  $$('.hex').forEach(element => element.classList.remove('robber-target', 'robber-pending'));
  if (state.mode === 'robber') {
    $$('.hex').filter(element => +element.dataset.tile !== state.robberTile).forEach(element => element.classList.add('robber-target'));
    if (state.pendingRobberTile != null) {
      const el = $$('.hex').find(e => +e.dataset.tile === state.pendingRobberTile);
      if (el) el.classList.add('robber-pending');
    }
    return;
  }
  const actor = state.turn;
  if (state.phase === 'setup') {
    if (currentIsBot()) return;
    if (state.setupPart === 'settlement') $$('.node').filter(element => canPlaceInitialSettlement(+element.dataset.node)).forEach(element => {
      const vertex = +element.dataset.node;
      element.dataset.tip = placementTip(vertex);
      element.classList.add('available', 'setup-candidate');
      if (vertex === state.pendingSetupVertex) {
        element.classList.add('selected-preview');
        element.style.setProperty('--preview-color', state.players[actor].color);
      }
    });
    else $$('.edge').filter(element => state.roads[element.dataset.edge] === undefined && !isSeaEdge(+element.dataset.edge) && edgeTouches(+element.dataset.edge, state.setupVertex)).forEach(element => {
      const edge = +element.dataset.edge;
      element.classList.add('available', 'setup-candidate');
      if (edge === state.pendingSetupEdge) {
        element.classList.add('selected-preview');
        element.style.setProperty('--preview-color', state.players[actor].color);
      }
    });
    return;
  }
  if (state.mode === 'pirate') {
    $$('.hex').filter(el => tiles[+el.dataset.tile]?.type === 'sea' && +el.dataset.tile !== state.pirateTile).forEach(el => el.classList.add('robber-target'));
    if (state.pendingPirateTile != null) {
      const el = $$('.hex').find(e => +e.dataset.tile === state.pendingPirateTile);
      if (el) el.classList.add('robber-pending');
    }
    return;
  }
  if (!state.mode || currentIsBot()) return;
  if (state.mode === 'road') $$('.edge').filter(element => state.roads[element.dataset.edge] === undefined && !isSeaEdge(+element.dataset.edge) && roadConnected(+element.dataset.edge, actor)).forEach(element => element.classList.add('available'));
  if (state.mode === 'ship') $$('.edge').filter(element => canPlaceShip(+element.dataset.edge, actor)).forEach(element => element.classList.add('available'));
  if (state.mode === 'moveShip' && state.movingShip == null) $$('.edge').filter(element => isMovableShip(+element.dataset.edge, actor)).forEach(element => element.classList.add('available', 'ship-movable'));
  if (state.mode === 'moveShip' && state.movingShip != null) $$('.edge').filter(element => canPlaceShip(+element.dataset.edge, actor)).forEach(element => element.classList.add('available'));
  if (state.mode === 'settlement') $$('.node').filter(element => canSettle(+element.dataset.node, actor)).forEach(element => element.classList.add('available'));
  if (state.mode === 'city') $$('.node').filter(element => state.buildings[element.dataset.node]?.player === actor && state.buildings[element.dataset.node].type === 'settlement').forEach(element => element.classList.add('available', 'upgrade-target'));
}

function renderRollLog() {
  const box = $('#rollLog');
  if (!box) return;
  const log = state.rollLog || [];
  if (!log.length || state.phase === 'setup') { box.hidden = true; return; }
  box.hidden = false;
  $('#rollLogList').innerHTML = log.slice(0, 7).map(entry => {
    const player = state.players[entry.player];
    return `<div class="roll-entry${entry.sum === 7 ? ' rl-seven' : ''}"><span class="rl-round">R${entry.round}</span><span class="avatar" style="background:${player.color}">${player.name[0]}</span><span class="rl-name">${player.name}</span><span class="rl-sum">${entry.sum}</span></div>`;
  }).join('');
}

function renderDevelopmentCards() {
  const viewer = state.humanCount === 1 ? 0 : ((currentIsBot() || state.awaitingPass) ? null : state.turn);
  const player = viewer != null ? state.players[viewer] : null;
  if (!player) { $('#devCardsList').innerHTML = '<small>NPCの手番です</small>'; return; }
  const names = { knight: '騎士', roadBuilding: '街道建設', plenty: '発見', monopoly: '独占', victory: '勝利点' };
  const descriptions = { knight: '盗賊を移動', roadBuilding: '街道を2本建設', plenty: '好きな資源を2枚', monopoly: '1種類を独占', victory: '非公開の1勝利点' };
  const cards = [
    ...player.dev.map((card, index) => ({ card, index, fresh: false })),
    ...player.newDev.map((card, index) => ({ card, index, fresh: true }))
  ];
  $('#devCardsList').innerHTML = cards.length ? cards.map(item => `<div class="dev-card-item ${item.fresh ? 'new' : ''}"><span><b>✦ ${names[item.card]}</b><br>${descriptions[item.card]}${item.fresh ? ' · 次ターンから' : ''}</span>${item.card === 'victory' ? '<em>自動</em>' : `<button data-dev-card="${item.card}" ${item.fresh || player.devPlayed || currentIsBot() || !state.rolled || state.resolvingSeven ? 'disabled' : ''}>使う</button>`}</div>`).join('') : '<small>発展カードはまだありません</small>';
  $$('[data-dev-card]').forEach(button => button.onclick = () => {
    const labels = { knight: '騎士', roadBuilding: '街道建設', plenty: '発見', monopoly: '独占' };
    if (playDevelopment(state.turn, button.dataset.devCard)) toast(`${labels[button.dataset.devCard]}カードを使いました`);
  });
}

function placementTip(vertex) {
  const parts = vertices[vertex].tiles.map(tileIndex => {
    const tile = tiles[tileIndex];
    return `${TYPE_DATA[tile.type].icon}${tile.num || '砂漠'}`;
  });
  const harbor = Object.prototype.hasOwnProperty.call(state.harbors, vertex) ? ` · 港${state.harbors[vertex] ? `2:1 ${RESOURCES[state.harbors[vertex]].icon}` : '3:1'}` : '';
  return `${parts.join(' / ')} · 期待値${Math.round(setupVertexScore(vertex))}${harbor}`;
}

function edgeTouches(edgeIndex, vertex) {
  const edge = edges[edgeIndex];
  return edge.a === vertex || edge.b === vertex;
}

function roadConnected(edgeIndex, player) {
  const edge = edges[edgeIndex];
  return [edge.a, edge.b].some(vertex => {
    const building = state.buildings[vertex];
    if (building && building.player !== player) return false;
    return building?.player === player || edges.some((item, i) => (item.a === vertex || item.b === vertex) && state.roads[i] === player);
  });
}

function isSeaEdge(edgeIndex) {
  const edge = edges[edgeIndex];
  const shared = vertices[edge.a].tiles.filter(t => vertices[edge.b].tiles.includes(t));
  return shared.some(t => tiles[t].type === 'sea');
}

function shipConnected(edgeIndex, player) {
  const edge = edges[edgeIndex];
  return [edge.a, edge.b].some(vertex => {
    const building = state.buildings[vertex];
    if (building && building.player !== player) return false;
    if (building?.player === player) return true;
    return edges.some((item, i) => (item.a === vertex || item.b === vertex) && state.ships[i] === player);
  });
}

function canPlaceShip(edgeIndex, player) {
  if (state.ships[edgeIndex] !== undefined || state.roads[edgeIndex] !== undefined) return false;
  if (!isSeaEdge(edgeIndex)) return false;
  // Pirate blocks ship building on adjacent sea tiles
  if (state.pirateTile != null) {
    const edge = edges[edgeIndex];
    const adjacentTiles = vertices[edge.a].tiles.filter(t => vertices[edge.b].tiles.includes(t));
    if (adjacentTiles.includes(state.pirateTile)) return false;
  }
  return shipConnected(edgeIndex, player);
}

function placeShip(edgeIndex) {
  const me = state.turn;
  if (state.mode === 'moveShip') {
    if (state.movingShip == null) pickShipToMove(edgeIndex);
    else relocateShipTo(edgeIndex);
    return;
  }
  if (currentIsBot() || state.mode !== 'ship' || !hasPieceAvailable(me, 'ship') || !canPlaceShip(edgeIndex, me)) return;
  pay('ship', me);
  state.ships[edgeIndex] = me;
  (state.shipsBuiltThisTurn = state.shipsBuiltThisTurn || []).push(edgeIndex);
  state.mode = null;
  updateAwards();
  toast('船を建設しました');
  soundEffect('build');
  render();
  checkWin(me);
}

function countShips(player) {
  return Object.values(state.ships).filter(p => p === player).length;
}

// A ship can be relocated if it sits at the open end of a route: one endpoint has
// no building and no other ship of the same player. Ships built/moved this turn are locked.
function isMovableShip(edgeIndex, player) {
  if (state.ships[edgeIndex] !== player) return false;
  if ((state.shipsBuiltThisTurn || []).includes(edgeIndex)) return false;
  const edge = edges[edgeIndex];
  return [edge.a, edge.b].some(vertex => {
    if (state.buildings[vertex]) return false;
    return !edges.some((other, i) => i !== edgeIndex && (other.a === vertex || other.b === vertex) && state.ships[i] === player);
  });
}

function beginMoveShip() {
  const me = state.turn;
  if (state.phase !== 'play' || currentIsBot() || !state.rolled || state.resolvingSeven) return;
  if (state.expansion !== 'seafarers') return;
  if (state.movedShipThisTurn) return toast('船の移動は1ターンに1回までです');
  const movable = edges.some((_, i) => isMovableShip(i, me));
  if (!movable) return toast('動かせる船がありません（航路の先端の船だけ動かせます）');
  state.mode = 'moveShip';
  state.movingShip = null;
  render();
  toast('動かす船（航路の先端）を選んでください');
}

function pickShipToMove(edgeIndex) {
  const me = state.turn;
  if (!isMovableShip(edgeIndex, me)) return;
  state.movingShip = edgeIndex;
  delete state.ships[edgeIndex];
  render();
  toast('移動先の海路を選んでください');
}

function relocateShipTo(edgeIndex) {
  const me = state.turn;
  if (state.movingShip == null) return;
  if (!canPlaceShip(edgeIndex, me)) return;
  state.ships[edgeIndex] = me;
  state.movingShip = null;
  state.movedShipThisTurn = true;
  state.mode = null;
  updateAwards();
  soundEffect('build');
  toast('船を移動しました');
  render();
  checkWin(me);
}

function cancelMoveShip() {
  const me = state.turn;
  if (state.mode !== 'moveShip') return;
  if (state.movingShip != null) { state.ships[state.movingShip] = me; state.movingShip = null; }
  state.mode = null;
  render();
}

function canSettle(vertex, player) {
  if (!canPlaceInitialSettlement(vertex)) return false;
  return edges.some((edge, i) =>
    (edge.a === vertex || edge.b === vertex) &&
    (state.roads[i] === player || state.ships[i] === player)
  );
}

function grantIslandDiscovery(vertex, player) {
  if (state.expansion !== 'seafarers') return;
  vertices[vertex].tiles.forEach(tileIndex => {
    const island = tiles[tileIndex]?.island;
    if (island == null || island === 0) return;
    if (state.islandSettlers[island] != null) return;
    state.islandSettlers[island] = player;
    state.players[player].islandVP = (state.players[player].islandVP || 0) + ISLAND_BONUS_VP;
    toast(`✨ ${state.players[player].name}が新しい島を発見！ +${ISLAND_BONUS_VP}VP`);
  });
}

function placeBuilding(vertex) {
  const me = state.turn;
  if (state.phase === 'setup') {
    if (currentIsBot() || state.setupPart !== 'settlement' || !canPlaceInitialSettlement(vertex)) return;
    state.pendingSetupVertex = vertex;
    toast('選んだ場所を自分の色で表示しました。下の「ここに決定」を押してください');
    render();
    return;
  }
  if (currentIsBot()) return;
  if (state.mode === 'settlement' && hasPieceAvailable(me, 'settlement') && canSettle(vertex, me)) {
    pay('settlement', me);
    state.buildings[vertex] = { player: me, type: 'settlement' };
    state.players[me].vp++;
    grantIslandDiscovery(vertex, me);
    state.mode = null;
    toast('開拓地を建設しました');
    soundEffect('build');
    updateAwards();
    render();
    checkWin(me);
  } else if (state.mode === 'city' && hasPieceAvailable(me, 'city') && state.buildings[vertex]?.player === me && state.buildings[vertex].type === 'settlement') {
    pay('city', me);
    state.buildings[vertex].type = 'city';
    state.players[me].vp++;
    state.mode = null;
    toast('都市へ発展しました');
    soundEffect('build');
    render();
    checkWin(me);
  }
}

function placeRoad(edgeIndex) {
  const me = state.turn;
  if (state.phase === 'setup') {
    if (currentIsBot() || state.setupPart !== 'road' || state.roads[edgeIndex] !== undefined || isSeaEdge(edgeIndex) || !edgeTouches(edgeIndex, state.setupVertex)) return;
    state.pendingSetupEdge = edgeIndex;
    toast('街道を選びました。下の「ここに決定」を押してください');
    render();
    return;
  }
  if (currentIsBot()) return;
  if (state.mode !== 'road' || !hasPieceAvailable(me, 'road') || state.roads[edgeIndex] !== undefined || !roadConnected(edgeIndex, me)) return;
  if (state.freeRoads > 0) {
    state.roads[edgeIndex] = me;
    state.freeRoads--;
    updateAwards();
    soundEffect('build');
    if (state.freeRoads > 0 && edges.some((_, i) => state.roads[i] === undefined && roadConnected(i, me)) && hasPieceAvailable(me, 'road')) {
      render();
      toast(`街道を建設しました。あと${state.freeRoads}本置けます`);
      checkWin(me);
      return;
    }
    state.freeRoads = 0;
    state.mode = null;
    clearCardAction();
    render();
    toast('街道建設カードの街道を置き終えました');
    checkWin(me);
    return;
  }
  pay('road', me);
  state.roads[edgeIndex] = me;
  state.mode = null;
  updateAwards();
  toast('街道を建設しました');
  soundEffect('build');
  render();
  checkWin(me);
}

function placeInitialSettlement(vertex, player) {
  state.buildings[vertex] = { player, type: 'settlement' };
  state.players[player].vp++;
  if (state.setupStep >= 4) grantInitialResources(vertex, player);
}

function grantInitialResources(vertex, player) {
  vertices[vertex].tiles.forEach(tileIndex => {
    const resource = TYPE_DATA[tiles[tileIndex].type].res;
    if (resource && state.bank[resource] > 0) {
      state.players[player].resources[resource]++;
      state.bank[resource]--;
    }
  });
}

function finishSetupTurn() {
  state.setupStep++;
  state.setupVertex = null;
  state.pendingSetupVertex = null;
  state.pendingSetupEdge = null;
  state.setupPart = 'settlement';
  state.mode = 'setup-settlement';
  if (state.setupStep >= state.setupOrder.length) {
    state.phase = 'play';
    state.turn = 0;
    state.mode = null;
    state.rolled = false;
    scale = .82;
    $('#board').style.transform = 'scale(.82)';
    toast('初期配置完了！');
    render();
    if (currentIsBot()) scheduleBotTurn(); else beginHumanTurn();
    return;
  }
  state.turn = state.setupOrder[state.setupStep];
  state.botTurnStartedAt = Date.now();
  render();
  if (currentIsBot()) scheduleBotSetup();
  else beginHumanTurn('2個目の開拓地を置いてください');
}

function setupVertexScore(vertex) {
  return vertices[vertex].tiles.reduce((score, tileIndex) => {
    const num = tiles[tileIndex].num;
    return score + (num ? 6 - Math.abs(7 - num) : 0);
  }, 0) + Math.random() * 2;
}

// Pip value of a number token (probability weight): 6/8 → 5, 2/12 → 1.
function pipValue(num) { return num ? 6 - Math.abs(7 - num) : 0; }

// What a player already produces — resource pips and which numbers they sit on.
function botProduction(player) {
  const res = {}, nums = {};
  Object.entries(state.buildings).forEach(([vertex, building]) => {
    if (building.player !== player) return;
    const weight = building.type === 'city' ? 2 : 1;
    vertices[vertex].tiles.forEach(tileIndex => {
      const resource = TYPE_DATA[tiles[tileIndex].type].res;
      const num = tiles[tileIndex].num;
      if (resource && num) { res[resource] = (res[resource] || 0) + pipValue(num) * weight; nums[num] = (nums[num] || 0) + 1; }
    });
  });
  return { res, nums };
}

// Smarter opening: weigh probability AND resource diversity, number spread, and harbors —
// not just raw pip count. Used by expert/master (rules.smart).
function botSetupScore(vertex, player) {
  const prod = botProduction(player);
  const types = new Set();
  let score = 0;
  vertices[vertex].tiles.forEach(tileIndex => {
    const num = tiles[tileIndex].num;
    if (!num) return;
    score += pipValue(num);
    const resource = TYPE_DATA[tiles[tileIndex].type].res;
    if (!resource) return;
    types.add(resource);
    // Brand-new resource is valuable; building staples (wood/brick/wheat/sheep) more so.
    if (!prod.res[resource]) score += 2.5 + (resource === 'ore' ? 0 : 1);
    // Avoid stacking onto a number we already depend on (a single robber/bad luck hurts less).
    if (prod.nums[num]) score -= 0.5 * prod.nums[num];
  });
  score += types.size * 1.2; // covering several resources at one spot is strong
  if (Object.prototype.hasOwnProperty.call(state.harbors, vertex)) score += state.harbors[vertex] ? 1.5 : 1;
  return score + Math.random() * 1.2;
}

// Pick the best opening spot for a bot: smart heuristic for expert/master, plain pips otherwise.
function botOpeningChoice(player) {
  const choices = vertices.map((_, i) => i).filter(canPlaceInitialSettlement);
  if (!choices.length) return null;
  return botRules().smart
    ? choices.sort((a, b) => botSetupScore(b, player) - botSetupScore(a, player))[0]
    : choices.sort((a, b) => setupVertexScore(b) - setupVertexScore(a))[0];
}

function scheduleBotSetup() {
  const version = gameVersion;
  const expectedStep = state.setupStep;
  const expectedPlayer = state.turn;
  state.botTurnStartedAt = Date.now();
  setTimeout(() => {
    if (version !== gameVersion || state.phase !== 'setup' || state.setupStep !== expectedStep || state.turn !== expectedPlayer || !currentIsBot()) return;
    const player = expectedPlayer;
    const vertex = botOpeningChoice(player);
    placeInitialSettlement(vertex, player);
    state.setupVertex = vertex;
    state.setupPart = 'road';
    render();
    setTimeout(() => {
      if (version !== gameVersion || state.phase !== 'setup' || state.setupStep !== expectedStep || state.turn !== expectedPlayer || state.setupPart !== 'road') return;
      const roads = edges.map((_, i) => i).filter(i => state.roads[i] === undefined && !isSeaEdge(i) && edgeTouches(i, vertex));
      // Smart bots aim the opening road toward the best next settlement spot; others go random.
      const chosen = botRules().smart ? roads.sort((a, b) => roadValue(b, player) - roadValue(a, player))[0] : roads[Math.floor(Math.random() * roads.length)];
      state.roads[chosen] = player;
      toast(`${state.players[player].name}が開拓地と街道を配置`);
      finishSetupTurn();
    }, 450);
  }, 500);
}

function forceSetupNpc() {
  if (state.phase !== 'setup' || !currentIsBot()) return;
  const player = state.turn;
  if (state.setupPart === 'settlement') {
    const choice = botOpeningChoice(player);
    if (choice == null) return;
    state.setupVertex = choice;
    placeInitialSettlement(state.setupVertex, player);
    state.setupPart = 'road';
  }
  const roads = edges.map((_, i) => i).filter(i => state.roads[i] === undefined && !isSeaEdge(i) && edgeTouches(i, state.setupVertex));
  if (!roads.length) return;
  const chosen = botRules().smart ? roads.sort((a, b) => roadValue(b, player) - roadValue(a, player))[0] : roads[0];
  state.roads[chosen] = player;
  toast(`${state.players[player].name}の初期配置を完了しました`);
  finishSetupTurn();
}

function rollDice() {
  if (state.phase !== 'play' || state.rolled || currentIsBot()) return;
  state.recentBotMoves = [];
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  soundEffect('dice');
  distributeRoll(a, b);
  state.rolled = true;
  $('#diceResult').innerHTML = `<span>${a}</span><span>${b}</span>`;
  render();
  showDiceOverlay(a, b, state.players[state.turn].name);
}

function showDiceOverlay(a, b, playerName) {
  const overlay = $('#offlineDiceOverlay');
  $('#offlineDicePlayer').textContent = `${playerName} のダイス`;
  $('#offlineDiceA').textContent = a;
  $('#offlineDiceB').textContent = b;
  $('#offlineDiceTotal').textContent = `合計 ${a + b}`;
  overlay.classList.add('show');
  clearTimeout(diceOverlayTimer);
  diceOverlayTimer = setTimeout(() => overlay.classList.remove('show'), 1100);
}

function primaryAction() {
  if (state.phase === 'setup') {
    if (currentIsBot()) return;
    confirmSetupPlacement();
    return;
  }
  rollDice();
}

function confirmSetupPlacement() {
  if (state.setupPart === 'settlement') {
    const vertex = state.pendingSetupVertex;
    if (vertex == null || !canPlaceInitialSettlement(vertex)) return toast('先に盤面の白い丸を選んでください');
    placeInitialSettlement(vertex, state.turn);
    state.setupVertex = vertex;
    state.pendingSetupVertex = null;
    state.setupPart = 'road';
    state.mode = 'setup-road';
    soundEffect('build');
    toast('開拓地を確定しました。次につながる街道を選んでください');
    render();
    return;
  }
  const edge = state.pendingSetupEdge;
  if (edge == null || state.roads[edge] !== undefined || !edgeTouches(edge, state.setupVertex)) return toast('先に白い街道を選んでください');
  state.roads[edge] = state.turn;
  state.pendingSetupEdge = null;
  soundEffect('build');
  finishSetupTurn();
}

function recordRoll(a, b) {
  if (!state.rollLog) state.rollLog = [];
  state.rollLog.unshift({ round: state.round, player: state.turn, a, b, sum: a + b });
  if (state.rollLog.length > 40) state.rollLog.length = 40;
}

function distributeRoll(a, b) {
  const sum = a + b;
  recordRoll(a, b);
  if (sum === 7) return resolveSeven(state.turn);
  let gained = 0;
  const claims = Object.fromEntries(Object.keys(RESOURCES).map(resource => [resource, []]));
  const goldClaims = []; // [{player, amount}] for gold tiles
  Object.entries(state.buildings).forEach(([vertex, building]) => {
    vertices[vertex].tiles.forEach(tileIndex => {
      const tile = tiles[tileIndex];
      if (tileIndex === state.robberTile || tile.num !== sum) return;
      if (tile.type === 'gold') {
        const amount = building.type === 'city' ? 2 : 1;
        goldClaims.push({ player: building.player, amount });
        if (building.player === state.turn) gained += amount;
      } else {
        const resource = TYPE_DATA[tile.type].res;
        if (resource) claims[resource].push({ player: building.player, amount: building.type === 'city' ? 2 : 1 });
      }
    });
  });
  // Farmer hero: +1 wheat when a fields tile rolls
  if (gameConfig.expansionHeroes) {
    Object.entries(state.buildings).forEach(([vertex, building]) => {
      if (state.players[building.player]?.hero !== 'farmer') return;
      vertices[vertex].tiles.forEach(tileIndex => {
        const tile = tiles[tileIndex];
        if (tileIndex !== state.robberTile && tile.num === sum && tile.type === 'fields') {
          claims.wheat.push({ player: building.player, amount: 1 });
        }
      });
    });
  }
  Object.entries(claims).forEach(([resource, requests]) => {
    const total = requests.reduce((sum, request) => sum + request.amount, 0);
    const recipients = new Set(requests.map(request => request.player));
    if (state.bank[resource] >= total) {
      requests.forEach(request => { state.players[request.player].resources[resource] += request.amount; if (request.player === state.turn) gained += request.amount; });
      state.bank[resource] -= total;
    } else if (recipients.size === 1 && requests.length) {
      const player = requests[0].player;
      const amount = state.bank[resource];
      state.players[player].resources[resource] += amount;
      if (player === state.turn) gained += amount;
      state.bank[resource] = 0;
    }
  });
  if (goldClaims.length) {
    // NPC auto-picks most needed resource; humans queue for dialog
    goldClaims.forEach(({ player, amount }) => {
      if (state.players[player].bot) {
        for (let k = 0; k < amount; k++) {
          const res = Object.keys(RESOURCES).sort((a, b) => npcResourceNeed(player, b) - npcResourceNeed(player, a))[0] || 'wood';
          if (state.bank[res] > 0) { state.players[player].resources[res]++; state.bank[res]--; }
        }
      } else {
        state.goldPickQueue.push({ player, amount });
      }
    });
  }
  toast(gained ? `${sum}！ 資源を ${gained} 枚獲得` : `${sum}！ 島から資源が産出しました`);
  if (state.goldPickQueue && state.goldPickQueue.length) processGoldPickQueue();
}

function randomOwnedResource(player) {
  const choices = Object.keys(RESOURCES).filter(resource => state.players[player].resources[resource] > 0);
  return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
}

function handTotal(player) { return Object.values(player.resources).reduce((sum, amount) => sum + amount, 0); }

function resolveSeven(roller) {
  soundEffect('robber');
  // NPCは自動で半分を捨てる。人間は順番にダイアログで捨てる。
  state.players.forEach((player, i) => {
    if (!player.bot) return;
    const limit = player.hero === 'general' ? 8 : 7;
    const count = handTotal(player);
    if (count <= limit) return;
    for (let k = 0; k < Math.floor(count / 2); k++) {
      const resource = randomOwnedResource(i);
      if (resource) { player.resources[resource]--; state.bank[resource]++; }
    }
  });
  state.sevenRoller = roller;
  state.discardQueue = state.players.map((p, i) => i).filter(i => !state.players[i].bot && handTotal(state.players[i]) > (state.players[i].hero === 'general' ? 8 : 7));
  state.resolvingSeven = true;
  render();
  processDiscardQueue();
}

function processDiscardQueue() {
  if (state.discardQueue && state.discardQueue.length) {
    const who = state.discardQueue[0];
    const required = Math.floor(handTotal(state.players[who]) / 2);
    if (state.humanCount > 1) showPassScreen(state.players[who].name, `手札を ${required} 枚捨てます`, () => showDiscardDialog(who, required));
    else showDiscardDialog(who, required);
    return;
  }
  finishSevenRobber();
}

function finishSevenRobber() {
  const roller = state.sevenRoller;
  if (state.players[roller].bot) {
    // NPCs in Seafarers move pirate if they have ships on sea
    if (state.expansion === 'seafarers' && Object.values(state.ships).includes(roller)) {
      movePirateAndSteal(roller);
    } else {
      moveRobberAndSteal(roller);
    }
    state.resolvingSeven = false;
    render();
    toast(`7！ ${state.players[roller].name}が盗賊を動かしました`);
  } else if (state.expansion === 'seafarers') {
    beginSevenChoice();
  } else {
    beginRobberChoice();
  }
}

function beginSevenChoice() {
  state.resolvingSeven = true;
  const hasSea = tiles.some(t => t.type === 'sea');
  if (!hasSea) { beginRobberChoice(); return; }
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>7！ 盗賊か海賊を動かす</h2><p>どちらを移動しますか？</p>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button style="flex:1;padding:12px;border:1px solid var(--line);border-radius:8px;background:white;cursor:pointer;font-size:14px;font-weight:700" id="chooseLandRobber">♟ 盗賊（陸）</button>
      <button style="flex:1;padding:12px;border:1px solid var(--line);border-radius:8px;background:#e8f4f9;cursor:pointer;font-size:14px;font-weight:700" id="chooseSeaPirate">⛵ 海賊（海）</button>
    </div>`;
  $('#modal').showModal();
  $('#chooseLandRobber').onclick = () => { $('#modal').close(); $('#modalClose').hidden = false; beginRobberChoice(); };
  $('#chooseSeaPirate').onclick = () => { $('#modal').close(); $('#modalClose').hidden = false; beginPirateChoice(); };
}

function beginPirateChoice() {
  state.mode = 'pirate';
  render();
  toast('青い海タイルを選んで海賊を動かしてください');
}

function placePirate(tileIndex) {
  if (state.mode !== 'pirate' || tiles[tileIndex].type !== 'sea') return;
  state.pendingPirateTile = tileIndex;
  render();
  toast('この海域でよければ「確定」を押してください');
}

function confirmPiratePlacement() {
  if (state.pendingPirateTile == null) return;
  const tileIndex = state.pendingPirateTile;
  state.pirateTile = tileIndex;
  state.pendingPirateTile = null;
  state.mode = null;
  soundEffect('robber');
  const victims = [...new Set(tiles[tileIndex].vertices.map(vertex => {
    const ship = Object.entries(state.ships).find(([ei]) => edges[ei].a === vertex || edges[ei].b === vertex);
    return ship ? state.ships[ship[0]] : null;
  }).filter(p => p != null && p !== state.turn && randomOwnedResource(p)))];
  if (victims.length === 0) {
    state.resolvingSeven = false;
    render();
    toast('海賊を移動しました（奪える相手はいません）');
    return;
  }
  if (victims.length === 1) { stealFromVictim(victims[0]); return; }
  render();
  showStealDialog(victims);
}

function cancelPiratePlacement() {
  state.pendingPirateTile = null;
  render();
}

function movePirateAndSteal(roller) {
  const seaTiles = tiles.map((t, i) => i).filter(i => tiles[i].type === 'sea' && i !== state.pirateTile);
  if (!seaTiles.length) { moveRobberAndSteal(roller); return; }
  state.pirateTile = seaTiles[Math.floor(Math.random() * seaTiles.length)];
  const victims = [...new Set(tiles[state.pirateTile].vertices.map(vertex => {
    const ship = Object.entries(state.ships).find(([ei]) => edges[ei].a === vertex || edges[ei].b === vertex);
    return ship ? state.ships[ship[0]] : null;
  }).filter(p => p != null && p !== roller && randomOwnedResource(p)))];
  if (victims.length) stealFromVictim(victims[Math.floor(Math.random() * victims.length)]);
}

function processGoldPickQueue() {
  if (!state.goldPickQueue || !state.goldPickQueue.length) return;
  const { player, amount } = state.goldPickQueue[0];
  const picked = {};
  showGoldPickDialog(player, amount, picked, () => {
    state.goldPickQueue.shift();
    processGoldPickQueue();
  });
}

function showGoldPickDialog(player, remaining, picked, onDone) {
  const owner = state.players[player];
  $('#modalClose').hidden = true;
  const resHtml = Object.entries(RESOURCES).map(([key, res]) =>
    `<button class="gold-pick-btn" data-res="${key}" style="padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:white;cursor:pointer;font-size:20px">${res.icon} ${res.name}</button>`
  ).join('');
  $('#modalContent').innerHTML = `<h2>${owner.name}：金鉱から資源を受け取る</h2><p>あと <b>${remaining}</b> 枚選んでください</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">${resHtml}</div>`;
  $('#modal').showModal();
  $$('[data-res]').forEach(btn => btn.onclick = () => {
    const res = btn.dataset.res;
    if (!res || !RESOURCES[res]) return;
    if (state.bank[res] > 0) { state.players[player].resources[res]++; state.bank[res]--; }
    remaining--;
    if (remaining > 0) showGoldPickDialog(player, remaining, picked, onDone);
    else { $('#modal').close(); $('#modalClose').hidden = false; onDone(); render(); }
  });
}

function showDiscardDialog(who, required) {
  const owner = state.players[who];
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>${owner.name}：手札を${required}枚捨てる</h2><p>捨てる資源の枚数を選んでください。</p><div class="discard-grid">${Object.entries(RESOURCES).map(([resource, data]) => `<label>${data.icon} ${data.name}<input id="discard-${resource}" type="number" min="0" max="${owner.resources[resource]}" value="0"></label>`).join('')}</div><button class="confirm-discard" id="confirmDiscardBtn">決定する</button>`;
  $('#modal').showModal();
  $('#confirmDiscardBtn').onclick = () => {
    const amounts = Object.fromEntries(Object.keys(RESOURCES).map(resource => [resource, Math.max(0, Number($(`#discard-${resource}`).value) || 0)]));
    const total = Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
    if (total !== required || Object.entries(amounts).some(([resource, amount]) => amount > owner.resources[resource])) return toast(`合計${required}枚を選んでください`);
    Object.entries(amounts).forEach(([resource, amount]) => { owner.resources[resource] -= amount; state.bank[resource] += amount; });
    $('#modal').close();
    $('#modalClose').hidden = false;
    if (state.discardQueue) state.discardQueue.shift();
    render();
    processDiscardQueue();
  };
}

function beginRobberChoice() {
  state.resolvingSeven = true;
  state.mode = 'robber';
  render();
  toast('黄色く光る土地を選んで盗賊を動かしてください');
}

function placeRobber(tileIndex) {
  if (state.mode === 'pirate') { placePirate(tileIndex); return; }
  if (state.mode !== 'robber' || tileIndex === state.robberTile) return;
  if (state.expansion === 'seafarers' && tiles[tileIndex]?.type === 'sea') return;
  state.pendingRobberTile = tileIndex;
  render();
  toast('この土地でよければ「確定」を押してください');
}

function confirmRobberPlacement() {
  if (state.pendingRobberTile == null) return;
  clearCardAction();
  const tileIndex = state.pendingRobberTile;
  state.robberTile = tileIndex;
  state.pendingRobberTile = null;
  state.mode = null;
  soundEffect('robber');
  const victims = [...new Set(tiles[tileIndex].vertices.map(vertex => state.buildings[vertex]?.player).filter(player => player != null && player !== state.turn && randomOwnedResource(player)))];
  if (victims.length === 0) {
    state.resolvingSeven = false;
    render();
    toast('盗賊を移動しました（奪える相手はいません）');
    return;
  }
  if (victims.length === 1) {
    stealFromVictim(victims[0]);
    return;
  }
  render();
  showStealDialog(victims);
}

function stealFromVictim(victim) {
  const resource = randomOwnedResource(victim);
  let message = '盗賊を移動しました';
  if (resource) {
    state.players[victim].resources[resource]--;
    state.players[state.turn].resources[resource]++;
    message = `${state.players[victim].name}から1枚獲得しました`;
  }
  state.resolvingSeven = false;
  render();
  toast(message);
}

function showStealDialog(victims) {
  state.resolvingSeven = true;
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>誰から1枚もらう？</h2><p>盗賊を置いた土地に接するプレイヤーから1枚を奪えます。</p><div class="steal-grid">${victims.map(victim => {
    const count = Object.values(state.players[victim].resources).reduce((sum, amount) => sum + amount, 0);
    return `<button class="steal-choice" data-steal="${victim}"><span class="avatar" style="background:${state.players[victim].color}">${state.players[victim].name[0]}</span><b>${state.players[victim].name}</b><small>手札 ${count}枚</small></button>`;
  }).join('')}</div>${handSummaryHtml()}`;
  $('#modal').showModal();
  $$('[data-steal]').forEach(button => button.onclick = () => {
    $('#modal').close();
    $('#modalClose').hidden = false;
    stealFromVictim(Number(button.dataset.steal));
  });
}

function cancelRobberPlacement() {
  state.pendingRobberTile = null;
  render();
}

function endTurn() {
  if (state.phase !== 'play' || state.gameOver || state.resolvingSeven) return;
  if (currentIsBot()) return forceNpcProgress();
  if (!state.rolled) return;
  advanceTurn();
}

// Escape hatch for the player: un-stick a frozen game without losing progress.
// Clears stalled bot timers, resolves a dangling "7" with no pending choice, closes a stuck
// modal, and nudges the current bot to act. If there is no game, just reloads the page.
function recoverGame() {
  if (!state) { location.reload(); return; }
  clearTimeout(botTimer);
  clearTimeout(botWatchdog);
  clearInterval(npcHeartbeat);
  state.botBusy = false;
  const awaitingChoice = state.mode === 'robber' || state.mode === 'pirate' || (state.discardQueue && state.discardQueue.length);
  if (state.resolvingSeven && !awaitingChoice) state.resolvingSeven = false;
  if (state.pendingRobberTile != null || state.pendingPirateTile != null) { state.pendingRobberTile = null; state.pendingPirateTile = null; }
  if ($('#modal')?.open && !awaitingChoice) { try { $('#modal').close(); } catch (e) {} $('#modalClose').hidden = false; }
  state.awaitingPass = false;
  const overlay = $('#passScreen');
  if (overlay) { overlay.style.display = 'none'; overlay.classList.add('hidden'); }
  startNpcHeartbeat();
  render();
  if (state.phase === 'setup' && currentIsBot()) forceSetupNpc();
  else if (state.phase === 'play' && currentIsBot()) { state.botBusy = false; botTurn(); }
  render();
  toast('状態を復旧しました。まだ進まない場合はもう一度押すか「新しいゲーム」を試してください');
}

function advanceTurn() {
  if (state.phase !== 'play' || state.gameOver) return;
  clearTimeout(botTimer);
  clearTimeout(botWatchdog);
  state.players[state.turn].dev.push(...state.players[state.turn].newDev);
  state.players[state.turn].newDev = [];
  state.players[state.turn].devPlayed = false;
  state.botBusy = false;
  state.freeRoads = 0;
  state.mode = null;
  clearCardAction();
  state.turn = (state.turn + 1) % state.players.length;
  if (state.turn === 0) state.round++;
  state.rolled = false;
  state.movedShipThisTurn = false;
  state.shipsBuiltThisTurn = [];
  resetFlexTrade();
  $('#diceResult').innerHTML = '<span>—</span><span>—</span>';
  if (gameConfig.expansionBarbarians) advanceBarbarian();
  render();
  if (currentIsBot()) scheduleBotTurn();
  else { soundEffect('turn'); beginHumanTurn(`${state.players[state.turn].name}のターンです`); }
}

function advanceBarbarian() {
  state.barbarianStep = (state.barbarianStep || 0) + 1;
  renderBarbarian();
  if (state.barbarianStep >= BARBARIAN_STEPS) {
    state.barbarianStep = 0;
    executeBarbsAttack();
  }
}

function executeBarbsAttack() {
  const totalKnights = state.players.reduce((sum, p) => sum + (p.playedKnights || 0), 0);
  const totalCities = Object.values(state.buildings).filter(b => b.type === 'city').length;
  if (totalCities === 0) { toast('🏴 蛮族が来たが、都市がないので被害なし！'); return; }
  if (totalKnights >= totalCities) {
    const leaderIdx = state.players.map((_, i) => i).reduce((best, i) => totalVP(i) > totalVP(best) ? i : best, 0);
    if (state.devDeck.length) {
      state.players[leaderIdx].newDev.push(state.devDeck.pop());
      toast(`⚔ 蛮族撃退！${state.players[leaderIdx].name}が発展カードを獲得！`);
    } else {
      toast('⚔ 蛮族撃退！よく守りました！');
    }
  } else {
    let victimCount = 0;
    state.players.forEach((player, pIdx) => {
      if (player.playedKnights > 0) return;
      const cityEntry = Object.entries(state.buildings).find(([, b]) => b.player === pIdx && b.type === 'city');
      if (!cityEntry) return;
      state.buildings[cityEntry[0]].type = 'settlement';
      state.players[pIdx].vp = Math.max(0, state.players[pIdx].vp - 1);
      victimCount++;
    });
    toast(victimCount > 0 ? '🏴 蛮族の来襲！騎士なきプレイヤーの都市が破壊されました' : '🏴 蛮族の来襲！被害なし');
  }
  render();
}

function renderBarbarian() {
  const panel = $('#barbPanel');
  if (!panel) return;
  const active = !!(gameConfig.expansionBarbarians && state && state.phase === 'play' && !state.gameOver);
  panel.hidden = !active;
  if (!active) return;
  const step = state.barbarianStep || 0;
  const barbTrack = $('#barbTrack');
  if (barbTrack) barbTrack.innerHTML = Array.from({ length: BARBARIAN_STEPS }, (_, i) =>
    `<span class="barb-step${i < step ? ' filled' : ''}${i === BARBARIAN_STEPS - 1 ? ' last' : ''}"></span>`
  ).join('');
  const barbInfo = $('#barbInfo');
  if (barbInfo) barbInfo.textContent = `あと ${BARBARIAN_STEPS - step} ターン`;
}

function scheduleBotTurn(delay = 650) {
  clearTimeout(botTimer);
  clearTimeout(botWatchdog);
  const version = gameVersion;
  const expectedPlayer = state.turn;
  state.botTurnStartedAt = Date.now();
  botTimer = setTimeout(() => {
    if (version === gameVersion && state.turn === expectedPlayer && !state.gameOver) botTurn();
  }, botDelay(delay));
  botWatchdog = setTimeout(() => {
    if (version === gameVersion && state.turn === expectedPlayer && !state.gameOver && !state.resolvingSeven) {
      state.botBusy = false;
      toast(`${state.players[expectedPlayer].name}の処理を復旧しました`);
      advanceTurn();
    }
  }, 5000);
}

function forceNpcProgress() {
  if (state.phase === 'setup') return forceSetupNpc();
  if (state.phase !== 'play' || !currentIsBot() || state.gameOver) return;
  clearTimeout(botTimer);
  if (state.botBusy || state.rolled) {
    state.botBusy = false;
    advanceTurn();
  } else botTurn();
}

function botTurn() {
  if (state.phase !== 'play' || !currentIsBot() || state.gameOver || state.botBusy) return;
  state.botBusy = true;
  state.botTurnStartedAt = Date.now();
  clearTimeout(botTimer);
  const version = gameVersion;
  const playerIndex = state.turn;
  try {
    const a = 1 + Math.floor(Math.random() * 6);
    const b = 1 + Math.floor(Math.random() * 6);
    $('#diceResult').innerHTML = `<span>${a}</span><span>${b}</span>`;
    distributeRoll(a, b);
    state.rolled = true;
    render();
  } catch (error) {
    console.error('NPC roll failed', error);
    state.rolled = true;
  }
  setTimeout(() => {
    if (version !== gameVersion || state.turn !== playerIndex || state.gameOver) return;
    if (maybeProposeNpcTrade(playerIndex, () => continueBotTurn(playerIndex, version))) return;
    continueBotTurn(playerIndex, version);
  }, botDelay(650));
}

function continueBotTurn(playerIndex, version) {
  if (version !== gameVersion || state.turn !== playerIndex || state.gameOver) return;
  // A 7 this bot rolled may still be waiting on a HUMAN to discard / move the robber.
  // Don't build or end the turn until that resolves, or End-Turn would stay disabled (freeze).
  if (state.resolvingSeven) {
    setTimeout(() => continueBotTurn(playerIndex, version), botDelay(300));
    return;
  }
  try {
    runBotActions(playerIndex);
    render();
    checkWin(playerIndex);
  } catch (error) {
    console.error('NPC action failed', error);
    toast(`${state.players[playerIndex].name}は行動を終了しました`);
  } finally {
    state.botBusy = false;
    if (!state.gameOver) botTimer = setTimeout(() => {
      if (version === gameVersion && state.turn === playerIndex) advanceTurn();
    }, botDelay(650));
  }
}

// NPCが必要な資源を考え、人間に交換を提案する（必要なら提案ダイアログを開いてtrueを返す）
function maybeProposeNpcTrade(player, onDone) {
  if (state.gameOver) return false;
  // In hotseat (multi-human) we skip NPC-initiated proposals: they would reveal one human's hand on another's turn.
  if (state.humanCount > 1) return false;
  const npc = state.players[player];
  const human = state.players[0];
  const keys = Object.keys(RESOURCES);
  // NPCが最も欲しい資源（建設に必要・自分の在庫が乏しい・人間が持っている）
  const want = keys.filter(key => human.resources[key] > 0 && npcResourceNeed(player, key) >= 1)
    .sort((a, b) => npcResourceNeed(player, b) - npcResourceNeed(player, a))[0];
  if (!want) return false;
  // NPCが手放せる余剰資源（必要度が低く、在庫が2枚以上、wantとは別）
  const give = keys.filter(key => key !== want && npc.resources[key] >= 2 && npcResourceNeed(player, key) < npcResourceNeed(player, want))
    .sort((a, b) => (npc.resources[b] - npcResourceNeed(player, b)) - (npc.resources[a] - npcResourceNeed(player, a)))[0];
  if (!give) return false;
  if (Math.random() > .6) return false; // 毎ターンは提案しない
  clearTimeout(botWatchdog);
  clearTimeout(botTimer);
  showNpcProposalDialog(player, give, want, onDone);
  return true;
}

function showNpcProposalDialog(player, giveRes, wantRes, onDone) {
  const npc = state.players[player];
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>${npc.name}からの交換提案</h2>
    <p class="trade-summary"><b>${npc.name}</b> が <b>1 ${RESOURCES[giveRes].icon}${RESOURCES[giveRes].name}</b> を渡すかわりに、あなたの <b>1 ${RESOURCES[wantRes].icon}${RESOURCES[wantRes].name}</b> をほしがっています。</p>
    ${handSummaryHtml()}
    <div class="proposal-actions">
      <button class="trade-accept-btn" id="acceptProposalBtn">交換に応じる</button>
      <button class="trade-reject-btn" id="rejectProposalBtn">断る</button>
    </div>`;
  $('#modal').showModal();
  const finish = (accepted) => {
    $('#modal').close();
    $('#modalClose').hidden = false;
    if (accepted) {
      completeNpcTrade(player, { [wantRes]: 1 }, { [giveRes]: 1 });
      toast(`${npc.name}と交換しました`);
    } else {
      toast(`${npc.name}の提案を断りました`);
    }
    onDone();
  };
  $('#acceptProposalBtn').onclick = () => finish(true);
  $('#rejectProposalBtn').onclick = () => finish(false);
}

function tryBankTrade(player, wanted) {
  if (state.bank[wanted] < 1) return false;
  const donor = Object.keys(RESOURCES).find(resource => resource !== wanted && state.players[player].resources[resource] >= maritimeRate(player, resource));
  if (!donor) return false;
  state.players[player].resources[donor] -= maritimeRate(player, donor);
  state.bank[donor] += maritimeRate(player, donor);
  state.players[player].resources[wanted]++;
  state.bank[wanted]--;
  return true;
}

function prepareCost(player, type) {
  if (botRules().bankTrade) Object.entries(effectiveCost(type, player)).forEach(([resource, amount]) => {
    while (state.players[player].resources[resource] < amount && tryBankTrade(player, resource)) {}
  });
  return canAfford(type, player);
}

function roadValue(edgeIndex, player) {
  const edge = edges[edgeIndex];
  return Math.max(...[edge.a, edge.b].map(vertex => {
    if (state.buildings[vertex]) return 0;
    return canPlaceInitialSettlement(vertex) ? setupVertexScore(vertex) + 3 : 0.5;
  }));
}

// Seafarers: a settlement spot is worth more on an undiscovered island (bonus VP)
function botVertexValue(vertex) {
  let score = setupVertexScore(vertex);
  if (state.expansion === 'seafarers') {
    vertices[vertex].tiles.forEach(tileIndex => {
      const island = tiles[tileIndex]?.island;
      if (island != null && island !== 0 && state.islandSettlers[island] == null) score += 6;
    });
  }
  return score;
}

// Centroids of islands no one has discovered yet — NPCs sail toward these
function unclaimedIslandCentroids() {
  const groups = {};
  tiles.forEach(tile => {
    if (tile.island != null && tile.island !== 0 && state.islandSettlers[tile.island] == null) {
      (groups[tile.island] = groups[tile.island] || []).push(tile);
    }
  });
  return Object.values(groups).map(list => ({
    x: list.reduce((sum, tile) => sum + tile.x, 0) / list.length,
    y: list.reduce((sum, tile) => sum + tile.y, 0) / list.length
  }));
}

// How useful is building a ship on this edge for an NPC? Higher = settle spot reached
// or meaningful progress sailing toward an undiscovered island.
function shipValue(edgeIndex, player) {
  const LAND = new Set(['forest', 'hills', 'pasture', 'fields', 'mountains', 'desert', 'gold']);
  const edge = edges[edgeIndex];
  const centroids = unclaimedIslandCentroids();
  let best = 0;
  [edge.a, edge.b].forEach(vertexIndex => {
    const vertex = vertices[vertexIndex];
    if (!state.buildings[vertexIndex] && canPlaceInitialSettlement(vertexIndex) && vertex.tiles.some(t => LAND.has(tiles[t].type))) {
      let value = setupVertexScore(vertexIndex) + 2;
      vertex.tiles.forEach(t => {
        const island = tiles[t]?.island;
        if (island != null && island !== 0 && state.islandSettlers[island] == null) value += 6;
      });
      best = Math.max(best, value);
    }
    if (centroids.length) {
      const nearest = Math.min(...centroids.map(c => Math.hypot(c.x - vertex.x, c.y - vertex.y)));
      best = Math.max(best, 4 - nearest / 90);
    }
  });
  return best;
}

function runBotActions(player) {
  const rules = botRules();
  const messages = [];
  for (let action = 0; action < rules.actions; action++) {
    const cities = Object.keys(state.buildings).map(Number).filter(vertex => state.buildings[vertex].player === player && state.buildings[vertex].type === 'settlement');
    if (cities.length && hasPieceAvailable(player, 'city') && prepareCost(player, 'city')) {
      const vertex = cities.sort((a, b) => setupVertexScore(b) - setupVertexScore(a))[0];
      pay('city', player);
      state.buildings[vertex].type = 'city';
      state.players[player].vp++;
      state.recentBotMoves.push({ kind: 'building', id: Number(vertex) });
      messages.push('都市');
      continue;
    }
    const settlements = vertices.map((_, i) => i).filter(vertex => canSettle(vertex, player));
    if (settlements.length && hasPieceAvailable(player, 'settlement') && prepareCost(player, 'settlement')) {
      const vertex = settlements.sort((a, b) => botVertexValue(b) - botVertexValue(a))[0];
      pay('settlement', player);
      state.buildings[vertex] = { player, type: 'settlement' };
      state.players[player].vp++;
      grantIslandDiscovery(vertex, player);
      state.recentBotMoves.push({ kind: 'building', id: Number(vertex) });
      messages.push('開拓地');
      continue;
    }
    const roads = edges.map((_, i) => i).filter(i => state.roads[i] === undefined && !isSeaEdge(i) && roadConnected(i, player));
    if (roads.length && hasPieceAvailable(player, 'road') && prepareCost(player, 'road')) {
      const chosen = rules.smartRoad ? roads.sort((a, b) => roadValue(b, player) - roadValue(a, player))[0] : roads[Math.floor(Math.random() * roads.length)];
      pay('road', player);
      state.roads[chosen] = player;
      state.recentBotMoves.push({ kind: 'road', id: Number(chosen) });
      messages.push('街道');
      continue;
    }
    if (state.expansion === 'seafarers' && hasPieceAvailable(player, 'ship')) {
      const ships = edges.map((_, i) => i).filter(i => canPlaceShip(i, player));
      const chosen = ships.sort((a, b) => shipValue(b, player) - shipValue(a, player))[0];
      // Aggressive bots sail farther on a hunch; cautious ones only build when a settle spot is in reach
      const threshold = rules.smartRoad ? 1.0 : (rules.bankTrade ? 1.6 : 3.0);
      if (chosen != null && shipValue(chosen, player) >= threshold && prepareCost(player, 'ship')) {
        pay('ship', player);
        state.ships[chosen] = player;
        state.recentBotMoves.push({ kind: 'ship', id: Number(chosen) });
        messages.push('船');
        continue;
      }
    }
    if (rules.devBuy && state.devDeck.length && prepareCost(player, 'development')) {
      buyDevelopment(player);
      messages.push('発展カード');
      continue;
    }
    break;
  }
  playBotDevelopment(player);
  updateAwards();
  toast(messages.length ? `${state.players[player].name}：${messages.join('・')}を建設` : `${state.players[player].name}はターンを終了`);
}

function buyDevelopment(player) {
  if (!state.devDeck.length || !canAfford('development', player)) return false;
  pay('development', player);
  if (state.players[player].hero === 'sage' && state.devDeck.length >= 2) {
    const card1 = state.devDeck.pop();
    const card2 = state.devDeck.pop();
    if (state.players[player].bot) {
      const devOrder = ['victory', 'knight', 'roadBuilding', 'plenty', 'monopoly'];
      const kept = devOrder.indexOf(card1) <= devOrder.indexOf(card2) ? card1 : card2;
      state.players[player].newDev.push(kept);
      state.devDeck.unshift(kept === card1 ? card2 : card1);
    } else {
      showSageDialog(player, card1, card2);
    }
    return true;
  }
  state.players[player].newDev.push(state.devDeck.pop());
  return true;
}

function showSageDialog(player, card1, card2) {
  const names = { knight: '騎士', roadBuilding: '街道建設', plenty: '発見', monopoly: '独占', victory: '勝利点' };
  const descs = { knight: '盗賊を移動させ1枚奪う', roadBuilding: '街道を2本無料で建設', plenty: '好きな資源を2枚獲得', monopoly: '1種類を全員から独占', victory: '非公開の1勝利点' };
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>🔮 古の賢者：2枚から1枚を選ぶ</h2>
    <p>引いた2枚のカードから1枚をキープ。もう1枚はデッキに戻ります。</p>
    <div style="display:flex;gap:12px;margin-top:16px">
      <button class="sage-pick" data-sage="${card1}" style="flex:1;padding:16px;border:2px solid var(--line);border-radius:12px;background:#fff;cursor:pointer;text-align:left">
        <b style="display:block;margin-bottom:4px">✦ ${names[card1]}</b><small>${descs[card1]}</small>
      </button>
      <button class="sage-pick" data-sage="${card2}" style="flex:1;padding:16px;border:2px solid var(--line);border-radius:12px;background:#fff;cursor:pointer;text-align:left">
        <b style="display:block;margin-bottom:4px">✦ ${names[card2]}</b><small>${descs[card2]}</small>
      </button>
    </div>`;
  $('#modal').showModal();
  $$('.sage-pick').forEach(btn => btn.onclick = () => {
    const kept = btn.dataset.sage;
    const returned = kept === card1 ? card2 : card1;
    state.players[player].newDev.push(kept);
    state.devDeck.unshift(returned);
    $('#modal').close();
    $('#modalClose').hidden = false;
    render();
    toast(`${names[kept]}カードを選びました`);
    checkWin(player);
  });
}

function handSize(player) { return Object.values(state.players[player].resources).reduce((a, b) => a + b, 0); }

function moveRobberAndSteal(player) {
  const smart = botRules().smart;
  const target = tiles.map((tile, index) => {
    if (index === state.robberTile || tile.type === 'desert' || tile.type === 'sea') return { index, score: -1 };
    let score = tile.vertices.reduce((sum, vertex) => {
      const building = state.buildings[vertex];
      if (!building || building.player === player) return sum;
      const base = building.type === 'city' ? 3 : 2;
      // Smart bots hit whoever is ahead — leader standing dominates, tile productivity is secondary.
      const lead = smart ? 1 + visibleVP(building.player) * 0.6 : 1;
      return sum + base * lead;
    }, 0);
    if (smart) score *= 0.75 + pipValue(tile.num) / 8;
    return { index, score: score + Math.random() * (smart ? 0.3 : 1) };
  }).sort((a, b) => b.score - a.score)[0].index;
  state.robberTile = target;
  const victims = [...new Set(tiles[target].vertices.map(vertex => state.buildings[vertex]?.player).filter(owner => owner != null && owner !== player && randomOwnedResource(owner)))];
  if (!victims.length) return;
  // Smart bots rob the player holding the most cards (and likely the leader); others pick at random.
  const victim = smart ? victims.sort((a, b) => handSize(b) - handSize(a))[0] : victims[Math.floor(Math.random() * victims.length)];
  const resource = randomOwnedResource(victim);
  state.players[victim].resources[resource]--;
  state.players[player].resources[resource]++;
}

function playDevelopment(player, card) {
  const index = state.players[player].dev.indexOf(card);
  if (index < 0 || card === 'victory' || state.players[player].devPlayed) return false;
  if (!state.players[player].bot) { cardActionSnapshot = cloneState(); state.pendingCard = card; }
  state.players[player].dev.splice(index, 1);
  state.players[player].devPlayed = true;
  if (card === 'knight') {
    state.players[player].playedKnights++;
    if (!state.players[player].bot) { beginRobberChoice(); checkWin(player); return true; }
    moveRobberAndSteal(player);
  } else if (card === 'roadBuilding') {
    if (!state.players[player].bot) {
      state.freeRoads = 2;
      state.mode = 'road';
      updateAwards();
      render();
      toast('無料で街道を2本置けます。盤上の黄色い街道を選んでください');
      checkWin(player);
      return true;
    }
    for (let i = 0; i < 2; i++) {
      const options = edges.map((_, edge) => edge).filter(edge => state.roads[edge] === undefined && roadConnected(edge, player));
      if (!options.length || !hasPieceAvailable(player, 'road')) break;
      state.roads[options[0]] = player;
    }
  } else if (card === 'plenty') {
    if (!state.players[player].bot) { showPlentyDialog(); checkWin(player); return true; }
    for (let i = 0; i < 2; i++) {
      const resource = Object.keys(RESOURCES).filter(key => state.bank[key] > 0).sort((a, b) => state.players[player].resources[a] - state.players[player].resources[b])[0];
      if (resource) { state.players[player].resources[resource]++; state.bank[resource]--; }
    }
  } else if (card === 'monopoly') {
    if (!state.players[player].bot) { showMonopolyDialog(); checkWin(player); return true; }
    const resource = Object.keys(RESOURCES).sort((a, b) => {
      const total = key => state.players.reduce((sum, item, owner) => sum + (owner === player ? 0 : item.resources[key]), 0);
      return total(b) - total(a);
    })[0];
    state.players.forEach((item, owner) => {
      if (owner === player) return;
      state.players[player].resources[resource] += item.resources[resource];
      item.resources[resource] = 0;
    });
  }
  updateAwards();
  render();
  checkWin(player);
  return true;
}

function showPlentyDialog() {
  const me = state.turn;
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>発見：資源を2枚選ぶ</h2><p>銀行から好きな資源を合計2枚受け取れます。</p>${handSummaryHtml(me)}<div class="discard-grid">${Object.entries(RESOURCES).map(([resource, data]) => `<label>${data.icon} ${data.name}<input id="plenty-${resource}" type="number" min="0" max="2" value="0"></label>`).join('')}</div><button class="confirm-discard" id="confirmPlentyBtn">受け取る</button><button class="cancel-card-link" id="cancelPlentyBtn">↩ やっぱりやめる</button>`;
  $('#modal').showModal();
  $('#cancelPlentyBtn').onclick = cancelCardAction;
  $('#confirmPlentyBtn').onclick = () => {
    const amounts = Object.fromEntries(Object.keys(RESOURCES).map(resource => [resource, Math.max(0, Number($(`#plenty-${resource}`).value) || 0)]));
    const total = Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
    if (total !== 2) return toast('合計2枚を選んでください');
    if (Object.entries(amounts).some(([resource, amount]) => amount > state.bank[resource])) return toast('銀行の在庫が足りません');
    Object.entries(amounts).forEach(([resource, amount]) => { state.players[me].resources[resource] += amount; state.bank[resource] -= amount; });
    clearCardAction();
    $('#modal').close();
    $('#modalClose').hidden = false;
    updateAwards();
    render();
    toast('発見カードで資源を受け取りました');
    checkWin(me);
  };
}

function showMonopolyDialog() {
  const me = state.turn;
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>独占：資源を1種類選ぶ</h2><p>選んだ資源を全プレイヤーから集めます。</p>${handSummaryHtml(me)}<div class="monopoly-grid">${Object.entries(RESOURCES).map(([resource, data]) => `<button class="monopoly-choice" data-monopoly="${resource}">${data.icon}<small>${data.name}</small></button>`).join('')}</div><button class="cancel-card-link" id="cancelMonopolyBtn">↩ やっぱりやめる</button>`;
  $('#modal').showModal();
  $('#cancelMonopolyBtn').onclick = cancelCardAction;
  $$('[data-monopoly]').forEach(button => button.onclick = () => {
    const resource = button.dataset.monopoly;
    let taken = 0;
    state.players.forEach((item, owner) => {
      if (owner === me) return;
      taken += item.resources[resource];
      state.players[me].resources[resource] += item.resources[resource];
      item.resources[resource] = 0;
    });
    clearCardAction();
    $('#modal').close();
    $('#modalClose').hidden = false;
    updateAwards();
    render();
    toast(`独占！ ${RESOURCES[resource].name}を${taken}枚集めました`);
    checkWin(me);
  });
}

function playBotDevelopment(player) {
  const card = state.players[player].dev.find(item => item !== 'victory');
  if (card && Math.random() < botRules().devChance) playDevelopment(player, card);
}

function longestRoadLength(player) {
  // Longest Trade Route: roads + ships combined (ships cannot pass through enemy settlements)
  const ownedRoads = edges.map((_, i) => i).filter(i => state.roads[i] === player);
  const ownedShips = edges.map((_, i) => i).filter(i => state.ships[i] === player);
  const owned = [...ownedRoads, ...ownedShips];
  function walk(vertex, used, lastWasShip) {
    if (used.size && state.buildings[vertex] && state.buildings[vertex].player !== player) return used.size;
    let best = used.size;
    owned.forEach(edgeIndex => {
      if (used.has(edgeIndex)) return;
      const edge = edges[edgeIndex];
      if (edge.a !== vertex && edge.b !== vertex) return;
      const isShip = state.ships[edgeIndex] === player;
      // Roads and ships can only connect through a settlement (not directly edge-to-edge)
      if (state.expansion === 'seafarers' && used.size > 0 && isShip !== lastWasShip) {
        const building = state.buildings[vertex];
        if (!building || building.player !== player) return;
      }
      const next = edge.a === vertex ? edge.b : edge.a;
      const nextUsed = new Set(used);
      nextUsed.add(edgeIndex);
      best = Math.max(best, walk(next, nextUsed, isShip));
    });
    return best;
  }
  return vertices.reduce((best, _, vertex) => Math.max(best, walk(vertex, new Set(), false)), 0);
}

function updateAwards() {
  const roadLengths = state.players.map((_, player) => longestRoadLength(player));
  const roadBest = Math.max(...roadLengths);
  if (roadBest >= 5) {
    const leaders = roadLengths.map((length, player) => ({ length, player })).filter(item => item.length === roadBest);
    if (!leaders.some(item => item.player === state.longestRoadOwner)) state.longestRoadOwner = leaders.length === 1 ? leaders[0].player : null;
  } else state.longestRoadOwner = null;
  const armies = state.players.map(player => player.playedKnights);
  const armyBest = Math.max(...armies);
  if (armyBest >= 3) {
    const leaders = armies.map((size, player) => ({ size, player })).filter(item => item.size === armyBest);
    if (leaders.length === 1 || leaders.some(item => item.player === state.largestArmyOwner)) state.largestArmyOwner = leaders.find(item => item.player === state.largestArmyOwner)?.player ?? leaders[0].player;
  } else state.largestArmyOwner = null;
  checkAnyWin();
}

function npcResourceNeed(player, resource) {
  const plans = ['city', 'settlement', 'road', 'development'];
  return plans.reduce((score, type) => {
    const ec = effectiveCost(type, player);
    const cost = ec[resource] || 0;
    if (!cost) return score;
    const totalMissing = Object.entries(ec).reduce((sum, [key, amount]) => sum + Math.max(0, amount - state.players[player].resources[key]), 0);
    return score + Math.max(0, cost - state.players[player].resources[resource]) * (4 / (1 + totalMissing));
  }, 0);
}

function sumRes(bundle) {
  return Object.values(bundle).reduce((sum, amount) => sum + (amount || 0), 0);
}

function formatBundle(bundle) {
  const parts = Object.keys(RESOURCES).filter(key => bundle[key]).map(key => `${bundle[key]} ${RESOURCES[key].icon}`);
  return parts.length ? parts.join(' ＋ ') : 'なし';
}

function handSummaryHtml(player = 0) {
  const owner = state.players[player];
  return `<div class="modal-hand"><span class="modal-hand-label">${owner.name}の手札</span><div class="modal-hand-list">${Object.entries(RESOURCES).map(([key, resource]) => `<span class="modal-hand-item${owner.resources[key] ? '' : ' zero'}">${resource.icon}<b>${owner.resources[key]}</b></span>`).join('')}</div></div>`;
}

// give = 人間が渡す（NPCが受け取る） / get = 人間がもらう（NPCが渡す）
function npcTradeDecision(target, give, get) {
  const npc = state.players[target];
  const giveTotal = sumRes(give), getTotal = sumRes(get);
  if (!npc || target === 0 || giveTotal < 1 || getTotal < 1) return { accept: false, score: -Infinity, reason: '条件が不正' };
  const short = Object.keys(RESOURCES).find(key => npc.resources[key] < (get[key] || 0));
  if (short) return { accept: false, score: -Infinity, reason: `${RESOURCES[short].name}が足りない` };
  let receiveValue = 0, giveValue = 0;
  Object.keys(RESOURCES).forEach(key => {
    if (give[key]) receiveValue += give[key] * (3 / (1 + npc.resources[key]) + npcResourceNeed(target, key));
    if (get[key]) giveValue += get[key] * (3 / (1 + npc.resources[key]) + npcResourceNeed(target, key) * .65);
  });
  const score = receiveValue / Math.max(.1, giveValue);
  const fairQuantity = getTotal <= giveTotal * 1.5;
  const accept = fairQuantity && score >= .9;
  return { accept, score, reason: accept ? '建設計画に合う' : fairQuantity ? '条件が見合わない' : '渡す枚数が多すぎる' };
}

function completeNpcTrade(target, give, get, human = 0) {
  Object.keys(RESOURCES).forEach(key => {
    const g = give[key] || 0, t = get[key] || 0;
    state.players[human].resources[key] -= g;
    state.players[target].resources[key] += g;
    state.players[target].resources[key] -= t;
    state.players[human].resources[key] += t;
  });
  soundEffect('trade');
  render();
}

function readPlayerTrade() {
  const give = {}, get = {};
  Object.keys(RESOURCES).forEach(key => {
    give[key] = Math.max(0, Number($(`#flexGive-${key}`)?.textContent) || 0);
    get[key] = Math.max(0, Number($(`#flexGet-${key}`)?.textContent) || 0);
  });
  return { give, get };
}

function resetFlexTrade() {
  Object.keys(RESOURCES).forEach(key => {
    const giveEl = $(`#flexGive-${key}`);
    const getEl = $(`#flexGet-${key}`);
    if (giveEl) giveEl.textContent = '0';
    if (getEl) getEl.textContent = '0';
  });
}

function validatePlayerTrade(trade) {
  if (state.phase !== 'play' || currentIsBot() || !state.rolled) return 'ダイスを振ったあとに交換できます';
  if (!sumRes(trade.give) || !sumRes(trade.get)) return '渡す資源ともらう資源をそれぞれ選んでください';
  if (Object.keys(RESOURCES).some(key => trade.give[key] && trade.get[key])) return '同じ資源を渡して受け取ることはできません';
  const short = Object.keys(RESOURCES).find(key => state.players[state.turn].resources[key] < trade.give[key]);
  if (short) return `${RESOURCES[short].name}が足りません`;
  return null;
}

// Everyone except the current player. NPCs auto-decide; humans confirm via a device handoff.
function allOpponents() {
  return state.players.map((player, index) => ({ player, index })).filter(item => item.index !== state.turn);
}
function botOpponents() {
  return allOpponents().filter(item => item.player.bot);
}

function executePlayerTrade() {
  const trade = readPlayerTrade();
  const error = validatePlayerTrade(trade);
  if (error) return toast(error);
  const target = Number($('#playerTradeTarget').value);
  if (!Number.isInteger(target) || !state.players[target] || target === state.turn) return toast('交換できる相手がいません');
  if (state.players[target].bot) {
    showTradeResultDialog(trade, [{ target, ...npcTradeDecision(target, trade.give, trade.get) }]);
  } else {
    startHumanTradeProposal(target, trade);
  }
}

function executePlayerTradeAll() {
  const trade = readPlayerTrade();
  const error = validatePlayerTrade(trade);
  if (error) return toast(error);
  const opponents = allOpponents();
  if (!opponents.length) return toast('交換できる相手がいません');
  const decisions = opponents.filter(item => item.player.bot).map(item => ({ target: item.index, ...npcTradeDecision(item.index, trade.give, trade.get) }));
  const humanTargets = opponents.filter(item => !item.player.bot).map(item => item.index);
  showTradeResultDialog(trade, decisions, humanTargets);
}

// Rebuild the "交換相手" dropdown each turn: the current player's opponents (NPCs and other humans).
function refreshTradeTargets() {
  const select = $('#playerTradeTarget');
  if (!select) return;
  const opponents = allOpponents();
  const previous = select.value;
  select.innerHTML = '';
  opponents.forEach(item => select.add(new Option(`${item.player.name}${item.player.bot ? '' : '（人間）'}`, item.index)));
  if (opponents.some(item => String(item.index) === String(previous))) select.value = previous;
}

// Hand the device to a human target so they can accept or decline the proposal themselves.
function startHumanTradeProposal(target, trade) {
  const proposer = state.turn;
  state.awaitingPass = true; // hide the hand bar during the cross-player handoff
  render();
  if ($('#modal').open) $('#modal').close();
  $('#modalClose').hidden = false;
  showPassScreen(state.players[target].name, `${state.players[proposer].name} さんから交換の提案があります`, () => {
    showHumanTradeDecision(proposer, target, trade);
  }, state.players[target].color);
}

function showHumanTradeDecision(proposer, target, trade) {
  const giveText = formatBundle(trade.give); // proposer gives → target receives
  const getText = formatBundle(trade.get);   // proposer wants → target gives
  const canAfford = Object.keys(RESOURCES).every(key => state.players[target].resources[key] >= (trade.get[key] || 0));
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>${state.players[target].name}さんへの提案</h2>
    <p class="trade-summary"><b>${state.players[proposer].name}</b> があなたに <b>${giveText}</b> を渡すかわりに、あなたの <b>${getText}</b> をほしがっています。</p>
    ${handSummaryHtml(target)}
    <div class="proposal-actions">
      <button class="trade-accept-btn" id="humanAcceptBtn"${canAfford ? '' : ' disabled'}>${canAfford ? '交換する' : '資源が足りません'}</button>
      <button class="trade-reject-btn" id="humanRejectBtn">断る</button>
    </div>`;
  $('#modal').showModal();
  const finish = (accepted) => {
    $('#modal').close();
    $('#modalClose').hidden = false;
    const apply = () => {
      const proposerAffords = Object.keys(RESOURCES).every(key => state.players[proposer].resources[key] >= (trade.give[key] || 0));
      if (accepted && proposerAffords) { completeNpcTrade(target, trade.give, trade.get, proposer); checkWin(proposer); }
    };
    handBackToProposer(proposer, accepted ? `${state.players[target].name}さんと交換が成立しました！` : `${state.players[target].name}さんに断られました`, apply);
  };
  $('#humanAcceptBtn').onclick = () => { if (canAfford) finish(true); };
  $('#humanRejectBtn').onclick = () => finish(false);
}

// Return the device to the proposer; reveal their hand only after they confirm.
function handBackToProposer(proposer, message, beforeReveal) {
  showPassScreen(state.players[proposer].name, '手番に戻ります。端末を受け取ってください。', () => {
    if (beforeReveal) beforeReveal();
    state.awaitingPass = false;
    render();
    if (message) toast(message);
  }, state.players[proposer].color);
}

function showTradeResultDialog(trade, decisions, humanTargets = []) {
  const giveText = formatBundle(trade.give);
  const getText = formatBundle(trade.get);
  const accepted = decisions.filter(item => item.accept).sort((a, b) => b.score - a.score);
  $('#modalClose').hidden = false;
  const human = state.turn;
  const humanRows = humanTargets.map(target => {
    const player = state.players[target];
    return `<div class="trade-result-row human">
      <span class="avatar" style="background:${player.color}">${player.name[0]}</span>
      <span class="trade-result-info"><b>${player.name}</b><small>人間プレイヤー · 本人に確認します</small></span>
      <button class="trade-accept-btn" data-human-trade="${target}">本人に渡す</button>
    </div>`;
  }).join('');
  $('#modalContent').innerHTML = `<h2>提案への返事</h2>
    <p class="trade-summary">あなたが渡す <b>${giveText}</b> → もらう <b>${getText}</b></p>
    ${handSummaryHtml(human)}
    <div class="trade-results">${decisions.map(item => {
      const player = state.players[item.target];
      return `<div class="trade-result-row ${item.accept ? 'ok' : 'ng'}">
        <span class="avatar" style="background:${player.color}">${player.name[0]}</span>
        <span class="trade-result-info"><b>${player.name}</b><small>${item.accept ? '✓ OK！交換できます' : '✗ ' + item.reason}</small></span>
        ${item.accept ? `<button class="trade-accept-btn" data-trade-with="${item.target}">交換する</button>` : '<span class="trade-ng-tag">拒否</span>'}
      </div>`;
    }).join('')}${humanRows}</div>
    ${(accepted.length || humanTargets.length) ? '<p class="trade-hint-modal">交換したい相手の「交換する」または「本人に渡す」を押してください。</p>' : '<p class="trade-none">承認してくれる相手がいませんでした。</p>'}`;
  $('#modal').showModal();
  $$('[data-trade-with]').forEach(button => button.onclick = () => {
    const target = Number(button.dataset.tradeWith);
    completeNpcTrade(target, trade.give, trade.get, human);
    $('#modal').close();
    toast(`${state.players[target].name}と交換が成立しました！`);
    checkWin(human);
  });
  $$('[data-human-trade]').forEach(button => button.onclick = () => {
    const target = Number(button.dataset.humanTrade);
    $('#modal').close();
    startHumanTradeProposal(target, trade);
  });
}

function checkWin(player = state.turn) {
  if (totalVP(player) >= (state.targetScore || 10) && !state.gameOver) {
    state.gameOver = true;
    showWinner(player);
  }
}

// Awards (longest road / largest army, +2 each) can push ANY player to the target as a
// side-effect of someone else's move — not just the acting player. Scan everyone so a win
// is never missed. Prefer the current player if they qualify (they win on their own turn).
function checkAnyWin() {
  if (state.gameOver) return;
  const target = state.targetScore || 10;
  const qualified = state.players.map((_, p) => p).filter(p => totalVP(p) >= target);
  if (!qualified.length) return;
  const winner = qualified.includes(state.turn) ? state.turn : qualified.sort((a, b) => totalVP(b) - totalVP(a))[0];
  state.gameOver = true;
  showWinner(winner);
}

function showWinner(player) {
  const name = state.players[player].name;
  const ranking = state.players.map((item, index) => ({
    index, name: item.name, vp: totalVP(index),
    settlements: countPieces(index, 'settlement'), cities: countPieces(index, 'city'),
    roads: countPieces(index, 'road'), knights: item.playedKnights,
    longest: state.longestRoadOwner === index, army: state.largestArmyOwner === index
  })).sort((a, b) => b.vp - a.vp);
  const medals = ['🥇', '🥈', '🥉', '4'];
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<div class="result-screen">
    <div class="trophy">🏆</div>
    <h2>${name} の勝利！</h2>
    <p class="result-sub">${totalVP(player)}勝利点を獲得し、島の開拓者になりました。</p>
    <div class="result-table">
      <div class="result-head"><span>順位</span><span>プレイヤー</span><span>勝利点</span></div>
      ${ranking.map((row, rank) => `<div class="result-row ${row.index === player ? 'winner-row' : ''}">
        <span class="result-rank">${medals[rank]}</span>
        <span class="result-player"><span class="avatar" style="background:${state.players[row.index].color}">${row.name[0]}</span><span class="result-name"><b>${row.name}${row.index === 0 ? ' (YOU)' : ''}</b><small>開拓地${row.settlements}・都市${row.cities}・道${row.roads}・騎士${row.knights}${row.longest ? '・🛣最長' : ''}${row.army ? '・⚔最大騎士' : ''}</small></span></span>
        <span class="result-vp">${row.vp}</span>
      </div>`).join('')}
    </div>
    <button class="result-again" onclick="document.getElementById('modalClose').hidden=false;modal.close();newGame()">もう一度遊ぶ</button>
  </div>`;
  $('#modal').showModal();
  soundEffect('build');
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(element._timer);
  element._timer = setTimeout(() => element.classList.remove('show'), 2200);
}

$$('.build-card').forEach(button => button.onclick = () => {
  if (button.dataset.build === 'development') {
    if (state.phase !== 'play' || currentIsBot() || !state.rolled || !buyDevelopment(state.turn)) return toast('発展カードを購入できません');
    toast('発展カードを1枚購入しました');
    render();
    checkWin(state.turn);
    return;
  }
  state.mode = button.dataset.build;
  toast(button.dataset.build === 'road' ? '盤上の黄色い街道を選択' : '盤上の黄色い地点を選択');
  render();
});
$('#playDevBtn').onclick = () => {
  if (currentIsBot()) return;
  const card = state.players[state.turn].dev.find(item => item !== 'victory');
  if (!card) return toast('使える発展カードがありません');
  const names = { knight: '騎士', roadBuilding: '街道建設', plenty: '発見', monopoly: '独占' };
  if (playDevelopment(state.turn, card)) toast(`${names[card]}カードを使いました`);
};
$('#moveShipBtn').onclick = () => { if (state.mode === 'moveShip') cancelMoveShip(); else beginMoveShip(); };
$('#rollBtn').onclick = primaryAction;
$('#endTurnBtn').onclick = endTurn;
$('#npcControlBtn').onclick = forceNpcProgress;
$('#cancelCardBtn').onclick = cancelCardAction;
$('#playerTradeBtn').onclick = executePlayerTrade;
$('#playerTradeAllBtn').onclick = executePlayerTradeAll;
const recoverBtnEl = $('#recoverBtn');
if (recoverBtnEl) recoverBtnEl.onclick = () => recoverGame();
$('#newGameBtn').onclick = () => {
  $('#playerNameInput').value = gameConfig.playerName;
  $(`input[name="boardMode"][value="${gameConfig.boardMode}"]`).checked = true;
  const diffInput = $(`input[name="difficulty"][value="${gameConfig.difficulty}"]`);
  if (diffInput) diffInput.checked = true;
  const speedInput = $(`input[name="botSpeed"][value="${gameConfig.botSpeed}"]`);
  if (speedInput) speedInput.checked = true;
  const scoreInput = $(`input[name="targetScore"][value="${gameConfig.targetScore || 10}"]`);
  if (scoreInput) scoreInput.checked = true;
  const humanInput = $(`input[name="humanCount"][value="${gameConfig.humanCount || 1}"]`);
  if (humanInput) humanInput.checked = true;
  (gameConfig.humanNames || []).forEach((nm, i) => {
    if (i >= 1) { const field = $(`#humanName${i + 1}`); if (field) field.value = nm; }
  });
  updateStartPlayerFields();
  $('#startScreen').classList.remove('hidden');
};

// Show name inputs for players 2..N and reflect how many NPCs will fill the table.
function updateStartPlayerFields() {
  const checked = $('input[name="humanCount"]:checked');
  const humanCount = Math.min(4, Math.max(1, Number(checked?.value) || 1));
  for (let i = 2; i <= 4; i++) {
    const field = $(`#humanName${i}`);
    if (field?.closest) { const label = field.closest('label'); if (label) label.hidden = i > humanCount; }
  }
  const extra = $('#extraNames');
  if (extra) extra.hidden = humanCount < 2;
  const npc = Math.max(0, 4 - humanCount);
  const hint = $('#npcHint');
  if (hint) hint.textContent = npc > 0 ? `NPC ×${npc} が参加します（合計4人）` : '人間4人で対戦します（NPCなし）';
}
$$('input[name="humanCount"]').forEach(input => input.addEventListener('change', updateStartPlayerFields));
updateStartPlayerFields();
function seafarersRulesHtml() {
  return `<div class="rules-seafarers">
    <p class="rules-expansion-title">🌊 拡張：航海者たち</p>
    <p><b>⛵ 船：</b>コストは🌲＋🐑。海に面した辺に置けます。自分の<b>沿岸の開拓地・都市</b>か、つながっている<b>船の先端</b>から伸ばします。街道と船は開拓地・都市を経由してつながり、合わせて<b>最長交易路</b>になります。</p>
    <p><b>🚢 船の移動：</b>1ターンに1回、航路の<b>先端の船</b>を1隻だけ別の場所へ動かせます（そのターンに置いた船・移動済みの船は動かせません）。「⛵ 船を移動」ボタンから行います。</p>
    <p><b>✨ 金鉱：</b>金鉱に接する開拓地・都市の所有者は、その数字が出ると<b>好きな資源</b>を選んで受け取れます（開拓地1枚・都市2枚）。</p>
    <p><b>🏝 新しい島の発見：</b>母島以外の島に<b>最初に開拓地</b>を置いた人は<b>＋${ISLAND_BONUS_VP}点</b>。船で海を渡ってたどり着きましょう。</p>
    <p><b>🏴‍☠️ 海賊：</b>海では盗賊のかわりに<b>海賊</b>が動きます。7を出すか騎士を使うと、盗賊（陸）か海賊（海）のどちらを動かすか選べます。海賊のいる海域では船を建設できず、その海域に面した相手から資源を1枚奪えます。</p>
  </div>`;
}
function heroesRulesHtml() {
  const mine = state?.players?.[0]?.hero ? HEROES.find(h => h.id === state.players[0].hero) : null;
  return `<div class="rules-seafarers">
    <p class="rules-expansion-title">✦ 拡張：英雄の伝説（クロードオリジナル）</p>
    <p>ゲーム開始時、各プレイヤーに<b>固有の英雄</b>が1人ランダムで配られます。英雄の能力は<b>ゲーム中ずっと自動で発動</b>する常時効果です。プレイヤー名の横に英雄バッジが表示されます。</p>
    ${mine ? `<p class="rules-my-hero">あなたの英雄：<b>${mine.icon} ${mine.name}</b><br>${mine.desc}</p>` : ''}
    <ul class="rules-hero-list">
      ${HEROES.map(h => `<li><b>${h.icon} ${h.name}</b>：${h.desc}</li>`).join('')}
    </ul>
    <p><small>※ 英雄能力は最初に配られた1つで固定。交換や変更はできません。</small></p>
  </div>`;
}
function barbariansRulesHtml() {
  return `<div class="rules-seafarers">
    <p class="rules-expansion-title">🏴 拡張：蛮族の来襲（シティ＆ナイト風 簡易版）</p>
    <p><b>⏳ 侵攻のタイミング：</b>手番が進むごとに蛮族船が前進し、<b>${BARBARIAN_STEPS}ターンごと</b>に上陸して全プレイヤーの<b>都市</b>を襲います。サイドバーの蛮族トラックで残りターンを確認できます。</p>
    <p><b>⚔ 防衛の判定：</b>上陸時、<b>全員が使った騎士カードの合計</b>と、<b>盤上の都市の合計数</b>を比べます。</p>
    <p><b>✅ 騎士 ≧ 都市 → 撃退成功：</b>勝利点が最も高いプレイヤーが<b>発展カードを1枚</b>もらえます。</p>
    <p><b>❌ 騎士 ＜ 都市 → 防衛失敗：</b>そのラウンドで<b>騎士を1枚も使っていないプレイヤー</b>の都市が1つ開拓地に格下げされます（−1点）。</p>
    <p><small>※ ポイント：騎士カードは盗賊対策だけでなく<b>都市を守る盾</b>にもなります。都市を増やすほど蛮族に狙われやすいので、騎士とのバランスが大切です。都市が1つも無いときは被害ゼロ。</small></p>
  </div>`;
}
$('#rulesBtn').onclick = () => {
  $('#modalContent').innerHTML = `<h2>遊び方</h2><div class="rules-list">
    <p><b>🎯 目的：</b>最初に<b>10勝利点</b>に到達したプレイヤーの勝ちです。開拓地は1点、都市は2点。さらに最長交易路・最大騎士力・勝利点カードでも点が入ります。</p>
    <p><b>🏝 初期配置：</b>全員が開拓地と街道を2組ずつ、往復順（あなた→他3人→他3人→あなた）に置きます。2個目の開拓地の周囲のタイルから初期資源を受け取ります。</p>
    <p><b>🎲 資源の産出：</b>手番では必ず最初にダイスを振ります。出た目の数字を持つタイルに接する開拓地（1枚）・都市（2枚）の所有者が資源を得ます。<b>ダイスを振るまで建設・交換・発展カードは使えません。</b></p>
    <p><b>🔨 建設コスト：</b>街道＝🌲🧱／開拓地＝🌲🧱🌾🐑／都市（開拓地を発展）＝🌾2 ⛏3／発展カード＝🌾🐑⛏。開拓地は最大5個・都市は最大4個・街道は最大15本まで。開拓地を都市にすると開拓地の枠が空きます。</p>
    <p><b>🃏 発展カード：</b>引いたターンは使えず、<b>次の自分の手番から・1ターンに1枚だけ</b>使えます。
      <br>・<b>騎士</b>＝盗賊を好きな土地へ動かして1枚奪う（置く前に確定ボタンで確認）
      <br>・<b>街道建設</b>＝無料の街道を2本、自分で選んで置く
      <br>・<b>発見</b>＝銀行から好きな資源を2枚もらう
      <br>・<b>独占</b>＝資源を1種類選び全員から集める
      <br>・<b>勝利点</b>＝隠したまま自動で1点（自分だけ見える）
      <br>騎士を3枚以上使うと<b>最大騎士力＋2点</b>。</p>
    <p><b>⚓ 港と交換：</b>銀行とは通常4:1で交換。港に開拓地・都市があると<b>3:1</b>（どの資源でも）や<b>2:1</b>（指定資源）になります。盤上の港は点線でどのマスと繋がるか示され、保有中の港は銀行パネルに表示されます。手番中は他プレイヤーへ直接交換も提案できます。</p>
    <p><b>🦹 7と盗賊：</b>7が出ると手札8枚以上の人は半分を捨てます。振った人は盗賊を動かし、その土地に接する相手から1枚奪います。盗賊のいる土地は資源を産出しません。</p>
    <p><b>🛣 最長交易路：</b>連続5本以上の街道${state.expansion === 'seafarers' ? '・船' : ''}を最も長く繋いだ人が<b>＋2点</b>。</p>
    ${state.expansion === 'seafarers' ? seafarersRulesHtml() : ''}
    ${gameConfig.expansionHeroes ? heroesRulesHtml() : ''}
    ${gameConfig.expansionBarbarians ? barbariansRulesHtml() : ''}
    <p><b>🤖 NPCの強さ：</b>開始画面で「やさしい／ふつう／強い」を選べます。強いほど街道を賢く伸ばし、発展カードを積極的に使います${state.expansion === 'seafarers' ? '（船で新しい島も目指します）' : ''}。</p>
    <p><b>🔒 勝利点の表示：</b>あなたの合計点だけが表示され、他プレイヤーの点数は伏せられます（ゲーム終了時に公開）。</p>
  </div>`;
  $('#modal').showModal();
};
$('#modalClose').onclick = () => $('#modal').close();

Object.entries(RESOURCES).forEach(([key, resource]) => {
  $('#tradeGive').add(new Option(`${resource.icon} ${resource.name}`, key));
  $('#tradeGet').add(new Option(`1 ${resource.icon}`, key));
});
const flexStepper = (side, key) => `<span class="ft-stepper"><button type="button" class="ft-step" data-side="${side}" data-res="${key}" data-delta="-1" aria-label="減らす">−</button><b id="flex${side === 'give' ? 'Give' : 'Get'}-${key}">0</b><button type="button" class="ft-step" data-side="${side}" data-res="${key}" data-delta="1" aria-label="増やす">＋</button></span>`;
$('#flexTrade').innerHTML = `<div class="flex-trade-head"><span>資源</span><span class="head-give">渡す</span><span class="head-get">もらう</span></div>` + Object.entries(RESOURCES).map(([key, resource]) => `<div class="flex-trade-row"><span class="ft-res">${resource.icon} ${resource.name}</span>${flexStepper('give', key)}${flexStepper('get', key)}</div>`).join('');
$('#flexTrade').onclick = event => {
  const button = event.target.closest('.ft-step');
  if (!button) return;
  const target = $(`#flex${button.dataset.side === 'give' ? 'Give' : 'Get'}-${button.dataset.res}`);
  if (target) target.textContent = Math.max(0, Math.min(20, Number(target.textContent) + Number(button.dataset.delta)));
};
$('#tradeGet').selectedIndex = 1;
$('#tradeBtn').onclick = () => {
  if (state.phase !== 'play' || currentIsBot() || !state.rolled) return toast('ダイスを振ったあとに交換できます');
  const give = $('#tradeGive').value;
  const get = $('#tradeGet').value;
  const player = state.players[state.turn];
  if (give === get) return toast('違う資源を選んでください');
  const rate = maritimeRate(state.turn, give);
  if (player.resources[give] < rate) return toast(`${RESOURCES[give].name}が${rate}枚必要です`);
  if (state.bank[get] < 1) return toast(`銀行に${RESOURCES[get].name}がありません`);
  player.resources[give] -= rate;
  state.bank[give] += rate;
  player.resources[get]++;
  state.bank[get]--;
  toast('銀行と交換しました');
  soundEffect('trade');
  render();
};
$('#tradeGive').onchange = () => render();
$('#zoomIn').onclick = () => { scale = Math.min(1.25, scale + .1); $('#board').style.transform = `scale(${scale})`; };
$('#zoomOut').onclick = () => { scale = Math.max(.65, scale - .1); $('#board').style.transform = `scale(${scale})`; };
$('#soundBtn').onclick = () => setAudioEnabled(!audioEnabled);
$('#bgmBtn').onclick = cycleBgm;
$('#fullscreenBtn').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
};
$('#startGameBtn').onclick = () => {
  const name = $('#playerNameInput').value.trim();
  const humanCount = Math.min(4, Math.max(1, Number($('input[name="humanCount"]:checked')?.value) || 1));
  const humanNames = [name || 'あなた'];
  for (let i = 2; i <= humanCount; i++) {
    humanNames.push(($(`#humanName${i}`)?.value || '').trim() || `プレイヤー${i}`);
  }
  const expansionCheck = $('#expansionSeafarers');
  const heroesCheck = $('#expansionHeroes');
  const barbsCheck = $('#expansionBarbarians');
  gameConfig = {
    playerName: name || 'あなた',
    humanCount,
    humanNames,
    npcCount: Math.max(0, 4 - humanCount),
    boardMode: $('input[name="boardMode"]:checked').value,
    boardSize: $('input[name="boardSize"]:checked')?.value || 'standard',
    difficulty: $('input[name="difficulty"]:checked')?.value || 'normal',
    botSpeed: $('input[name="botSpeed"]:checked')?.value || 'normal',
    targetScore: Number($('input[name="targetScore"]:checked')?.value) || 10,
    music: $('#startMusic').checked,
    expansion: expansionCheck?.checked ? 'seafarers' : null,
    expansionHeroes: heroesCheck?.checked || false,
    expansionBarbarians: barbsCheck?.checked || false,
  };
  $('#startScreen').classList.add('hidden');
  setAudioEnabled(gameConfig.music);
  newGame();
  soundEffect('turn');
  // 拡張を選んで始めたら、その拡張のルールを最初に表示する
  if (gameConfig.expansion === 'seafarers' || gameConfig.expansionHeroes || gameConfig.expansionBarbarians) {
    showExpansionIntro();
  }
};

// 選んだ拡張のルールだけをまとめてモーダル表示する
function showExpansionIntro() {
  const parts = [];
  if (gameConfig.expansion === 'seafarers') parts.push(seafarersRulesHtml());
  if (gameConfig.expansionHeroes) parts.push(heroesRulesHtml());
  if (gameConfig.expansionBarbarians) parts.push(barbariansRulesHtml());
  if (!parts.length) return;
  $('#modalContent').innerHTML = `<h2>拡張ルールの遊び方</h2>
    <p style="color:#74817c;font-size:13px;margin:-4px 0 6px">選んだ拡張のルールです。「遊び方」ボタンからいつでも見直せます。</p>
    <div class="rules-list">${parts.join('')}</div>`;
  $('#modal').showModal();
}

newGame();
