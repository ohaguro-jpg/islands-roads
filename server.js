const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 4180);
const ROOT = __dirname;
const rooms = new Map();
const COLORS = ['#c95642', '#3d7181', '#d9a838', '#577b59'];
const RESOURCES = ['wood', 'brick', 'wheat', 'sheep', 'ore'];
const COSTS = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1 }, city: { wheat: 2, ore: 3 }, development: { wheat: 1, sheep: 1, ore: 1 }, ship: { wood: 1, sheep: 1 } };
const TYPES = ['forest','forest','forest','forest','hills','hills','hills','pasture','pasture','pasture','pasture','fields','fields','fields','fields','mountains','mountains','mountains','desert'];
const TYPE_RESOURCE = { forest: 'wood', hills: 'brick', pasture: 'sheep', fields: 'wheat', mountains: 'ore', desert: null, sea: null, gold: null };
const NUMBERS = [5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11];
// Seafarers expansion: radius-3 board with sea, gold fields, and two discovery islands
const ISLAND_BONUS_VP = 1;
const SEA_HEX_SIZE = 52;
const SEAFARERS_HOME = new Set(['-1,-1','0,-1','1,-1','-1,0','0,0','1,0','-1,1','0,1','1,1']);
const SEAFARERS_DISC1 = new Set(['1,-3','2,-3','3,-3','3,-2']);
const SEAFARERS_DISC2 = new Set(['-3,2','-3,3','-2,3']);
const SEAFARERS_TILE_TYPES = ['fields','hills','forest','pasture','mountains','fields','pasture','forest','desert','mountains','hills','forest','gold','pasture','fields','gold'];
const SEAFARERS_TILE_NUMBERS = [9,6,4,3,12,10,8,5,null,2,11,8,5,9,6,10];
const LAND_TYPES = new Set(['forest','hills','pasture','fields','mountains','desert','gold']);

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function emptyResources() { return { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 }; }
function token() { return crypto.randomBytes(24).toString('base64url'); }
function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(''); } while (rooms.has(code));
  return code;
}
function cleanName(value) { return String(value || '').trim().slice(0, 12) || 'プレイヤー'; }

function buildGeometry(random = true) {
  const coords = [];
  for (let r = -2; r <= 2; r++) for (let q = Math.max(-2, -r - 2); q <= Math.min(2, -r + 2); q++) coords.push({ q, r });
  const types = random ? shuffle(TYPES) : ['mountains','pasture','forest','fields','hills','pasture','mountains','forest','fields','desert','fields','forest','mountains','forest','pasture','hills','fields','pasture','hills'];
  const numberPool = random ? shuffle(NUMBERS) : [4,9,6,4,12,10,11,10,8,3,2,9,3,8,11,6,5,5];
  let numberIndex = 0;
  const tiles = coords.map((coord, index) => ({ id: index, q: coord.q, r: coord.r, x: 350 + 96 * coord.q, y: 330 + Math.sqrt(3) * 64 * (coord.r + coord.q / 2), type: types[index], number: types[index] === 'desert' ? null : numberPool[numberIndex++], vertices: [] }));
  const vertexMap = new Map();
  const vertices = [];
  tiles.forEach((tile, tileId) => {
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI / 3 * corner;
      const x = Math.round(tile.x + 64 * Math.cos(angle));
      const y = Math.round(tile.y + 64 * Math.sin(angle));
      const key = `${x},${y}`;
      let id = vertexMap.get(key);
      if (id == null) { id = vertices.length; vertexMap.set(key, id); vertices.push({ id, x, y, tiles: [] }); }
      vertices[id].tiles.push(tileId);
      tile.vertices.push(id);
    }
  });
  const edgeMap = new Map();
  const edges = [];
  tiles.forEach(tile => tile.vertices.forEach((a, corner) => {
    const b = tile.vertices[(corner + 1) % 6];
    const key = [a, b].sort((x, y) => x - y).join('-');
    if (!edgeMap.has(key)) { edgeMap.set(key, edges.length); edges.push({ id: edges.length, a, b }); }
  }));
  // 港: 海岸の辺に9個（default は固定配置、random はシャッフル）
  const coastal = new Set(vertices.filter(v => v.tiles.length < 3).map(v => v.id));
  const boundaryEdges = edges
    .filter(e => coastal.has(e.a) && coastal.has(e.b) && vertices[e.a].tiles.filter(t => vertices[e.b].tiles.includes(t)).length === 1)
    .map(e => ({ e, angle: Math.atan2((vertices[e.a].y + vertices[e.b].y) / 2 - 330, (vertices[e.a].x + vertices[e.b].x) / 2 - 350) }))
    .sort((a, b) => a.angle - b.angle);
  const harborTypes = random ? shuffle([null, null, null, null, 'wood', 'brick', 'wheat', 'sheep', 'ore']) : [null, 'wood', null, 'brick', null, 'wheat', 'sheep', null, 'ore'];
  const harbors = {};
  const harborEdges = [];
  const usedHarborVertices = new Set();
  for (let i = 0; i < 9 && boundaryEdges.length; i++) {
    const target = Math.floor(i * boundaryEdges.length / 9);
    let offset = 0;
    while (offset < boundaryEdges.length && [boundaryEdges[(target + offset) % boundaryEdges.length].e.a, boundaryEdges[(target + offset) % boundaryEdges.length].e.b].some(v => usedHarborVertices.has(v))) offset++;
    const he = boundaryEdges[(target + offset) % boundaryEdges.length].e;
    usedHarborVertices.add(he.a); usedHarborVertices.add(he.b);
    harbors[he.a] = harborTypes[i]; harbors[he.b] = harborTypes[i];
    harborEdges.push({ a: he.a, b: he.b, type: harborTypes[i] });
  }
  return { tiles, vertices, edges, harbors, harborEdges };
}

