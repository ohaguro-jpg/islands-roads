// オンライン対戦のフル自動シミュレーション
// 実サーバーの bot AI とゲームルールで最後まで対戦させ、クラッシュ・ルール違反を検証する。
// setTimeout を高速化して全bot対戦を一気に進める。

// --- 高速タイマー: bot の setTimeout を即時化（persist は require.main!==module で無効） ---
const realSetTimeout = global.setTimeout;
global.setTimeout = (fn, delay, ...args) => realSetTimeout(fn, delay > 30 ? 1 : delay, ...args);

const srv = require('./server.js');
const { rooms, createRoom, addPlayer, startRoom, act, publicState } = srv;

function checkInvariants(room, label, problems) {
  const g = room.game;
  if (!g) { problems.push(`${label}: game missing`); return; }
  const n = room.players.length;
  // VP は 0 以上、勝者は targetScore 以上
  room.players.forEach((p, i) => {
    const counts = { settlement: 0, city: 0 };
    Object.values(g.buildings).forEach(b => { if (b.player === i) counts[b.type]++; });
    if (counts.settlement > 5) problems.push(`${label}: player ${i} settlements ${counts.settlement} > 5`);
    if (counts.city > 4) problems.push(`${label}: player ${i} cities ${counts.city} > 4`);
    const roads = Object.values(g.roads).filter(o => o === i).length;
    if (roads > 15) problems.push(`${label}: player ${i} roads ${roads} > 15`);
    // 手札はマイナスにならない
    Object.entries(g.hands[i]).forEach(([r, v]) => { if (v < 0) problems.push(`${label}: player ${i} ${r}=${v} negative`); });
  });
  // 銀行はマイナスにならない
  Object.entries(g.bank).forEach(([r, v]) => { if (v < 0) problems.push(`${label}: bank ${r}=${v} negative`); });
  // publicState がエラーなく作れる（各プレイヤー視点）
  room.players.forEach((_, i) => { try { publicState(room, i); } catch (e) { problems.push(`${label}: publicState(${i}) threw ${e.message}`); } });
}

function runOneGame(difficulty, boardMode, idx) {
  const problems = [];
  let result = {};
  // 例外を捕まえる
  const origError = console.error;
  const errLog = [];
  console.error = (...a) => { errLog.push(a.join(' ')); };
  try {
    const { room, identity } = createRoom(`Host${idx}`, boardMode, null, difficulty);
    // 4人になるまでbot追加
    while (room.players.length < 4) room.players.push({ id: room.players.length, name: `NPC${room.players.length}`, color: ['#c0392b','#2980b9','#c9a227','#27ae60'][room.players.length], token: 't' + room.players.length, connected: true, isBot: true });
    // 全員を bot 化（host も自動で動かす）
    room.players.forEach(p => { p.isBot = true; });
    startRoom(room, identity.playerId, false, difficulty);
    // bot をキックして対戦開始
    srv.rooms.get(room.code); // ensure registered
    require('./server.js'); // noop
    // touch を呼んで scheduler 起動
    act.__nudge;
    // 直接 scheduler を起動するため、ダミーの act を 1 回試す代わりに、内部の touch 経由で進む。
    // startRoom は touch を呼んでいるので既に最初の bot がスケジュール済み。
    return new Promise(resolve => {
      const start = Date.now();
      let lastVersion = -1, stalls = 0, ticks = 0;
      const poll = setInterval(() => {
        ticks++;
        checkInvariants(room, `g${idx} t${ticks}`, problems);
        if (room.game?.winner != null) {
          clearInterval(poll);
          finish('winner');
        } else if (room.version === lastVersion) {
          stalls++;
          if (stalls > 200) { clearInterval(poll); finish('STALLED'); }
        } else { lastVersion = room.version; stalls = 0; }
        if (Date.now() - start > 25000) { clearInterval(poll); finish('TIMEOUT'); }
      }, 3);
      function finish(reason) {
        const g = room.game;
        const vps = room.players.map((_, i) => publicState(room, i).game.vp[i]);
        result = {
          game: idx, difficulty, boardMode, reason,
          round: g?.round, winner: g?.winner,
          vps,
          totalBuildings: Object.keys(g?.buildings || {}).length,
          totalRoads: Object.keys(g?.roads || {}).length,
          errors: errLog.length,
          problems: problems.slice(0, 8),
        };
        console.error = origError;
        resolve(result);
      }
    });
  } catch (e) {
    console.error = origError;
    return Promise.resolve({ game: idx, difficulty, boardMode, reason: 'CRASH', error: e.message, stack: e.stack?.split('\n')[1], problems });
  }
}

(async () => {
  const configs = [
    { difficulty: 'easy', boardMode: 'default' },
    { difficulty: 'normal', boardMode: 'random' },
    { difficulty: 'hard', boardMode: 'default' },
  ];
  console.log('=== ISLANDS & ROADS オンライン フル対戦シミュレーション ===');
  let allOk = true;
  for (let i = 0; i < configs.length; i++) {
    const r = await runOneGame(configs[i].difficulty, configs[i].boardMode, i + 1);
    const ok = (r.reason === 'winner') && r.errors === 0 && (!r.problems || r.problems.length === 0);
    if (!ok) allOk = false;
    console.log(`\n--- ゲーム${r.game} [${r.difficulty}/${r.boardMode}] ---`);
    console.log(JSON.stringify(r, null, 0));
    console.log(ok ? '✅ 正常終了（勝者あり・エラーなし・違反なし）' : '⚠️ 要確認');
  }
  console.log('\n=== 総合: ' + (allOk ? '✅ 全ゲーム正常' : '⚠️ 問題あり') + ' ===');
  process.exit(allOk ? 0 : 1);
})();
