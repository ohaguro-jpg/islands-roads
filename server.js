const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 4180);
const ROOT = __dirname;
const rooms = new Map();
const COLORS = ['#c95642', '#3d7181', '#d9a838', '#577b59'];
const RESOURCES = ['wood', 'brick', 'wheat', 'sheep', 'ore'];
const COSTS = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1 }, city: { wheat: 2, ore: 3 } };
const TYPES = ['forest','forest','forest','forest','hills','hills','hills','pasture','pasture','pasture','pasture','fields','fields','fields','fields','mountains','mountains','mountains','desert'];
const TYPE_RESOURCE = { forest: 'wood', hills: 'brick', pasture: 'sheep', fields: 'wheat', mountains: 'ore', desert: null };
const NUMBERS = [5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11];

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
  return { tiles, vertices, edges };
}

function createRoom(name, boardMode) {
  const code = roomCode();
  const room = { code, host: 0, phase: 'lobby', boardMode: boardMode === 'random' ? 'random' : 'default', players: [], version: 1, clients: new Set(), game: null, offers: [] };
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

function startRoom(room, playerId, fillBots = false) {
  if (room.host !== playerId) throw new Error('ホストだけが開始できます');
  if (fillBots) while (room.players.length < 4) room.players.push({ id: room.players.length, name: `NPC ${room.players.length}`, color: COLORS[room.players.length], token: token(), connected: true, isBot: true });
  if (room.players.length < 2) throw new Error('2人以上必要です。1人の場合はNPCを追加して開始してください');
  const geometry = buildGeometry(room.boardMode === 'random');
  const order = [...room.players.map(player => player.id), ...room.players.map(player => player.id).reverse()];
  room.phase = 'game';
  room.game = {
    ...geometry, turn: order[0], round: 0, stage: 'setup-settlement', setupOrder: order, setupIndex: 0, setupVertex: null,
    rolled: false, dice: null, buildings: {}, roads: {}, robberTile: geometry.tiles.find(tile => tile.type === 'desert').id,
    bank: Object.fromEntries(RESOURCES.map(resource => [resource, 19])),
    hands: room.players.map(() => emptyResources()), vp: room.players.map(() => 0), winner: null
  };
  touch(room);
}

function scheduleRoomBot(room) {
  clearTimeout(room.botTimer);
  const game = room.game;
  if (room.phase !== 'game' || !game || game.winner != null || !room.players[game.turn]?.isBot) return;
  const player = game.turn;
  const delay = game.stage.startsWith('setup') ? 240 : 550;
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
      } else if (game.stage === 'build') {
        game.botActions = (game.botActions || 0) + 1;
        const city = Object.entries(game.buildings).find(([, piece]) => piece.player === player && piece.type === 'settlement');
        if (game.botActions <= 3 && city && canPay(game, player, 'city') && pieceCount(game, player, 'city') < 4) act(room, player, 'buildCity', { vertex: Number(city[0]) });
        else {
          const settlement = game.vertices.find(item => validSettlement(game, item.id, player, false));
          if (game.botActions <= 3 && settlement && canPay(game, player, 'settlement') && pieceCount(game, player, 'settlement') < 5) act(room, player, 'placeSettlement', { vertex: settlement.id });
          else {
            const road = game.edges.find(item => validRoad(game, item.id, player));
            if (game.botActions <= 3 && road && canPay(game, player, 'road') && pieceCount(game, player, 'road') < 15) act(room, player, 'placeRoad', { edge: road.id });
            else act(room, player, 'endTurn');
          }
        }
      }
    } catch (error) {
      console.error('Online NPC error:', error.message);
      if (game.stage === 'build') try { act(room, player, 'endTurn'); } catch {}
    }
  }, delay);
}

