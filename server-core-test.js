const { createRoom, startRoom, act, publicState } = require('./server');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function validVertex(game) {
  return game.vertices.find(vertex => {
    if (game.buildings[vertex.id]) return false;
    const adjacent = game.edges.filter(edge => edge.a === vertex.id || edge.b === vertex.id).map(edge => edge.a === vertex.id ? edge.b : edge.a);
    return !adjacent.some(id => game.buildings[id]);
  }).id;
}
function humanPair(room) {
  let state = publicState(room, 0);
  const vertex = validVertex(state.game);
  act(room, 0, 'placeSettlement', { vertex });
  state = publicState(room, 0);
  const edge = state.game.edges.find(item => (item.a === vertex || item.b === vertex) && state.game.roads[item.id] == null).id;
  act(room, 0, 'placeRoad', { edge });
}

(async () => {
  const { room } = createRoom('Solo', 'default');
  startRoom(room, 0, true);
  if (room.players.length !== 4 || !room.players.slice(1).every(player => player.isBot)) throw new Error('NPC fill failed');
  humanPair(room);
  await wait(3300);
  if (room.game.turn !== 0 || room.game.stage !== 'setup-settlement') throw new Error(`first NPC setup stalled: ${room.game.turn}/${room.game.stage}`);
  humanPair(room);
  await wait(3300);
  if (room.game.turn !== 0 || room.game.stage !== 'roll') throw new Error(`second NPC setup stalled: ${room.game.turn}/${room.game.stage}`);
  act(room, 0, 'roll');
  // 自分のターンで7が出たら盗賊処理を済ませてから終了（手札が少なければ捨て段階は来ない）
  if (room.game.stage === 'robber') act(room, 0, 'moveRobber', { tile: room.game.tiles.find(t => t.id !== room.game.robberTile).id });
  if (room.game.stage === 'steal') act(room, 0, 'steal', { victim: room.game.stealOptions[0] });
  act(room, 0, 'endTurn');
  // NPC3人のターン（7が出ると盗賊処理ぶん時間がかかる）を十分待つ
  await wait(11000);
  if (room.game.turn !== 0 || room.game.stage !== 'roll') throw new Error(`NPC turn cycle stalled: ${room.game.turn}/${room.game.stage}`);
  console.log('server core NPC test: PASS');
  console.log(JSON.stringify({ players: room.players.length, buildings: Object.keys(room.game.buildings).length, roads: Object.keys(room.game.roads).length, round: room.game.round, turn: room.game.turn }));
})().catch(error => { console.error(error); process.exit(1); });