// Seafarers: radius-3 board, sea + gold tiles, home island + two discovery islands.
function buildSeafarersGeometry(random = false) {
  const S = SEA_HEX_SIZE, HS = S * 1.5, VS = S * Math.sqrt(3), CX = 350, CY = 335;
  const coords = [];
  for (let r = -3; r <= 3; r++) for (let q = Math.max(-3, -r - 3); q <= Math.min(3, -r + 3); q++) coords.push({ q, r });
  const landTypes = random ? shuffle([...SEAFARERS_TILE_TYPES]) : [...SEAFARERS_TILE_TYPES];
  const landNumbers = [...SEAFARERS_TILE_NUMBERS];
  let landIndex = 0;
  const tiles = coords.map((coord, id) => {
    const key = `${coord.q},${coord.r}`;
    const island = SEAFARERS_HOME.has(key) ? 0 : SEAFARERS_DISC1.has(key) ? 1 : SEAFARERS_DISC2.has(key) ? 2 : null;
    const isSea = island === null;
    const x = Math.round(CX + HS * coord.q);
    const y = Math.round(CY + VS * (coord.r + coord.q / 2));
    const type = isSea ? 'sea' : landTypes[landIndex];
    const number = isSea ? null : landNumbers[landIndex];
    if (!isSea) landIndex++;
    return { id, q: coord.q, r: coord.r, x, y, type, number, island, vertices: [] };
  });
  const vertexMap = new Map();
  const vertices = [];
  tiles.forEach((tile, tileId) => {
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI / 3 * corner;
      const x = Math.round(tile.x + S * Math.cos(angle));
      const y = Math.round(tile.y + S * Math.sin(angle));
      const key = `${x},${y}`;
      let id = vertexMap.get(key);
      if (id == null) { id = vertices.length; vertexMap.set(key, id); vertices.push({ id, x, y, tiles: [] }); }
      vertices[id].tiles.push(tileId);
      tile.vertices.push(id);
    }
  });
  const edgeMap = new Map();
  const edges = [];
  tiles.forEach(tile => tile.vertices.forEach((a, corner) => {
    const b = tile.vertices[(corner + 1) % 6];
    const key = [a, b].sort((x, y) => x - y).join('-');
    if (!edgeMap.has(key)) { edgeMap.set(key, edges.length); edges.push({ id: edges.length, a, b }); }
  }));
  // Harbors sit on coastal edges (land↔sea boundary)
  const coastal = edges.map(edge => {
    const shared = vertices[edge.a].tiles.filter(t => vertices[edge.b].tiles.includes(t));
    const types = shared.map(t => tiles[t].type);
    if (!types.some(t => LAND_TYPES.has(t)) || !types.includes('sea')) return null;
    const mx = (vertices[edge.a].x + vertices[edge.b].x) / 2, my = (vertices[edge.a].y + vertices[edge.b].y) / 2;
    return { edge, angle: Math.atan2(my - CY, mx - CX) };
  }).filter(Boolean).sort((a, b) => a.angle - b.angle);
  const harborTypes = random ? shuffle([null, null, null, null, 'wood', 'brick', 'wheat', 'sheep', 'ore']) : [null, 'wood', null, 'brick', null, 'wheat', 'sheep', null, 'ore'];
  const harbors = {};
  const harborEdges = [];
  const usedVertices = new Set();
  const count = Math.min(9, coastal.length);
  for (let i = 0; i < count; i++) {
    const target = Math.floor(i * coastal.length / count);
    let offset = 0;
    while (offset < coastal.length && [coastal[(target + offset) % coastal.length].edge.a, coastal[(target + offset) % coastal.length].edge.b].some(v => usedVertices.has(v))) offset++;
    const edge = coastal[(target + offset) % coastal.length].edge;
    usedVertices.add(edge.a); usedVertices.add(edge.b);
    harbors[edge.a] = harborTypes[i]; harbors[edge.b] = harborTypes[i];
    harborEdges.push({ a: edge.a, b: edge.b, type: harborTypes[i] });
  }
  return { tiles, vertices, edges, harbors, harborEdges, hexSize: S, expansion: 'seafarers' };
}

function isSeaEdge(game, edgeId) {
  const edge = game.edges[edgeId];
  const shared = game.vertices[edge.a].tiles.filter(t => game.vertices[edge.b].tiles.includes(t));
  return shared.some(t => game.tiles[t].type === 'sea');
}
function isLandVertex(game, vertex) { return game.vertices[vertex].tiles.some(t => LAND_TYPES.has(game.tiles[t].type)); }
function shipConnected(game, edgeId, player) {
  const edge = game.edges[edgeId];
  return [edge.a, edge.b].some(vertex => {
    const building = game.buildings[vertex];
    if (building && building.player !== player) return false;
    if (building?.player === player) return true;
    return game.edges.some(item => item.id !== edgeId && (item.a === vertex || item.b === vertex) && game.ships[item.id] === player);
  });
}
function validShip(game, edgeId, player) {
  if (game.expansion !== 'seafarers') return false;
  const edge = game.edges[edgeId];
  if (!edge || game.ships[edgeId] != null || game.roads[edgeId] != null) return false;
  if (!isSeaEdge(game, edgeId)) return false;
  if (game.pirateTile != null) {
    const adjacent = game.vertices[edge.a].tiles.filter(t => game.vertices[edge.b].tiles.includes(t));
    if (adjacent.includes(game.pirateTile)) return false;
  }
  return shipConnected(game, edgeId, player);
}
function isMovableShip(game, edgeId, player) {
  if (game.ships[edgeId] !== player) return false;
  if ((game.shipsBuiltThisTurn || []).includes(Number(edgeId))) return false;
  const edge = game.edges[edgeId];
  return [edge.a, edge.b].some(vertex => {
    if (game.buildings[vertex]) return false;
    return !game.edges.some(other => other.id !== Number(edgeId) && (other.a === vertex || other.b === vertex) && game.ships[other.id] === player);
  });
}
function grantIslandDiscovery(game, vertex, player) {
  if (game.expansion !== 'seafarers') return;
  game.vertices[vertex].tiles.forEach(tileId => {
    const island = game.tiles[tileId]?.island;
    if (island == null || island === 0 || game.islandSettlers[island] != null) return;
    game.islandSettlers[island] = player;
    game.islandVP[player] = (game.islandVP[player] || 0) + ISLAND_BONUS_VP;
  });
}
function pirateVictims(game, tile, roller) {
  const set = new Set();
  game.edges.forEach(edge => {
    if (game.ships[edge.id] == null || game.ships[edge.id] === roller) return;
    const shared = game.vertices[edge.a].tiles.filter(t => game.vertices[edge.b].tiles.includes(t));
    if (shared.includes(tile) && handTotal(game.hands[game.ships[edge.id]]) > 0) set.add(game.ships[edge.id]);
  });
  return [...set];
}

