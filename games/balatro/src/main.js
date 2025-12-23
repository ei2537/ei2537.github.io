import * as PIXI from 'pixi.js';
import { AssetLoader } from './AssetLoader.js';
import { CardSprite } from './CardSprite.js';
import { Poker } from './Poker.js';

// --- 初期設定 ---
const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x374244,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
});
document.body.appendChild(app.view);

window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    layoutUI(); // リサイズ時に再配置
});

// レイヤー
const handContainer = new PIXI.Container();
const uiContainer = new PIXI.Container();
app.stage.addChild(handContainer);
app.stage.addChild(uiContainer);

// ゲームデータ
let deck = [];
let handCards = [];

// UI要素
let infoText, scoreText, btnPlay, btnDiscard;

async function init() {
    await AssetLoader.load();
    createUI();
    resetDeck();
    drawCards(8);
}

// --- ゲームロジック ---

function resetDeck() {
    deck = [];
    const suits = ['Hearts', 'Clubs', 'Diamonds', 'Spades'];
    const ranks = ['2','3','4','5','6','7','8','9','10','Jack','Queen','King','Ace'];
    suits.forEach(suit => ranks.forEach(rank => deck.push({ rank, suit })));
    deck.sort(() => Math.random() - 0.5); // シャッフル
}

function drawCards(count) {
    for(let i=0; i<count; i++) {
        if (deck.length === 0) break;
        const data = deck.pop();
        const card = new CardSprite(data.rank, data.suit);
        card.scale.set(2.5);
        
        // カード選択時のイベントリスナー
        card.on('pointerdown', () => {
            updateScorePreview();
        });

        handCards.push(card);
        handContainer.addChild(card);
    }
    layoutHand();
    updateScorePreview();
}

// カードが選ばれたときにスコア計算して表示
function updateScorePreview() {
    const selected = handCards.filter(c => c.selected);
    if (selected.length > 0) {
        const result = Poker.evaluate(selected);
        infoText.text = result.name;
        scoreText.text = result.text;
        
        // ボタンの色を変えて「押せる感」を出す
        btnPlay.alpha = (selected.length <= 5) ? 1.0 : 0.5;
        btnDiscard.alpha = 1.0;
    } else {
        infoText.text = "Select cards";
        scoreText.text = "";
        btnPlay.alpha = 0.5;
        btnDiscard.alpha = 0.5;
    }
}

// プレイ実行
function onPlay() {
    const selected = handCards.filter(c => c.selected);
    if (selected.length === 0 || selected.length > 5) return;

    // TODO: ここでスコア加算などの演出を入れる
    
    // カードを捨てる
    removeSelectedCards();
    drawCards(Math.min(8 - handCards.length, deck.length)); // 手札が8枚になるまで補充
}

// ディスカード実行
function onDiscard() {
    const selected = handCards.filter(c => c.selected);
    if (selected.length === 0 || selected.length > 5) return;

    removeSelectedCards();
    drawCards(Math.min(8 - handCards.length, deck.length));
}

function removeSelectedCards() {
    const keep = [];
    handCards.forEach(c => {
        if (c.selected) {
            handContainer.removeChild(c); // 画面から削除
        } else {
            keep.push(c);
        }
    });
    handCards = keep;
}

// --- レイアウト & UI ---

function createUI() {
    const style = new PIXI.TextStyle({
        fontFamily: 'Arial', fontSize: 36, fill: 0xFFFFFF, fontWeight: 'bold',
        dropShadow: true, dropShadowDistance: 2, align: 'center'
    });

    infoText = new PIXI.Text('Select cards', style);
    infoText.anchor.set(0.5);
    uiContainer.addChild(infoText);

    scoreText = new PIXI.Text('', { ...style, fontSize: 24, fill: 0xFFCC00 });
    scoreText.anchor.set(0.5);
    uiContainer.addChild(scoreText);

    // シンプルなボタン作成関数
    const createBtn = (text, color, onClick) => {
        const cnt = new PIXI.Container();
        const bg = new PIXI.Graphics();
        bg.beginFill(color);
        bg.lineStyle(2, 0xFFFFFF);
        bg.drawRoundedRect(-100, -30, 200, 60, 10);
        bg.endFill();
        
        const txt = new PIXI.Text(text, { fontFamily:'Arial', fontSize:24, fill:0xFFFFFF, fontWeight:'bold' });
        txt.anchor.set(0.5);
        
        cnt.addChild(bg, txt);
        cnt.eventMode = 'static';
        cnt.cursor = 'pointer';
        cnt.on('pointerdown', onClick);
        return cnt;
    };

    btnPlay = createBtn("PLAY HAND", 0xE67E22, onPlay);
    uiContainer.addChild(btnPlay);

    btnDiscard = createBtn("DISCARD", 0xE74C3C, onDiscard);
    uiContainer.addChild(btnDiscard);

    layoutUI();
}

function layoutUI() {
    const cx = app.screen.width / 2;
    const cy = app.screen.height;

    infoText.x = cx;
    infoText.y = 100;
    
    scoreText.x = cx;
    scoreText.y = 150;

    btnPlay.x = cx - 120;
    btnPlay.y = cy - 220;

    btnDiscard.x = cx + 120;
    btnDiscard.y = cy - 220;
    
    layoutHand();
}

function layoutHand() {
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height - 100;
    
    handContainer.x = centerX;
    handContainer.y = centerY;

    handCards.forEach((card, i) => {
        const offset = i - (handCards.length - 1) / 2;
        card.x = offset * 90; 
        card.y = Math.abs(offset) * 5; 
        // 選択中は少し上に表示
        if (card.selected) card.y -= 30;
        
        card.rotation = offset * 0.05;
        card.zIndex = i;
    });
    handContainer.sortableChildren = true;
}

// 既存のCardSpriteで選択状態変更時にレイアウト更新を呼ぶため、CardSpriteも少し修正が必要ならする
// 今回はmain.js側で再レイアウトを呼ぶ形にするため、CardSprite.jsのtoggleSelect後にcallbackできると良いが、
// 簡易的に updateScorePreview 内でレイアウト更新はしていないため、
// 選択時の「浮き」は CardSprite.js 内で完結させるか、layoutHandを毎フレーム呼ぶかにする。
// ここではシンプルに、AssetLoaderなどの既存ファイルはそのままで動くようにしています。
// ※ CardSprite.js の toggleSelect で this.y をいじっているので、layoutHand と競合する可能性があります。
// 　 完全に制御するため、CardSprite.js の toggleSelect は「フラグ変更のみ」にして、
// 　 動きは main.js の layoutHand で管理するのが一番きれいです。

init();