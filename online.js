const ICONS = { wood:'🌲', brick:'🧱', wheat:'🌾', sheep:'🐑', ore:'⛏' };
const RES_NAMES = { wood:'木材', brick:'レンガ', wheat:'小麦', sheep:'羊毛', ore:'鉱石' };
const COLORS_LIST = Object.keys(ICONS);
let session = JSON.parse(localStorage.getItem('islands-online-session') || 'null');
let state = null, source = null, buildMode = null, lastDiceSignature = null, diceOverlayTimer = null;
let pendingRobberTile = null, svgScale = 1, pendingIncomingOffer = null;
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const svgNS = 'http://www.w3.org/2000/svg';

// ===== NETWORK =====
function message(text, error=false){ const el=$('#onlineNotice'); if(el){el.textContent=text;el.style.color=error?'#b44b3b':'#47705c';} }
async function request(url, options={}){
  const response = await fetch(url, {...options, headers: {'content-type':'application/json', ...(session?{authorization:`Bearer ${session.token}`}:{}), ...(options.headers||{})}});
  const data = await response.json();
  if(!response.ok) throw new Error(data.error||'通信に失敗しました');
  return data;
}
function saveSession(value){ session=value; localStorage.setItem('islands-online-session',JSON.stringify(value)); }
function showGame(){ $('#joinScreen').style.display='none'; $('#gameScreen').style.display=''; $('#roomCode').textContent=session.roomCode; connect(); }

async function withPending(btn, label, fn){
  const original=btn.textContent; btn.disabled=true; btn.textContent=label;
  $('#joinError').textContent='サーバーを起こしています…最大30秒ほどお待ちください';
  try{ await fn(); } catch(e){ $('#joinError').textContent=e.message; } finally{ btn.disabled=false; btn.textContent=original; }
}
async function createRoom(){
  await withPending($('#createRoomBtn'),'作成中…',async()=>{
    const result = await request('/api/rooms', {method:'POST', body:JSON.stringify({name:$('#onlineName').value, boardMode:$('#onlineBoard').value, difficulty:$('#onlineDifficulty').value})});
    saveSession(result); showGame();
  });
}
async function joinRoom(rejoin=false){
  const btn = rejoin?$('#rejoinBtn'):$('#joinRoomBtn');
  await withPending(btn,'参加中…',async()=>{
    const code = (rejoin?session.roomCode:$('#roomCodeInput').value).trim().toUpperCase();
    const result = await request(`/api/rooms/${code}/join`, {method:'POST', body:JSON.stringify(rejoin?{rejoinToken:session.token}:{name:$('#onlineName').value})});
    saveSession(result); showGame();
  });
}
function connect(){
  if(source) source.close();
  source = new EventSource(`/api/rooms/${session.roomCode}/events?token=${encodeURIComponent(session.token)}`);
  source.addEventListener('state', event=>{
    state = JSON.parse(event.data);
    $('#connectionStatus').textContent = '● 同期中';
    render();
  });
  source.onerror = ()=>{ $('#connectionStatus').textContent = '再接続中…'; };
}
async function action(type, payload={}){
  try{ await request(`/api/rooms/${session.roomCode}/action`, {method:'POST', body:JSON.stringify({type, payload})}); message(''); }
  catch(e){ message(e.message, true); toast(e.message); }
}

// ===== TOAST =====
let toastTimer = null;
function toast(msg){
  const el=$('#toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2400);
}

// ===== SVG HELPERS =====
function el(name, attrs={}, text=''){
  const node = document.createElementNS(svgNS, name);
  Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v));
  if(text) node.textContent=text;
  return node;
}
function hexPoints(x, y, size=64){ return Array.from({length:6},(_,i)=>{const a=Math.PI/3*i;return`${x+size*Math.cos(a)},${y+size*Math.sin(a)}`}).join(' '); }