function maritimeRate(game, player, resource) {
  let rate = 4;
  for (const [vertex, type] of Object.entries(game.harbors || {})) {
    if (game.buildings[vertex]?.player !== player) continue;
    if (type === resource) rate = 2; else if (type == null) rate = Math.min(rate, 3);
  }
  return rate;
}
function victoryCards(game, player) { return [...game.dev[player], ...game.newDev[player]].filter(c => c === 'victory').length; }
// 表示用の勝利点（建物＋最長交易路＋最大騎士力。隠れた勝利点カードは含めない）
function visibleVP(game, player) { return game.vp[player] + (game.longestRoadOwner === player ? 2 : 0) + (game.largestArmyOwner === player ? 2 : 0) + ((game.islandVP && game.islandVP[player]) || 0); }
// 勝敗判定用の総勝利点（勝利点カードも含む）
function totalVP(game, player) { return visibleVP(game, player) + victoryCards(game, player); }
function updateArmy(game) {
  const best = Math.max(...game.playedKnights);
  if (best >= 3) { const leaders = game.playedKnights.map((size, p) => ({ size, p })).filter(i => i.size === best); if (!leaders.some(i => i.p === game.largestArmyOwner)) game.largestArmyOwner = leaders.length === 1 ? leaders[0].p : null; }
  else game.largestArmyOwner = null;
}

function longestRoadLength(game, player) {
  // Seafarers: roads + ships count together but only connect through a settlement (not edge-to-edge)
  const seafarers = game.expansion === 'seafarers';
  const owned = game.edges.filter(e => game.roads[e.id] === player || (seafarers && game.ships[e.id] === player));
  function walk(vertex, used, lastWasShip) {
    if (used.size > 0 && game.buildings[vertex] && game.buildings[vertex].player !== player) return used.size;
    let best = used.size;
    for (const e of owned) {
      if (used.has(e.id) || (e.a !== vertex && e.b !== vertex)) continue;
      const isShip = seafarers && game.ships[e.id] === player;
      if (seafarers && used.size > 0 && isShip !== lastWasShip) {
        const building = game.buildings[vertex];
        if (!building || building.player !== player) continue;
      }
      const next = e.a === vertex ? e.b : e.a;
      used.add(e.id); best = Math.max(best, walk(next, used, isShip)); used.delete(e.id);
    }
    return best;
  }
  let best = 0;
  for (const v of game.vertices) best = Math.max(best, walk(v.id, new Set(), false));
  return best;
}
function updateLongestRoad(game) {
  const n = game.playedKnights.length;
  const lengths = Array.from({ length: n }, (_, p) => longestRoadLength(game, p));
  const best = Math.max(...lengths);
  if (best >= 5) {
    const leaders = lengths.map((len, p) => ({ len, p })).filter(i => i.len === best);
    if (!leaders.some(i => i.p === game.longestRoadOwner)) game.longestRoadOwner = leaders.length === 1 ? leaders[0].p : null;
  } else game.longestRoadOwner = null;
}

function createRoom(name, boardMode, expansion, difficulty) {
  const code = roomCode();
  const room = { code, host: 0, phase: 'lobby', boardMode: boardMode === 'random' ? 'random' : 'default', expansion: expansion === 'seafarers' ? 'seafarers' : null, difficulty: ['easy','hard'].includes(difficulty) ? difficulty : 'normal', botSpeed: 'normal', players: [], version: 1, clients: new Set(), game: null, offers: [], lastActive: Date.now() };
  rooms.set(code, room);
  return { room, identity: addPlayer(room, name) };
}

function addPlayer(room, name) {
  if (room.phase !== 'lobby') throw new Error('ゲームはすでに開始しています');
  if (room.players.length >= 4) throw new Error('このルームは満員です');
  const player = { id: room.players.length, name: cleanName(name), color: COLORS[room.players.length], token: token(), connected: true, isBot: false };
  room.players.push(player);
  room.version++;
  broadcast(room);
  return { playerId: player.id, token: player.token, roomCode: room.code };
}

function startRoom(room, playerId, fillBots = false, difficulty = null) {
  if (room.host !== playerId) throw new Error('ホストだけが開始できます');
  if (difficulty) room.difficulty = ['easy','hard'].includes(difficulty) ? difficulty : 'normal';
  if (fillBots) while (room.players.length < 4) room.players.push({ id: room.players.length, name: `NPC ${room.players.length}`, color: COLORS[room.players.length], token: token(), connected: true, isBot: true });
  if (room.players.length < 2) throw new Error('2人以上必要です。1人の場合はNPCを追加して開始してください');
  const seafarers = room.expansion === 'seafarers';
  const geometry = seafarers ? buildSeafarersGeometry(room.boardMode === 'random') : buildGeometry(room.boardMode === 'random');
  const order = [...room.players.map(player => player.id), ...room.players.map(player => player.id).reverse()];
  room.phase = 'game';
  room.game = {
    ...geometry, turn: order[0], round: 0, stage: 'setup-settlement', setupOrder: order, setupIndex: 0, setupVertex: null,
    rolled: false, dice: null, buildings: {}, roads: {}, ships: {}, robberTile: geometry.tiles.find(tile => tile.type === 'desert').id,
    bank: Object.fromEntries(RESOURCES.map(resource => [resource, 19])),
    hands: room.players.map(() => emptyResources()), vp: room.players.map(() => 0), winner: null,
    devDeck: shuffle([...Array(14).fill('knight'), ...Array(5).fill('victory'), ...Array(2).fill('roadBuilding'), ...Array(2).fill('plenty'), ...Array(2).fill('monopoly')]),
    dev: room.players.map(() => []), newDev: room.players.map(() => []), playedKnights: room.players.map(() => 0),
    devPlayed: room.players.map(() => false), freeRoads: 0, largestArmyOwner: null, longestRoadOwner: null,
    expansion: seafarers ? 'seafarers' : null, pirateTile: null, islandSettlers: {}, islandVP: room.players.map(() => 0),
    goldPick: {}, shipsBuiltThisTurn: [], movedShipThisTurn: false
  };
  touch(room);
}

