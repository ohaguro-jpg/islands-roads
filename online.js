const ICONS={wood:'🌲',brick:'🧱',wheat:'🌾',sheep:'🐑',ore:'⛏'};
const TYPE_ICON={forest:'🌲',hills:'🧱',pasture:'🐑',fields:'🌾',mountains:'⛰',desert:'☀'};
let session=JSON.parse(localStorage.getItem('islands-online-session')||'null');
let state=null,source=null,buildMode=null,lastDiceSignature=null,diceOverlayTimer=null;
const $=selector=>document.querySelector(selector);
const svgNS='http://www.w3.org/2000/svg';

function message(text,error=false){$('#onlineNotice').textContent=text;$('#onlineNotice').style.color=error?'#b44b3b':'#47705c'}
async function request(url,options={}){
  const response=await fetch(url,{...options,headers:{'content-type':'application/json',...(session?{authorization:`Bearer ${session.token}`}:{}),...(options.headers||{})}});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'通信に失敗しました');return data;
}
function saveSession(value){session=value;localStorage.setItem('islands-online-session',JSON.stringify(value));}
function showGame(){$('#joinScreen').hidden=true;$('#gameScreen').hidden=false;$('#roomCode').textContent=session.roomCode;connect();}

async function withPending(btn,label,fn){const original=btn.textContent;btn.disabled=true;btn.textContent=label;$('#joinError').textContent='サーバーを起こしています…最大30秒ほどお待ちください';try{await fn()}catch(e){$('#joinError').textContent=e.message}finally{btn.disabled=false;btn.textContent=original}}
async function createRoom(){await withPending($('#createRoomBtn'),'作成中…',async()=>{const result=await request('/api/rooms',{method:'POST',body:JSON.stringify({name:$('#onlineName').value,boardMode:$('#onlineBoard').value})});saveSession(result);showGame()})}
async function joinRoom(rejoin=false){const btn=rejoin?$('#rejoinBtn'):$('#joinRoomBtn');await withPending(btn,'参加中…',async()=>{const code=(rejoin?session.roomCode:$('#roomCodeInput').value).trim().toUpperCase();const result=await request(`/api/rooms/${code}/join`,{method:'POST',body:JSON.stringify(rejoin?{rejoinToken:session.token}:{name:$('#onlineName').value})});saveSession(result);showGame()})}
function connect(){if(source)source.close();source=new EventSource(`/api/rooms/${session.roomCode}/events?token=${encodeURIComponent(session.token)}`);source.addEventListener('state',event=>{state=JSON.parse(event.data);$('#connectionStatus').textContent='● 同期中';render()});source.onerror=()=>{$('#connectionStatus').textContent='再接続中…'};}
async function action(type,payload={}){try{await request(`/api/rooms/${session.roomCode}/action`,{method:'POST',body:JSON.stringify({type,payload})});message('')}catch(e){message(e.message,true)}}

function el(name,attrs={},text=''){const node=document.createElementNS(svgNS,name);Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));if(text)node.textContent=text;return node}
function hexPoints(x,y,size=64){return Array.from({length:6},(_,i)=>{const a=Math.PI/3*i;return `${x+size*Math.cos(a)},${y+size*Math.sin(a)}`}).join(' ')}
function canInitialSettlement(vertex){const g=state.game;if(g.buildings[vertex])return false;const adjacent=g.edges.filter(e=>e.a===vertex||e.b===vertex).map(e=>e.a===vertex?e.b:e.a);return !adjacent.some(v=>g.buildings[v])}
function isAvailableVertex(vertex){const g=state.game;if(g.turn!==state.you)return false;if(g.stage==='setup-settlement')return canInitialSettlement(vertex);if(buildMode==='city')return g.buildings[vertex]?.player===state.you&&g.buildings[vertex].type==='settlement';if(buildMode!=='settlement'||g.buildings[vertex])return false;return canInitialSettlement(vertex)&&g.edges.some(e=>(e.a===vertex||e.b===vertex)&&g.roads[e.id]===state.you)}
function isAvailableEdge(edge){const g=state.game;if(g.turn!==state.you||g.roads[edge.id]!=null)return false;if(g.stage==='setup-road')return edge.a===g.setupVertex||edge.b===g.setupVertex;if(buildMode!=='road'&&!(g.freeRoads>0&&g.stage==='build'))return false;return [edge.a,edge.b].some(v=>g.buildings[v]?.player===state.you||g.edges.some(e=>(e.a===v||e.b===v)&&g.roads[e.id]===state.you))}

