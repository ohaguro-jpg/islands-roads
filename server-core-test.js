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
  act(room, 0, 'endTurn');
  await wait(5000);
  if (room.game.turn !== 0 || room.game.stage !== 'roll') throw new Error(`NPC turn cycle stalled: ${room.game.turn}/${room.game.stage}`);
  console.log('server core NPC test: PASS');
  console.log(JSON.stringify({ players: room.players.length, buildings: Object.keys(room.game.buildings).length, roads: Object.keys(room.game.roads).length, round: room.game.round, turn: room.game.turn }));
})().catch(error => { console.error(error); process.exit(1); });