// オンラインNPCの難易度: 1ターンの建設回数・銀行交換・発展カード購入を変える
const DIFFICULTY_BOT = {
  easy:   { maxActions: 2, bankTrade: false, devBuy: false },
  normal: { maxActions: 4, bankTrade: true,  devBuy: true },
  hard:   { maxActions: 6, bankTrade: true,  devBuy: true },
};
// 目標(type)に足りない資源を、余剰資源の銀行交換で1回ぶん補う。交換したら true。
function botBankTradeToward(room, player, type) {
  const game = room.game;
  const cost = COSTS[type];
  const need = {};
  for (const [r, amt] of Object.entries(cost)) { const miss = amt - game.hands[player][r]; if (miss > 0) need[r] = miss; }
  const wanted = Object.keys(need).sort((a, b) => need[b] - need[a]);
  if (!wanted.length) return false; // すでに買える
  for (const give of RESOURCES) {
    if (need[give]) continue;                     // 足りない資源は出さない
    const keep = cost[give] || 0;                 // 目標に要る分は残す
    const rate = maritimeRate(game, player, give);
    if (game.hands[player][give] - keep < rate) continue;
    const get = wanted.find(r => game.bank[r] > 0 && r !== give);
    if (!get) continue;
    act(room, player, 'bankTrade', { give, get });
    return true;
  }
  return false;
}

function scheduleRoomBot(room) {
  clearTimeout(room.botTimer);
  const game = room.game;
  if (room.phase !== 'game' || !game || game.winner != null || !room.players[game.turn]?.isBot) return;
  const player = game.turn;
  const delay = game.stage.startsWith('setup') ? 200 : (room.botSpeed === 'fast' ? 200 : room.botSpeed === 'slow' ? 1500 : 550);
  room.botTimer = setTimeout(() => {
    try {
      if (game.stage === 'setup-settlement') {
        const vertex = game.vertices.find(item => validSettlement(game, item.id, player, true));
        if (vertex) act(room, player, 'placeSettlement', { vertex: vertex.id });
      } else if (game.stage === 'setup-road') {
        const edge = game.edges.find(item => validRoad(game, item.id, player, game.setupVertex));
        if (edge) act(room, player, 'placeRoad', { edge: edge.id });
      } else if (game.stage === 'roll') {
        game.botActions = 0;
        act(room, player, 'roll');
      } else if (game.stage === 'robber') {
        const candidates = game.tiles.filter(t => t.id !== game.robberTile);
        const good = candidates.find(t => robberVictims(game, t.id, player).length);
        act(room, player, 'moveRobber', { tile: (good || candidates[crypto.randomInt(candidates.length)]).id });
      } else if (game.stage === 'steal') {
        act(room, player, 'steal', { victim: game.stealOptions[0] });
      } else if (game.stage === 'build') {
        const diff = DIFFICULTY_BOT[room.difficulty] || DIFFICULTY_BOT.normal;
        game.botActions = (game.botActions || 0) + 1;
        const city = Object.entries(game.buildings).find(([, piece]) => piece.player === player && piece.type === 'settlement');
        const settlement = game.vertices.find(item => validSettlement(game, item.id, player, false));
        const road = game.edges.find(item => validRoad(game, item.id, player));
        const canCity = city && pieceCount(game, player, 'city') < 4;
        const canSettle = settlement && pieceCount(game, player, 'settlement') < 5;
        const canRoad = road && pieceCount(game, player, 'road') < 15;
        if (game.botActions > diff.maxActions) act(room, player, 'endTurn');
        else if (!game.devPlayed[player] && game.dev[player].includes('knight') && game.tiles.some(t => t.id !== game.robberTile && robberVictims(game, t.id, player).length)) act(room, player, 'playDev', { card: 'knight' });
        else if (canCity && canPay(game, player, 'city')) act(room, player, 'buildCity', { vertex: Number(city[0]) });
        else if (canSettle && canPay(game, player, 'settlement')) act(room, player, 'placeSettlement', { vertex: settlement.id });
        else if (canRoad && canPay(game, player, 'road')) act(room, player, 'placeRoad', { edge: road.id });
        // 銀行交換で目標に近づく（normal/hard）。優先度: 都市→開拓地→（hardのみ）街道
        else if (diff.bankTrade && canCity && botBankTradeToward(room, player, 'city')) { /* traded */ }
        else if (diff.bankTrade && canSettle && botBankTradeToward(room, player, 'settlement')) { /* traded */ }
        else if (diff.bankTrade && diff.maxActions >= 6 && canRoad && botBankTradeToward(room, player, 'road')) { /* traded */ }
        else if (diff.devBuy && game.devDeck.length && canPay(game, player, 'development')) act(room, player, 'buyDev');
        else act(room, player, 'endTurn');
      }
    } catch (error) {
      console.error('Online NPC error:', error.message);
      if (game.stage === 'build') try { act(room, player, 'endTurn'); } catch {}
    }
  }, delay);
  room.botTimer.unref?.(); // テストやCLIでプロセス終了を妨げない（本番はHTTPサーバが常駐）
}

