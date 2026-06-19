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
const TYPE_DATA = { forest: { res: 'wood', icon: '🌲' }, hills: { res: 'brick', icon: '🧱' }, pasture: { res: 'sheep', icon: '🐑' }, fields: { res: 'wheat', icon: '🌾' }, mountains: { res: 'ore', icon: '⛏' }, desert: { res: null, icon: '☀' } };
const NUMBERS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
const COLORS = ['#c95642', '#3d7181', '#d9a838', '#577b59'];
const NAMES = ['あなた', 'ミナト', 'アオイ', 'ハル'];
const NPC_NAMES = ['ミナト', 'アオイ', 'ハル', 'カイ'];
const COSTS = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1 }, city: { wheat: 2, ore: 3 }, development: { wheat: 1, sheep: 1, ore: 1 } };
const PIECE_LIMITS = { road: 15, settlement: 5, city: 4 };
const SETUP_ORDER = [0, 1, 2, 3, 3, 2, 1, 0];
let state;
let vertices = [];
let edges = [];
let tiles = [];
let scale = 1;
let gameVersion = 0;
let botTimer = null;
let botWatchdog = null;
let gameConfig = { playerName: 'あなた', boardMode: 'default', music: true, difficulty: 'normal', botSpeed: 'normal' };
const BOT_SPEED = { slow: 1.7, normal: 1, fast: .35 };
const botDelay = ms => Math.round(ms * (BOT_SPEED[gameConfig.botSpeed] || 1));
const DIFFICULTY = {
  easy:   { label: 'やさしい', actions: 2, smartRoad: false, bankTrade: false, devBuy: false, devChance: .15 },
  normal: { label: 'ふつう',   actions: 4, smartRoad: false, bankTrade: true,  devBuy: true,  devChance: .5 },
  hard:   { label: '強い',     actions: 6, smartRoad: true,  bankTrade: true,  devBuy: true,  devChance: .85 }
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
  for (let attempt = 0; attempt < 200; attempt++) {
    const pool = shuffle(NUMBERS);
    const result = [];
    let cursor = 0;
    coords.forEach((_, index) => result[index] = types[index] === 'desert' ? null : pool[cursor++]);
    const fair = result.every((number, index) => ![6, 8].includes(number) || result.every((other, otherIndex) => index === otherIndex || ![6, 8].includes(other) || !isNeighbor(coords[index], coords[otherIndex])));
    if (fair) return result;
  }
  let cursor = 0;
  return types.map(type => type === 'desert' ? null : NUMBERS[cursor++]);
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
    players.push({ name, color: COLORS[i % COLORS.length], bot, vp: 0, resources: emptyResources(), dev: [], newDev: [], playedKnights: 0, devPlayed: false });
  }
  const base = shuffle(players.map((_, i) => i));
  const setupOrder = [...base, ...[...base].reverse()];
  state = {
    phase: 'setup', setupStep: 0, setupPart: 'settlement', setupVertex: null, pendingSetupVertex: null, pendingSetupEdge: null,
    turn: setupOrder[0], setupOrder, round: 1, rolled: false, mode: 'setup-settlement',
    targetScore: gameConfig.targetScore || 10, humanCount,
    players,
    buildings: {}, roads: {}, harbors: {}, bank: { wood: 19, brick: 19, wheat: 19, sheep: 19, ore: 19 }, robberTile: null, pendingRobberTile: null, freeRoads: 0, recentBotMoves: [], longestRoadOwner: null, largestArmyOwner: null,
    devDeck: shuffle([...Array(14).fill('knight'), ...Array(5).fill('victory'), ...Array(2).fill('roadBuilding'), ...Array(2).fill('plenty'), ...Array(2).fill('monopoly')]),
    gameOver: false, botBusy: false, resolvingSeven: false, rollLog: [], pendingCard: null, awaitingPass: false
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
    if (!state.botBusy && !state.rolled) botTurn();
    else if (!state.botBusy && state.rolled && elapsed > 2200) advanceTurn();
    else if (state.botBusy && elapsed > 5000) {
      state.botBusy = false;
      advanceTurn();
    }
  }, 1000);
}