// ===== BOARD LOGIC =====
function canInitialSettlement(vertex){
  const g=state.game;
  if(g.buildings[vertex]) return false;
  const adj = g.edges.filter(e=>e.a===vertex||e.b===vertex).map(e=>e.a===vertex?e.b:e.a);
  return !adj.some(v=>g.buildings[v]);
}
function isAvailableVertex(vertex){
  const g=state.game;
  if(g.turn!==state.you) return false;
  if(g.stage==='setup-settlement') return canInitialSettlement(vertex);
  if(buildMode==='city') return g.buildings[vertex]?.player===state.you&&g.buildings[vertex].type==='settlement';
  if(buildMode!=='settlement'||g.buildings[vertex]) return false;
  return canInitialSettlement(vertex)&&g.edges.some(e=>(e.a===vertex||e.b===vertex)&&g.roads[e.id]===state.you);
}
function isAvailableEdge(edge){
  const g=state.game;
  if(g.turn!==state.you||g.roads[edge.id]!=null) return false;
  if(g.stage==='setup-road') return edge.a===g.setupVertex||edge.b===g.setupVertex;
  if(buildMode!=='road'&&!(g.freeRoads>0&&g.stage==='build')) return false;
  return [edge.a,edge.b].some(v=>g.buildings[v]?.player===state.you||g.edges.some(e=>(e.a===v||e.b===v)&&g.roads[e.id]===state.you));
}

// ===== BOARD RENDER =====
function renderBoard(){
  const g=state.game, svg=$('#onlineBoardSvg');
  svg.innerHTML='';
  const TYPE_ICON={forest:'🌲',hills:'🧱',pasture:'🐑',fields:'🌾',mountains:'⛰',desert:'☀'};
  g.tiles.forEach(tile=>{
    svg.append(el('polygon',{points:hexPoints(tile.x,tile.y),class:`tile ${tile.type}`}));
    svg.append(el('text',{x:tile.x,y:tile.y-17,'text-anchor':'middle','font-size':25},TYPE_ICON[tile.type]));
    if(tile.number){
      svg.append(el('circle',{cx:tile.x,cy:tile.y+15,r:18,class:'tile-number'}));
      svg.append(el('text',{x:tile.x,y:tile.y+21,'text-anchor':'middle','font-weight':800,fill:tile.number===6||tile.number===8?'#b44235':'#17372f'},tile.number));
    }
  });
  (g.harborEdges||[]).forEach(({a,b,type})=>{
    const va=g.vertices[a],vb=g.vertices[b];
    const mx=(va.x+vb.x)/2,my=(va.y+vb.y)/2;
    const dx=mx-350,dy=my-330,len=Math.hypot(dx,dy)||1;
    const cx=mx+dx/len*42,cy=my+dy/len*42;
    svg.append(el('line',{x1:va.x,y1:va.y,x2:cx,y2:cy,class:'harbor-link'}));
    svg.append(el('line',{x1:vb.x,y1:vb.y,x2:cx,y2:cy,class:'harbor-link'}));
    svg.append(el('circle',{cx,cy,r:20,class:'harbor-marker'}));
    svg.append(el('text',{x:cx,y:cy-3,'text-anchor':'middle','font-size':type?13:9,class:'harbor-text'},type?ICONS[type]:'3:1'));
    if(type) svg.append(el('text',{x:cx,y:cy+10,'text-anchor':'middle','font-size':8,class:'harbor-text'},'2:1'));
  });
  g.edges.forEach(edge=>{
    const a=g.vertices[edge.a],b=g.vertices[edge.b],owner=g.roads[edge.id];
    if(owner!=null){
      svg.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'road-outline'}));
      svg.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'road',style:`stroke:${state.players[owner].color};stroke-width:11px`}));
    }
    const hit=el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'edge-hit'});
    if(isAvailableEdge(edge)) hit.setAttribute('stroke','#ffd24f');
    hit.onclick=()=>isAvailableEdge(edge)&&action('placeRoad',{edge:edge.id});
    svg.append(hit);
  });
  g.vertices.forEach(vertex=>{
    const building=g.buildings[vertex.id];
    if(building){
      const color=state.players[building.player].color;
      const points=building.type==='city'
        ?`${vertex.x-12},${vertex.y+12} ${vertex.x-12},${vertex.y-5} ${vertex.x},${vertex.y-16} ${vertex.x+7},${vertex.y-8} ${vertex.x+15},${vertex.y-8} ${vertex.x+15},${vertex.y+12}`
        :`${vertex.x-13},${vertex.y+11} ${vertex.x-13},${vertex.y-4} ${vertex.x},${vertex.y-16} ${vertex.x+13},${vertex.y-4} ${vertex.x+13},${vertex.y+11}`;
      const piece=el('polygon',{points,class:'building',style:`fill:${color}`});
      piece.onclick=()=>buildMode==='city'&&action('buildCity',{vertex:vertex.id});
      svg.append(piece);
    } else {
      const avail=isAvailableVertex(vertex.id);
      const node=el('circle',{cx:vertex.x,cy:vertex.y,r:avail?10:5,class:`node ${avail?'available':''}`});
      node.onclick=()=>avail&&action('placeSettlement',{vertex:vertex.id});
      svg.append(node);
    }
  });
  // Robber
  const robber=g.tiles[g.robberTile];
  svg.append(el('circle',{cx:robber.x,cy:robber.y-34,r:13,class:'robber'}));
  // Robber targeting
  if(g.stage==='robber'&&g.turn===state.you){
    g.tiles.forEach(tile=>{
      if(tile.id===g.robberTile) return;
      const isPending = pendingRobberTile===tile.id;
      const p=el('polygon',{points:hexPoints(tile.x,tile.y),class:`robber-target${isPending?' robber-pending':''}`});
      p.onclick=()=>setPendingRobber(tile.id);
      svg.append(p);
    });
  }
}