function scheduleIdleCheck(room) {
  clearTimeout(room.idleTimer);
  const game = room.game;
  if (room.phase !== 'game' || !game || game.winner != null || room.players[game.turn]?.isBot) return;
  const player = game.turn;
  room.idleTimer = setTimeout(() => {
    try {
      if (game.turn !== player || game.winner != null) return;
      if (game.stage === 'setup-settlement') {
        const v = game.vertices.find(item => validSettlement(game, item.id, player, true));
        if (v) act(room, player, 'placeSettlement', { vertex: v.id });
      } else if (game.stage === 'setup-road') {
        const e = game.edges.find(item => validRoad(game, item.id, player, game.setupVertex));
        if (e) act(room, player, 'placeRoad', { edge: e.id });
      } else if (game.stage === 'roll') {
        act(room, player, 'roll');
      } else if (game.stage === 'build') {
        act(room, player, 'endTurn');
      } else if (game.stage === 'robber') {
        const candidates = game.tiles.filter(t => t.id !== game.robberTile);
        act(room, player, 'moveRobber', { tile: candidates[crypto.randomInt(candidates.length)].id });
      } else if (game.stage === 'steal' && game.stealOptions?.length) {
        act(room, player, 'steal', { victim: game.stealOptions[0] });
      } else if (game.stage === 'discard' && game.discard?.[player] != null) {
        const hand = game.hands[player], needed = game.discard[player], sel = {};
        let rem = needed;
        for (const r of [...RESOURCES].sort((a, b) => hand[b] - hand[a])) { const n = Math.min(hand[r], rem); if (n > 0) { sel[r] = n; rem -= n; } if (!rem) break; }
        act(room, player, 'discard', { resources: sel });
      }
    } catch (e) { console.error('Idle auto-action failed:', e.message); }
  }, 60000);
  room.idleTimer.unref?.(); // プロセス終了を妨げない
}
function adjacentVertices(game, vertex) { return game.edges.filter(edge => edge.a === vertex || edge.b === vertex).map(edge => edge.a === vertex ? edge.b : edge.a); }
function validSettlement(game, vertex, player, setup = false) {
  if (!game.vertices[vertex] || game.buildings[vertex]) return false;
  if (game.expansion === 'seafarers' && !isLandVertex(game, vertex)) return false;
  if (adjacentVertices(game, vertex).some(id => game.buildings[id])) return false;
  if (setup) return true;
  return game.edges.some(edge => (edge.a === vertex || edge.b === vertex) && (game.roads[edge.id] === player || game.ships[edge.id] === player));
}
function validRoad(game, edgeId, player, setupVertex = null) {
  const edge = game.edges[edgeId];
  if (!edge || game.roads[edgeId] != null) return false;
  if (game.expansion === 'seafarers' && isSeaEdge(game, edgeId)) return false; // roads are land-only
  if (setupVertex != null) return edge.a === setupVertex || edge.b === setupVertex;
  return [edge.a, edge.b].some(vertex => {
    const building = game.buildings[vertex];
    if (building && building.player !== player) return false;
    return building?.player === player || game.edges.some(item => (item.a === vertex || item.b === vertex) && game.roads[item.id] === player);
  });
}
function canPay(game, player, type) { return Object.entries(COSTS[type]).every(([resource, amount]) => game.hands[player][resource] >= amount); }
function pay(game, player, type) { Object.entries(COSTS[type]).forEach(([resource, amount]) => { game.hands[player][resource] -= amount; game.bank[resource] += amount; }); }
function pieceCount(game, player, type) {
  if (type === 'road') return Object.values(game.roads).filter(owner => owner === player).length;
  if (type === 'ship') return Object.values(game.ships).filter(owner => owner === player).length;
  return Object.values(game.buildings).filter(piece => piece.player === player && piece.type === type).length;
}
// NPC ship valuation: reaching a settle spot or sailing toward an undiscovered island
function islandCentroids(game) {
  const groups = {};
  game.tiles.forEach(tile => { if (tile.island != null && tile.island !== 0 && game.islandSettlers[tile.island] == null) (groups[tile.island] = groups[tile.island] || []).push(tile); });
  return Object.values(groups).map(list => ({ x: list.reduce((s, t) => s + t.x, 0) / list.length, y: list.reduce((s, t) => s + t.y, 0) / list.length }));
}
function shipValue(game, edgeId, player) {
  const edge = game.edges[edgeId];
  const centroids = islandCentroids(game);
  let best = 0;
  [edge.a, edge.b].forEach(v => {
    const vertex = game.vertices[v];
    if (!game.buildings[v] && isLandVertex(game, v) && validSettlement(game, v, player, true)) {
      let value = 2;
      vertex.tiles.forEach(t => { const island = game.tiles[t]?.island; if (island != null && island !== 0 && game.islandSettlers[island] == null) value += 6; });
      best = Math.max(best, value);
    }
    if (centroids.length) best = Math.max(best, 4 - Math.min(...centroids.map(c => Math.hypot(c.x - vertex.x, c.y - vertex.y))) / 90);
  });
  return best;
}

function finishSetupPair(room) {
  const game = room.game;
  game.setupIndex++;
  game.setupVertex = null;
  if (game.setupIndex >= game.setupOrder.length) {
    game.stage = 'roll'; game.turn = 0; game.round = 1; game.rolled = false;
  } else {
    game.turn = game.setupOrder[game.setupIndex]; game.stage = 'setup-settlement';
  }
}

function handTotal(hand) { return Object.values(hand).reduce((a, b) => a + b, 0); }
function randomResourceFrom(hand) { const available = RESOURCES.filter(resource => hand[resource] > 0); return available.length ? available[crypto.randomInt(available.length)] : null; }
function robberVictims(game, tile, roller) {
  const set = new Set();
  game.tiles[tile].vertices.forEach(vertex => { const building = game.buildings[vertex]; if (building && building.player !== roller && handTotal(game.hands[building.player]) > 0) set.add(building.player); });
  return [...set];
}
function stealCard(game, robber, victim) { const resource = randomResourceFrom(game.hands[victim]); if (resource) { game.hands[victim][resource]--; game.hands[robber][resource]++; } }
// 7が出たとき: NPCは即時に半分捨て、人間は捨てる枚数を選ぶ。全員済んだら手番者が盗賊を動かす段階へ。
function startSeven(room) {
  const game = room.game;
  room.players.forEach((p, i) => { const hand = game.hands[i]; const total = handTotal(hand); if (p.isBot && total > 7) for (let k = 0; k < Math.floor(total / 2); k++) { const r = randomResourceFrom(hand); if (r) { hand[r]--; game.bank[r]++; } } });
  game.discard = {};
  room.players.forEach((p, i) => { const total = handTotal(game.hands[i]); if (!p.isBot && total > 7) game.discard[i] = Math.floor(total / 2); });
  if (Object.keys(game.discard).length) { game.stage = 'discard'; } else { game.discard = null; game.stage = 'robber'; }
}

// Seafarers: pick the resource an NPC most needs toward its next build
function npcNeededResource(game, player) {
  const hand = game.hands[player];
  let bestRes = RESOURCES[0], bestScore = -Infinity;
  RESOURCES.forEach(resource => {
    if (game.bank[resource] < 1) return;
    let score = 0;
    Object.values(COSTS).forEach(cost => { if (cost[resource]) score += Math.max(0, cost[resource] - hand[resource]); });
    score -= hand[resource] * 0.1;
    if (score > bestScore) { bestScore = score; bestRes = resource; }
  });
  return bestRes;
}
function distribute(room, sum) {
  const game = room.game;
  const claims = [];
  const goldGains = {}; // player -> count of gold picks owed
  Object.entries(game.buildings).forEach(([vertex, building]) => game.vertices[vertex].tiles.forEach(tileId => {
    const tile = game.tiles[tileId];
    if (tile.id === game.robberTile || tile.number !== sum) return;
    const amount = building.type === 'city' ? 2 : 1;
    if (tile.type === 'gold') { goldGains[building.player] = (goldGains[building.player] || 0) + amount; return; }
    const resource = TYPE_RESOURCE[tile.type];
    if (resource) claims.push({ player: building.player, resource, amount });
  }));
  RESOURCES.forEach(resource => {
    const selected = claims.filter(claim => claim.resource === resource);
    const total = selected.reduce((sum, claim) => sum + claim.amount, 0);
    if (game.bank[resource] < total) return;
    selected.forEach(claim => game.hands[claim.player][resource] += claim.amount);
    game.bank[resource] -= total;
  });
  // Gold fields: NPCs auto-pick their most-needed resource; humans choose via the pickGold action
  Object.entries(goldGains).forEach(([p, count]) => {
    const playerId = Number(p);
    if (room.players[playerId]?.isBot) {
      for (let i = 0; i < count; i++) { const resource = npcNeededResource(game, playerId); if (game.bank[resource] > 0) { game.hands[playerId][resource]++; game.bank[resource]--; } }
    } else {
      game.goldPick[playerId] = (game.goldPick[playerId] || 0) + count;
    }
  });
}