function adjacentVertices(game, vertex) { return game.edges.filter(edge => edge.a === vertex || edge.b === vertex).map(edge => edge.a === vertex ? edge.b : edge.a); }
function validSettlement(game, vertex, player, setup = false) {
  if (!game.vertices[vertex] || game.buildings[vertex]) return false;
  if (adjacentVertices(game, vertex).some(id => game.buildings[id])) return false;
  return setup || game.edges.some(edge => (edge.a === vertex || edge.b === vertex) && game.roads[edge.id] === player);
}
function validRoad(game, edgeId, player, setupVertex = null) {
  const edge = game.edges[edgeId];
  if (!edge || game.roads[edgeId] != null) return false;
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
  return Object.values(game.buildings).filter(piece => piece.player === player && piece.type === type).length;
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

function distribute(game, sum) {
  if (sum === 7) {
    game.hands.forEach(hand => {
      const total = Object.values(hand).reduce((a, b) => a + b, 0);
      for (let i = 0; i < Math.floor(total > 7 ? total / 2 : 0); i++) {
        const available = RESOURCES.filter(resource => hand[resource] > 0);
        const resource = available[crypto.randomInt(available.length)];
        hand[resource]--; game.bank[resource]++;
      }
    });
    const options = game.tiles.filter(tile => tile.id !== game.robberTile);
    game.robberTile = options[crypto.randomInt(options.length)].id;
    return;
  }
  const claims = [];
  Object.entries(game.buildings).forEach(([vertex, building]) => game.vertices[vertex].tiles.forEach(tileId => {
    const tile = game.tiles[tileId];
    const resource = TYPE_RESOURCE[tile.type];
    if (tile.id !== game.robberTile && tile.number === sum && resource) claims.push({ player: building.player, resource, amount: building.type === 'city' ? 2 : 1 });
  }));
  RESOURCES.forEach(resource => {
    const selected = claims.filter(claim => claim.resource === resource);
    const total = selected.reduce((sum, claim) => sum + claim.amount, 0);
    if (game.bank[resource] < total) return;
    selected.forEach(claim => game.hands[claim.player][resource] += claim.amount);
    game.bank[resource] -= total;
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
    if (setup) {
      if (game.setupIndex >= room.players.length) game.vertices[payload.vertex].tiles.forEach(tileId => { const resource = TYPE_RESOURCE[game.tiles[tileId].type]; if (resource && game.bank[resource]) { game.hands[player][resource]++; game.bank[resource]--; } });
      game.setupVertex = payload.vertex; game.stage = 'setup-road';
    }
  } else if (type === 'placeRoad') {
    if (game.turn !== player || !['setup-road','build'].includes(game.stage)) throw new Error('今は街道を置けません');
    const setup = game.stage === 'setup-road';
    if (!validRoad(game, payload.edge, player, setup ? game.setupVertex : null)) throw new Error('その場所には建設できません');
    if (!setup) { if (pieceCount(game, player, 'road') >= 15 || !canPay(game, player, 'road')) throw new Error('資源または駒が足りません'); pay(game, player, 'road'); }
    game.roads[payload.edge] = player;
    if (setup) finishSetupPair(room);
  } else if (type === 'roll') {
    if (game.turn !== player || game.stage !== 'roll' || game.rolled) throw new Error('今はダイスを振れません');
    const a = crypto.randomInt(1, 7), b = crypto.randomInt(1, 7); game.dice = [a, b]; game.rolled = true; distribute(game, a + b); game.stage = 'build';
  } else if (type === 'buildCity') {
    const building = game.buildings[payload.vertex];
    if (game.turn !== player || game.stage !== 'build' || !building || building.player !== player || building.type !== 'settlement') throw new Error('都市にできません');
    if (pieceCount(game, player, 'city') >= 4 || !canPay(game, player, 'city')) throw new Error('資源または駒が足りません');
    pay(game, player, 'city'); building.type = 'city'; game.vp[player]++;
  } else if (type === 'endTurn') {
    if (game.turn !== player || game.stage !== 'build') throw new Error('ターンを終了できません');
    game.turn = (game.turn + 1) % room.players.length; if (game.turn === 0) game.round++; game.stage = 'roll'; game.rolled = false; game.dice = null;
  } else if (type === 'offerTrade') {
    if (game.turn !== player || game.stage !== 'build') throw new Error('今は交換できません');
    const to = Number(payload.to), giveAmount = Number(payload.giveAmount), getAmount = Number(payload.getAmount);
    if (!room.players[to] || to === player || !RESOURCES.includes(payload.give) || !RESOURCES.includes(payload.get) || payload.give === payload.get || giveAmount < 1 || getAmount < 1 || game.hands[player][payload.give] < giveAmount) throw new Error('交換条件が不正です');
    room.offers = room.offers.filter(offer => offer.from !== player);
    room.offers.push({ id: token().slice(0, 8), from: player, to, give: payload.give, giveAmount, get: payload.get, getAmount });
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
  if (game.vp[player] >= 10) game.winner = player;
  touch(room);
}

function publicState(room, playerId) {
  const base = { code: room.code, phase: room.phase, host: room.host, you: playerId, version: room.version, boardMode: room.boardMode, players: room.players.map(player => ({ id: player.id, name: player.name, color: player.color, connected: player.connected, isBot: player.isBot })) };
  if (!room.game) return base;
  const game = room.game;
  return { ...base, game: { tiles: game.tiles, vertices: game.vertices, edges: game.edges, turn: game.turn, round: game.round, stage: game.stage, setupIndex: game.setupIndex, setupVertex: game.setupVertex, dice: game.dice, buildings: game.buildings, roads: game.roads, robberTile: game.robberTile, vp: game.vp, winner: game.winner, cardCounts: game.hands.map(hand => Object.values(hand).reduce((a,b)=>a+b,0)), hand: game.hands[playerId], offers: room.offers.filter(offer => offer.from === playerId || offer.to === playerId) } };
}
function findIdentity(room, authToken) { return authToken ? room.players.find(player => player.token === authToken && !player.isBot) : null; }
function touch(room) { room.version++; broadcast(room); scheduleRoomBot(room); }
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
    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const body = await readBody(request); const result = createRoom(body.name, body.boardMode); return json(response, 201, result.identity);
    }
    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/(join|start|action|state|events))?$/);
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
        response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        response.write(`event: state\ndata: ${JSON.stringify(publicState(room, player.id))}\n\n`);
        const client = { response, playerId: player.id }; room.clients.add(client); request.on('close', () => room.clients.delete(client)); return;
      }
      if (operation === 'start' && request.method === 'POST') { const body = await readBody(request); startRoom(room, player.id, Boolean(body.fillBots)); return json(response, 200, { ok: true }); }
      if (operation === 'action' && request.method === 'POST') { const body = await readBody(request); act(room, player.id, body.type, body.payload); return json(response, 200, { ok: true }); }
    }
    const requested = url.pathname === '/' ? '/online.html' : url.pathname;
    const file = path.normalize(path.join(ROOT, requested));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return json(response, 404, { error: 'Not found' });
    response.writeHead(200, { 'content-type': `${mime(file)}; charset=utf-8`, 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(response);
  } catch (error) { json(response, 400, { error: error.message || '処理に失敗しました' }); }
});

if (require.main === module) {
  loadRooms();
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { flushRooms(); process.exit(0); });
  server.listen(PORT, '0.0.0.0', () => console.log(`ISLANDS & ROADS Online: http://localhost:${PORT}`));
}

module.exports = { server, rooms, createRoom, addPlayer, startRoom, act, publicState, validSettlement, validRoad };