// ===== TOPBAR (player scores) =====
function renderTopbar(){
  if(!state.game) return;
  const g=state.game;
  const PLAYER_COLORS=['#d04030','#3474b0','#38833a','#c9942e'];
  $('#playersList').innerHTML=state.players.map((p,i)=>`
    <div class="player-row${g.turn===p.id?' active':''}">
      <div class="avatar" style="background:${p.color||PLAYER_COLORS[i]}">${p.name[0]}</div>
      <div class="player-name"><b>${p.name}${p.id===state.you?' 👤':p.isBot?' NPC':''}</b>
        <small>手札${g.cardCounts[p.id]}枚${g.largestArmyOwner===p.id?' ⚔':''} ${g.longestRoadOwner===p.id?' 🛣':''}</small>
      </div>
      <span class="vp">${g.vp[p.id]} <small style="font-size:9px">VP</small></span>
    </div>`).join('');
  $('#roundLabel').textContent=`ROUND ${g.round}`;
}

// ===== HAND BAR =====
function renderHand(){
  if(!state.game) return;
  const h=state.game.hand;
  $('#resourceGrid').innerHTML=Object.entries(ICONS).map(([r,icon])=>
    `<div class="resource"><i>${icon}</i><b>${h[r]||0}</b><small>${RES_NAMES[r]}</small></div>`).join('');
  const total=Object.values(h).reduce((a,b)=>a+b,0);
  $('#cardCount').textContent=`${total} CARDS`;
}

// ===== TURN BANNER =====
function renderTurnBanner(){
  if(!state.game) return;
  const g=state.game, me=g.turn===state.you;
  $('#turnDot').style.background=me?'#4a8c5c':'#b04030';
  $('#turnName').textContent=me?'あなたのターンです':state.players[g.turn].name+'のターン';
  $('#turnScore').textContent=`${g.vp[state.you]} VP`;
}

// ===== TURN INFO (stage text as notice) =====
function renderStageNotice(){
  if(!state.game) return;
  const g=state.game, mine=g.turn===state.you;
  const stages={
    'setup-settlement': mine?'開拓地を置いてください':'相手が開拓地を置いています',
    'setup-road': mine?'街道を置いてください':'相手が街道を置いています',
    'roll': mine?'ダイスを振ってください':'相手のターンです',
    'build': mine?'交換・建設ができます':'相手のターンです',
    'discard':'7！ 手札を捨てています',
    'robber': mine?'盗賊を動かす土地を選んでください':'盗賊を移動中',
    'steal': mine?'奪う相手を選んでください':''
  };
  message(stages[g.stage]||'');
}

// ===== DICE RESULT =====
function renderDice(){
  if(!state.game||!state.game.dice) return;
  const [a,b]=state.game.dice;
  const el=$('#diceResult');
  el.innerHTML=`<span>${a}</span><span>${b}</span>`;
}