function act(room, player, type, payload = {}) {
  if (room.phase !== 'game') throw new Error('ゲームが始まっていません');
  const game = room.game;
  if (game.winner != null) throw new Error('ゲームは終了しています');
  if (type === 'placeSettlement') {
    if (game.turn !== player || !['setup-settlement','build'].includes(game.stage)) throw new Error('今は開拓地を置けません');
    const setup = game.stage === 'setup-settlement';
    if (!validSettlement(game, payload.vertex, player, setup)) throw new Error('その場所には建設できません');
    if (!setup) { if (pieceCount(game, player, 'settlement') >= 5 || !canPay(game, player, 'settlement')) throw new Error('資源または駒が足りません'); pay(game, player, 'settlement'); }
    game.buildings[payload.vertex] = { player, type: 'settlement' }; game.vp[player]++;
    updateLongestRoad(game);
    if (setup) {
      if (game.setupIndex >= room.players.length) game.vertices[payload.vertex].tiles.forEach(tileId => { const resource = TYPE_RESOURCE[game.tiles[tileId].type]; if (resource && game.bank[resource]) { game.hands[player][resource]++; game.bank[resource]--; } });
      game.setupVertex = payload.vertex; game.stage = 'setup-road';
    }
  } else if (type === 'placeRoad') {
    if (game.turn !== player || !['setup-road','build'].includes(game.stage)) throw new Error('今は街道を置けません');
    const setup = game.stage === 'setup-road';
    if (!validRoad(game, payload.edge, player, setup ? game.setupVertex : null)) throw new Error('その場所には建設できません');
    if (!setup) {
      if (pieceCount(game, player, 'road') >= 15) throw new Error('街道の駒が足りません');
      if (game.freeRoads > 0) game.freeRoads--;
      else { if (!canPay(game, player, 'road')) throw new Error('資源が足りません'); pay(game, player, 'road'); }
    }
    game.roads[payload.edge] = player;
    updateLongestRoad(game);
    if (setup) finishSetupPair(room);
  } else if (type === 'roll') {
    if (game.turn !== player || game.stage !== 'roll' || game.rolled) throw new Error('今はダイスを振れません');
    const a = crypto.randomInt(1, 7), b = crypto.randomInt(1, 7); game.dice = [a, b]; game.rolled = true;
    if (a + b === 7) startSeven(room); else { distribute(room, a + b); game.stage = 'build'; }
  } else if (type === 'discard') {
    if (game.stage !== 'discard' || !game.discard || game.discard[player] == null) throw new Error('今は手札を捨てる必要はありません');
    const required = game.discard[player], hand = game.hands[player], sel = payload.resources || {};
    let total = 0; for (const r of RESOURCES) { const n = Math.max(0, Number(sel[r]) || 0); if (n > hand[r]) throw new Error('その枚数は持っていません'); total += n; }
    if (total !== required) throw new Error(`合計${required}枚を選んでください`);
    for (const r of RESOURCES) { const n = Math.max(0, Number(sel[r]) || 0); hand[r] -= n; game.bank[r] += n; }
    delete game.discard[player];
    if (Object.keys(game.discard).length === 0) { game.discard = null; game.stage = 'robber'; }
  } else if (type === 'moveRobber') {
    if (game.turn !== player || game.stage !== 'robber') throw new Error('今は盗賊を動かせません');
    const tile = Number(payload.tile);
    if (!game.tiles[tile] || tile === game.robberTile) throw new Error('別の土地を選んでください');
    game.robberTile = tile;
    const victims = robberVictims(game, tile, player);
    if (victims.length <= 1) { if (victims.length === 1) stealCard(game, player, victims[0]); game.stealOptions = null; game.stage = 'build'; }
    else { game.stealOptions = victims; game.stage = 'steal'; }
  } else if (type === 'steal') {
    if (game.turn !== player || game.stage !== 'steal' || !game.stealOptions) throw new Error('今は相手を選べません');
    const victim = Number(payload.victim);
    if (!game.stealOptions.includes(victim)) throw new Error('その相手は選べません');
    stealCard(game, player, victim); game.stealOptions = null; game.stage = 'build';
  } else if (type === 'buildCity') {
    const building = game.buildings[payload.vertex];
    if (game.turn !== player || game.stage !== 'build' || !building || building.player !== player || building.type !== 'settlement') throw new Error('都市にできません');
    if (pieceCount(game, player, 'city') >= 4 || !canPay(game, player, 'city')) throw new Error('資源または駒が足りません');
    pay(game, player, 'city'); building.type = 'city'; game.vp[player]++;
  } else if (type === 'endTurn') {
    if (game.turn !== player || game.stage !== 'build') throw new Error('ターンを終了できません');
    game.dev[player] = game.dev[player].concat(game.newDev[player]); game.newDev[player] = []; // 今買ったカードは次ターンから使える
    game.devPlayed[player] = false; game.freeRoads = 0;
    game.turn = (game.turn + 1) % room.players.length; if (game.turn === 0) game.round++; game.stage = 'roll'; game.rolled = false; game.dice = null;
  } else if (type === 'bankTrade') {
    if (game.turn !== player || game.stage !== 'build') throw new Error('今は交換できません');
    const give = payload.give, get = payload.get;
    if (!RESOURCES.includes(give) || !RESOURCES.includes(get) || give === get) throw new Error('交換条件が不正です');
    const rate = maritimeRate(game, player, give);
    if (game.hands[player][give] < rate) throw new Error(`${give}が${rate}枚必要です`);
    if (game.bank[get] < 1) throw new Error('銀行に在庫がありません');
    game.hands[player][give] -= rate; game.bank[give] += rate; game.hands[player][get]++; game.bank[get]--;
  } else if (type === 'buyDev') {
    if (game.turn !== player || game.stage !== 'build') throw new Error('今は購入できません');
    if (!game.devDeck.length) throw new Error('発展カードの山札がありません');
    if (!canPay(game, player, 'development')) throw new Error('資源が足りません（🌾1 🐑1 ⛏1）');
    pay(game, player, 'development'); game.newDev[player].push(game.devDeck.pop());
  } else if (type === 'playDev') {
    if (game.turn !== player || game.stage !== 'build') throw new Error('今はカードを使えません');
    if (game.devPlayed[player]) throw new Error('発展カードは1ターンに1枚までです');
    const card = payload.card, idx = game.dev[player].indexOf(card);
    if (idx < 0 || card === 'victory') throw new Error('そのカードは使えません');
    // 状態を変える前に検証する（途中失敗で壊れないように）
    let plentyAmts, monoRes;
    if (card === 'plenty') {
      plentyAmts = {}; let total = 0;
      for (const r of RESOURCES) { const n = Math.max(0, Number((payload.resources || {})[r]) || 0); plentyAmts[r] = n; total += n; }
      if (total !== 2) throw new Error('合計2枚を選んでください');
      for (const r of RESOURCES) if (plentyAmts[r] > game.bank[r]) throw new Error('銀行の在庫が足りません');
    } else if (card === 'monopoly') { monoRes = payload.resource; if (!RESOURCES.includes(monoRes)) throw new Error('資源を選んでください'); }
    game.dev[player].splice(idx, 1); game.devPlayed[player] = true;
    if (card === 'knight') { game.playedKnights[player]++; updateArmy(game); game.stage = 'robber'; } // 既存の盗賊フローへ
    else if (card === 'roadBuilding') { game.freeRoads = 2; }
    else if (card === 'plenty') { for (const r of RESOURCES) { game.hands[player][r] += plentyAmts[r]; game.bank[r] -= plentyAmts[r]; } }
    else if (card === 'monopoly') { room.players.forEach((p, i) => { if (i === player) return; game.hands[player][monoRes] += game.hands[i][monoRes]; game.hands[i][monoRes] = 0; }); }
  } else if (type === 'offerTrade') {
    if (game.turn !== player || game.stage !== 'build') throw new Error('今は交換できません');
    const to = Number(payload.to), giveAmount = Number(payload.giveAmount), getAmount = Number(payload.getAmount);
    if (!room.players[to] || to === player || !RESOURCES.includes(payload.give) || !RESOURCES.includes(payload.get) || payload.give === payload.get || giveAmount < 1 || getAmount < 1 || game.hands[player][payload.give] < giveAmount) throw new Error('交換条件が不正です');
    room.offers = room.offers.filter(offer => offer.from !== player);
    room.offers.push({ id: token().slice(0, 8), from: player, to, give: payload.give, giveAmount, get: payload.get, getAmount });
  } else if (type === 'offerAll') {
    if (game.turn !== player || game.stage !== 'build') throw new Error('今は交換できません');
    const { give, get, giveAmount, getAmount } = payload;
    const gAmt = Number(giveAmount), rAmt = Number(getAmount);
    if (!RESOURCES.includes(give) || !RESOURCES.includes(get) || give === get || gAmt < 1 || rAmt < 1 || game.hands[player][give] < gAmt) throw new Error('交換条件が不正です');
    room.offers = room.offers.filter(offer => offer.from !== player);
    room.players.forEach((p, i) => {
      if (i === player || p.isBot) return;
      room.offers.push({ id: token().slice(0, 8), from: player, to: i, give, giveAmount: gAmt, get, getAmount: rAmt });
    });
  } else if (type === 'respondTrade') {
    const offer = room.offers.find(item => item.id === payload.offerId && item.to === player);
    if (!offer) throw new Error('交換提案がありません');
    if (payload.accept) {
      if (game.turn !== offer.from || game.hands[offer.from][offer.give] < offer.giveAmount || game.hands[player][offer.get] < offer.getAmount) throw new Error('交換に必要な資源がありません');
      game.hands[offer.from][offer.give] -= offer.giveAmount; game.hands[player][offer.give] += offer.giveAmount;
      game.hands[player][offer.get] -= offer.getAmount; game.hands[offer.from][offer.get] += offer.getAmount;
    }
    room.offers = room.offers.filter(item => item.id !== offer.id);
  } else throw new Error('不明な操作です');
  if (totalVP(game, player) >= 10) game.winner = player;
  touch(room);
}