function renderBoard(){const g=state.game,svg=$('#onlineBoardSvg');svg.innerHTML='';
  g.tiles.forEach(tile=>{svg.append(el('polygon',{points:hexPoints(tile.x,tile.y),class:`tile ${tile.type}`}));svg.append(el('text',{x:tile.x,y:tile.y-17,'text-anchor':'middle','font-size':25},TYPE_ICON[tile.type]));if(tile.number){svg.append(el('circle',{cx:tile.x,cy:tile.y+15,r:18,class:'tile-number'}));svg.append(el('text',{x:tile.x,y:tile.y+21,'text-anchor':'middle','font-weight':800,fill:tile.number===6||tile.number===8?'#b44235':'#17372f'},tile.number))}});
  // 港マーカー：辺ごとに1つ（9個）、中点から外側にオフセット
  (g.harborEdges||[]).forEach(({a,b,type})=>{
    const va=g.vertices[a],vb=g.vertices[b];
    const mx=(va.x+vb.x)/2,my=(va.y+vb.y)/2;
    const dx=mx-350,dy=my-330,len=Math.hypot(dx,dy)||1;
    const cx=mx+dx/len*42,cy=my+dy/len*42;
    svg.append(el('line',{x1:va.x,y1:va.y,x2:cx,y2:cy,class:'harbor-link'}));
    svg.append(el('line',{x1:vb.x,y1:vb.y,x2:cx,y2:cy,class:'harbor-link'}));
    svg.append(el('circle',{cx,cy,r:20,class:'harbor-marker'}));
    svg.append(el('text',{x:cx,y:cy-3,'text-anchor':'middle','font-size':type?13:9,class:'harbor-text'},type?ICONS[type]:'3:1'));
    if(type)svg.append(el('text',{x:cx,y:cy+10,'text-anchor':'middle','font-size':8,class:'harbor-text'},'2:1'));
  });
  g.edges.forEach(edge=>{const a=g.vertices[edge.a],b=g.vertices[edge.b],owner=g.roads[edge.id];if(owner!=null){svg.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'road-outline'}));svg.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'road',style:`stroke:${state.players[owner].color};stroke-width:11px`}))}const hit=el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'edge-hit'});if(isAvailableEdge(edge))hit.setAttribute('stroke','#ffd24f');hit.onclick=()=>isAvailableEdge(edge)&&action('placeRoad',{edge:edge.id});svg.append(hit)});
  g.vertices.forEach(vertex=>{const building=g.buildings[vertex.id];if(building){const color=state.players[building.player].color;const points=building.type==='city'?`${vertex.x-12},${vertex.y+12} ${vertex.x-12},${vertex.y-5} ${vertex.x},${vertex.y-16} ${vertex.x+7},${vertex.y-8} ${vertex.x+15},${vertex.y-8} ${vertex.x+15},${vertex.y+12}`:`${vertex.x-13},${vertex.y+11} ${vertex.x-13},${vertex.y-4} ${vertex.x},${vertex.y-16} ${vertex.x+13},${vertex.y-4} ${vertex.x+13},${vertex.y+11}`;const piece=el('polygon',{points,class:'building',style:`fill:${color}`});piece.onclick=()=>buildMode==='city'&&action('buildCity',{vertex:vertex.id});svg.append(piece)}else{const avail=isAvailableVertex(vertex.id);const node=el('circle',{cx:vertex.x,cy:vertex.y,r:avail?10:5,class:`node ${avail?'available':''}`});node.onclick=()=>avail&&action('placeSettlement',{vertex:vertex.id});svg.append(node)}});
  const robber=g.tiles[g.robberTile];svg.append(el('circle',{cx:robber.x,cy:robber.y-34,r:13,class:'robber'}));
  if(g.stage==='robber'&&g.turn===state.you){g.tiles.forEach(tile=>{if(tile.id===g.robberTile)return;const p=el('polygon',{points:hexPoints(tile.x,tile.y),class:'robber-target'});p.onclick=()=>action('moveRobber',{tile:tile.id});svg.append(p)})}
}

