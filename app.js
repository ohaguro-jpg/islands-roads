// ===== i18n =====
// 言語は localStorage に永続化。RESOURCES/HEROES は getter で言語を見るので、
// 既存の .name / .desc 参照はコードを一切変えずに両言語に対応する。
let LANG = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'ja';
const RES_NAMES_EN = { wood: 'Wood', brick: 'Brick', wheat: 'Wheat', sheep: 'Sheep', ore: 'Ore' };
const RESOURCES = {
  wood:  { get name() { return LANG === 'en' ? RES_NAMES_EN.wood : '木材'; }, icon: '🌲' },
  brick: { get name() { return LANG === 'en' ? RES_NAMES_EN.brick : 'レンガ'; }, icon: '🧱' },
  wheat: { get name() { return LANG === 'en' ? RES_NAMES_EN.wheat : '小麦'; }, icon: '🌾' },
  sheep: { get name() { return LANG === 'en' ? RES_NAMES_EN.sheep : '羊毛'; }, icon: '🐑' },
  ore:   { get name() { return LANG === 'en' ? RES_NAMES_EN.ore : '鉱石'; }, icon: '⛏' }
};
const TILE_TYPES = [...Array(4).fill('forest'), ...Array(3).fill('hills'), ...Array(4).fill('pasture'), ...Array(4).fill('fields'), ...Array(3).fill('mountains'), 'desert'];
const DEFAULT_TYPES = ['mountains', 'pasture', 'forest', 'fields', 'hills', 'pasture', 'mountains', 'forest', 'fields', 'desert', 'fields', 'forest', 'mountains', 'forest', 'pasture', 'hills', 'fields', 'pasture', 'hills'];
const DEFAULT_NUMBERS = [4, 9, 6, 4, 12, 10, 11, 10, 8, null, 3, 2, 9, 3, 8, 11, 6, 5, 5];
const TYPE_DATA = { forest: { res: 'wood', icon: '🌲' }, hills: { res: 'brick', icon: '🧱' }, pasture: { res: 'sheep', icon: '🐑' }, fields: { res: 'wheat', icon: '🌾' }, mountains: { res: 'ore', icon: '⛏' }, desert: { res: null, icon: '☀' }, sea: { res: null, icon: '🌊' }, gold: { res: null, icon: '✨' } };
const NUMBERS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
const COLORS = ['#c95642', '#3d7181', '#d9a838', '#577b59'];
const NAMES = ['あなた', 'ミナト', 'アオイ', 'ハル'];
const NPC_NAMES = ['ミナト', 'アオイ', 'ハル', 'カイ'];
const NPC_NAMES_EN = ['Minato', 'Aoi', 'Haru', 'Kai'];
function npcName(i) { return LANG === 'en' ? NPC_NAMES_EN[i] : NPC_NAMES[i]; }
const COSTS = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1 }, city: { wheat: 2, ore: 3 }, development: { wheat: 1, sheep: 1, ore: 1 }, ship: { wood: 1, sheep: 1 } };
const PIECE_LIMITS = { road: 15, settlement: 5, city: 4, ship: 15 };
// Selectable board sizes. `n` is the axial hexagon radius; `trimCorners` drops the 6 corner
// hexes for a rounded mid-size board. `unit` is the hex radius in px — smaller for bigger
// boards so they fit the same on-screen envelope (sea-ring / .board are fixed size).
const BOARD_SIZES = {
  standard: { label: '標準', n: 2, trimCorners: false, unit: 64, deserts: 1, harbors: 9 },
  large:    { label: '大型', n: 3, trimCorners: true,  unit: 52, deserts: 2, harbors: 11 },
  huge:     { label: '巨大', n: 3, trimCorners: false, unit: 49, deserts: 2, harbors: 13 }
};
function boardSizeConfig() { return BOARD_SIZES[gameConfig.boardSize] || BOARD_SIZES.standard; }
// 駒の数を「盤面サイズ」と「勝利点」の両方で増やす。大きい盤・高得点でも駒切れで
// 建てられなくならないように、建物だけで目標点を十分上回れる数を確保する。
function pieceLimitsFor(sizeKey, targetScore) {
  const sizeStep = { standard: 0, large: 1, huge: 2 }[sizeKey] || 0;
  const scoreStep = targetScore >= 20 ? 2 : targetScore >= 15 ? 1 : 0;
  return {
    settlement: 5 + sizeStep + scoreStep * 2, // 開拓地: 1点/個
    city:       4 + sizeStep + scoreStep,      // 都市: 2点/個
    road:       15 + sizeStep * 4 + scoreStep * 4,
    ship:       15 + sizeStep * 4 + scoreStep * 4
  };
}
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
// Hero Pack (yuji Original) — each player receives one passive hero ability
const HEROES_EN = {
  general:      { name: 'Veteran General',    desc: 'No discard on a 7 with 15 cards or fewer (half discarded at 16+)' },
  architect:    { name: 'Master Architect',   desc: 'Roads cost only 1 brick (no wood needed)' },
  sage:         { name: 'Ancient Sage',       desc: 'Draw 2 development cards when buying and keep your favorite' },
  guardian:     { name: 'Unbreakable Guardian', desc: 'Never loses resources to the robber; production continues even with the robber on your tile' },
  gambler:      { name: 'Lucky Gambler',      desc: 'On your turn, roll the dice 3 times and pick your favorite while watching the board' },
  taxman:       { name: 'Greedy Taxman',      desc: 'Steals 2 cards when robbing with a 7' },
  harbormaster: { name: 'Harbor Master',      desc: 'Bank/port trades are 2:1 for every resource' }
};
const HEROES = [
  { id: 'general',     icon: '🗡', get name() { return LANG === 'en' ? HEROES_EN.general.name : '歴戦の将軍'; },     get desc() { return LANG === 'en' ? HEROES_EN.general.desc : '手札が 15 枚以下なら 7 が出ても捨て不要（16 枚以上で半分捨て）'; } },
  { id: 'architect',   icon: '🏗', get name() { return LANG === 'en' ? HEROES_EN.architect.name : '天才建築家'; },   get desc() { return LANG === 'en' ? HEROES_EN.architect.desc : '街道の建設コストがレンガ 1 枚のみ（木材不要）'; } },
  { id: 'sage',        icon: '🔮', get name() { return LANG === 'en' ? HEROES_EN.sage.name : '古の賢者'; },          get desc() { return LANG === 'en' ? HEROES_EN.sage.desc : '発展カード購入時に 2 枚引いて好きな 1 枚を選べる'; } },
  { id: 'guardian',    icon: '🛡', get name() { return LANG === 'en' ? HEROES_EN.guardian.name : '不屈の守人'; },    get desc() { return LANG === 'en' ? HEROES_EN.guardian.desc : '盗賊で資源を 1 枚も奪われず、盗賊が乗っても生産が止まらない'; } },
  { id: 'gambler',     icon: '🎲', get name() { return LANG === 'en' ? HEROES_EN.gambler.name : '強運の博徒'; },     get desc() { return LANG === 'en' ? HEROES_EN.gambler.desc : '自分の手番、ダイスを 3 回ふって盤面を見ながら好きな 1 つを選べる'; } },
  { id: 'taxman',      icon: '💰', get name() { return LANG === 'en' ? HEROES_EN.taxman.name : '強欲の徴税官'; },    get desc() { return LANG === 'en' ? HEROES_EN.taxman.desc : '7 を出して盗む時、2 枚奪える'; } },
  { id: 'harbormaster', icon: '🌊', get name() { return LANG === 'en' ? HEROES_EN.harbormaster.name : '港の主'; },   get desc() { return LANG === 'en' ? HEROES_EN.harbormaster.desc : '銀行・港との交換が全資源 2:1'; } },
];
// Hero is only set when the expansion is on; helpers used by robber/steal logic.
function robbable(player) { return state.players[player]?.hero !== 'guardian'; }   // guardian can't be stolen from
function stealCount(player) { return state.players[player]?.hero === 'taxman' ? 2 : 1; } // taxman robs 2

