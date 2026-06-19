const { spawn } = require('node:child_process');
const fs = require('node:fs');

const port = 4199;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function api(path, method = 'GET', body, token) {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(5000) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
  return data;
}

function validVertex(game) {
  return game.vertices.find(vertex => {
    if (game.buildings[vertex.id]) return false;
    const adjacent = game.edges.filter(edge => edge.a === vertex.id || edge.b === vertex.id).map(edge => edge.a === vertex.id ? edge.b : edge.a);
    return !adjacent.some(id => game.buildings[id]);
  }).id;
}

(async () => {
  try {
    const uiSource = fs.readFileSync('online.js', 'utf8');
    const uiMarkup = fs.readFileSync('online.html', 'utf8');
    if (!uiSource.includes("class:'road-outline'") || !uiSource.includes('style:`stroke:${state.players[owner].color}')) throw new Error('road color rendering regression');
    if (!uiSource.includes('style:`fill:${color}`')) throw new Error('building color rendering regression');
    if (!uiMarkup.includes('id="diceOverlay"') || !uiSource.includes('showDiceOverlay')) throw new Error('full-screen dice overlay missing');
    await wait(250);
    const host = await api('/api/rooms', 'POST', { name: 'Host', boardMode: 'default' });
    const guest = await api(`/api/rooms/${host.roomCode}/join`, 'POST', { name: 'Guest' });
    await api(`/api/rooms/${host.roomCode}/start`, 'POST', {}, host.token);
    let hostState = await api(`/api/rooms/${host.roomCode}/state`, 'GET', null, host.token);
    const guestState = await api(`/api/rooms/${host.roomCode}/state`, 'GET', null, guest.token);
    if ('hands' in hostState.game || 'hands' in guestState.game) throw new Error('private hands leaked');
    let rejected = false;
    try { await api(`/api/rooms/${host.roomCode}/action`, 'POST', { type: 'roll' }, guest.token); } catch (error) { rejected = error.status === 400; }
    if (!rejected) throw new Error('out-of-turn action was accepted');
    for (let pair = 0; pair < 4; pair++) {
      const activeToken = (await api(`/api/rooms/${host.roomCode}/state`, 'GET', null, host.token)).game.turn === 0 ? host.token : guest.token;
      const current = await api(`/api/rooms/${host.roomCode}/state`, 'GET', null, activeToken);
      const vertex = validVertex(current.game);
      await api(`/api/rooms/${host.roomCode}/action`, 'POST', { type: 'placeSettlement', payload: { vertex } }, activeToken);
      const afterSettlement = await api(`/api/rooms/${host.roomCode}/state`, 'GET', null, activeToken);
      const edge = afterSettlement.game.edges.find(item => (item.a === vertex || item.b === vertex) && afterSettlement.game.roads[item.id] == null).id;
      await api(`/api/rooms/${host.roomCode}/action`, 'POST', { type: 'placeRoad', payload: { edge } }, activeToken);
    }
    hostState = await api(`/api/rooms/${host.roomCode}/state`, 'GET', null, host.token);
    if (hostState.game.stage !== 'roll' || hostState.game.turn !== 0) throw new Error('setup did not complete');
    await api(`/api/rooms/${host.roomCode}/action`, 'POST', { type: 'roll' }, host.token);
    let rolled = await api(`/api/rooms/${host.roomCode}/state`, 'GET', null, guest.token);
    // 7が出た場合は盗賊を動かして手番を進める（手札が少なく捨て段階は来ない想定）
    if (rolled.game.stage === 'robber') {
      const tile = rolled.game.tiles.find(t => t.id !== rolled.game.robberTile).id;
      await api(`/api/rooms/${host.roomCode}/action`, 'POST', { type: 'moveRobber', payload: { tile } }, host.token);
      rolled = await api(`/api/rooms/${host.roomCode}/state`, 'GET', null, guest.token);
    }
    if (!rolled.game.dice || rolled.game.stage !== 'build') throw new Error('dice state did not sync');
    const rejoined = await api(`/api/rooms/${host.roomCode}/join`, 'POST', { rejoinToken: guest.token });
    if (rejoined.playerId !== guest.playerId) throw new Error('rejoin failed');
    console.log('online smoke test: PASS');
    console.log(JSON.stringify({ room: host.roomCode, privateHands: true, invalidTurnRejected: true, setupSynced: true, pieceColors: true, diceOverlay: true, diceSynced: true, rejoin: true }));
  } finally { child.kill('SIGTERM'); }
})().catch(error => { console.error(error); child.kill('SIGTERM'); process.exit(1); });