function renderPlayers(){const g=state.game;$('#onlinePlayers').innerHTML=state.players.map(p=>`<div class="online-player ${g&&g.turn===p.id?'active':''}"><i style="background:${p.color}"></i><span>${p.name}${p.id===state.you?' (あなた)':''}${p.isBot?' NPC':''}${g&&g.largestArmyOwner===p.id?' <b class="army-badge">⚔</b>':''}${g&&g.longestRoadOwner===p.id?' <b class="road-badge">🛣</b>':''}<small>${g?`手札${g.cardCounts[p.id]} · 騎士${g.playedKnights[p.id]}${g.devCounts[p.id]?` · 発展${g.devCounts[p.id]}`:''}`:p.connected?' 参加中':' 切断'}</small></span><b>${g?g.vp[p.id]:''} VP</b></div>`).join('');$('#tradeTo').innerHTML=state.players.filter(p=>p.id!==state.you).map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
const DEV_NAMES={knight:'騎士',roadBuilding:'街道建設',plenty:'発見',monopoly:'独占',victory:'勝利点'};
const DEV_DESC={knight:'盗賊を動かして1枚奪う',roadBuilding:'無料で街道を2本',plenty:'銀行から2枚もらう',monopoly:'資源1種を独占',victory:'隠し勝利点+1'};
function renderDev(){if(!state.game)return;const g=state.game,mine=g.turn===state.you&&g.stage==='build';const h=g.hand,canBuy=mine&&g.devDeckCount>0&&h.wheat>=1&&h.sheep>=1&&h.ore>=1;$('#buyDevBtn').disabled=!canBuy;$('#devDeckCount').textContent=`残り${g.devDeckCount}`;
  const cards=[...g.dev.map(c=>({c,fresh:false})),...g.newDev.map(c=>({c,fresh:true}))];
  $('#onlineDevList').innerHTML=cards.length?cards.map(({c,fresh})=>`<div class="dev-item ${fresh?'fresh':''}"><span><b>✦ ${DEV_NAMES[c]}</b><small>${DEV_DESC[c]}${fresh?' · 次のターンから':''}</small></span>${c==='victory'?'<em>自動</em>':`<button data-play="${c}" ${(!mine||fresh||g.devPlayed)?'disabled':''}>使う</button>`}</div>`).join(''):'<small class="lobby-hint">発展カードはまだありません</small>';
  document.querySelectorAll('#onlineDevList [data-play]').forEach(b=>b.onclick=()=>playDevCard(b.dataset.play))}
function playDevCard(card){if(card==='plenty')return openPlenty();if(card==='monopoly')return openMonopoly();action('playDev',{card})}
function openPlenty(){const ov=$('#plentyOverlay');ov.hidden=false;$('#plentyGrid').innerHTML=Object.entries(ICONS).map(([r,icon])=>`<label class="discard-cell">${icon}<input type="number" min="0" max="2" value="0" data-res="${r}"></label>`).join('');updatePlentyTotal()}
function updatePlentyTotal(){let t=0;document.querySelectorAll('#plentyGrid input').forEach(i=>t+=Math.max(0,Number(i.value)||0));$('#plentyConfirmBtn').textContent=`受け取る (${t}/2)`;$('#plentyConfirmBtn').disabled=t!==2}
function submitPlenty(){const resources={};document.querySelectorAll('#plentyGrid input').forEach(i=>resources[i.dataset.res]=Math.max(0,Number(i.value)||0));$('#plentyOverlay').hidden=true;action('playDev',{card:'plenty',resources})}
function openMonopoly(){const ov=$('#monopolyOverlay');ov.hidden=false;$('#monopolyGrid').innerHTML=Object.entries(ICONS).map(([r,icon])=>`<button data-res="${r}">${icon} ${r}</button>`).join('');document.querySelectorAll('#monopolyGrid [data-res]').forEach(b=>b.onclick=()=>{ov.hidden=true;action('playDev',{card:'monopoly',resource:b.dataset.res})})}
function renderHand(){if(!state.game)return;$('#onlineHand').innerHTML=Object.entries(ICONS).map(([r,icon])=>`<div class="online-card">${icon}<b>${state.game.hand[r]}</b></div>`).join('')}
function renderOffers(){if(!state.game)return;$('#tradeOffers').innerHTML=state.game.offers.map(o=>{const incoming=o.to===state.you;return `<div class="offer">${state.players[o.from].name}: ${o.giveAmount}${ICONS[o.give]} ⇄ ${o.getAmount}${ICONS[o.get]}${incoming?`<br><button data-offer="${o.id}" data-accept="1">承認</button><button data-offer="${o.id}">拒否</button>`:''}</div>`}).join('');document.querySelectorAll('[data-offer]').forEach(btn=>btn.onclick=()=>action('respondTrade',{offerId:btn.dataset.offer,accept:btn.dataset.accept==='1'}))}
function showDiceOverlay(dice,player){const overlay=$('#diceOverlay');$('#diceOverlayPlayer').textContent=`${player} のダイス`;$('#diceOverlayA').textContent=dice[0];$('#diceOverlayB').textContent=dice[1];$('#diceOverlayTotal').textContent=`合計 ${dice[0]+dice[1]}`;overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');clearTimeout(diceOverlayTimer);diceOverlayTimer=setTimeout(()=>{overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true')},1250)}