function publicState(room, playerId) {
  const base = { code: room.code, phase: room.phase, host: room.host, you: playerId, version: room.version, boardMode: room.boardMode, difficulty: room.difficulty, botSpeed: room.botSpeed, players: room.players.map(player => ({ id: player.id, name: player.name, color: player.color, connected: player.connected, isBot: player.isBot })) };
  if (!room.game) return base;
  const game = room.game;
  return { ...base, game: { tiles: game.tiles, vertices: game.vertices, edges: game.edges, turn: game.turn, round: game.round, stage: game.stage, setupIndex: game.setupIndex, setupVertex: game.setupVertex, dice: game.dice, buildings: game.buildings, roads: game.roads, robberTile: game.robberTile, vp: room.players.map((_, i) => visibleVP(game, i)), winner: game.winner, cardCounts: game.hands.map(hand => Object.values(hand).reduce((a,b)=>a+b,0)), hand: game.hands[playerId], discardNeeded: game.discard?.[playerId] || 0, stealOptions: (game.stage === 'steal' && game.turn === playerId) ? game.stealOptions : null, harbors: game.harbors, harborEdges: game.harborEdges, rates: Object.fromEntries(RESOURCES.map(r => [r, maritimeRate(game, playerId, r)])), dev: game.dev[playerId], newDev: game.newDev[playerId], devCounts: room.players.map((_, i) => game.dev[i].length + game.newDev[i].length), playedKnights: game.playedKnights, largestArmyOwner: game.largestArmyOwner, longestRoadOwner: game.longestRoadOwner, freeRoads: game.turn === playerId ? game.freeRoads : 0, devDeckCount: game.devDeck.length, devPlayed: game.devPlayed[playerId], offers: room.offers.filter(offer => offer.from === playerId || offer.to === playerId) } };
}
function findIdentity(room, authToken) { return authToken ? room.players.find(player => player.token === authToken && !player.isBot) : null; }
function touch(room) { room.lastActive = Date.now(); room.version++; broadcast(room); scheduleRoomBot(room); scheduleIdleCheck(room); }
// 放置されたルームを定期削除（無料枠のメモリ圧迫を防ぐ）。接続クライアントがおらず30分更新なしなら破棄。
function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.clients.size === 0 && now - (room.lastActive || 0) > 30 * 60 * 1000) {
      clearTimeout(room.botTimer); clearTimeout(room.idleTimer); rooms.delete(code);
    }
  }
}
function broadcast(room) {
  room.clients.forEach(client => {
    try { client.response.write(`event: state\ndata: ${JSON.stringify(publicState(room, client.playerId))}\n\n`); } catch { room.clients.delete(client); }
  });
  persist();
}