// ===== DICE OVERLAY =====
function showDiceOverlay(dice, player){
  const overlay=$('#diceOverlay');
  $('#diceOverlayPlayer').textContent=`${player} のダイス`;
  $('#diceOverlayA').textContent=dice[0];
  $('#diceOverlayB').textContent=dice[1];
  $('#diceOverlayTotal').textContent=`合計 ${dice[0]+dice[1]}`;
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  clearTimeout(diceOverlayTimer);
  diceOverlayTimer=setTimeout(()=>{overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');},1300);
}

// ===== BANK =====
function renderBank(){
  if(!state.game) return;
  const g=state.game, mine=g.turn===state.you&&g.stage==='build';
  const give=$('#bankGive').value||'wood';
  const rate=(g.rates&&g.rates[give])||4;
  $('#bankRate').textContent=`${rate} : 1`;
  $('#bankTradeBtn').disabled=!mine;
  const owned=new Set();
  Object.entries(g.harbors||{}).forEach(([v,t])=>{if(g.buildings[v]?.player===state.you)owned.add(t);});
  $('#bankHarbors').textContent=owned.size?('保有する港: '+[owned.has(null)?'3:1 どれでも':null,...[...owned].filter(t=>t).map(t=>`2:1 ${ICONS[t]}`)].filter(Boolean).join(' / ')):'港なし（すべて4:1）';
}

// ===== DEV CARDS =====
const DEV_NAMES={knight:'騎士',roadBuilding:'街道建設',plenty:'発見',monopoly:'独占',victory:'勝利点'};
const DEV_DESC={knight:'盗賊を動かして1枚奪う',roadBuilding:'無料で街道を2本',plenty:'銀行から2枚もらう',monopoly:'資源1種を独占',victory:'隠し勝利点+1'};
function renderDev(){
  if(!state.game) return;
  const g=state.game, mine=g.turn===state.you&&g.stage==='build';
  const h=g.hand, canBuy=mine&&g.devDeckCount>0&&h.wheat>=1&&h.sheep>=1&&h.ore>=1;
  $('#buyDevBtn').disabled=!canBuy;
  $('#devDeckCount').textContent=`残${g.devDeckCount}`;
  const cards=[...g.dev.map(c=>({c,fresh:false})),...g.newDev.map(c=>({c,fresh:true}))];
  const total=cards.length;
  $('#devCount').textContent=`${total}枚`;
  $('#onlineDevList').innerHTML=cards.length
    ?cards.map(({c,fresh})=>`<div class="dev-item${fresh?' fresh':''}"><span><b>✦ ${DEV_NAMES[c]}</b><small>${DEV_DESC[c]}${fresh?' · 次のターンから':''}</small></span>${c==='victory'?'<em>自動</em>':`<button data-play="${c}" ${(!mine||fresh||g.devPlayed)?'disabled':''}>使う</button>`}</div>`).join('')
    :'<small>発展カードはまだありません</small>';
  $$('#onlineDevList [data-play]').forEach(b=>b.onclick=()=>playDevCard(b.dataset.play));
}
function playDevCard(card){
  if(card==='plenty') return openPlenty();
  if(card==='monopoly') return openMonopoly();
  action('playDev',{card});
}

// ===== DISCARD =====
function renderDiscard(){
  const need=state.game.discardNeeded||0, ov=$('#discardOverlay');
  if(!need){ ov.hidden=true; return; }
  ov.hidden=false;
  if(ov.dataset.for!==`${state.game.round}:${need}`){
    ov.dataset.for=`${state.game.round}:${need}`;
    $('#discardSub').textContent=`合計 ${need} 枚を選んで捨ててください`;
    $('#discardGrid').innerHTML=Object.entries(ICONS).map(([r,icon])=>
      `<label class="discard-cell">${icon}<input type="number" min="0" max="${state.game.hand[r]}" value="0" data-res="${r}"><small>所持 ${state.game.hand[r]}</small></label>`).join('');
  }
  updateDiscardTotal();
}
function updateDiscardTotal(){
  const need=state.game.discardNeeded||0; let t=0;
  $$('#discardGrid input').forEach(i=>t+=Math.max(0,Number(i.value)||0));
  $('#discardConfirmBtn').textContent=`捨てる (${t}/${need})`;
  $('#discardConfirmBtn').disabled=t!==need;
}
function submitDiscard(){
  const resources={};
  $$('#discardGrid input').forEach(i=>resources[i.dataset.res]=Math.max(0,Number(i.value)||0));
  action('discard',{resources}); $('#discardOverlay').dataset.for='';
}

// ===== STEAL =====
function renderSteal(){
  const opts=state.game.stealOptions, ov=$('#stealOverlay');
  if(!opts||!opts.length){ ov.hidden=true; return; }
  ov.hidden=false;
  $('#stealGrid').innerHTML=opts.map(id=>
    `<button data-victim="${id}"><i style="background:${state.players[id].color}"></i>${state.players[id].name}<small>${state.game.cardCounts[id]}枚</small></button>`).join('');
  $$('#stealGrid [data-victim]').forEach(b=>b.onclick=()=>action('steal',{victim:+b.dataset.victim}));
}

// ===== PLENTY / MONOPOLY =====
function openPlenty(){
  const ov=$('#plentyOverlay'); ov.hidden=false;
  $('#plentyGrid').innerHTML=Object.entries(ICONS).map(([r,icon])=>
    `<label class="discard-cell">${icon}<input type="number" min="0" max="2" value="0" data-res="${r}"></label>`).join('');
  updatePlentyTotal();
}
function updatePlentyTotal(){
  let t=0; $$('#plentyGrid input').forEach(i=>t+=Math.max(0,Number(i.value)||0));
  $('#plentyConfirmBtn').textContent=`受け取る (${t}/2)`;
  $('#plentyConfirmBtn').disabled=t!==2;
}
function submitPlenty(){
  const resources={};
  $$('#plentyGrid input').forEach(i=>resources[i.dataset.res]=Math.max(0,Number(i.value)||0));
  $('#plentyOverlay').hidden=true; action('playDev',{card:'plenty',resources});
}
function openMonopoly(){
  const ov=$('#monopolyOverlay'); ov.hidden=false;
  $('#monopolyGrid').innerHTML=Object.entries(ICONS).map(([r,icon])=>
    `<button data-res="${r}">${icon} ${RES_NAMES[r]}</button>`).join('');
  $$('#monopolyGrid [data-res]').forEach(b=>b.onclick=()=>{ ov.hidden=true; action('playDev',{card:'monopoly',resource:b.dataset.res}); });
}

// ===== INCOMING TRADE =====
function renderIncomingTrade(){
  const offers=state.game.offers||[];
  const incoming=offers.find(o=>o.to===state.you);
  if(!incoming){ $('#incomingTradeOverlay').hidden=true; pendingIncomingOffer=null; return; }
  if(pendingIncomingOffer===incoming.id) return; // already showing
  pendingIncomingOffer=incoming.id;
  const from=state.players[incoming.from]?.name||'?';
  $('#incomingTradeText').innerHTML=
    `<b>${from}</b> からの提案：<br>
    ${incoming.giveAmount}${ICONS[incoming.give]} あなたにあげる<br>
    ${incoming.getAmount}${ICONS[incoming.get]} あなたからほしい`;
  $('#incomingTradeOverlay').hidden=false;
  $('#incomingTradeAccept').onclick=()=>{ $('#incomingTradeOverlay').hidden=true; pendingIncomingOffer=null; action('respondTrade',{offerId:incoming.id,accept:true}); };
  $('#incomingTradeReject').onclick=()=>{ $('#incomingTradeOverlay').hidden=true; pendingIncomingOffer=null; action('respondTrade',{offerId:incoming.id,accept:false}); };
}

// ===== FLEX TRADE =====
function setupFlexTrade(){
  const flexStepper=(side,key)=>`<span class="ft-stepper"><button type="button" class="ft-step" data-side="${side}" data-res="${key}" data-delta="-1">−</button><b id="flex${side==='give'?'Give':'Get'}-${key}">0</b><button type="button" class="ft-step" data-side="${side}" data-res="${key}" data-delta="1">＋</button></span>`;
  $('#flexTrade').innerHTML=`<div class="flex-trade-head"><span>資源</span><span class="head-give">渡す</span><span class="head-get">もらう</span></div>`+Object.entries(ICONS).map(([k,icon])=>`<div class="flex-trade-row"><span class="ft-res">${icon} ${RES_NAMES[k]}</span>${flexStepper('give',k)}${flexStepper('get',k)}</div>`).join('');
  $('#flexTrade').onclick=ev=>{
    const btn=ev.target.closest('.ft-step'); if(!btn) return;
    const tgt=$(`#flex${btn.dataset.side==='give'?'Give':'Get'}-${btn.dataset.res}`);
    if(tgt) tgt.textContent=Math.max(0,Math.min(20,Number(tgt.textContent)+Number(btn.dataset.delta)));
  };
}
function getFlexOffer(){
  const give={}, get={};
  COLORS_LIST.forEach(r=>{give[r]=Number($(`#flexGive-${r}`)?.textContent||0); get[r]=Number($(`#flexGet-${r}`)?.textContent||0);});
  return {give,get};
}
function buildTradePayload(){
  const {give,get}=getFlexOffer();
  const giveRes=Object.entries(give).find(([,v])=>v>0);
  const getRes=Object.entries(get).find(([,v])=>v>0);
  if(!giveRes) return toast('渡す資源を選んでください'), null;
  if(!getRes) return toast('もらう資源を選んでください'), null;
  return {give:giveRes[0], giveAmount:giveRes[1], get:getRes[0], getAmount:getRes[1]};
}

// ===== ROBBER CONFIRM =====
function setPendingRobber(tileId){
  pendingRobberTile=tileId;
  $('#robberConfirmOverlay').style.display='flex';
  renderBoard(); // re-render to show glow on pending tile
}
function confirmRobber(){
  $('#robberConfirmOverlay').style.display='none';
  action('moveRobber',{tile:pendingRobberTile});
  pendingRobberTile=null;
}
function cancelRobber(){
  $('#robberConfirmOverlay').style.display='none';
  pendingRobberTile=null;
  renderBoard();
}

// ===== LOBBY =====
function renderLobby(){
  const isHost=state.host===state.you;
  const lobbyPanel=$('#lobbyPanel');
  if(state.phase==='lobby'){
    lobbyPanel.hidden=false;
    $('#lobbyStatus').textContent=`${state.players.length}/4`;
    $('#onlinePlayers').innerHTML=state.players.map(p=>`<div class="player-row"><div class="avatar" style="background:${p.color}">${p.name[0]}</div><div class="player-name"><b>${p.name}${p.id===state.you?' 👤':p.isBot?' NPC':''}</b></div></div>`).join('');
    $('#addBotBtn').hidden=!isHost||state.players.length>=4;
    $('#startOnlineBtn').hidden=!isHost;
    $('#startOnlineBtn').textContent=state.players.length<2?'NPCを追加して開始':'ゲーム開始';
    $('#lobbyHint').textContent=isHost
      ?`NPCを追加してから「ゲーム開始」を押してください。`
      :'ホストがゲームを開始するまでお待ちください。';
    $('#onlineBoardSvg').innerHTML='';
  } else {
    lobbyPanel.hidden=true;
  }
}

// ===== BUILD MODE =====
function renderBuildButtons(){
  if(!state.game) return;
  const g=state.game, mine=g.turn===state.you&&g.stage==='build';
  ['road','settlement','city'].forEach(mode=>{
    const btn=$(`#${mode}ModeBtn`);
    btn.disabled=!mine;
    btn.classList.toggle('selected', buildMode===mode);
  });
  $('#buyDevBtn').disabled=!state.game||(()=>{ const g=state.game,mine=g.turn===state.you&&g.stage==='build',h=g.hand; return !(mine&&g.devDeckCount>0&&h.wheat>=1&&h.sheep>=1&&h.ore>=1); })();
}

// ===== MAIN RENDER =====
function render(){
  renderLobby();
  if(state.phase==='lobby') return;

  const g=state.game;
  renderTopbar();
  renderHand();
  renderTurnBanner();
  renderDice();
  renderBoard();
  renderBank();
  renderDev();
  renderBuildButtons();
  renderDiscard();
  renderSteal();
  renderIncomingTrade();
  renderStageNotice();

  // Action bar state
  const mine=g.turn===state.you;
  $('#rollOnlineBtn').disabled=!mine||g.stage!=='roll';
  $('#endOnlineBtn').disabled=!mine||g.stage!=='build';

  // Dice signature → overlay
  const sig=g.dice?`${g.round}:${g.turn}:${g.dice.join('-')}`:null;
  if(sig&&sig!==lastDiceSignature) showDiceOverlay(g.dice,state.players[g.turn].name);
  lastDiceSignature=sig;

  // Free roads hint
  if(g.freeRoads>0&&mine) message('無料で街道を置けます（盤面の黄色い線をクリック）');

  // Winner
  if(g.winner!=null) toast(`🎉 ${state.players[g.winner].name}の勝利！`);
}

// ===== ZOOM =====
function applyZoom(){
  const svg=$('#onlineBoardSvg');
  svg.style.width=`${Math.round(700*svgScale)}px`;
  svg.style.height=`${Math.round(660*svgScale)}px`;
}

// ===== EVENT WIRING =====
// Lobby
$('#createRoomBtn').onclick=createRoom;
$('#joinRoomBtn').onclick=()=>joinRoom(false);
$('#rejoinBtn').onclick=()=>joinRoom(true);
$('#startOnlineBtn').onclick=async()=>{
  try{ await request(`/api/rooms/${session.roomCode}/start`,{method:'POST',body:JSON.stringify({fillBots:state.players.length<2})}); }
  catch(e){ message(e.message,true); }
};
$('#addBotBtn').onclick=async()=>{
  try{ await request(`/api/rooms/${session.roomCode}/addbot`,{method:'POST'}); message(''); }
  catch(e){ message(e.message,true); }
};

// Game actions
$('#rollOnlineBtn').onclick=()=>action('roll');
$('#endOnlineBtn').onclick=()=>action('endTurn');

// Build modes
['road','settlement','city'].forEach(mode=>{
  $(`#${mode}ModeBtn`).onclick=()=>{
    buildMode=buildMode===mode?null:mode;
    $$('.build-card').forEach(b=>b.classList.remove('selected'));
    if(buildMode) $(`#${mode}ModeBtn`).classList.add('selected');
    renderBoard();
  };
});

// Buy dev card
$('#buyDevBtn').onclick=()=>action('buyDev');

// Dev card play button
$('#playDevBtn').onclick=()=>{
  const list=$('#onlineDevList'); list.style.display=list.style.display==='none'?'':'none';
};

// Player trade
setupFlexTrade();
$('#offerOnlineTrade').onclick=()=>{
  const pl=buildTradePayload(); if(!pl) return;
  action('offerTrade',{to:+$('#tradeTo').value,...pl});
};
$('#offerAllTrade').onclick=()=>{
  const pl=buildTradePayload(); if(!pl) return;
  action('offerAll',pl);
};

// Bank trade
Object.entries(ICONS).forEach(([key,icon])=>{
  $('#bankGive').add(new Option(`${icon} ${RES_NAMES[key]}`,key));
  $('#bankGet').add(new Option(`${icon} ${RES_NAMES[key]}`,key));
});
$('#bankGet').selectedIndex=1;
$('#bankGive').onchange=renderBank;
$('#bankTradeBtn').onclick=()=>action('bankTrade',{give:$('#bankGive').value,get:$('#bankGet').value});

// Plenty / Monopoly
$('#plentyGrid').oninput=updatePlentyTotal;
$('#plentyConfirmBtn').onclick=submitPlenty;
$('#plentyCancelBtn').onclick=()=>$('#plentyOverlay').hidden=true;
$('#monopolyCancelBtn').onclick=()=>$('#monopolyOverlay').hidden=true;

// Discard
$('#discardGrid').oninput=updateDiscardTotal;
$('#discardConfirmBtn').onclick=submitDiscard;

// Robber confirm
$('#robberConfirmBtn').onclick=confirmRobber;
$('#robberCancelBtn').onclick=cancelRobber;

// Zoom
$('#onlineZoomIn').onclick=()=>{ svgScale=Math.min(1.5,+(svgScale+0.1).toFixed(1)); applyZoom(); };
$('#onlineZoomOut').onclick=()=>{ svgScale=Math.max(0.6,+(svgScale-0.1).toFixed(1)); applyZoom(); };

// Invite
async function copyInvite(){
  const link=`${location.origin}/online.html?room=${session.roomCode}`;
  const btn=$('#copyRoomBtn');
  try{
    await navigator.clipboard.writeText(link);
    const orig=btn.textContent; btn.textContent='✓ コピーしました';
    btn.style.background='#4a8c5c'; btn.style.color='white';
    setTimeout(()=>{ btn.textContent=orig; btn.style.background=''; btn.style.color=''; },2000);
  } catch{ prompt('このリンクを友達に送ってください',link); }
}
$('#copyRoomBtn').onclick=copyInvite;

// Init
if(session){ $('#rejoinBtn').hidden=false; $('#rejoinBtn').textContent=`${session.roomCode}へ再参加`; }
const invitedRoom=new URLSearchParams(location.search).get('room');
if(invitedRoom){
  const code=invitedRoom.trim().toUpperCase().slice(0,5);
  $('#roomCodeInput').value=code;
  $('#joinHint').textContent=`ルーム ${code} に参加します。名前を入れて「チームに参加」を押してください。`;
  $('#onlineName').focus();
}