function render(){
  renderPlayers();
  if(state.phase==='lobby'){
    $('#turnInfo').textContent=`参加者 ${state.players.length}/4`;
    const isHost=state.host===state.you;
    $('#addBotBtn').hidden=!isHost||state.players.length>=4;
    $('#startOnlineBtn').hidden=!isHost;
    $('#startOnlineBtn').textContent=state.players.length<2?'NPCを追加して開始':'ゲーム開始';
    const hostName=state.players[0]?.name||'ホスト';
    $('#lobbyHint').textContent=isHost
      ?`NPCを追加してから「ゲーム開始」を押してください。${hostName}が最初に配置します。`
      :'ホストがゲームを開始するまでお待ちください。';
    $('#onlineBoardSvg').innerHTML='';
    return;
  }
  $('#addBotBtn').hidden=true;
  $('#startOnlineBtn').hidden=true;
  $('#lobbyHint').textContent='';
  const g=state.game;
  renderBoard();renderHand();renderOffers();
  const mine=g.turn===state.you;
  const stages={'setup-settlement':'開拓地を置いてください','setup-road':'街道を置いてください',roll:'ダイスを振ってください',build:'交換・建設ができます',discard:'7! 手札を捨てています',robber:'盗賊を動かす土地を選んでください',steal:'奪う相手を選んでください'};
  $('#turnInfo').textContent=`${state.players[g.turn].name}のターン · ${stages[g.stage]}`;
  $('#onlineDice').textContent=g.dice?g.dice.join(' + '):'—';
  const diceSignature=g.dice?`${g.round}:${g.turn}:${g.dice.join('-')}`:null;
  if(diceSignature&&diceSignature!==lastDiceSignature)showDiceOverlay(g.dice,state.players[g.turn].name);
  lastDiceSignature=diceSignature;
  $('#rollOnlineBtn').disabled=!mine||g.stage!=='roll';
  $('#endOnlineBtn').disabled=!mine||g.stage!=='build';
  ['road','settlement','city'].forEach(mode=>$(`#${mode}ModeBtn`).disabled=!mine||g.stage!=='build');
  renderDiscard();renderSteal();renderBank();renderDev();
  if(g.freeRoads>0&&mine)message('無料で街道を置けます（盤面の黄色い線をクリック）');
  if(g.winner!=null)message(`${state.players[g.winner].name}の勝利！`);
}

function renderBank(){if(!state.game)return;const g=state.game,mine=g.turn===state.you&&g.stage==='build';const give=$('#bankGive').value||'wood';$('#bankRate').textContent=`${(g.rates&&g.rates[give])||4}:1`;$('#bankTradeBtn').disabled=!mine;const owned=new Set();Object.entries(g.harbors||{}).forEach(([v,t])=>{if(g.buildings[v]?.player===state.you)owned.add(t)});$('#bankHarbors').textContent=owned.size?('保有する港: '+[owned.has(null)?'3:1 どれでも':null,...[...owned].filter(t=>t).map(t=>`2:1 ${ICONS[t]}`)].filter(Boolean).join(' / ')):'港なし（すべて4:1）'}
function renderDiscard(){const need=state.game.discardNeeded||0,ov=$('#discardOverlay');if(!need){ov.hidden=true;return}ov.hidden=false;if(ov.dataset.for!=`${state.game.round}:${need}`){ov.dataset.for=`${state.game.round}:${need}`;$('#discardSub').textContent=`合計 ${need} 枚を選んで捨ててください`;$('#discardGrid').innerHTML=Object.entries(ICONS).map(([r,icon])=>`<label class="discard-cell">${icon}<input type="number" min="0" max="${state.game.hand[r]}" value="0" data-res="${r}"><small>所持 ${state.game.hand[r]}</small></label>`).join('');}updateDiscardTotal()}
function updateDiscardTotal(){const need=state.game.discardNeeded||0;let total=0;document.querySelectorAll('#discardGrid input').forEach(i=>total+=Math.max(0,Number(i.value)||0));$('#discardConfirmBtn').textContent=`捨てる (${total}/${need})`;$('#discardConfirmBtn').disabled=total!==need}
function submitDiscard(){const resources={};document.querySelectorAll('#discardGrid input').forEach(i=>resources[i.dataset.res]=Math.max(0,Number(i.value)||0));action('discard',{resources});$('#discardOverlay').dataset.for='';}
function renderSteal(){const opts=state.game.stealOptions,ov=$('#stealOverlay');if(!opts||!opts.length){ov.hidden=true;return}ov.hidden=false;$('#stealGrid').innerHTML=opts.map(id=>`<button data-victim="${id}"><i style="background:${state.players[id].color}"></i>${state.players[id].name}<small>${state.game.cardCounts[id]}枚</small></button>`).join('');document.querySelectorAll('#stealGrid [data-victim]').forEach(b=>b.onclick=()=>action('steal',{victim:+b.dataset.victim}))}