// ----- Room persistence (survives server restarts; on hosts with a persistent disk also survives sleep) -----
const ROOMS_FILE = process.env.ROOMS_FILE || path.join(ROOT, '.rooms.json');
const PERSIST_ENABLED = require.main === module; // off during unit tests
function serializeRooms() { return JSON.stringify([...rooms.values()].map(room => ({ ...room, clients: undefined, botTimer: undefined }))); }
let persistTimer = null;
function persist() {
  if (!PERSIST_ENABLED) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { fs.writeFile(ROOMS_FILE, serializeRooms(), error => { if (error) console.error('Room save failed:', error.message); }); }, 400);
}
function flushRooms() { if (!PERSIST_ENABLED) return; try { fs.writeFileSync(ROOMS_FILE, serializeRooms()); } catch (error) { console.error('Room flush failed:', error.message); } }
function loadRooms() {
  try {
    if (!fs.existsSync(ROOMS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'));
    for (const room of data) { room.clients = new Set(); delete room.botTimer; rooms.set(room.code, room); }
    if (rooms.size) console.log(`Restored ${rooms.size} room(s) from ${ROOMS_FILE}`);
  } catch (error) { console.error('Room restore failed:', error.message); }
}

function json(response, status, data) { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); response.end(JSON.stringify(data)); }
function readBody(request) { return new Promise((resolve, reject) => { let body = ''; request.on('data', chunk => { body += chunk; if (body.length > 1e6) reject(new Error('too large')); }); request.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('JSONが不正です')); } }); }); }
function mime(file) { return file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream'; }

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname === '/api/health') return json(response, 200, { ok: true });
    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const body = await readBody(request); const result = createRoom(body.name, body.boardMode, null, body.difficulty); return json(response, 201, result.identity);
    }
    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/(join|start|action|state|events|addbot|settings))?$/);
    if (match) {
      const room = rooms.get(match[1]); if (!room) return json(response, 404, { error: 'ルームが見つかりません' });
      const operation = match[2] || 'state';
      if (operation === 'join' && request.method === 'POST') {
        const body = await readBody(request);
        if (body.rejoinToken) {
          const player = findIdentity(room, body.rejoinToken); if (!player) throw new Error('再参加情報が無効です'); player.connected = true; touch(room); return json(response, 200, { playerId: player.id, token: player.token, roomCode: room.code });
        }
        return json(response, 201, addPlayer(room, body.name));
      }
      const authToken = request.headers.authorization?.replace(/^Bearer /, '') || url.searchParams.get('token');
      const player = findIdentity(room, authToken); if (!player) return json(response, 401, { error: '参加トークンが無効です' });
      if (operation === 'state' && request.method === 'GET') return json(response, 200, publicState(room, player.id));
      if (operation === 'events' && request.method === 'GET') {
        // X-Accel-Buffering:no で Render などのプロキシのバッファリングを無効化
        response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
        response.write('retry: 3000\n\n'); // 切断時のブラウザ自動再接続を3秒に
        response.write(`event: state\ndata: ${JSON.stringify(publicState(room, player.id))}\n\n`);
        const client = { response, playerId: player.id }; room.clients.add(client);
        // プロキシのアイドル切断を防ぐため定期的にコメント行を送る（無通信でも接続維持）
        const keepAlive = setInterval(() => { try { response.write(`: ping ${Date.now()}\n\n`); } catch { clearInterval(keepAlive); room.clients.delete(client); } }, 20000);
        if (keepAlive.unref) keepAlive.unref();
        request.on('close', () => { clearInterval(keepAlive); room.clients.delete(client); });
        return;
      }
      if (operation === 'settings' && request.method === 'POST') {
        if (room.host !== player.id) throw new Error('ホストだけが設定できます');
        const body = await readBody(request);
        if (['fast','normal','slow'].includes(body.botSpeed)) room.botSpeed = body.botSpeed;
        touch(room); return json(response, 200, { ok: true });
      }
      if (operation === 'addbot' && request.method === 'POST') {
        if (room.host !== player.id) throw new Error('ホストだけがNPCを追加できます');
        if (room.phase !== 'lobby') throw new Error('ゲームはすでに開始しています');
        if (room.players.length >= 4) throw new Error('このルームは満員です');
        const botNum = room.players.filter(p => p.isBot).length + 1;
        const bot = { id: room.players.length, name: `NPC ${botNum}`, color: COLORS[room.players.length], token: token(), connected: true, isBot: true };
        room.players.push(bot); touch(room); return json(response, 200, { ok: true });
      }
      if (operation === 'start' && request.method === 'POST') { const body = await readBody(request); startRoom(room, player.id, Boolean(body.fillBots), body.difficulty); return json(response, 200, { ok: true }); }
      if (operation === 'action' && request.method === 'POST') { const body = await readBody(request); act(room, player.id, body.type, body.payload); return json(response, 200, { ok: true }); }
    }
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.normalize(path.join(ROOT, requested));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return json(response, 404, { error: 'Not found' });
    response.writeHead(200, { 'content-type': `${mime(file)}; charset=utf-8`, 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(response);
  } catch (error) { json(response, 400, { error: error.message || '処理に失敗しました' }); }
});

if (require.main === module) {
  loadRooms();
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { flushRooms(); process.exit(0); });
  setInterval(cleanupRooms, 5 * 60 * 1000).unref?.(); // 5分ごとに放置ルームを掃除
  server.listen(PORT, '0.0.0.0', () => console.log(`ISLANDS & ROADS Online: http://localhost:${PORT}`));
}

module.exports = { server, rooms, createRoom, addPlayer, startRoom, act, publicState, validSettlement, validRoad };