function buildBoard() {
  const board = $('#board');
  board.innerHTML = '<div class="sea-ring"></div>';
  vertices = [];
  edges = [];
  tiles = [];
  const coords = [];
  for (let r = -2; r <= 2; r++) {
    const qMin = Math.max(-2, -r - 2);
    const qMax = Math.min(2, -r + 2);
    for (let q = qMin; q <= qMax; q++) coords.push({ q, r });
  }
  const types = gameConfig.boardMode === 'default' ? [...DEFAULT_TYPES] : shuffle(TILE_TYPES);
  const numbers = gameConfig.boardMode === 'default' ? [...DEFAULT_NUMBERS] : createFairNumbers(coords, types);
  coords.forEach((coord, i) => {
    const x = 345 + 96 * coord.q;
    const y = 325 + Math.sqrt(3) * 64 * (coord.r + coord.q / 2);
    const type = types[i];
    const num = numbers[i];
    tiles.push({ x, y, type, num, vertices: [] });
    if (type === 'desert') state.robberTile = i;
    const element = document.createElement('div');
    element.className = `hex ${type}`;
    element.dataset.tile = i;
    element.style.left = `${x - 64}px`;
    element.style.top = `${y - 56}px`;
    element.innerHTML = `<span class="tile-icon">${TYPE_DATA[type].icon}</span>${num ? `<span class="token ${num === 6 || num === 8 ? 'hot' : ''}">${num}<small>${'•'.repeat(6 - Math.abs(7 - num))}</small></span>` : ''}`;
    element.onclick = () => placeRobber(i);
    board.append(element);
  });
  const vertexMap = new Map();
  tiles.forEach((tile, tileIndex) => {
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI / 3 * corner;
      const x = Math.round(tile.x + 64 * Math.cos(angle));
      const y = Math.round(tile.y + 64 * Math.sin(angle));
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
  const harborTypes = gameConfig.boardMode === 'default' ? [null, 'wood', null, 'brick', null, 'wheat', 'sheep', null, 'ore'] : shuffle([null, null, null, null, 'wood', 'brick', 'wheat', 'sheep', 'ore']);
  const usedHarborVertices = new Set();
  for (let i = 0; i < 9; i++) {
    const target = Math.floor(i * boundaryEdges.length / 9);
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
    const badges = [
      state.longestRoadOwner === i ? '<span class="award-badge road-award">🛣 最長交易路</span>' : '',
      state.largestArmyOwner === i ? '<span class="award-badge army-award">⚔ 最大騎士力</span>' : ''
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
  const confirmOverlay = $('#robberConfirmOverlay');
  if (confirmOverlay) {
    const show = state.mode === 'robber' && state.pendingRobberTile != null;
    confirmOverlay.style.display = show ? 'flex' : 'none';
  }
  $$('.build-card').forEach(button => {
    if (setup) button.disabled = botTurnNow || button.dataset.build !== state.setupPart;
    else button.disabled = state.resolvingSeven || botTurnNow || !state.rolled || !canAfford(button.dataset.build, state.turn) || !hasPieceAvailable(state.turn, button.dataset.build);
  });
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
}

function adjacentNodes(vertex) {
  return edges.filter(edge => edge.a === vertex || edge.b === vertex).map(edge => edge.a === vertex ? edge.b : edge.a);
}

function canPlaceInitialSettlement(vertex) {
  return !state.buildings[vertex] && !adjacentNodes(vertex).some(neighbor => state.buildings[neighbor]);
}

function canAfford(type, player = 0) {
  return Object.entries(COSTS[type]).every(([resource, amount]) => state.players[player].resources[resource] >= amount);
}

function pay(type, player = 0) {
  Object.entries(COSTS[type]).forEach(([resource, amount]) => {
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
  return rate;
}

function visibleVP(player) {
  return state.players[player].vp + (state.longestRoadOwner === player ? 2 : 0) + (state.largestArmyOwner === player ? 2 : 0);
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
    else $$('.edge').filter(element => state.roads[element.dataset.edge] === undefined && edgeTouches(+element.dataset.edge, state.setupVertex)).forEach(element => {
      const edge = +element.dataset.edge;
      element.classList.add('available', 'setup-candidate');
      if (edge === state.pendingSetupEdge) {
        element.classList.add('selected-preview');
        element.style.setProperty('--preview-color', state.players[actor].color);
      }
    });
    return;
  }
  if (!state.mode || currentIsBot()) return;
  if (state.mode === 'road') $$('.edge').filter(element => state.roads[element.dataset.edge] === undefined && roadConnected(+element.dataset.edge, actor)).forEach(element => element.classList.add('available'));
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

function canSettle(vertex, player) {
  if (!canPlaceInitialSettlement(vertex)) return false;
  return edges.some((edge, i) => (edge.a === vertex || edge.b === vertex) && state.roads[i] === player);
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
    if (currentIsBot() || state.setupPart !== 'road' || state.roads[edgeIndex] !== undefined || !edgeTouches(edgeIndex, state.setupVertex)) return;
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

function scheduleBotSetup() {
  const version = gameVersion;
  const expectedStep = state.setupStep;
  const expectedPlayer = state.turn;
  state.botTurnStartedAt = Date.now();
  setTimeout(() => {
    if (version !== gameVersion || state.phase !== 'setup' || state.setupStep !== expectedStep || state.turn !== expectedPlayer || !currentIsBot()) return;
    const player = expectedPlayer;
    const choices = vertices.map((_, i) => i).filter(canPlaceInitialSettlement).sort((a, b) => setupVertexScore(b) - setupVertexScore(a));
    const vertex = choices[0];
    placeInitialSettlement(vertex, player);
    state.setupVertex = vertex;
    state.setupPart = 'road';
    render();
    setTimeout(() => {
      if (version !== gameVersion || state.phase !== 'setup' || state.setupStep !== expectedStep || state.turn !== expectedPlayer || state.setupPart !== 'road') return;
      const roads = edges.map((_, i) => i).filter(i => state.roads[i] === undefined && edgeTouches(i, vertex));
      state.roads[roads[Math.floor(Math.random() * roads.length)]] = player;
      toast(`${state.players[player].name}が開拓地と街道を配置`);
      finishSetupTurn();
    }, 450);
  }, 500);
}

function forceSetupNpc() {
  if (state.phase !== 'setup' || !currentIsBot()) return;
  const player = state.turn;
  if (state.setupPart === 'settlement') {
    const choices = vertices.map((_, i) => i).filter(canPlaceInitialSettlement).sort((a, b) => setupVertexScore(b) - setupVertexScore(a));
    if (!choices.length) return;
    state.setupVertex = choices[0];
    placeInitialSettlement(state.setupVertex, player);
    state.setupPart = 'road';
  }
  const roads = edges.map((_, i) => i).filter(i => state.roads[i] === undefined && edgeTouches(i, state.setupVertex));
  if (!roads.length) return;
  state.roads[roads[0]] = player;
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
  Object.entries(state.buildings).forEach(([vertex, building]) => {
    vertices[vertex].tiles.forEach(tileIndex => {
      const tile = tiles[tileIndex];
      const resource = TYPE_DATA[tile.type].res;
      if (tileIndex !== state.robberTile && tile.num === sum && resource) {
        const amount = building.type === 'city' ? 2 : 1;
        claims[resource].push({ player: building.player, amount });
      }
    });
  });
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
  toast(gained ? `${sum}！ 資源を ${gained} 枚獲得` : `${sum}！ 島から資源が産出しました`);
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
    const count = handTotal(player);
    if (count <= 7) return;
    for (let k = 0; k < Math.floor(count / 2); k++) {
      const resource = randomOwnedResource(i);
      if (resource) { player.resources[resource]--; state.bank[resource]++; }
    }
  });
  state.sevenRoller = roller;
  state.discardQueue = state.players.map((p, i) => i).filter(i => !state.players[i].bot && handTotal(state.players[i]) > 7);
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
    moveRobberAndSteal(roller);
    state.resolvingSeven = false;
    render();
    toast(`7！ ${state.players[roller].name}が盗賊を動かしました`);
  } else {
    beginRobberChoice();
  }
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
  if (state.mode !== 'robber' || tileIndex === state.robberTile) return;
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
  resetFlexTrade();
  $('#diceResult').innerHTML = '<span>—</span><span>—</span>';
  render();
  if (currentIsBot()) scheduleBotTurn();
  else { soundEffect('turn'); beginHumanTurn(`${state.players[state.turn].name}のターンです`); }
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
    if (version === gameVersion && state.turn === expectedPlayer && !state.gameOver) {
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
  if (botRules().bankTrade) Object.entries(COSTS[type]).forEach(([resource, amount]) => {
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
      const vertex = settlements.sort((a, b) => setupVertexScore(b) - setupVertexScore(a))[0];
      pay('settlement', player);
      state.buildings[vertex] = { player, type: 'settlement' };
      state.players[player].vp++;
      state.recentBotMoves.push({ kind: 'building', id: Number(vertex) });
      messages.push('開拓地');
      continue;
    }
    const roads = edges.map((_, i) => i).filter(i => state.roads[i] === undefined && roadConnected(i, player));
    if (roads.length && hasPieceAvailable(player, 'road') && prepareCost(player, 'road')) {
      const chosen = rules.smartRoad ? roads.sort((a, b) => roadValue(b, player) - roadValue(a, player))[0] : roads[Math.floor(Math.random() * roads.length)];
      pay('road', player);
      state.roads[chosen] = player;
      state.recentBotMoves.push({ kind: 'road', id: Number(chosen) });
      messages.push('街道');
      continue;
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
  state.players[player].newDev.push(state.devDeck.pop());
  return true;
}

function moveRobberAndSteal(player) {
  const target = tiles.map((tile, index) => ({ index, score: index === state.robberTile ? -1 : tile.vertices.reduce((sum, vertex) => {
    const building = state.buildings[vertex];
    return sum + (building && building.player !== player ? (building.type === 'city' ? 3 : 2) : 0);
  }, 0) + Math.random() })).sort((a, b) => b.score - a.score)[0].index;
  state.robberTile = target;
  const victims = [...new Set(tiles[target].vertices.map(vertex => state.buildings[vertex]?.player).filter(owner => owner != null && owner !== player && randomOwnedResource(owner)))];
  if (!victims.length) return;
  const victim = victims[Math.floor(Math.random() * victims.length)];
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
  const owned = edges.map((_, index) => index).filter(index => state.roads[index] === player);
  function walk(vertex, used) {
    if (used.size && state.buildings[vertex] && state.buildings[vertex].player !== player) return used.size;
    let best = used.size;
    owned.forEach(edgeIndex => {
      if (used.has(edgeIndex)) return;
      const edge = edges[edgeIndex];
      if (edge.a !== vertex && edge.b !== vertex) return;
      const next = edge.a === vertex ? edge.b : edge.a;
      const nextUsed = new Set(used);
      nextUsed.add(edgeIndex);
      best = Math.max(best, walk(next, nextUsed));
    });
    return best;
  }
  return vertices.reduce((best, _, vertex) => Math.max(best, walk(vertex, new Set())), 0);
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
}

function npcResourceNeed(player, resource) {
  const plans = ['city', 'settlement', 'road', 'development'];
  return plans.reduce((score, type) => {
    const cost = COSTS[type][resource] || 0;
    if (!cost) return score;
    const totalMissing = Object.entries(COSTS[type]).reduce((sum, [key, amount]) => sum + Math.max(0, amount - state.players[player].resources[key]), 0);
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
$('#rollBtn').onclick = primaryAction;
$('#endTurnBtn').onclick = endTurn;
$('#npcControlBtn').onclick = forceNpcProgress;
$('#cancelCardBtn').onclick = cancelCardAction;
$('#playerTradeBtn').onclick = executePlayerTrade;
$('#playerTradeAllBtn').onclick = executePlayerTradeAll;
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
    <p><b>🛣 最長交易路：</b>連続5本以上の街道を最も長く繋いだ人が<b>＋2点</b>。</p>
    <p><b>🤖 NPCの強さ：</b>開始画面で「やさしい／ふつう／強い」を選べます。強いほど街道を賢く伸ばし、発展カードを積極的に使います。</p>
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
  gameConfig = {
    playerName: name || 'あなた',
    humanCount,
    humanNames,
    npcCount: Math.max(0, 4 - humanCount),
    boardMode: $('input[name="boardMode"]:checked').value,
    difficulty: $('input[name="difficulty"]:checked')?.value || 'normal',
    botSpeed: $('input[name="botSpeed"]:checked')?.value || 'normal',
    targetScore: Number($('input[name="targetScore"]:checked')?.value) || 10,
    music: $('#startMusic').checked
  };
  $('#startScreen').classList.add('hidden');
  setAudioEnabled(gameConfig.music);
  newGame();
  soundEffect('turn');
};

newGame();
