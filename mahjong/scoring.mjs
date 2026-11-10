import {Shoupai,rule,hule,hule_param} from './vendor/majiang.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const integer=(n,min=0,max=1000000)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export const WINDS=['東','南','西','北'];
export function tileName(tile) {
  if(!tile)return '未選択';
  if(tile[0]==='z')return ['','東','南','西','北','白','發','中'][+tile[1]];
  return `${tile[1]==='0'?'赤5':tile[1]}${{m:'萬',p:'筒',s:'索'}[tile[0]]}`;
}
export function validTile(tile){return typeof tile==='string'&&/^(?:[mps][0-9]|z[1-7])$/.test(tile);}
const normalized=t=>t[0]+(+t[1]||5);
const relative=(from,winner)=>['','+','=','-'][(from-winner+4)%4];
export function scoreWin(game,input) {
  const winner=Number(input.winner),from=Number(input.from);
  check(integer(winner,0,3),'和了した人を選んでください。');
  check(['ron','tsumo'].includes(input.method),'ロン・ツモを選んでください。');
  if(input.method==='ron')check(integer(from,0,3)&&from!==winner,'放銃した人を選んでください。');
  if(input.mode!=='tiles')return directScore(game,{...input,winner,from});
  const hand=input.hand||[],melds=input.melds||[],dora=input.dora||[],ura=input.ura||[];
  check(Array.isArray(hand)&&Array.isArray(melds)&&melds.length<=4,'手牌と副露を確認してください。');
  check(hand.length===13-melds.length*3,`和了牌を除いた手牌は${13-melds.length*3}枚にしてください。`);
  check(validTile(input.win),'和了牌を1枚選んでください。');
  const lizhi=Number(input.lizhi||0);
  check(integer(lizhi,0,2),'リーチの設定を確認してください。');
  const open=melds.some(m=>m.type!=='ankan');
  check(!(lizhi&&open),'副露した手ではリーチできません（暗槓は除く）。');
  check(!game.riichi[winner]||lizhi>0,'リーチ登録済みです。リーチありで計算してください。');
  check(dora.length>=1&&dora.length<=5,'ドラ表示牌を1〜5枚入力してください。');
  check(!lizhi||ura.length===dora.length,'リーチ時はドラ表示牌と同じ枚数の裏ドラ表示牌を入力してください。');
  const all=[...hand,input.win,...melds.flatMap(m=>m.tiles||[]),...dora,...(lizhi?ura:[])];
  check(all.every(validTile),'牌の種類を確認してください。');
  const counts={},reds={m:0,p:0,s:0};
  for(const tile of all){const key=normalized(tile);counts[key]=(counts[key]||0)+1;check(counts[key]<=4,`${tileName(tile)}が5枚以上あります。手牌・副露・表示牌を確認してください。`);if(tile[1]==='0')reds[tile[0]]++;}
  check(Object.values(reds).every(n=>n<=1),'赤5は各色1枚までです。');
  check(game.config.aka||Object.values(reds).every(n=>n===0),'赤ドラなし設定です。通常の5を使ってください。');
  const fulou=melds.map(m=>{
    const tiles=m.tiles||[],values=tiles.map(t=>+t[1]||5).sort((a,b)=>a-b);
    check(['chi','pon','kan','ankan'].includes(m.type),'副露の種類を確認してください。');
    check(tiles.length===(m.type==='chi'||m.type==='pon'?3:4),'副露の枚数が合いません。');
    check(tiles.every(t=>t[0]===tiles[0][0]),'同じ色の牌で副露してください。');
    if(m.type==='chi')check(tiles[0][0]!=='z'&&values[1]===values[0]+1&&values[2]===values[0]+2&&m.from===(winner+3)%4,'チーは上家からの連続する3枚です。');
    else check(new Set(values).size===1,'ポン・カンは同じ牌で作ってください。');
    if(m.type!=='ankan')check(integer(m.from,0,3)&&m.from!==winner,'副露を鳴いた相手を選んでください。');
    const raw=tiles[0][0]+tiles.map(t=>t[1]).join('')+(m.type==='ankan'?'':relative(m.from,winner));
    const canonical=Shoupai.valid_mianzi(raw);check(canonical,'副露の組み合わせを確認してください。');return canonical;
  });
  const special=input.special||'none';
  check(['none','last','rinshan','chankan','first'].includes(special),'和了の状況を確認してください。');
  check(!input.ippatsu||lizhi>0,'一発にはリーチが必要です。');
  if(special==='rinshan')check(input.method==='tsumo'&&melds.some(m=>['kan','ankan'].includes(m.type)),'嶺上開花はカンの後のツモです。');
  if(special==='chankan')check(input.method==='ron','槍槓はロンで指定してください。');
  if(special==='first')check(input.method==='tsumo'&&!melds.length&&!lizhi,'天和・地和は副露・リーチなしの最初のツモです。');
  check(!(input.ippatsu&&['rinshan','chankan','first'].includes(special)),'その特殊状況と一発は同時に成立しません。');
  const shoupai=new Shoupai(hand);shoupai._fulou=fulou;
  if(input.method==='tsumo')shoupai.zimo(input.win);
  const menfeng=(winner-game.dealer+4)%4;
  const params=hule_param({
    rule:rule({'クイタンあり':game.config.kuitan,'切り上げ満貫あり':game.config.kiriage,'数え役満あり':game.config.kazoe,'ダブル役満あり':game.config.doubleYakuman}),
    zhuangfeng:Math.floor(game.round/4)%4,menfeng,lizhi,yifa:!!input.ippatsu,
    lingshang:special==='rinshan',qianggang:special==='chankan',haidi:special==='last'?(input.method==='tsumo'?1:2):0,
    tianhu:special==='first'?(menfeng===0?1:2):0,baopai:dora,fubaopai:lizhi?ura:null,changbang:game.honba,lizhibang:0
  });
  const result=hule(shoupai,input.method==='ron'?input.win+relative(from,winner):null,params);
  check(result&&result.defen>0&&result.hupai?.length,'和了形と役を確認してください。ドラだけでは和了れません。');
  return {winner,from,method:input.method,mode:'tiles',base:result.defen,fu:result.fu||null,han:result.fanshu||null,yakuman:result.damanguan||0,
    yaku:result.hupai.map(h=>({name:h.name,han:h.fanshu})),delta:game.players.map((_,id)=>result.fenpei[(id-game.dealer+4)%4]),
    declare:lizhi>0&&!game.riichi[winner]};
}
function directScore(game,input) {
  const delta=[0,0,0,0];let base=0;
  const payment=n=>{n=Number(n);check(integer(n,100,1000000)&&n%100===0,'支払点は100点単位の正の整数にしてください。');return n;};
  if(input.method==='ron') {base=payment(input.ron);delta[input.from]-=base+game.honba*300;delta[input.winner]+=base+game.honba*300;}
  else for(let id=0;id<4;id++)if(id!==input.winner){const amount=payment(id===game.dealer&&input.winner!==game.dealer?input.parent:input.child);base+=amount;delta[id]-=amount+game.honba*100;delta[input.winner]+=amount+game.honba*100;}
  return {winner:input.winner,from:input.from,method:input.method,mode:'points',base,delta,yaku:[],declare:false};
}