Object.entries(ICONS).forEach(([key,icon])=>{$('#onlineGive').add(new Option(icon,key));$('#onlineGet').add(new Option(icon,key));$('#bankGive').add(new Option(icon,key));$('#bankGet').add(new Option(icon,key))});$('#onlineGet').selectedIndex=1;$('#bankGet').selectedIndex=1;
$('#bankGive').onchange=renderBank;$('#bankTradeBtn').onclick=()=>action('bankTrade',{give:$('#bankGive').value,get:$('#bankGet').value});
$('#buyDevBtn').onclick=()=>action('buyDev');
$('#plentyGrid').oninput=updatePlentyTotal;$('#plentyConfirmBtn').onclick=submitPlenty;$('#plentyCancelBtn').onclick=()=>$('#plentyOverlay').hidden=true;$('#monopolyCancelBtn').onclick=()=>$('#monopolyOverlay').hidden=true;
$('#createRoomBtn').onclick=createRoom;$('#joinRoomBtn').onclick=()=>joinRoom(false);$('#rejoinBtn').onclick=()=>joinRoom(true);
$('#startOnlineBtn').onclick=async()=>{const fillBots=state.players.length<2;try{await request(`/api/rooms/${session.roomCode}/start`,{method:'POST',body:JSON.stringify({fillBots})})}catch(e){message(e.message,true)}};
$('#addBotBtn').onclick=async()=>{try{await request(`/api/rooms/${session.roomCode}/addbot`,{method:'POST'});message('')}catch(e){message(e.message,true)}};
$('#rollOnlineBtn').onclick=()=>action('roll');$('#endOnlineBtn').onclick=()=>action('endTurn');
['road','settlement','city'].forEach(mode=>$(`#${mode}ModeBtn`).onclick=()=>{buildMode=buildMode===mode?null:mode;document.querySelectorAll('.actions button').forEach(b=>b.classList.remove('selected'));if(buildMode)$(`#${mode}ModeBtn`).classList.add('selected');renderBoard()});
$('#offerOnlineTrade').onclick=()=>action('offerTrade',{to:+$('#tradeTo').value,give:$('#onlineGive').value,giveAmount:+$('#onlineGiveAmount').value,get:$('#onlineGet').value,getAmount:+$('#onlineGetAmount').value});
$('#discardGrid').oninput=updateDiscardTotal;$('#discardConfirmBtn').onclick=submitDiscard;

async function copyInvite(){
  const link=`${location.origin}/online.html?room=${session.roomCode}`;
  const btn=$('#copyRoomBtn');
  try{
    await navigator.clipboard.writeText(link);
    const orig=btn.textContent;
    btn.textContent='✓ コピーしました';
    btn.style.background='#4a8c5c';btn.style.color='white';
    setTimeout(()=>{btn.textContent=orig;btn.style.background='';btn.style.color=''},2000);
  }catch{prompt('このリンクを友達に送ってください',link)}
}
$('#copyRoomBtn').onclick=copyInvite;

if(session){$('#rejoinBtn').hidden=false;$('#rejoinBtn').textContent=`${session.roomCode}へ再参加`}
const invitedRoom=new URLSearchParams(location.search).get('room');
if(invitedRoom){const code=invitedRoom.trim().toUpperCase().slice(0,5);$('#roomCodeInput').value=code;$('#joinHint').textContent=`ルーム ${code} に参加します。名前を入れて「チームに参加」を押してください。`;$('#onlineName').focus()}
