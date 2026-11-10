export const WINDS=['東','南','西','北'];
export const countOf=game=>game.players.length;
export const windIndex=(game,id)=>(id-game.dealer+countOf(game))%countOf(game);
export const roundText=(round,count)=>`${WINDS[Math.floor(round/count)%4]}${round%count+1}局`;
export const honbaRon=game=>game.config.honbaValue||300;
export const honbaEach=game=>honbaRon(game)===1000?500:100;
export const wallSettings=game=>countOf(game)===3?{stacks:18,dead:game.config.nuki!==false?9:7,rinshan:game.config.nuki!==false?4:2}:{stacks:17,dead:7,rinshan:2};