// Translation dictionary for toasts / dialogs / other dynamic (non-HTML-authored) strings.
// Static HTML text lives in the .html files as data-ja/data-en (see applyI18n below).
const T = {
  ja: {
    cardCancelled: 'カードの使用を取り消しました',
    bgmName: 'BGM：{name}',
    placingFrom: '{name}から配置します',
    devCardUsed: '{label}カードを使いました',
    shipBuilt: '船を建設しました',
    shipMoveLimit: '船の移動は1ターンに1回までです',
    noMovableShips: '動かせる船がありません（航路の先端の船だけ動かせます）',
    pickShipToMove: '動かす船（航路の先端）を選んでください',
    pickShipDestination: '移動先の海路を選んでください',
    shipMoved: '船を移動しました',
    islandDiscovered: '✨ {name}が新しい島を発見！ +{vp}VP',
    setupSpotSelected: '選んだ場所を自分の色で表示しました。下の「ここに決定」を押してください',
    settlementBuilt: '開拓地を建設しました',
    cityBuilt: '都市へ発展しました',
    setupRoadSelected: '街道を選びました。下の「ここに決定」を押してください',
    roadBuiltFreeRemaining: '街道を建設しました。あと{n}本置けます',
    roadBuildingDone: '街道建設カードの街道を置き終えました',
    roadBuilt: '街道を建設しました',
    setupComplete: '初期配置完了！',
    botPlacedSetup: '{name}が開拓地と街道を配置',
    botSetupDone: '{name}の初期配置を完了しました',
    pickWhiteDotFirst: '先に盤面の白い丸を選んでください',
    settlementConfirmedPickRoad: '開拓地を確定しました。次につながる街道を選んでください',
    pickWhiteRoadFirst: '先に白い街道を選んでください',
    rolledGained: '{sum}！ 資源を {gained} 枚獲得',
    rolledNoGain: '{sum}！ 島から資源が産出しました',
    sevenBotMovedRobber: '7！ {name}が盗賊を動かしました',
    pickSeaTileForPirate: '青い海タイルを選んで海賊を動かしてください',
    confirmSeaTile: 'この海域でよければ「確定」を押してください',
    pirateMovedNoVictim: '海賊を移動しました（奪える相手はいません）',
    discardPickExact: '合計{n}枚を選んでください',
    pickGlowingTile: '黄色く光る土地を選んで盗賊を動かしてください',
    confirmTile: 'この土地でよければ「確定」を押してください',
    robberMovedNoVictim: '盗賊を移動しました（奪える相手はいません）',
    stolenFrom: '{name}から{n}枚獲得しました',
    robberMoved: '盗賊を移動しました',
    recovered: '状態を復旧しました。まだ進まない場合はもう一度押すか「新しいゲーム」を試してください',
    barbNoCities: '🏴 蛮族が来たが、都市がないので被害なし！',
    barbRepelledReward: '⚔ 蛮族撃退！{name}が発展カードを獲得！',
    barbRepelled: '⚔ 蛮族撃退！よく守りました！',
    barbDamage: '🏴 蛮族の来襲！騎士なきプレイヤーの都市が破壊されました',
    barbNoDamage: '🏴 蛮族の来襲！被害なし',
    botRecovered: '{name}の処理を復旧しました',
    botEndedActions: '{name}は行動を終了しました',
    tradedWithNpc: '{name}と交換しました',
    rejectedNpcOffer: '{name}の提案を断りました',
    botBuilt: '{name}：{items}を建設',
    botNoAction: '{name}はターンを終了',
    sageCardChosen: '{label}カードを選びました',
    freeRoadsPrompt: '無料で街道を2本置けます。盤上の黄色い街道を選んでください',
    pickExactlyTwo: '合計2枚を選んでください',
    bankOutOfStock: '銀行の在庫が足りません',
    plentyReceived: '発見カードで資源を受け取りました',
    monopolyCollected: '独占！ {res}を{n}枚集めました',
    noTradeTarget: '交換できる相手がいません',
    tradeSucceeded: '{name}と交換が成立しました！',
    cantBuyDev: '発展カードを購入できません',
    devBought: '発展カードを1枚購入しました',
    pickYellowRoad: '盤上の黄色い街道を選択',
    pickYellowSpot: '盤上の黄色い地点を選択',
    noPlayableDev: '使える発展カードがありません',
    rollBeforeTrade: 'ダイスを振ったあとに交換できます',
    pickDifferentResource: '違う資源を選んでください',
    needNMore: '{res}が{rate}枚必要です',
    bankOutOfRes: '銀行に{res}がありません',
    bankTraded: '銀行と交換しました',
    firstSettlementPrompt: '最初の開拓地を置いてください',
    secondSettlementPrompt: '2個目の開拓地を置いてください',
    yourTurn: '{name}のターンです',
    noHarborsOwned: '保有する港はありません（すべて<b>4:1</b>）',
    harborsOwnedPrefix: '保有する港：',
    desertLabel: '砂漠',
    expectedValue: '{parts} · 期待値{score}{harbor}',
    handOf: '{name}の手札',
    pickResourcesEach: '渡す資源ともらう資源をそれぞれ選んでください',
    sameResourceTrade: '同じ資源を渡して受け取ることはできません',
    resourceShort: '{res}が足りません',
    itemCity: '都市',
    itemSettlement: '開拓地',
    itemRoad: '街道',
    itemShip: '船',
    itemDevCard: '発展カード',
    acceptTrade: '交換に応じる',
    actionLabel: 'アクション',
    advanceNpc: 'NPCを進める',
    advanceNpcNow: 'NPCを今すぐ進める →',
    advanceNpcSetup: 'NPCの初期配置を進める →',
    allHuman: '人間4人で対戦します（NPCなし）',
    anyResource: 'どの資源でも',
    automatic: '自動',
    backToYourTurn: '手番に戻ります。端末を受け取ってください。',
    breakdownCities: '都市×{n}',
    breakdownIsland: '新島発見+{n}',
    breakdownLargestArmy: '最大騎士力+2',
    breakdownLongestRoad: '最長交易路+2',
    breakdownSettlements: '開拓地×{n}',
    breakdownVpCards: '勝利点カード×{n}',
    cancelShipMove: '✕ 船の移動をやめる',
    countCards: '{n}枚',
    countHave: '{n}枚持ち',
    decide: '決定する',
    declineTrade: '断る',
    declined: '拒否',
    decrease: '減らす',
    diceOf: '{name} のダイス',
    discardBody: '今の手札は<b>{n}枚</b>。捨てる資源の枚数を選んでください。',
    discardProgress: '選択中: {total} / {n}枚',
    discardTitle: '{name}：手札を{n}枚捨てる',
    doTrade: '交換する',
    endTurn: 'ターン終了',
    expansionIntroSub: '選んだ拡張のルールです。「遊び方」ボタンからいつでも見直せます。',
    expansionIntroTitle: '拡張ルールの遊び方',
    fromNextTurn: '次ターンから',
    gamblerPickLabel: '出た目から1つ選ぶ',
    getLabel: 'もらう',
    giveLabel: '渡す',
    goldPickBody: 'あと <b>{n}</b> 枚選んでください',
    goldPickTitle: '{name}：金鉱から資源を受け取る',
    handToThem: '本人に渡す',
    harborLabel: '港',
    howToPlay: '遊び方',
    humanPlayerConfirm: '人間プレイヤー · 本人に確認します',
    humanProposalBody: '<b>{name}</b> があなたに {give} を渡すかわりに、あなたの {get} をほしがっています。',
    humanProposalIncoming: '{name} さんから交換の提案があります',
    humanProposalTitle: '{name}さんへの提案',
    humanTag: '人間',
    humanTradeDeclined: '{name}さんに断られました',
    humanTradeSucceeded: '{name}さんと交換が成立しました！',
    increase: '増やす',
    isThisYou: '{name} さんですか？',
    largestArmyBadge: '最大騎士力',
    largestArmyShort: '最大騎士',
    longestRoadBadge: '最長交易路',
    longestRoadShort: '最長',
    minPointsLabel: '最低点',
    minVp: '最低 {n} VP',
    minVpShort: '最低 {n}',
    monopolyDialogBody: '選んだ資源を全プレイヤーから集めます。',
    monopolyDialogTitle: '独占：資源を1種類選ぶ',
    moveShipBtnLabel: '⛵ 船を移動（1ターン1回）',
    mustDiscardN: '手札を {n} 枚捨てます',
    neverMind: 'やっぱりやめる',
    noDevCardsYet: '発展カードはまだありません',
    noOneAccepted: '承認してくれる相手がいませんでした。',
    none: 'なし',
    npcJoining: 'NPC ×{n} が参加します（合計4人）',
    npcProposalBody: '<b>{name}</b> が {give} を渡すかわりに、あなたの {want} をほしがっています。',
    npcProposalTitle: '{name}からの交換提案',
    npcsTurn: 'NPCの手番です',
    okCanTrade: 'OK！交換できます',
    pickRoadSpot: '街道の場所を選ぶ',
    pickSettlementSpot: '開拓地の場所を選ぶ',
    pirateSea: '海賊（海）',
    placingNth: '{n}個目を配置',
    playAgain: 'もう一度遊ぶ',
    playerLabel: 'プレイヤー',
    playerN: 'プレイヤー{n}',
    pleaseWait: '少し待ってください',
    plentyDialogBody: '銀行から好きな資源を合計2枚受け取れます。',
    plentyDialogTitle: '発見：資源を2枚選ぶ',
    proposalReplyBody: 'あなたが渡す {give} → もらう {get}',
    proposalReplyTitle: '提案への返事',
    rankLabel: '順位',
    reasonFits: '建設計画に合う',
    reasonInvalid: '条件が不正',
    reasonMismatch: '条件が見合わない',
    reasonShort: '{res}が足りない',
    reasonTooMuch: '渡す枚数が多すぎる',
    reasonWinRisk: 'それを渡すと勝たれてしまう',
    receive: '受け取る',
    resourceLabel: '資源',
    resourceShort2: '資源が足りません',
    resultLine: '開拓地{settlements}・都市{cities}・道{roads}・騎士{knights}',
    robberLand: '盗賊（陸）',
    rollDiceLabel: 'ダイスを振る',
    rulesBarbariansJudge: '<b>⚔ 防衛の判定：</b>上陸時、<b>全員が使った騎士カードの合計</b>と、<b>盤上の都市の合計数</b>を比べます。',
    rulesBarbariansLose: '<b>❌ 騎士 ＜ 都市 → 防衛失敗：</b>そのラウンドで<b>騎士を1枚も使っていないプレイヤー</b>の都市が1つ開拓地に格下げされます（−1点）。',
    rulesBarbariansNote: '※ ポイント：騎士カードは盗賊対策だけでなく<b>都市を守る盾</b>にもなります。都市を増やすほど蛮族に狙われやすいので、騎士とのバランスが大切です。都市が1つも無いときは被害ゼロ。',
    rulesBarbariansTiming: '<b>⏳ 侵攻のタイミング：</b>手番が進むごとに蛮族船が前進し、<b>{n}ターンごと</b>に上陸して全プレイヤーの<b>都市</b>を襲います。サイドバーの蛮族トラックで残りターンを確認できます。',
    rulesBarbariansTitle: '拡張：蛮族の来襲（シティ＆ナイト風 簡易版）',
    rulesBarbariansWin: '<b>✅ 騎士 ≧ 都市 → 撃退成功：</b>勝利点が最も高いプレイヤーが<b>発展カードを1枚</b>もらえます。',
    rulesBuildCost: '<b>🔨 建設コスト：</b>街道＝🌲🧱／開拓地＝🌲🧱🌾🐑／都市（開拓地を発展）＝🌾2 ⛏3／発展カード＝🌾🐑⛏。開拓地は最大5個・都市は最大4個・街道は最大15本まで。開拓地を都市にすると開拓地の枠が空きます。',
    rulesDevIntro: '<b>🃏 発展カード：</b>引いたターンは使えず、<b>次の自分の手番から・1ターンに1枚だけ</b>使えます。',
    rulesDevKnight: '・<b>騎士</b>＝盗賊を好きな土地へ動かして1枚奪う（置く前に確定ボタンで確認）',
    rulesDevMonopoly: '・<b>独占</b>＝資源を1種類選び全員から集める',
    rulesDevPlenty: '・<b>発見</b>＝銀行から好きな資源を2枚もらう',
    rulesDevRoadBuilding: '・<b>街道建設</b>＝無料の街道を2本、自分で選んで置く',
    rulesDevVictory: '・<b>勝利点</b>＝隠したまま自動で1点（自分だけ見える）<br>騎士を3枚以上使うと<b>最大騎士力＋2点</b>。',
    rulesGoal: '<b>🎯 目的：</b>最初に<b>10勝利点</b>に到達したプレイヤーの勝ちです。開拓地は1点、都市は2点。さらに最長交易路・最大騎士力・勝利点カードでも点が入ります。',
    rulesHarbors: '<b>⚓ 港と交換：</b>銀行とは通常4:1で交換。港に開拓地・都市があると<b>3:1</b>（どの資源でも）や<b>2:1</b>（指定資源）になります。盤上の港は点線でどのマスと繋がるか示され、保有中の港は銀行パネルに表示されます。手番中は他プレイヤーへ直接交換も提案できます。',
    rulesHeroesIntro: 'ゲーム開始時、各プレイヤーに<b>固有の英雄</b>が1人ランダムで配られます。英雄の能力は<b>ゲーム中ずっと自動で発動</b>する常時効果です。プレイヤー名の横に英雄バッジが表示されます。',
    rulesHeroesMine: 'あなたの英雄：<b>{icon} {name}</b><br>{desc}',
    rulesHeroesNote: '※ 英雄能力は最初に配られた1つで固定。交換や変更はできません。',
    rulesHeroesTitle: '拡張：英雄の伝説（yuji オリジナル）',
    rulesLargestArmy: '',
    rulesLongestRoad: '<b>🛣 最長交易路：</b>連続5本以上の街道{ships}を最も長く繋いだ人が<b>＋2点</b>。',
    rulesLongestRoadShips: '・船',
    rulesNpcSailing: '（船で新しい島も目指します）',
    rulesNpcStrength: '<b>🤖 NPCの強さ：</b>開始画面で「やさしい／ふつう／強い」を選べます。強いほど街道を賢く伸ばし、発展カードを積極的に使います{sailing}。',
    rulesProduction: '<b>🎲 資源の産出：</b>手番では必ず最初にダイスを振ります。出た目の数字を持つタイルに接する開拓地（1枚）・都市（2枚）の所有者が資源を得ます。<b>ダイスを振るまで建設・交換・発展カードは使えません。</b>',
    rulesSeafarersGold: '<b>✨ 金鉱：</b>金鉱に接する開拓地・都市の所有者は、その数字が出ると<b>好きな資源</b>を選んで受け取れます（開拓地1枚・都市2枚）。',
    rulesSeafarersIsland: '<b>🏝 新しい島の発見：</b>母島以外の島に<b>最初に開拓地</b>を置いた人は<b>＋{n}点</b>。船で海を渡ってたどり着きましょう。',
    rulesSeafarersMoveShip: '<b>🚢 船の移動：</b>1ターンに1回、航路の<b>先端の船</b>を1隻だけ別の場所へ動かせます（そのターンに置いた船・移動済みの船は動かせません）。「⛵ 船を移動」ボタンから行います。',
    rulesSeafarersPirate: '<b>🏴‍☠️ 海賊：</b>海では盗賊のかわりに<b>海賊</b>が動きます。7を出すか騎士を使うと、盗賊（陸）か海賊（海）のどちらを動かすか選べます。海賊のいる海域では船を建設できず、その海域に面した相手から資源を1枚奪えます。',
    rulesSeafarersShip: '<b>⛵ 船：</b>コストは🌲＋🐑。海に面した辺に置けます。自分の<b>沿岸の開拓地・都市</b>か、つながっている<b>船の先端</b>から伸ばします。街道と船は開拓地・都市を経由してつながり、合わせて<b>最長交易路</b>になります。',
    rulesSeafarersTitle: '拡張：航海者たち',
    rulesSetup: '<b>🏝 初期配置：</b>全員が開拓地と街道を2組ずつ、往復順（あなた→他3人→他3人→あなた）に置きます。2個目の開拓地の周囲のタイルから初期資源を受け取ります。',
    rulesSeven: '<b>🦹 7と盗賊：</b>7が出ると手札8枚以上の人は半分を捨てます。振った人は盗賊を動かし、その土地に接する相手から1枚奪います。盗賊のいる土地は資源を産出しません。',
    rulesVpVisibility: '<b>🔒 勝利点の表示：</b>あなたの合計点だけが表示され、他プレイヤーの点数は伏せられます（ゲーム終了時に公開）。',
    sageDialogBody: '引いた2枚のカードから1枚をキープ。もう1枚はデッキに戻ります。',
    sageDialogTitle: '古の賢者：2枚から1枚を選ぶ',
    selected: '選択済み',
    setupPhaseLabel: '初期配置',
    setupTextRoad: '白い線を選び、下の決定ボタンを押してください',
    setupTextSettlement: '小さい白い丸を選び、下の決定ボタンを押してください',
    setupTitlePlacing: '{name}が配置中…',
    setupTitleRoad: '街道を置こう',
    setupTitleSettlement: '開拓地を置こう',
    sevenChoiceBody: 'どちらを移動しますか？',
    sevenChoiceTitle: '7！ 盗賊か海賊を動かす',
    statsLine: '手札{hand} · 開拓地{settlements} · 都市{cities} · 道{roads} · 発展{dev} · 騎士{knights}',
    stealFromWhoBody: '盗賊を置いた土地に接するプレイヤーから1枚を奪えます。',
    stealFromWhoTitle: '誰から1枚もらう？',
    step1SelectOnBoard: '① 盤面から選択',
    step2Confirm: '② ここに決定',
    sumLabel: '合計 {n}',
    totalLabel: '合計 {n}',
    tradeHintModal: '交換したい相手の「交換する」または「本人に渡す」を押してください。',
    turnsRemaining: 'あと {n} ターン',
    use: '使う',
    victoryPointsLabel: '勝利点',
    winSub: '{n}勝利点を獲得し、島の開拓者になりました。',
    winTitle: '{name} の勝利！',
    you: 'あなた',
    yourCurrentVpTitle: 'あなたの現在の勝利点（隠し勝利点カード込み）',
    yourTurnCheckHand: 'あなたの番です。準備ができたら手札を見ましょう。',
  },
  en: {
    cardCancelled: 'Card use cancelled',
    bgmName: 'BGM: {name}',
    placingFrom: '{name} is placing pieces',
    devCardUsed: 'Used {label} card',
    shipBuilt: 'Ship built',
    shipMoveLimit: 'You can only move a ship once per turn',
    noMovableShips: 'No movable ships (only ships at the end of a route can move)',
    pickShipToMove: 'Choose a ship to move (must be at the end of a route)',
    pickShipDestination: 'Choose a sea route to move it to',
    shipMoved: 'Ship moved',
    islandDiscovered: '✨ {name} discovered a new island! +{vp}VP',
    setupSpotSelected: 'Spot marked in your color. Press "Confirm" below',
    settlementBuilt: 'Settlement built',
    cityBuilt: 'Upgraded to a city',
    setupRoadSelected: 'Road selected. Press "Confirm" below',
    roadBuiltFreeRemaining: 'Road built. {n} more to place',
    roadBuildingDone: 'Finished placing the Road Building roads',
    roadBuilt: 'Road built',
    setupComplete: 'Setup complete!',
    botPlacedSetup: '{name} placed a settlement and road',
    botSetupDone: '{name} finished their setup',
    pickWhiteDotFirst: 'Select a white dot on the board first',
    settlementConfirmedPickRoad: 'Settlement confirmed. Choose the connecting road',
    pickWhiteRoadFirst: 'Select a white road first',
    rolledGained: '{sum}! Gained {gained} resource(s)',
    rolledNoGain: '{sum}! The island produced no resources for you',
    sevenBotMovedRobber: '7! {name} moved the robber',
    pickSeaTileForPirate: 'Pick a blue sea tile to move the pirate',
    confirmSeaTile: 'Press "Confirm" if this sea tile is fine',
    pirateMovedNoVictim: 'Pirate moved (no one to rob)',
    discardPickExact: 'Choose exactly {n} cards',
    pickGlowingTile: 'Pick the glowing tile to move the robber',
    confirmTile: 'Press "Confirm" if this tile is fine',
    robberMovedNoVictim: 'Robber moved (no one to rob)',
    stolenFrom: 'Took {n} card(s) from {name}',
    robberMoved: 'Robber moved',
    recovered: 'State recovered. Press again or try "New Game" if it is still stuck',
    barbNoCities: '🏴 The barbarians arrived, but no cities means no damage!',
    barbRepelledReward: '⚔ Barbarians repelled! {name} received a development card!',
    barbRepelled: '⚔ Barbarians repelled! Well defended!',
    barbDamage: '🏴 Barbarian raid! Cities of knight-less players were destroyed',
    barbNoDamage: '🏴 Barbarian raid! No damage',
    botRecovered: '{name}’s turn was recovered',
    botEndedActions: '{name} finished their actions',
    tradedWithNpc: 'Traded with {name}',
    rejectedNpcOffer: '{name} declined the offer',
    botBuilt: '{name}: built {items}',
    botNoAction: '{name} ended their turn',
    sageCardChosen: 'Chose the {label} card',
    freeRoadsPrompt: 'You can place 2 free roads. Pick the yellow roads on the board',
    pickExactlyTwo: 'Choose exactly 2 cards',
    bankOutOfStock: 'The bank is out of stock',
    plentyReceived: 'Received resources from Year of Plenty',
    monopolyCollected: 'Monopoly! Collected {n} {res}',
    noTradeTarget: 'No one to trade with',
    tradeSucceeded: 'Trade with {name} succeeded!',
    cantBuyDev: 'Cannot buy a development card',
    devBought: 'Bought a development card',
    pickYellowRoad: 'Select a yellow road on the board',
    pickYellowSpot: 'Select a yellow spot on the board',
    noPlayableDev: 'No development card available to play',
    rollBeforeTrade: 'Roll the dice before trading',
    pickDifferentResource: 'Pick a different resource',
    needNMore: 'You need {rate} {res}',
    bankOutOfRes: 'The bank has no {res}',
    bankTraded: 'Traded with the bank',
    firstSettlementPrompt: 'Place your first settlement',
    secondSettlementPrompt: 'Place your second settlement',
    yourTurn: 'It is {name}’s turn',
    noHarborsOwned: 'No harbors owned (all <b>4:1</b>)',
    harborsOwnedPrefix: 'Harbors owned: ',
    desertLabel: 'Desert',
    expectedValue: '{parts} · Expected {score}{harbor}',
    handOf: '{name}’s hand',
    pickResourcesEach: 'Choose what to give and what to receive',
    sameResourceTrade: 'You cannot give and receive the same resource',
    resourceShort: 'Not enough {res}',
    itemCity: 'a city',
    itemSettlement: 'a settlement',
    itemRoad: 'a road',
    itemShip: 'a ship',
    itemDevCard: 'a dev card',
    acceptTrade: 'Accept trade',
    actionLabel: 'Action',
    advanceNpc: 'Advance NPC',
    advanceNpcNow: 'Advance NPC now →',
    advanceNpcSetup: 'Advance NPC setup →',
    allHuman: 'All 4 players are human (no NPCs)',
    anyResource: 'any resource',
    automatic: 'Auto',
    backToYourTurn: 'Back to your turn. Take the device.',
    breakdownCities: '{n} city(ies)',
    breakdownIsland: 'New island +{n}',
    breakdownLargestArmy: 'Largest Army +2',
    breakdownLongestRoad: 'Longest Road +2',
    breakdownSettlements: '{n} settlement(s)',
    breakdownVpCards: '{n} victory point card(s)',
    cancelShipMove: '✕ Cancel ship move',
    countCards: '{n} cards',
    countHave: 'have {n}',
    decide: 'Confirm',
    declineTrade: 'Decline',
    declined: 'Declined',
    decrease: 'Decrease',
    diceOf: '{name}’s dice',
    discardBody: 'Your hand has <b>{n} cards</b>. Choose how many of each resource to discard.',
    discardProgress: 'Selected: {total} / {n}',
    discardTitle: '{name}: discard {n} cards',
    doTrade: 'Trade',
    endTurn: 'End Turn',
    expansionIntroSub: 'Rules for the expansions you picked. Revisit anytime with the "How to Play" button.',
    expansionIntroTitle: 'Expansion Rules',
    fromNextTurn: 'from next turn',
    gamblerPickLabel: 'Pick one of the rolls',
    getLabel: 'Get',
    giveLabel: 'Give',
    goldPickBody: 'Choose <b>{n}</b> more',
    goldPickTitle: '{name}: take resources from the gold field',
    handToThem: 'Hand it to them',
    harborLabel: 'harbor',
    howToPlay: 'How to Play',
    humanPlayerConfirm: 'Human player · confirm with them',
    humanProposalBody: '<b>{name}</b> offers you {give} in exchange for your {get}.',
    humanProposalIncoming: '{name} has a trade offer for you',
    humanProposalTitle: 'Offer for {name}',
    humanTag: 'human',
    humanTradeDeclined: '{name} declined',
    humanTradeSucceeded: 'Traded with {name}!',
    increase: 'Increase',
    isThisYou: 'Is this {name}?',
    largestArmyBadge: 'Largest Army',
    largestArmyShort: 'Largest Army',
    longestRoadBadge: 'Longest Road',
    longestRoadShort: 'Longest',
    minPointsLabel: 'min. points',
    minVp: 'min. {n} VP',
    minVpShort: 'min. {n}',
    monopolyDialogBody: 'Take all of the chosen resource from every player.',
    monopolyDialogTitle: 'Monopoly: choose a resource',
    moveShipBtnLabel: '⛵ Move ship (once per turn)',
    mustDiscardN: 'Must discard {n} cards',
    neverMind: 'Never mind',
    noDevCardsYet: 'No development cards yet',
    noOneAccepted: 'No one accepted your offer.',
    none: 'none',
    npcJoining: '{n} NPC(s) will join (4 total)',
    npcProposalBody: '<b>{name}</b> offers {give} in exchange for your {want}.',
    npcProposalTitle: 'Trade offer from {name}',
    npcsTurn: 'NPC’s turn',
    okCanTrade: 'OK! You can trade',
    pickRoadSpot: 'Choose where to place the road',
    pickSettlementSpot: 'Choose where to place the settlement',
    pirateSea: 'Pirate (sea)',
    placingNth: 'Placing #{n}',
    playAgain: 'Play again',
    playerLabel: 'Player',
    playerN: 'Player {n}',
    pleaseWait: 'Please wait a moment',
    plentyDialogBody: 'Take 2 resources of your choice from the bank.',
    plentyDialogTitle: 'Year of Plenty: choose 2 resources',
    proposalReplyBody: 'You give {give} → you get {get}',
    proposalReplyTitle: 'Replies to your offer',
    rankLabel: 'Rank',
    reasonFits: 'Fits their build plan',
    reasonInvalid: 'Invalid trade',
    reasonMismatch: 'Not a good fit',
    reasonShort: 'Not enough {res}',
    reasonTooMuch: 'Asking for too much',
    reasonWinRisk: 'That trade would hand you the win',
    receive: 'Receive',
    resourceLabel: 'Resource',
    resourceShort2: 'Not enough resources',
    resultLine: '{settlements} settlements · {cities} cities · {roads} roads · {knights} knights',
    robberLand: 'Robber (land)',
    rollDiceLabel: 'Roll the dice',
    rulesBarbariansJudge: '<b>⚔ Defense check:</b> On landing, compare <b>everyone’s total played Knights</b> against <b>the total number of cities on the board</b>.',
    rulesBarbariansLose: '<b>❌ Knights &lt; Cities → Defense fails:</b> Any player who played <b>no Knight this round</b> has one city downgraded to a settlement (−1 point).',
    rulesBarbariansNote: '※ Tip: Knight cards aren’t just for the robber — they’re a <b>shield for your cities</b>. More cities means a juicier target for the barbarians, so balance city-building with Knights. No cities means no damage.',
    rulesBarbariansTiming: '<b>⏳ Timing:</b> The barbarian ship advances every turn and lands every <b>{n} turns</b>, attacking every player’s <b>cities</b>. Check the sidebar tracker for turns remaining.',
    rulesBarbariansTitle: 'Expansion: Barbarian Attack (simplified Cities & Knights)',
    rulesBarbariansWin: '<b>✅ Knights ≥ Cities → Defense succeeds:</b> The player with the most victory points receives <b>1 development card</b>.',
    rulesBuildCost: '<b>🔨 Build costs:</b> Road = 🌲🧱 / Settlement = 🌲🧱🌾🐑 / City (upgrade) = 🌾2 ⛏3 / Dev card = 🌾🐑⛏. Max 5 settlements, 4 cities, 15 roads. Upgrading a settlement to a city frees up a settlement slot.',
    rulesDevIntro: '<b>🃏 Development cards:</b> Can’t be played the turn you buy them, and only <b>one per turn, starting your next turn</b>.',
    rulesDevKnight: '· <b>Knight</b> = move the robber to any tile and steal 1 card (confirm before placing)',
    rulesDevMonopoly: '· <b>Monopoly</b> = pick one resource and take it from everyone',
    rulesDevPlenty: '· <b>Year of Plenty</b> = take 2 resources of your choice from the bank',
    rulesDevRoadBuilding: '· <b>Road Building</b> = place 2 free roads of your choice',
    rulesDevVictory: '· <b>Victory Point</b> = a hidden point, automatic (only you can see it)<br>Playing 3+ Knights gives you <b>Largest Army +2</b>.',
    rulesGoal: '<b>🎯 Goal:</b> First to <b>10 victory points</b> wins. Settlements are worth 1 point, cities 2. Longest Road, Largest Army and victory point cards also count.',
    rulesHarbors: '<b>⚓ Bank &amp; harbor trade:</b> Bank trades are normally 4:1. A harbor settlement/city gives <b>3:1</b> (any resource) or <b>2:1</b> (a specific resource). Dotted lines on the board show which spots connect to a harbor, and your harbors are listed in the bank panel. You can also propose direct trades to other players on your turn.',
    rulesHeroesIntro: 'At the start of the game, each player is randomly given a <b>unique hero</b>. Hero abilities are <b>always-on passive effects</b> for the whole game. A hero badge appears next to each player’s name.',
    rulesHeroesMine: 'Your hero: <b>{icon} {name}</b><br>{desc}',
    rulesHeroesNote: '※ Your hero is fixed for the game once assigned — no trading or changing.',
    rulesHeroesTitle: 'Expansion: Legend of Heroes (yuji original)',
    rulesLargestArmy: '',
    rulesLongestRoad: '<b>🛣 Longest Road:</b> Whoever connects 5+ roads{ships} in the longest unbroken chain gets <b>+2 points</b>.',
    rulesLongestRoadShips: ' / ships',
    rulesNpcSailing: ' (they’ll also sail for new islands)',
    rulesNpcStrength: '<b>🤖 NPC strength:</b> Choose Easy/Normal/Hard (and more) on the start screen. Stronger NPCs build roads more cleverly and use development cards more aggressively{sailing}.',
    rulesProduction: '<b>🎲 Producing resources:</b> You must roll the dice first each turn. Owners of settlements (1 card) and cities (2 cards) adjacent to the rolled number receive resources. <b>You can’t build, trade, or play development cards until you roll.</b>',
    rulesSeafarersGold: '<b>✨ Gold fields:</b> Owners of settlements/cities next to a gold field get to <b>choose any resource</b> when its number is rolled (1 for a settlement, 2 for a city).',
    rulesSeafarersIsland: '<b>🏝 Discovering new islands:</b> The first player to place a settlement on an island other than the home island gets <b>+{n} point</b>. Sail across the sea to reach one!',
    rulesSeafarersMoveShip: '<b>🚢 Moving ships:</b> Once per turn you can move a single ship from the <b>open end of a route</b> to a new spot (ships placed or moved this turn can’t move again). Use the "⛵ Move Ship" button.',
    rulesSeafarersPirate: '<b>🏴‍☠️ Pirates:</b> At sea, the pirate moves instead of the robber. Rolling a 7 or playing a Knight lets you choose to move the robber (land) or the pirate (sea). No ships can be built in a pirate-occupied sea zone, and you can steal 1 card from an adjacent opponent.',
    rulesSeafarersShip: '<b>⛵ Ships:</b> Cost 🌲+🐑. Can be placed on sea-adjacent edges, extending from your <b>coastal settlement/city</b> or a connected <b>ship’s open end</b>. Roads and ships connect through settlements/cities and combine for <b>Longest Road</b>.',
    rulesSeafarersTitle: 'Expansion: Seafarers',
    rulesSetup: '<b>🏝 Setup:</b> Everyone places 2 settlements and 2 roads each, in snake-draft order (you → others → others → you). You receive starting resources from the tiles around your second settlement.',
    rulesSeven: '<b>🦹 7s and the robber:</b> On a 7, anyone with 8+ cards discards half. The roller moves the robber and steals 1 card from an adjacent player. A tile with the robber on it produces nothing.',
    rulesVpVisibility: '<b>🔒 Score visibility:</b> Only your own total is shown; other players’ totals stay hidden until the game ends.',
    sageDialogBody: 'Keep one of the two drawn cards. The other goes back into the deck.',
    sageDialogTitle: 'Ancient Sage: pick 1 of 2',
    selected: 'Selected',
    setupPhaseLabel: 'Setup',
    setupTextRoad: 'Select a white line, then press Confirm below',
    setupTextSettlement: 'Select a small white dot, then press Confirm below',
    setupTitlePlacing: '{name} is placing…',
    setupTitleRoad: 'Place a road',
    setupTitleSettlement: 'Place a settlement',
    sevenChoiceBody: 'Which one do you want to move?',
    sevenChoiceTitle: '7! Move the robber or the pirate',
    statsLine: 'Hand {hand} · Settlements {settlements} · Cities {cities} · Roads {roads} · Dev {dev} · Knights {knights}',
    stealFromWhoBody: 'You can steal 1 card from a player adjacent to the robber’s tile.',
    stealFromWhoTitle: 'Steal from who?',
    step1SelectOnBoard: '① Select on the board',
    step2Confirm: '② Confirm here',
    sumLabel: 'Total {n}',
    totalLabel: 'Total {n}',
    tradeHintModal: 'Press "Trade" or "Hand it to them" for whoever you want to trade with.',
    turnsRemaining: '{n} turns left',
    use: 'Use',
    victoryPointsLabel: 'Victory Points',
    winSub: 'Reached {n} victory points and became the ruler of the isle.',
    winTitle: '{name} wins!',
    you: 'You',
    yourCurrentVpTitle: 'Your current victory points (including hidden VP cards)',
    yourTurnCheckHand: 'It’s your turn. Check your hand when you’re ready.',
  }
};
function t(key, vars) {
  let s = (T[LANG] && T[LANG][key]) ?? T.ja[key] ?? key;
  if (vars) Object.keys(vars).forEach(k => { s = s.split(`{${k}}`).join(vars[k]); });
  return s;
}
// "{name}'s hand" reads awkwardly in English when name is literally "You" (e.g. "You's hand").
// Japanese "あなたの手札" doesn't have this problem, so only English needs the special case.
function handOfLabel(name) {
  return (LANG === 'en' && name === t('you')) ? 'Your hand' : t('handOf', { name });
}
// Same issue for "{name} wins!" → "You wins!" reads wrong; needs "You win!" instead.
function winTitleText(name) {
  return (LANG === 'en' && name === t('you')) ? 'You win!' : t('winTitle', { name });
}
function diceOfLabel(name) {
  return (LANG === 'en' && name === t('you')) ? 'Your dice' : t('diceOf', { name });
}
function yourTurnLabel(name) {
  return (LANG === 'en' && name === t('you')) ? 'It’s your turn' : t('yourTurn', { name });
}
// Apply translations to static HTML marked with data-i18n / data-i18n-ph (placeholder) /
// data-i18n-title (title attr). Text content is read from data-ja / data-en on the element
// itself so translations live next to the Japanese text they replace.
function applyI18n() {
  document.querySelectorAll('[data-en]').forEach(el => {
    const val = LANG === 'en' ? el.dataset.en : el.dataset.ja;
    if (val == null) return;
    if (el.dataset.i18nAttr) el.setAttribute(el.dataset.i18nAttr, val);
    else el.textContent = val;
  });
  if (document.documentElement) document.documentElement.lang = LANG;
  document.body?.classList.toggle('lang-en', LANG === 'en');
}
function setLang(lang) {
  LANG = lang === 'en' ? 'en' : 'ja';
  try { localStorage.setItem('lang', LANG); } catch (e) {}
  applyI18n();
  $$('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === LANG));
  if (typeof renderFlexTrade === 'function') renderFlexTrade();
  if (typeof renderBankTradeOptions === 'function') renderBankTradeOptions();
  if (typeof updateStartPlayerFields === 'function') updateStartPlayerFields();
  if (typeof state !== 'undefined' && state) render();
}
// Development card display text, shared across the dev-card panel, the "use" button and the sage dialog.
const DEV_CARD_NAMES = { ja: { knight: '騎士', roadBuilding: '街道建設', plenty: '発見', monopoly: '独占', victory: '勝利点' }, en: { knight: 'Knight', roadBuilding: 'Road Building', plenty: 'Year of Plenty', monopoly: 'Monopoly', victory: 'Victory Point' } };
const DEV_CARD_DESC_SHORT = { ja: { knight: '盗賊を移動', roadBuilding: '街道を2本建設', plenty: '好きな資源を2枚', monopoly: '1種類を独占', victory: '非公開の1勝利点' }, en: { knight: 'Move the robber', roadBuilding: 'Build 2 free roads', plenty: '2 resources of your choice', monopoly: 'Monopolize 1 resource', victory: 'A hidden victory point' } };
const DEV_CARD_DESC_LONG = { ja: { knight: '盗賊を移動させ1枚奪う', roadBuilding: '街道を2本無料で建設', plenty: '好きな資源を2枚獲得', monopoly: '1種類を全員から独占', victory: '非公開の1勝利点' }, en: { knight: 'Move the robber and steal a card', roadBuilding: 'Build 2 roads for free', plenty: 'Take 2 resources of your choice', monopoly: 'Take one resource from everyone', victory: 'A hidden victory point' } };
function devCardName(card) { return DEV_CARD_NAMES[LANG][card]; }
function devCardDescShort(card) { return DEV_CARD_DESC_SHORT[LANG][card]; }
function devCardDescLong(card) { return DEV_CARD_DESC_LONG[LANG][card]; }
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
// 各ランクを1段ずつ底上げ（旧easy→新easyは無し、旧normal→新easy、旧hard→新normal、
// 旧expert→新hard、旧master→新expert）。最強(master)はさらに一段上を新設し、手数を増量
// した上で elite フラグ（最長交易路を積極的に狙う・交易がより頻繁かつシビア）を付与。
const DIFFICULTY = {
  easy:   { label: 'やさしい',   actions: 4,  smartRoad: false, bankTrade: true,  devBuy: true,  devChance: .5,  smart: false, elite: false },
  normal: { label: 'ふつう',     actions: 6,  smartRoad: true,  bankTrade: true,  devBuy: true,  devChance: .85, smart: false, elite: false },
  hard:   { label: '強い',       actions: 9,  smartRoad: true,  bankTrade: true,  devBuy: true,  devChance: 1,   smart: true,  elite: false },
  expert: { label: 'もっと強い', actions: 16, smartRoad: true,  bankTrade: true,  devBuy: true,  devChance: 1,   smart: true,  elite: false },
  master: { label: '最強',       actions: 24, smartRoad: true,  bankTrade: true,  devBuy: true,  devChance: 1,   smart: true,  elite: true }
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
  toast(t('cardCancelled'));
}
const $ = selector => document.querySelector(selector);
function currentIsBot() { return !!(state && state.players && state.players[state.turn] && state.players[state.turn].bot); }
function beginHumanTurn(message) {
  // Multi-human (hotseat) shows a "pass the device" screen so hands stay hidden until the right player confirms.
  if (state && state.humanCount > 1 && !currentIsBot()) {
    state.awaitingPass = true;
    render(); // hides the hand bar while the device is being passed
    const player = state.players[state.turn];
    showPassScreen(player.name, message || t('yourTurnCheckHand'), () => {
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
  if ($('#passName')) $('#passName').textContent = t('isThisYou', { name });
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
const BGM_NAMES_EN = ['Battle of Rough Waves', 'Island Raid', 'Stormy Voyage', 'Hour of Reckoning'];
const BGM_TRACKS = [
  { get name() { return LANG === 'en' ? BGM_NAMES_EN[0] : '荒波の戦い'; }, wave: 'sawtooth', tempo: 400, kick: true,
    notes: [329.63, 493.88, 587.33, 493.88, 392, 587.33, 659.25, 493.88, 440, 659.25, 587.33, 440, 392, 493.88, 329.63, 246.94],
    bass: [82.41, 82.41, 110, 98] },
  { get name() { return LANG === 'en' ? BGM_NAMES_EN[1] : '島の襲撃'; }, wave: 'square', tempo: 360, kick: true,
    notes: [440, 523.25, 659.25, 523.25, 587.33, 659.25, 783.99, 659.25, 523.25, 659.25, 587.33, 523.25, 493.88, 440, 392, 440],
    bass: [110, 110, 87.31, 98] },
  { get name() { return LANG === 'en' ? BGM_NAMES_EN[2] : '嵐の航海'; }, wave: 'sawtooth', tempo: 440, kick: true,
    notes: [293.66, 349.23, 440, 587.33, 440, 349.23, 392, 466.16, 587.33, 466.16, 392, 349.23, 293.66, 349.23, 261.63, 293.66],
    bass: [73.42, 73.42, 98, 87.31] },
  { get name() { return LANG === 'en' ? BGM_NAMES_EN[3] : '決戦の刻'; }, wave: 'square', tempo: 380, kick: true,
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
  toast(t('bgmName', { name: BGM_TRACKS[currentTrack].name }));
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
  const humanNames = gameConfig.humanNames || [gameConfig.playerName || t('you')];
  const players = [];
  for (let i = 0; i < total; i++) {
    const bot = i >= humanCount;
    const name = bot ? (npcName(i - humanCount) || `NPC${i - humanCount + 1}`) : ((humanNames[i] || '').trim() || t('playerN', { n: i + 1 }));
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
    gameOver: false, botBusy: false, resolvingSeven: false, rollLog: [], pendingCard: null, awaitingPass: false, rerollUsed: false, gamblerChoices: null,
    islandSettlers: {}, goldPickQueue: [], expansion: gameConfig.expansion || null,
    movedShipThisTurn: false, shipsBuiltThisTurn: [], barbarianStep: 0
  };
  scale = .82;
  buildBoard();
  $('#board').style.transform = `scale(${scale})`;
  render();
  if (currentIsBot()) { toast(t('placingFrom', { name: state.players[state.turn].name })); scheduleBotSetup(); }
  else beginHumanTurn(t('firstSettlementPrompt'));
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
    if (state.resolvingSeven || blockingModalOpen()) return; // a required human choice is pending — never auto-advance past it
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
  Object.assign(PIECE_LIMITS, pieceLimitsFor(gameConfig.boardSize || 'standard', gameConfig.targetScore || 10));
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
  // Merge shared corners by PROXIMITY (not a rounded pixel key). On small-hex boards (大型/巨大)
  // the sqrt(3) y-term makes a shared corner round to a 1px-different key on adjacent tiles,
  // splitting it into two vertices and breaking road/settlement connectivity. Distinct vertices
  // are ~U apart, so merging anything within 0.4·U is safe.
  const vtxTolSq = (U * 0.4) ** 2;
  tiles.forEach((tile, tileIndex) => {
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI / 3 * corner;
      const x = tile.x + U * Math.cos(angle);
      const y = tile.y + U * Math.sin(angle);
      let vertexIndex = vertices.findIndex(v => (v.x - x) ** 2 + (v.y - y) ** 2 < vtxTolSq);
      if (vertexIndex < 0) {
        vertexIndex = vertices.length;
        vertices.push({ x: Math.round(x), y: Math.round(y), tiles: [] });
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
    // 押し出し距離とマーカーの見た目サイズは hex の大きさ(U)に比例させる。固定pxのままだと
    // 小さいhex(大型/巨大盤)で港が相対的に大きく・タイルに近くなり重なって見づらくなる。
    const harborScale = U / 64;
    const harborPush = 42 * harborScale;
    const harborSize = Math.max(30, Math.round(50 * harborScale));
    const cx = midpoint.x + (midpoint.x - 345) / length * harborPush;
    const cy = midpoint.y + (midpoint.y - 325) / length * harborPush;
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
    marker.style.left = `${cx - harborSize / 2}px`;
    marker.style.top = `${cy - harborSize / 2}px`;
    marker.style.width = `${harborSize}px`;
    marker.style.height = `${harborSize}px`;
    marker.style.fontSize = `${Math.max(9, Math.round(11 * harborScale))}px`;
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
  Object.assign(PIECE_LIMITS, pieceLimitsFor('huge', gameConfig.targetScore || 10)); // 大きい盤なので駒も多め
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
  // Proximity merge (same reasoning as the base board): a rounded pixel key splits shared corners
  // on these small hexes, breaking connectivity. Distinct vertices are ~S apart.
  const vtxTolSq = (S * 0.4) ** 2;
  tiles.forEach((tile, tileIndex) => {
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI / 3 * corner;
      const x = tile.x + S * Math.cos(angle);
      const y = tile.y + S * Math.sin(angle);
      let vi = vertices.findIndex(v => (v.x - x) ** 2 + (v.y - y) ** 2 < vtxTolSq);
      if (vi < 0) { vi = vertices.length; vertices.push({ x: Math.round(x), y: Math.round(y), tiles: [] }); }
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
  $('#turnScore').textContent = setup ? t('placingNth', { n: Math.floor(state.setupStep / 4) + 1 }) : (state.gameOver ? `${totalVP(state.turn)} VP` : t('minVp', { n: visibleVP(state.turn) }));
  $('#roundLabel').textContent = setup ? t('setupPhaseLabel') : `ROUND ${state.round}`;
  const botTurnNow = currentIsBot();
  const viewer = state.humanCount === 1 ? 0 : ((botTurnNow || state.awaitingPass) ? null : state.turn);
  $('#playersList').innerHTML = state.players.map((item, i) => {
    const isMe = viewer != null && i === viewer;
    const breakdown = (isMe && !setup) ? vpBreakdown(i) : '';
    const target = state.targetScore;
    // 自分の行は「今の本当の点数（隠し勝利点込み）」を大きく、最低点は小さく。相手は最低点のみ。
    const vpHtml = state.gameOver
      ? `<small>${t('victoryPointsLabel')}</small>${totalVP(i)} / ${target}`
      : (isMe
        ? `<b class="vp-now" title="${t('yourCurrentVpTitle')}">${totalVP(i)}</b><small class="vp-min">${t('minVpShort', { n: visibleVP(i) })} / ${target}</small>`
        : `<small>${t('minPointsLabel')}</small>${visibleVP(i)} / ${target}`);
    const handCount = Object.values(item.resources).reduce((a, b) => a + b, 0);
    const devCount = item.dev.length + item.newDev.length;
    const stats = t('statsLine', { hand: handCount, settlements: countPieces(i, 'settlement'), cities: countPieces(i, 'city'), roads: countPieces(i, 'road'), dev: devCount, knights: item.playedKnights });
    const heroData = item.hero ? HEROES.find(h => h.id === item.hero) : null;
    const badges = [
      state.longestRoadOwner === i ? `<span class="award-badge road-award">🛣 ${t('longestRoadBadge')}</span>` : '',
      state.largestArmyOwner === i ? `<span class="award-badge army-award">⚔ ${t('largestArmyBadge')}</span>` : '',
      heroData ? `<span class="award-badge hero-badge" title="${heroData.desc}">${heroData.icon} ${heroData.name}</span>` : ''
    ].join('');
    return `<div class="player-row ${i === state.turn ? 'active' : ''}"><span class="avatar" style="background:${item.color}">${item.name[0]}</span><span class="player-name"><b>${item.name}${isMe ? ' (YOU)' : ''}${item.bot ? ' <small class="npc-tag">NPC</small>' : ''}</b><small>${stats}</small>${badges ? `<small class="award-row">${badges}</small>` : ''}${breakdown ? `<small class="vp-breakdown">${breakdown}</small>` : ''}</span><span class="vp">${vpHtml}</span></div>`;
  }).join('');
  const me = viewer != null ? state.players[viewer] : null;
  $('#handLabel').textContent = me ? handOfLabel(me.name) : t('npcsTurn');
  $('#resourceGrid').innerHTML = Object.entries(RESOURCES).map(([key, resource]) => `<div class="resource${me ? '' : ' hand-hidden'}"><b>${me ? me.resources[key] : '–'}</b><i>${resource.icon}</i><small>${resource.name}</small></div>`).join('');
  $('#cardCount').textContent = me ? `${Object.values(me.resources).reduce((a, b) => a + b, 0)} CARDS` : '';
  $('#devCount').textContent = t('countCards', { n: me ? me.dev.length + me.newDev.length : 0 });
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
    moveShipBtn.textContent = inMove ? t('cancelShipMove') : t('moveShipBtnLabel');
  }
  const setupSelectionReady = state.setupPart === 'settlement' ? state.pendingSetupVertex != null : state.pendingSetupEdge != null;
  $('#rollBtn').disabled = setup ? botTurnNow || !setupSelectionReady : state.rolled || botTurnNow || !!state.gamblerChoices;
  $('#endTurnBtn').disabled = setup || state.resolvingSeven || (!botTurnNow && !state.rolled);
  $('#endTurnBtn').innerHTML = !setup && botTurnNow ? `${t('advanceNpc')} <b>→</b>` : `${t('endTurn')} <b>→</b>`;
  $('#npcControlBtn').hidden = !botTurnNow || state.gameOver;
  $('#npcControlBtn').textContent = setup ? t('advanceNpcSetup') : t('advanceNpcNow');
  // 強運の博徒の出目選択バー（盤面を覆わないよう下部に表示）
  const gp = $('#gamblerPick');
  if (gp) {
    if (state.gamblerChoices && !setup && !botTurnNow) {
      gp.innerHTML = `<span class="gp-label">🎲 ${t('gamblerPickLabel')}</span>` + state.gamblerChoices.map((pair, i) =>
        `<button class="gp-opt${pair[0] + pair[1] === 7 ? ' gp-seven' : ''}" onclick="chooseGamblerDie(${i})"><span class="gp-dice"><b>${pair[0]}</b><b>${pair[1]}</b></span><small>${t('sumLabel', { n: pair[0] + pair[1] })}</small></button>`).join('');
      gp.style.display = 'flex';
    } else {
      gp.style.display = 'none';
    }
  }
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
    $('#setupGuideTitle').textContent = humanTurn ? (placingSettlement ? t('setupTitleSettlement') : t('setupTitleRoad')) : t('setupTitlePlacing', { name: player.name });
    $('#setupGuideText').textContent = humanTurn ? (placingSettlement ? t('setupTextSettlement') : t('setupTextRoad')) : t('pleaseWait');
    const selected = placingSettlement ? state.pendingSetupVertex != null : state.pendingSetupEdge != null;
    $('#rollBtn').innerHTML = `<span class="dice-icon">${placingSettlement ? '⌂' : '━'}</span><span><small>${selected ? t('selected') : t('step1SelectOnBoard')}</small>${selected ? t('step2Confirm') : (placingSettlement ? t('pickSettlementSpot') : t('pickRoadSpot'))}</span>`;
  } else {
    $('#rollBtn').innerHTML = `<span class="dice-icon">⚄</span><span><small>${t('actionLabel')}</small>${t('rollDiceLabel')}</span>`;
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
  if (!owned.size) return t('noHarborsOwned');
  const generic = owned.has(null) ? `<b>3:1</b> ${t('anyResource')}` : '';
  const specific = [...owned].filter(res => res).map(res => `<b>2:1</b> ${RESOURCES[res].icon}${RESOURCES[res].name}`);
  return t('harborsOwnedPrefix') + [generic, ...specific].filter(Boolean).join(' ／ ');
}

function maritimeRate(player, resource) {
  let rate = 4;
  let ownsHarbor = false;
  Object.entries(state.harbors).forEach(([vertex, type]) => {
    if (state.buildings[vertex]?.player !== player) return;
    ownsHarbor = true;
    if (type === resource) rate = 2;
    else if (type == null) rate = Math.min(rate, 3);
  });
  // 港の主: 港を1つでも持っていれば、その恩恵が全資源に及ぶ（港を持たないうちは無効）
  if (ownsHarbor && state.players[player]?.hero === 'harbormaster') rate = Math.min(rate, 2);
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
  if (settlements) parts.push(t('breakdownSettlements', { n: settlements }));
  if (cities) parts.push(t('breakdownCities', { n: cities }));
  if (state.longestRoadOwner === player) parts.push(t('breakdownLongestRoad'));
  if (state.largestArmyOwner === player) parts.push(t('breakdownLargestArmy'));
  if (p.islandVP) parts.push(t('breakdownIsland', { n: p.islandVP }));
  const secretCards = [...p.dev, ...p.newDev].filter(c => c === 'victory').length;
  if (secretCards) parts.push(t('breakdownVpCards', { n: secretCards }));
  return parts.join(LANG === 'en' ? ', ' : '・');
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
  if (!player) { $('#devCardsList').innerHTML = `<small>${t('npcsTurn')}</small>`; return; }
  const cards = [
    ...player.dev.map((card, index) => ({ card, index, fresh: false })),
    ...player.newDev.map((card, index) => ({ card, index, fresh: true }))
  ];
  $('#devCardsList').innerHTML = cards.length ? cards.map(item => `<div class="dev-card-item ${item.fresh ? 'new' : ''}"><span><b>✦ ${devCardName(item.card)}</b><br>${devCardDescShort(item.card)}${item.fresh ? ` · ${t('fromNextTurn')}` : ''}</span>${item.card === 'victory' ? `<em>${t('automatic')}</em>` : `<button data-dev-card="${item.card}" ${item.fresh || player.devPlayed || currentIsBot() || !state.rolled || state.resolvingSeven ? 'disabled' : ''}>${t('use')}</button>`}</div>`).join('') : `<small>${t('noDevCardsYet')}</small>`;
  $$('[data-dev-card]').forEach(button => button.onclick = () => {
    if (playDevelopment(state.turn, button.dataset.devCard)) toast(t('devCardUsed', { label: devCardName(button.dataset.devCard) }));
  });
}

function placementTip(vertex) {
  const parts = vertices[vertex].tiles.map(tileIndex => {
    const tile = tiles[tileIndex];
    return `${TYPE_DATA[tile.type].icon}${tile.num || t('desertLabel')}`;
  });
  const harbor = Object.prototype.hasOwnProperty.call(state.harbors, vertex) ? ` · ${t('harborLabel')}${state.harbors[vertex] ? `2:1 ${RESOURCES[state.harbors[vertex]].icon}` : '3:1'}` : '';
  return t('expectedValue', { parts: parts.join(' / '), score: Math.round(setupVertexScore(vertex)), harbor });
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
  toast(t('shipBuilt'));
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
  if (state.movedShipThisTurn) return toast(t('shipMoveLimit'));
  const movable = edges.some((_, i) => isMovableShip(i, me));
  if (!movable) return toast(t('noMovableShips'));
  state.mode = 'moveShip';
  state.movingShip = null;
  render();
  toast(t('pickShipToMove'));
}

function pickShipToMove(edgeIndex) {
  const me = state.turn;
  if (!isMovableShip(edgeIndex, me)) return;
  state.movingShip = edgeIndex;
  delete state.ships[edgeIndex];
  render();
  toast(t('pickShipDestination'));
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
  toast(t('shipMoved'));
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
    toast(t('islandDiscovered', { name: state.players[player].name, vp: ISLAND_BONUS_VP }));
  });
}

function placeBuilding(vertex) {
  const me = state.turn;
  if (state.phase === 'setup') {
    if (currentIsBot() || state.setupPart !== 'settlement' || !canPlaceInitialSettlement(vertex)) return;
    state.pendingSetupVertex = vertex;
    toast(t('setupSpotSelected'));
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
    toast(t('settlementBuilt'));
    soundEffect('build');
    updateAwards();
    render();
    checkWin(me);
  } else if (state.mode === 'city' && hasPieceAvailable(me, 'city') && state.buildings[vertex]?.player === me && state.buildings[vertex].type === 'settlement') {
    pay('city', me);
    state.buildings[vertex].type = 'city';
    state.players[me].vp++;
    state.mode = null;
    toast(t('cityBuilt'));
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
    toast(t('setupRoadSelected'));
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
      toast(t('roadBuiltFreeRemaining', { n: state.freeRoads }));
      checkWin(me);
      return;
    }
    state.freeRoads = 0;
    state.mode = null;
    clearCardAction();
    render();
    toast(t('roadBuildingDone'));
    checkWin(me);
    return;
  }
  pay('road', me);
  state.roads[edgeIndex] = me;
  state.mode = null;
  updateAwards();
  toast(t('roadBuilt'));
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
    toast(t('setupComplete'));
    render();
    if (currentIsBot()) scheduleBotTurn(); else beginHumanTurn();
    return;
  }
  state.turn = state.setupOrder[state.setupStep];
  state.botTurnStartedAt = Date.now();
  render();
  if (currentIsBot()) scheduleBotSetup();
  else beginHumanTurn(t('secondSettlementPrompt'));
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
      toast(t('botPlacedSetup', { name: state.players[player].name }));
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
  toast(t('botSetupDone', { name: state.players[player].name }));
  finishSetupTurn();
}

const rollDie = () => 1 + Math.floor(Math.random() * 6);

function rollDice() {
  if (state.phase !== 'play' || state.rolled || currentIsBot()) return;
  if (state.gamblerChoices) return; // 出目を選ぶまでは「ダイスを振る」を再度押しても無視（連打で選択肢が上書きされるのを防ぐ）
  state.recentBotMoves = [];
  // 強運の博徒: ダイスを3回ふって、盤面を見ながら好きな出目を1つ選べる（盤面を覆わない下部バーで選択）。
  if (state.players[state.turn].hero === 'gambler' && !state.rerollUsed) {
    state.gamblerChoices = [0, 1, 2].map(() => [rollDie(), rollDie()]);
    render();
    return;
  }
  finalizeRoll(rollDie(), rollDie());
}

// 博徒が選んだ出目で確定する
function chooseGamblerDie(index) {
  if (!state.gamblerChoices || !state.gamblerChoices[index]) return;
  const [a, b] = state.gamblerChoices[index];
  state.gamblerChoices = null;
  state.rerollUsed = true;
  render();
  finalizeRoll(a, b);
}

function finalizeRoll(a, b) {
  soundEffect('dice');
  distributeRoll(a, b);
  state.rolled = true;
  $('#diceResult').innerHTML = `<span>${a}</span><span>${b}</span>`;
  render();
  showDiceOverlay(a, b, state.players[state.turn].name);
}

// NPC博徒の出目評価: 自分の生産が最大の出目を選ぶ（7は資源ゼロ＝避ける傾向）。
function gamblerRollScore(a, b, player) {
  const sum = a + b;
  if (sum === 7) return 0.4;
  let total = 0;
  Object.entries(state.buildings).forEach(([vertex, building]) => {
    if (building.player !== player) return;
    vertices[vertex].tiles.forEach(tileIndex => {
      const tile = tiles[tileIndex];
      if (tile.num === sum && tileIndex !== state.robberTile && TYPE_DATA[tile.type].res) total += building.type === 'city' ? 2 : 1;
    });
  });
  return total + Math.random() * 0.3;
}

function showDiceOverlay(a, b, playerName) {
  const overlay = $('#offlineDiceOverlay');
  $('#offlineDicePlayer').textContent = diceOfLabel(playerName);
  $('#offlineDiceA').textContent = a;
  $('#offlineDiceB').textContent = b;
  $('#offlineDiceTotal').textContent = t('totalLabel', { n: a + b });
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
    if (vertex == null || !canPlaceInitialSettlement(vertex)) return toast(t('pickWhiteDotFirst'));
    placeInitialSettlement(vertex, state.turn);
    state.setupVertex = vertex;
    state.pendingSetupVertex = null;
    state.setupPart = 'road';
    state.mode = 'setup-road';
    soundEffect('build');
    toast(t('settlementConfirmedPickRoad'));
    render();
    return;
  }
  const edge = state.pendingSetupEdge;
  if (edge == null || state.roads[edge] !== undefined || !edgeTouches(edge, state.setupVertex)) return toast(t('pickWhiteRoadFirst'));
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
      if (tile.num !== sum) return;
      // 不屈の守人は盗賊が乗っても生産が止まらない
      if (tileIndex === state.robberTile && state.players[building.player]?.hero !== 'guardian') return;
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
  toast(gained ? t('rolledGained', { sum, gained }) : t('rolledNoGain', { sum }));
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
    const limit = player.hero === 'general' ? 15 : 7;
    const count = handTotal(player);
    if (count <= limit) return;
    for (let k = 0; k < Math.floor(count / 2); k++) {
      const resource = randomOwnedResource(i);
      if (resource) { player.resources[resource]--; state.bank[resource]++; }
    }
  });
  state.sevenRoller = roller;
  state.discardQueue = state.players.map((p, i) => i).filter(i => !state.players[i].bot && handTotal(state.players[i]) > (state.players[i].hero === 'general' ? 15 : 7));
  state.resolvingSeven = true;
  render();
  processDiscardQueue();
}

function processDiscardQueue() {
  if (state.discardQueue && state.discardQueue.length) {
    const who = state.discardQueue[0];
    const required = Math.floor(handTotal(state.players[who]) / 2);
    if (state.humanCount > 1) showPassScreen(state.players[who].name, t('mustDiscardN', { n: required }), () => showDiscardDialog(who, required));
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
    toast(t('sevenBotMovedRobber', { name: state.players[roller].name }));
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
  $('#modalContent').innerHTML = `<h2>${t('sevenChoiceTitle')}</h2><p>${t('sevenChoiceBody')}</p>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button style="flex:1;padding:12px;border:1px solid var(--line);border-radius:8px;background:white;cursor:pointer;font-size:14px;font-weight:700" id="chooseLandRobber">♟ ${t('robberLand')}</button>
      <button style="flex:1;padding:12px;border:1px solid var(--line);border-radius:8px;background:#e8f4f9;cursor:pointer;font-size:14px;font-weight:700" id="chooseSeaPirate">⛵ ${t('pirateSea')}</button>
    </div>`;
  $('#modal').showModal();
  $('#chooseLandRobber').onclick = () => { $('#modal').close(); $('#modalClose').hidden = false; beginRobberChoice(); };
  $('#chooseSeaPirate').onclick = () => { $('#modal').close(); $('#modalClose').hidden = false; beginPirateChoice(); };
}

function beginPirateChoice() {
  state.mode = 'pirate';
  render();
  toast(t('pickSeaTileForPirate'));
}

function placePirate(tileIndex) {
  if (state.mode !== 'pirate' || tiles[tileIndex].type !== 'sea') return;
  state.pendingPirateTile = tileIndex;
  render();
  toast(t('confirmSeaTile'));
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
  }).filter(p => p != null && p !== state.turn && robbable(p) && randomOwnedResource(p)))];
  if (victims.length === 0) {
    state.resolvingSeven = false;
    render();
    toast(t('pirateMovedNoVictim'));
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
  }).filter(p => p != null && p !== roller && robbable(p) && randomOwnedResource(p)))];
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
  $('#modalContent').innerHTML = `<h2>${t('goldPickTitle', { name: owner.name })}</h2><p>${t('goldPickBody', { n: remaining })}</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">${resHtml}</div>`;
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
  const handTotal = Object.values(owner.resources).reduce((sum, amount) => sum + amount, 0);
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>${t('discardTitle', { name: owner.name, n: required })}</h2><p>${t('discardBody', { n: handTotal })}</p><div class="discard-grid">${Object.entries(RESOURCES).map(([resource, data]) => `<label>${data.icon} ${data.name}<small class="discard-have">${t('countHave', { n: owner.resources[resource] })}</small><input id="discard-${resource}" type="number" min="0" max="${owner.resources[resource]}" value="0"></label>`).join('')}</div><p class="discard-progress" id="discardProgress">${t('discardProgress', { total: 0, n: required })}</p><button class="confirm-discard" id="confirmDiscardBtn">${t('decide')}</button>`;
  $('#modal').showModal();
  const updateProgress = () => {
    const total = Object.keys(RESOURCES).reduce((sum, resource) => sum + Math.max(0, Number($(`#discard-${resource}`).value) || 0), 0);
    $('#discardProgress').textContent = t('discardProgress', { total, n: required });
    $('#discardProgress').classList.toggle('discard-progress-ok', total === required);
  };
  Object.keys(RESOURCES).forEach(resource => { $(`#discard-${resource}`).oninput = updateProgress; });
  $('#confirmDiscardBtn').onclick = () => {
    const amounts = Object.fromEntries(Object.keys(RESOURCES).map(resource => [resource, Math.max(0, Number($(`#discard-${resource}`).value) || 0)]));
    const total = Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
    if (total !== required || Object.entries(amounts).some(([resource, amount]) => amount > owner.resources[resource])) return toast(t('discardPickExact', { n: required }));
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
  toast(t('pickGlowingTile'));
}

function placeRobber(tileIndex) {
  if (state.mode === 'pirate') { placePirate(tileIndex); return; }
  if (state.mode !== 'robber' || tileIndex === state.robberTile) return;
  if (state.expansion === 'seafarers' && tiles[tileIndex]?.type === 'sea') return;
  state.pendingRobberTile = tileIndex;
  render();
  toast(t('confirmTile'));
}

function confirmRobberPlacement() {
  if (state.pendingRobberTile == null) return;
  clearCardAction();
  const tileIndex = state.pendingRobberTile;
  state.robberTile = tileIndex;
  state.pendingRobberTile = null;
  state.mode = null;
  soundEffect('robber');
  const victims = [...new Set(tiles[tileIndex].vertices.map(vertex => state.buildings[vertex]?.player).filter(player => player != null && player !== state.turn && robbable(player) && randomOwnedResource(player)))];
  if (victims.length === 0) {
    state.resolvingSeven = false;
    render();
    toast(t('robberMovedNoVictim'));
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
  let taken = 0;
  for (let k = 0; k < stealCount(state.turn); k++) { // 強欲の徴税官は 2 枚
    const resource = randomOwnedResource(victim);
    if (!resource) break;
    state.players[victim].resources[resource]--;
    state.players[state.turn].resources[resource]++;
    taken++;
  }
  state.resolvingSeven = false;
  render();
  toast(taken ? t('stolenFrom', { name: state.players[victim].name, n: taken }) : t('robberMoved'));
}

function showStealDialog(victims) {
  state.resolvingSeven = true;
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>${t('stealFromWhoTitle')}</h2><p>${t('stealFromWhoBody')}</p><div class="steal-grid">${victims.map(victim => {
    const count = Object.values(state.players[victim].resources).reduce((sum, amount) => sum + amount, 0);
    return `<button class="steal-choice" data-steal="${victim}"><span class="avatar" style="background:${state.players[victim].color}">${state.players[victim].name[0]}</span><b>${state.players[victim].name}</b><small>${t('countCards', { n: count })}</small></button>`;
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

// True while a modal demanding a required human choice is open (proposal, robber-steal, gambler
// reroll, sage/gold/monopoly/plenty picks, 7-discard…). These all hide the modal's close button.
function blockingModalOpen() { const modal = $('#modal'); return !!(modal && modal.open && $('#modalClose')?.hidden); }

// Escape hatch for the player: un-stick a frozen game without losing progress.
// Clears stalled bot timers, resolves a dangling "7" with no pending choice, closes a stuck
// modal, and nudges the current bot to act. If there is no game, just reloads the page.
function recoverGame() {
  if (!state) { location.reload(); return; }
  clearTimeout(botTimer);
  clearTimeout(botWatchdog);
  clearInterval(npcHeartbeat);
  state.botBusy = false;
  // Recovery is a deliberate "I'm stuck" action — bail out of whatever dialog/choice is pending.
  state.resolvingSeven = false;
  state.discardQueue = null;
  state.mode = null;
  state.pendingRobberTile = null;
  state.pendingPirateTile = null;
  state.freeRoads = 0;
  state.goldPickQueue = [];
  state.gamblerChoices = null;
  if ($('#modal')?.open) { try { $('#modal').close(); } catch (e) {} }
  $('#modalClose').hidden = false;
  clearCardAction();
  state.awaitingPass = false;
  const overlay = $('#passScreen');
  if (overlay) { overlay.style.display = 'none'; overlay.classList.add('hidden'); }
  startNpcHeartbeat();
  render();
  if (state.phase === 'setup' && currentIsBot()) forceSetupNpc();
  else if (state.phase === 'play' && currentIsBot()) forceNpcProgress();
  render();
  toast(t('recovered'));
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
  state.rerollUsed = false;
  state.gamblerChoices = null;
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
  else { soundEffect('turn'); beginHumanTurn(yourTurnLabel(state.players[state.turn].name)); }
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
  if (totalCities === 0) { toast(t('barbNoCities')); return; }
  if (totalKnights >= totalCities) {
    const leaderIdx = state.players.map((_, i) => i).reduce((best, i) => totalVP(i) > totalVP(best) ? i : best, 0);
    if (state.devDeck.length) {
      state.players[leaderIdx].newDev.push(state.devDeck.pop());
      toast(t('barbRepelledReward', { name: state.players[leaderIdx].name }));
    } else {
      toast(t('barbRepelled'));
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
    toast(victimCount > 0 ? t('barbDamage') : t('barbNoDamage'));
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
  if (barbInfo) barbInfo.textContent = t('turnsRemaining', { n: BARBARIAN_STEPS - step });
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
    if (version === gameVersion && state.turn === expectedPlayer && !state.gameOver && !state.resolvingSeven && !blockingModalOpen()) {
      state.botBusy = false;
      toast(t('botRecovered', { name: state.players[expectedPlayer].name }));
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
    let a = 1 + Math.floor(Math.random() * 6);
    let b = 1 + Math.floor(Math.random() * 6);
    // 強運の博徒(NPC): 3回ふって自分の生産が最大の出目を選ぶ
    if (state.players[playerIndex].hero === 'gambler' && !state.rerollUsed) {
      state.rerollUsed = true;
      const best = [[a, b], [rollDie(), rollDie()], [rollDie(), rollDie()]]
        .sort((x, y) => gamblerRollScore(y[0], y[1], playerIndex) - gamblerRollScore(x[0], x[1], playerIndex))[0];
      a = best[0]; b = best[1];
    }
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
    toast(t('botEndedActions', { name: state.players[playerIndex].name }));
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
  if (Math.random() > (botRules().elite ? .3 : .6)) return false; // 最強はより頻繁に交渉を持ちかける
  clearTimeout(botWatchdog);
  clearTimeout(botTimer);
  showNpcProposalDialog(player, give, want, onDone);
  return true;
}

function showNpcProposalDialog(player, giveRes, wantRes, onDone) {
  const npc = state.players[player];
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>${t('npcProposalTitle', { name: npc.name })}</h2>
    <p class="trade-summary">${t('npcProposalBody', { name: npc.name, give: `<b>1 ${RESOURCES[giveRes].icon}${RESOURCES[giveRes].name}</b>`, want: `<b>1 ${RESOURCES[wantRes].icon}${RESOURCES[wantRes].name}</b>` })}</p>
    ${handSummaryHtml()}
    <div class="proposal-actions">
      <button class="trade-accept-btn" id="acceptProposalBtn">${t('acceptTrade')}</button>
      <button class="trade-reject-btn" id="rejectProposalBtn">${t('declineTrade')}</button>
    </div>`;
  $('#modal').showModal();
  const finish = (accepted) => {
    $('#modal').close();
    $('#modalClose').hidden = false;
    if (accepted) {
      completeNpcTrade(player, { [wantRes]: 1 }, { [giveRes]: 1 });
      toast(t('tradedWithNpc', { name: npc.name }));
    } else {
      toast(t('rejectedNpcOffer', { name: npc.name }));
    }
    onDone();
  };
  $('#acceptProposalBtn').onclick = () => finish(true);
  $('#rejectProposalBtn').onclick = () => finish(false);
}

function tryBankTrade(player, wanted) {
  if (state.bank[wanted] < 1) return false;
  // 渡す資源は「一番要らない（次の建設で使う予定が薄い）」ものを選ぶ。固定順だと、
  // 次に使いたい資源を気づかず手放してしまうことがあった。
  const donor = Object.keys(RESOURCES)
    .filter(resource => resource !== wanted && state.players[player].resources[resource] >= maritimeRate(player, resource))
    .sort((a, b) => npcResourceNeed(player, a) - npcResourceNeed(player, b))[0];
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
  const settleValue = Math.max(...[edge.a, edge.b].map(vertex => {
    if (state.buildings[vertex]) return 0;
    return canPlaceInitialSettlement(vertex) ? setupVertexScore(vertex) + 3 : 0.5;
  }));
  if (!botRules().elite) return settleValue;
  // 最強(elite)は最長交易路の称号(+2VP)も狙う。この道を置いたら自分の交易路が
  // どれだけ伸びるかを仮置きして測り、伸びが大きい道を優先する。
  const before = longestRoadLength(player);
  state.roads[edgeIndex] = player;
  const after = longestRoadLength(player);
  delete state.roads[edgeIndex];
  let bonus = Math.max(0, after - before) * 2.5;
  // 他の誰かが最長交易路を持っている時、この一手で奪えるなら最優先で狙いにいく
  if (state.longestRoadOwner != null && state.longestRoadOwner !== player && after >= 5) {
    const rivalLen = longestRoadLength(state.longestRoadOwner);
    if (after > rivalLen && before <= rivalLen) bonus += 8;
  }
  return settleValue + bonus;
}

// Seafarers: a settlement spot is worth more on an undiscovered island (bonus VP)
function botVertexValue(vertex, player) {
  // smart系は開幕と同じ評価（資源多様性・港・数字の分散）を使う。それ以外は確率だけの雑な評価のまま。
  let score = botRules().smart ? botSetupScore(vertex, player) : setupVertexScore(vertex);
  // 最強(elite)は「相手にとってもいい場所」を先取りする価値も上乗せする（妨害）
  if (botRules().elite) {
    state.players.forEach((p, idx) => {
      if (idx === player || p.bot) return;
      score += botSetupScore(vertex, idx) * 0.35;
    });
  }
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
      messages.push(t('itemCity'));
      continue;
    }
    const settlements = vertices.map((_, i) => i).filter(vertex => canSettle(vertex, player));
    if (settlements.length && hasPieceAvailable(player, 'settlement') && prepareCost(player, 'settlement')) {
      const vertex = settlements.sort((a, b) => botVertexValue(b, player) - botVertexValue(a, player))[0];
      pay('settlement', player);
      state.buildings[vertex] = { player, type: 'settlement' };
      state.players[player].vp++;
      grantIslandDiscovery(vertex, player);
      state.recentBotMoves.push({ kind: 'building', id: Number(vertex) });
      messages.push(t('itemSettlement'));
      continue;
    }
    const roads = edges.map((_, i) => i).filter(i => state.roads[i] === undefined && !isSeaEdge(i) && roadConnected(i, player));
    if (roads.length && hasPieceAvailable(player, 'road') && prepareCost(player, 'road')) {
      const chosen = rules.smartRoad ? roads.sort((a, b) => roadValue(b, player) - roadValue(a, player))[0] : roads[Math.floor(Math.random() * roads.length)];
      pay('road', player);
      state.roads[chosen] = player;
      state.recentBotMoves.push({ kind: 'road', id: Number(chosen) });
      messages.push(t('itemRoad'));
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
        messages.push(t('itemShip'));
        continue;
      }
    }
    if (rules.devBuy && state.devDeck.length && prepareCost(player, 'development')) {
      buyDevelopment(player);
      messages.push(t('itemDevCard'));
      continue;
    }
    break;
  }
  playBotDevelopment(player);
  updateAwards();
  toast(messages.length ? t('botBuilt', { name: state.players[player].name, items: messages.join(LANG === 'en' ? ', ' : '・') }) : t('botNoAction', { name: state.players[player].name }));
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
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>🔮 ${t('sageDialogTitle')}</h2>
    <p>${t('sageDialogBody')}</p>
    <div style="display:flex;gap:12px;margin-top:16px">
      <button class="sage-pick" data-sage="${card1}" style="flex:1;padding:16px;border:2px solid var(--line);border-radius:12px;background:#fff;cursor:pointer;text-align:left">
        <b style="display:block;margin-bottom:4px">✦ ${devCardName(card1)}</b><small>${devCardDescLong(card1)}</small>
      </button>
      <button class="sage-pick" data-sage="${card2}" style="flex:1;padding:16px;border:2px solid var(--line);border-radius:12px;background:#fff;cursor:pointer;text-align:left">
        <b style="display:block;margin-bottom:4px">✦ ${devCardName(card2)}</b><small>${devCardDescLong(card2)}</small>
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
    toast(t('sageCardChosen', { label: devCardName(kept) }));
    checkWin(player);
  });
}

function handSize(player) { return Object.values(state.players[player].resources).reduce((a, b) => a + b, 0); }

// 最強(elite)専用: このタイルの資源を止めれば、あと1枚で建設できてしまう相手を止められるか
function robberDenialBonus(owner, tileIndex) {
  if (!botRules().elite) return 0;
  const resource = TYPE_DATA[tiles[tileIndex].type].res;
  if (!resource) return 0;
  const res = state.players[owner].resources;
  const oneCardShort = type => {
    if (!hasPieceAvailable(owner, type)) return false;
    const cost = effectiveCost(type, owner);
    if (!(cost[resource] > 0)) return false;
    const missing = Object.entries(cost).reduce((sum, [key, amount]) => sum + Math.max(0, amount - (res[key] || 0)), 0);
    return missing === 1;
  };
  return (oneCardShort('settlement') || oneCardShort('city')) ? 4 : 0;
}

function moveRobberAndSteal(player) {
  const smart = botRules().smart;
  const elite = botRules().elite;
  const target = tiles.map((tile, index) => {
    if (index === state.robberTile || tile.type === 'desert' || tile.type === 'sea') return { index, score: -1 };
    let score = tile.vertices.reduce((sum, vertex) => {
      const building = state.buildings[vertex];
      if (!building || building.player === player) return sum;
      const base = building.type === 'city' ? 3 : 2;
      // Smart bots hit whoever is ahead — leader standing dominates, tile productivity is secondary.
      const lead = smart ? 1 + (elite ? totalVP(building.player) : visibleVP(building.player)) * 0.6 : 1;
      return sum + base * lead + robberDenialBonus(building.player, index);
    }, 0);
    if (smart) score *= 0.75 + pipValue(tile.num) / 8;
    return { index, score: score + Math.random() * (smart ? 0.3 : 1) };
  }).sort((a, b) => b.score - a.score)[0].index;
  state.robberTile = target;
  const victims = [...new Set(tiles[target].vertices.map(vertex => state.buildings[vertex]?.player).filter(owner => owner != null && owner !== player && robbable(owner) && randomOwnedResource(owner)))];
  if (!victims.length) return;
  // Smart bots rob the player holding the most cards (and likely the leader); others pick at random.
  const victim = smart ? victims.sort((a, b) => handSize(b) - handSize(a))[0] : victims[Math.floor(Math.random() * victims.length)];
  for (let k = 0; k < stealCount(player); k++) { // 徴税官のNPCは 2 枚
    const resource = randomOwnedResource(victim);
    if (!resource) break;
    state.players[victim].resources[resource]--;
    state.players[player].resources[resource]++;
  }
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
      toast(t('freeRoadsPrompt'));
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
  $('#modalContent').innerHTML = `<h2>${t('plentyDialogTitle')}</h2><p>${t('plentyDialogBody')}</p>${handSummaryHtml(me)}<div class="discard-grid">${Object.entries(RESOURCES).map(([resource, data]) => `<label>${data.icon} ${data.name}<input id="plenty-${resource}" type="number" min="0" max="2" value="0"></label>`).join('')}</div><button class="confirm-discard" id="confirmPlentyBtn">${t('receive')}</button><button class="cancel-card-link" id="cancelPlentyBtn">↩ ${t('neverMind')}</button>`;
  $('#modal').showModal();
  $('#cancelPlentyBtn').onclick = cancelCardAction;
  $('#confirmPlentyBtn').onclick = () => {
    const amounts = Object.fromEntries(Object.keys(RESOURCES).map(resource => [resource, Math.max(0, Number($(`#plenty-${resource}`).value) || 0)]));
    const total = Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
    if (total !== 2) return toast(t('pickExactlyTwo'));
    if (Object.entries(amounts).some(([resource, amount]) => amount > state.bank[resource])) return toast(t('bankOutOfStock'));
    Object.entries(amounts).forEach(([resource, amount]) => { state.players[me].resources[resource] += amount; state.bank[resource] -= amount; });
    clearCardAction();
    $('#modal').close();
    $('#modalClose').hidden = false;
    updateAwards();
    render();
    toast(t('plentyReceived'));
    checkWin(me);
  };
}

function showMonopolyDialog() {
  const me = state.turn;
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>${t('monopolyDialogTitle')}</h2><p>${t('monopolyDialogBody')}</p>${handSummaryHtml(me)}<div class="monopoly-grid">${Object.entries(RESOURCES).map(([resource, data]) => `<button class="monopoly-choice" data-monopoly="${resource}">${data.icon}<small>${data.name}</small></button>`).join('')}</div><button class="cancel-card-link" id="cancelMonopolyBtn">↩ ${t('neverMind')}</button>`;
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
    toast(t('monopolyCollected', { res: RESOURCES[resource].name, n: taken }));
    checkWin(me);
  });
}

// どのカードを使うと今一番得か採点する（smart系の判断力向上。手札の並び順で決め打ちしない）。
function devCardPriorityScore(player, card) {
  if (card === 'knight') {
    const reaches3 = state.players[player].playedKnights + 1 >= 3;
    const contested = state.largestArmyOwner !== player && reaches3; // 最大騎士力+2点を今取れる/守れる
    return contested ? 9 : 5;
  }
  if (card === 'roadBuilding') {
    const roads = edges.map((_, i) => i).filter(i => state.roads[i] === undefined && !isSeaEdge(i) && roadConnected(i, player));
    return roads.length >= 2 ? 8 : roads.length === 1 ? 4 : 0;
  }
  if (card === 'monopoly') {
    const best = Math.max(...Object.keys(RESOURCES).map(r => state.players.reduce((sum, p, i) => i === player ? sum : sum + p.resources[r], 0)));
    return best >= 3 ? 7 : 2;
  }
  if (card === 'plenty') {
    const missing = Object.keys(RESOURCES).filter(r => npcResourceNeed(player, r) > 0).length;
    return missing >= 2 ? 6 : 3;
  }
  return 1;
}
function playBotDevelopment(player) {
  const playable = state.players[player].dev.filter(item => item !== 'victory');
  if (!playable.length) return;
  const rules = botRules();
  const card = rules.smart ? playable.sort((a, b) => devCardPriorityScore(player, b) - devCardPriorityScore(player, a))[0] : playable[0];
  if (Math.random() < rules.devChance) playDevelopment(player, card);
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
  return parts.length ? parts.join(' ＋ ') : t('none');
}

function handSummaryHtml(player = 0) {
  const owner = state.players[player];
  return `<div class="modal-hand"><span class="modal-hand-label">${handOfLabel(owner.name)}</span><div class="modal-hand-list">${Object.entries(RESOURCES).map(([key, resource]) => `<span class="modal-hand-item${owner.resources[key] ? '' : ' zero'}">${resource.icon}<b>${owner.resources[key]}</b></span>`).join('')}</div></div>`;
}

// 最強(elite)専用: この交換で proposer(人間側)に資源を渡すと、その場で建設して勝ってしまわないか判定
function opponentWinRisk(proposer, extraGive) {
  if (!botRules().elite) return false;
  const player = state.players[proposer];
  if (!player) return false;
  const target = state.targetScore || 10;
  if (totalVP(proposer) + 1 < target) return false; // まだ勝利に近くないなら無関係
  const projected = { ...player.resources };
  Object.keys(RESOURCES).forEach(key => { projected[key] = (projected[key] || 0) + (extraGive[key] || 0); });
  const affordable = type => Object.entries(effectiveCost(type, proposer)).every(([res, amount]) => (projected[res] || 0) >= amount);
  if (hasPieceAvailable(proposer, 'city') && affordable('city') &&
      Object.values(state.buildings).some(b => b.player === proposer && b.type === 'settlement')) return true;
  if (hasPieceAvailable(proposer, 'settlement') && affordable('settlement') &&
      vertices.some((_, v) => canSettle(v, proposer))) return true;
  return false;
}

// give = 人間が渡す（NPCが受け取る） / get = 人間がもらう（NPCが渡す）
function npcTradeDecision(target, give, get, proposer = state.turn) {
  const npc = state.players[target];
  const giveTotal = sumRes(give), getTotal = sumRes(get);
  if (!npc || target === 0 || giveTotal < 1 || getTotal < 1) return { accept: false, score: -Infinity, reason: t('reasonInvalid') };
  const short = Object.keys(RESOURCES).find(key => npc.resources[key] < (get[key] || 0));
  if (short) return { accept: false, score: -Infinity, reason: t('reasonShort', { res: RESOURCES[short].name }) };
  if (opponentWinRisk(proposer, get)) return { accept: false, score: -Infinity, reason: t('reasonWinRisk') };
  let receiveValue = 0, giveValue = 0;
  Object.keys(RESOURCES).forEach(key => {
    if (give[key]) receiveValue += give[key] * (3 / (1 + npc.resources[key]) + npcResourceNeed(target, key));
    if (get[key]) giveValue += get[key] * (3 / (1 + npc.resources[key]) + npcResourceNeed(target, key) * .65);
  });
  const score = receiveValue / Math.max(.1, giveValue);
  const fairQuantity = getTotal <= giveTotal * 1.5;
  // 最強(elite)は自分に有利な交換しか受けない（甘い交換を掴まされない）
  const accept = fairQuantity && score >= (botRules().elite ? 1.05 : .9);
  return { accept, score, reason: accept ? t('reasonFits') : fairQuantity ? t('reasonMismatch') : t('reasonTooMuch') };
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
  if (state.phase !== 'play' || currentIsBot() || !state.rolled) return t('rollBeforeTrade');
  if (!sumRes(trade.give) || !sumRes(trade.get)) return t('pickResourcesEach');
  if (Object.keys(RESOURCES).some(key => trade.give[key] && trade.get[key])) return t('sameResourceTrade');
  const short = Object.keys(RESOURCES).find(key => state.players[state.turn].resources[key] < trade.give[key]);
  if (short) return t('resourceShort', { res: RESOURCES[short].name });
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
  if (!Number.isInteger(target) || !state.players[target] || target === state.turn) return toast(t('noTradeTarget'));
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
  if (!opponents.length) return toast(t('noTradeTarget'));
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
  opponents.forEach(item => select.add(new Option(`${item.player.name}${item.player.bot ? '' : ` (${t('humanTag')})`}`, item.index)));
  if (opponents.some(item => String(item.index) === String(previous))) select.value = previous;
}

// Hand the device to a human target so they can accept or decline the proposal themselves.
function startHumanTradeProposal(target, trade) {
  const proposer = state.turn;
  state.awaitingPass = true; // hide the hand bar during the cross-player handoff
  render();
  if ($('#modal').open) $('#modal').close();
  $('#modalClose').hidden = false;
  showPassScreen(state.players[target].name, t('humanProposalIncoming', { name: state.players[proposer].name }), () => {
    showHumanTradeDecision(proposer, target, trade);
  }, state.players[target].color);
}

function showHumanTradeDecision(proposer, target, trade) {
  const giveText = formatBundle(trade.give); // proposer gives → target receives
  const getText = formatBundle(trade.get);   // proposer wants → target gives
  const canAfford = Object.keys(RESOURCES).every(key => state.players[target].resources[key] >= (trade.get[key] || 0));
  $('#modalClose').hidden = true;
  $('#modalContent').innerHTML = `<h2>${t('humanProposalTitle', { name: state.players[target].name })}</h2>
    <p class="trade-summary">${t('humanProposalBody', { name: state.players[proposer].name, give: `<b>${giveText}</b>`, get: `<b>${getText}</b>` })}</p>
    ${handSummaryHtml(target)}
    <div class="proposal-actions">
      <button class="trade-accept-btn" id="humanAcceptBtn"${canAfford ? '' : ' disabled'}>${canAfford ? t('doTrade') : t('resourceShort2')}</button>
      <button class="trade-reject-btn" id="humanRejectBtn">${t('declineTrade')}</button>
    </div>`;
  $('#modal').showModal();
  const finish = (accepted) => {
    $('#modal').close();
    $('#modalClose').hidden = false;
    const apply = () => {
      const proposerAffords = Object.keys(RESOURCES).every(key => state.players[proposer].resources[key] >= (trade.give[key] || 0));
      if (accepted && proposerAffords) { completeNpcTrade(target, trade.give, trade.get, proposer); checkWin(proposer); }
    };
    handBackToProposer(proposer, accepted ? t('humanTradeSucceeded', { name: state.players[target].name }) : t('humanTradeDeclined', { name: state.players[target].name }), apply);
  };
  $('#humanAcceptBtn').onclick = () => { if (canAfford) finish(true); };
  $('#humanRejectBtn').onclick = () => finish(false);
}

// Return the device to the proposer; reveal their hand only after they confirm.
function handBackToProposer(proposer, message, beforeReveal) {
  showPassScreen(state.players[proposer].name, t('backToYourTurn'), () => {
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
      <span class="trade-result-info"><b>${player.name}</b><small>${t('humanPlayerConfirm')}</small></span>
      <button class="trade-accept-btn" data-human-trade="${target}">${t('handToThem')}</button>
    </div>`;
  }).join('');
  $('#modalContent').innerHTML = `<h2>${t('proposalReplyTitle')}</h2>
    <p class="trade-summary">${t('proposalReplyBody', { give: `<b>${giveText}</b>`, get: `<b>${getText}</b>` })}</p>
    ${handSummaryHtml(human)}
    <div class="trade-results">${decisions.map(item => {
      const player = state.players[item.target];
      return `<div class="trade-result-row ${item.accept ? 'ok' : 'ng'}">
        <span class="avatar" style="background:${player.color}">${player.name[0]}</span>
        <span class="trade-result-info"><b>${player.name}</b><small>${item.accept ? `✓ ${t('okCanTrade')}` : '✗ ' + item.reason}</small></span>
        ${item.accept ? `<button class="trade-accept-btn" data-trade-with="${item.target}">${t('doTrade')}</button>` : `<span class="trade-ng-tag">${t('declined')}</span>`}
      </div>`;
    }).join('')}${humanRows}</div>
    ${(accepted.length || humanTargets.length) ? `<p class="trade-hint-modal">${t('tradeHintModal')}</p>` : `<p class="trade-none">${t('noOneAccepted')}</p>`}`;
  $('#modal').showModal();
  $$('[data-trade-with]').forEach(button => button.onclick = () => {
    const target = Number(button.dataset.tradeWith);
    completeNpcTrade(target, trade.give, trade.get, human);
    $('#modal').close();
    toast(t('tradeSucceeded', { name: state.players[target].name }));
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
    <h2>${winTitleText(name)}</h2>
    <p class="result-sub">${t('winSub', { n: totalVP(player) })}</p>
    <div class="result-table">
      <div class="result-head"><span>${t('rankLabel')}</span><span>${t('playerLabel')}</span><span>${t('victoryPointsLabel')}</span></div>
      ${ranking.map((row, rank) => `<div class="result-row ${row.index === player ? 'winner-row' : ''}">
        <span class="result-rank">${medals[rank]}</span>
        <span class="result-player"><span class="avatar" style="background:${state.players[row.index].color}">${row.name[0]}</span><span class="result-name"><b>${row.name}${row.index === 0 ? ' (YOU)' : ''}</b><small>${t('resultLine', { settlements: row.settlements, cities: row.cities, roads: row.roads, knights: row.knights })}${row.longest ? `${LANG === 'en' ? ', ' : '・'}🛣${t('longestRoadShort')}` : ''}${row.army ? `${LANG === 'en' ? ', ' : '・'}⚔${t('largestArmyShort')}` : ''}</small></span></span>
        <span class="result-vp">${row.vp}</span>
      </div>`).join('')}
    </div>
    <button class="result-again" onclick="document.getElementById('modalClose').hidden=false;modal.close();newGame()">${t('playAgain')}</button>
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
    if (state.phase !== 'play' || currentIsBot() || !state.rolled || !buyDevelopment(state.turn)) return toast(t('cantBuyDev'));
    toast(t('devBought'));
    render();
    checkWin(state.turn);
    return;
  }
  state.mode = button.dataset.build;
  toast(button.dataset.build === 'road' ? t('pickYellowRoad') : t('pickYellowSpot'));
  render();
});
$('#playDevBtn').onclick = () => {
  if (currentIsBot()) return;
  const card = state.players[state.turn].dev.find(item => item !== 'victory');
  if (!card) return toast(t('noPlayableDev'));
  if (playDevelopment(state.turn, card)) toast(t('devCardUsed', { label: devCardName(card) }));
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
  if (hint) hint.textContent = npc > 0 ? t('npcJoining', { n: npc }) : t('allHuman');
}
$$('input[name="humanCount"]').forEach(input => input.addEventListener('change', updateStartPlayerFields));
updateStartPlayerFields();
function seafarersRulesHtml() {
  return `<div class="rules-seafarers">
    <p class="rules-expansion-title">🌊 ${t('rulesSeafarersTitle')}</p>
    <p>${t('rulesSeafarersShip')}</p>
    <p>${t('rulesSeafarersMoveShip')}</p>
    <p>${t('rulesSeafarersGold')}</p>
    <p>${t('rulesSeafarersIsland', { n: ISLAND_BONUS_VP })}</p>
    <p>${t('rulesSeafarersPirate')}</p>
  </div>`;
}
function heroesRulesHtml() {
  const mine = state?.players?.[0]?.hero ? HEROES.find(h => h.id === state.players[0].hero) : null;
  return `<div class="rules-seafarers">
    <p class="rules-expansion-title">✦ ${t('rulesHeroesTitle')}</p>
    <p>${t('rulesHeroesIntro')}</p>
    ${mine ? `<p class="rules-my-hero">${t('rulesHeroesMine', { icon: mine.icon, name: mine.name, desc: mine.desc })}</p>` : ''}
    <ul class="rules-hero-list">
      ${HEROES.map(h => `<li><b>${h.icon} ${h.name}</b>：${h.desc}</li>`).join('')}
    </ul>
    <p><small>${t('rulesHeroesNote')}</small></p>
  </div>`;
}
function barbariansRulesHtml() {
  return `<div class="rules-seafarers">
    <p class="rules-expansion-title">🏴 ${t('rulesBarbariansTitle')}</p>
    <p>${t('rulesBarbariansTiming', { n: BARBARIAN_STEPS })}</p>
    <p>${t('rulesBarbariansJudge')}</p>
    <p>${t('rulesBarbariansWin')}</p>
    <p>${t('rulesBarbariansLose')}</p>
    <p><small>${t('rulesBarbariansNote')}</small></p>
  </div>`;
}
$('#rulesBtn').onclick = () => {
  $('#modalContent').innerHTML = `<h2>${t('howToPlay')}</h2><div class="rules-list">
    <p>${t('rulesGoal')}</p>
    <p>${t('rulesSetup')}</p>
    <p>${t('rulesProduction')}</p>
    <p>${t('rulesBuildCost')}</p>
    <p>${t('rulesDevIntro')}
      <br>${t('rulesDevKnight')}
      <br>${t('rulesDevRoadBuilding')}
      <br>${t('rulesDevPlenty')}
      <br>${t('rulesDevMonopoly')}
      <br>${t('rulesDevVictory')}
      <br>${t('rulesLargestArmy')}</p>
    <p>${t('rulesHarbors')}</p>
    <p>${t('rulesSeven')}</p>
    <p>${t('rulesLongestRoad', { ships: state.expansion === 'seafarers' ? t('rulesLongestRoadShips') : '' })}</p>
    ${state.expansion === 'seafarers' ? seafarersRulesHtml() : ''}
    ${gameConfig.expansionHeroes ? heroesRulesHtml() : ''}
    ${gameConfig.expansionBarbarians ? barbariansRulesHtml() : ''}
    <p>${t('rulesNpcStrength', { sailing: state.expansion === 'seafarers' ? t('rulesNpcSailing') : '' })}</p>
    <p>${t('rulesVpVisibility')}</p>
  </div>`;
  $('#modal').showModal();
};
$('#modalClose').onclick = () => $('#modal').close();

function renderBankTradeOptions() {
  const give = $('#tradeGive'), get = $('#tradeGet');
  const savedGive = give.value, savedGet = get.value;
  give.innerHTML = ''; get.innerHTML = '';
  Object.entries(RESOURCES).forEach(([key, resource]) => {
    give.add(new Option(`${resource.icon} ${resource.name}`, key));
    get.add(new Option(`1 ${resource.icon}`, key));
  });
  if (savedGive) give.value = savedGive;
  get.value = savedGet || Object.keys(RESOURCES)[1];
}
renderBankTradeOptions();
const flexStepper = (side, key) => `<span class="ft-stepper"><button type="button" class="ft-step" data-side="${side}" data-res="${key}" data-delta="-1" aria-label="${t('decrease')}">−</button><b id="flex${side === 'give' ? 'Give' : 'Get'}-${key}">0</b><button type="button" class="ft-step" data-side="${side}" data-res="${key}" data-delta="1" aria-label="${t('increase')}">＋</button></span>`;
function renderFlexTrade() {
  $('#flexTrade').innerHTML = `<div class="flex-trade-head"><span>${t('resourceLabel')}</span><span class="head-give">${t('giveLabel')}</span><span class="head-get">${t('getLabel')}</span></div>` + Object.entries(RESOURCES).map(([key, resource]) => `<div class="flex-trade-row"><span class="ft-res">${resource.icon} ${resource.name}</span>${flexStepper('give', key)}${flexStepper('get', key)}</div>`).join('');
}
renderFlexTrade();
$('#flexTrade').onclick = event => {
  const button = event.target.closest('.ft-step');
  if (!button) return;
  const target = $(`#flex${button.dataset.side === 'give' ? 'Give' : 'Get'}-${button.dataset.res}`);
  if (target) target.textContent = Math.max(0, Math.min(20, Number(target.textContent) + Number(button.dataset.delta)));
};
$('#tradeGet').selectedIndex = 1;
$('#tradeBtn').onclick = () => {
  if (state.phase !== 'play' || currentIsBot() || !state.rolled) return toast(t('rollBeforeTrade'));
  const give = $('#tradeGive').value;
  const get = $('#tradeGet').value;
  const player = state.players[state.turn];
  if (give === get) return toast(t('pickDifferentResource'));
  const rate = maritimeRate(state.turn, give);
  if (player.resources[give] < rate) return toast(t('needNMore', { res: RESOURCES[give].name, rate }));
  if (state.bank[get] < 1) return toast(t('bankOutOfRes', { res: RESOURCES[get].name }));
  player.resources[give] -= rate;
  state.bank[give] += rate;
  player.resources[get]++;
  state.bank[get]--;
  toast(t('bankTraded'));
  soundEffect('trade');
  render();
};
$('#tradeGive').onchange = () => render();
$('#zoomIn').onclick = () => { scale = Math.min(1.25, scale + .1); $('#board').style.transform = `scale(${scale})`; };
$('#zoomOut').onclick = () => { scale = Math.max(.65, scale - .1); $('#board').style.transform = `scale(${scale})`; };
$('#soundBtn').onclick = () => setAudioEnabled(!audioEnabled);
$('#bgmBtn').onclick = cycleBgm;
$$('.lang-btn').forEach(btn => btn.onclick = () => setLang(btn.dataset.lang));
$('#fullscreenBtn').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
};
$('#startGameBtn').onclick = () => {
  const name = $('#playerNameInput').value.trim();
  const humanCount = Math.min(4, Math.max(1, Number($('input[name="humanCount"]:checked')?.value) || 1));
  const humanNames = [name || t('you')];
  for (let i = 2; i <= humanCount; i++) {
    humanNames.push(($(`#humanName${i}`)?.value || '').trim() || t('playerN', { n: i }));
  }
  const expansionCheck = $('#expansionSeafarers');
  const heroesCheck = $('#expansionHeroes');
  const barbsCheck = $('#expansionBarbarians');
  gameConfig = {
    playerName: name || t('you'),
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
  $('#modalContent').innerHTML = `<h2>${t('expansionIntroTitle')}</h2>
    <p style="color:#74817c;font-size:13px;margin:-4px 0 6px">${t('expansionIntroSub')}</p>
    <div class="rules-list">${parts.join('')}</div>`;
  $('#modal').showModal();
}

applyI18n();
$$('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === LANG));
newGame();
