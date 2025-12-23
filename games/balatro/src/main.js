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
    layoutUI();
});

// レイヤー
const gameContainer = new PIXI.Container();
const uiContainer = new PIXI.Container();
app.stage.addChild(gameContainer);
app.stage.addChild(uiContainer);

// --- ゲームステート ---
const STATE = {
    deck: [],
    handCards: [],
    score: 0,           // 現在のラウンドスコア
    targetScore: 300,   // 目標スコア (Small Blind)
    hands: 4,           // 残りハンド数
    discards: 3,        // 残りディスカード数
    ante: 1,            // 現在のアンティ
    dollars: 4,         // 所持金
    round: 1            // ラウンド数
};

// --- UI要素 ---
let infoText, scoreText, btnPlay, btnDiscard;
let hudTexts = {}; // HUDのテキスト群

async function init() {
    await AssetLoader.load();
    createHUD(); // 左側のステータス表示を作成
    createGameUI(); // ボタンなど
    startRound();
}

// --- ゲーム進行ロジック ---

function startRound() {
    STATE.score = 0;
    STATE.hands = 4;
    STATE.discards = 3;
    STATE.handCards = [];
    // 簡易的な目標スコア上昇ロジック
    STATE.targetScore = 300 * STATE.ante * STATE.round; 
    
    updateHUD();
    resetDeck();
    drawCards(8);
}

function resetDeck() {
    STATE.deck = [];
    const suits = ['Hearts', 'Clubs', 'Diamonds', 'Spades'];
    const ranks = ['2','3','4','5','6','7','8','9','10','Jack','Queen','King','Ace'];
    suits.forEach(suit => ranks.forEach(rank => STATE.deck.push({ rank, suit })));
    STATE.deck.sort(() => Math.random() - 0.5);
}

function drawCards(count) {
    for(let i=0; i<count; i++) {
        if (STATE.deck.length === 0) break;
        const data = STATE.deck.pop();
        const card = new CardSprite(data.rank, data.suit);
        card.scale.set(2.5);
        
        card.on('pointerdown', () => {
            card.toggleSelect();
            updateScorePreview();
            layoutHand();
        });

        STATE.handCards.push(card);
        gameContainer.addChild(card);
    }
    layoutHand();
    updateScorePreview();
}

function updateScorePreview() {
    const selected = STATE.handCards.filter(c => c.selected);
    if (selected.length > 0) {
        const result = Poker.evaluate(selected);
        infoText.text = result.name;
        scoreText.text = result.text; // "30 x 4 = 120"
        
        // ボタン制御
        const canPlay = selected.length <= 5 && STATE.hands > 0;
        const canDiscard = selected.length <= 5 && STATE.discards > 0;
        
        btnPlay.alpha = canPlay ? 1.0 : 0.5;
        btnPlay.eventMode = canPlay ? 'static' : 'none';
        
        btnDiscard.alpha = canDiscard ? 1.0 : 0.5;
        btnDiscard.eventMode = canDiscard ? 'static' : 'none';

    } else {
        infoText.text = "Select cards";
        scoreText.text = "";
        btnPlay.alpha = 0.5; btnPlay.eventMode = 'none';
        btnDiscard.alpha = 0.5; btnDiscard.eventMode = 'none';
    }
}

// プレイ実行
function onPlay() {
    const selected = STATE.handCards.filter(c => c.selected);
    if (selected.length === 0 || STATE.hands <= 0) return;

    // スコア計算
    const result = Poker.evaluate(selected);
    const earnedScore = result.score;
    
    // スコア加算アニメーション（簡易）
    STATE.score += earnedScore;
    STATE.hands--;
    updateHUD();

    // 勝利判定
    if (STATE.score >= STATE.targetScore) {
        infoText.text = "BLIND DEFEATED!";
        infoText.style.fill = 0xF1C40F; // Gold
        setTimeout(() => {
            nextRound();
        }, 2000);
    } else if (STATE.hands === 0) {
        infoText.text = "GAME OVER";
        infoText.style.fill = 0xE74C3C; // Red
        // 本来はここでリスタート処理など
    } else {
        infoText.text = `Scored: ${earnedScore}`;
    }

    // カード処理
    removeSelectedCards();
    drawCards(Math.min(8 - STATE.handCards.length, STATE.deck.length));
}

// 次のラウンドへ
function nextRound() {
    // 盤面クリア
    STATE.handCards.forEach(c => gameContainer.removeChild(c));
    STATE.handCards = [];
    
    STATE.round++;
    if (STATE.round > 3) {
        STATE.round = 1;
        STATE.ante++;
    }
    
    infoText.text = `Round ${STATE.round} / Ante ${STATE.ante}`;
    infoText.style.fill = 0xFFFFFF;
    startRound();
}

// ディスカード実行
function onDiscard() {
    const selected = STATE.handCards.filter(c => c.selected);
    if (selected.length === 0 || STATE.discards <= 0) return;

    STATE.discards--;
    updateHUD();

    infoText.text = "Discarded";
    removeSelectedCards();
    drawCards(Math.min(8 - STATE.handCards.length, STATE.deck.length));
}

function removeSelectedCards() {
    const keep = [];
    STATE.handCards.forEach(c => {
        if (c.selected) {
            gameContainer.removeChild(c);
        } else {
            keep.push(c);
        }
    });
    STATE.handCards = keep;
}

// --- UI構築 ---

function createHUD() {
    // 左サイドバーの背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0x2C3E50);
    bg.drawRect(0, 0, 250, window.innerHeight);
    bg.endFill();
    uiContainer.addChild(bg);

    const style = new PIXI.TextStyle({
        fontFamily: 'Arial', fontSize: 24, fill: 0xFFFFFF, fontWeight: 'bold'
    });
    const labelStyle = new PIXI.TextStyle({
        fontFamily: 'Arial', fontSize: 18, fill: 0x95A5A6
    });

    let y = 30;
    const addStat = (label, key, color = 0xFFFFFF) => {
        const lbl = new PIXI.Text(label, labelStyle);
        lbl.x = 20; lbl.y = y;
        uiContainer.addChild(lbl);
        
        const val = new PIXI.Text("0", { ...style, fill: color });
        val.x = 20; val.y = y + 25;
        uiContainer.addChild(val);
        hudTexts[key] = val;
        
        y += 70;
    };

    addStat("SCORE / TARGET", "score", 0xFFFFFF); // 特別扱い
    y += 10;
    addStat("HANDS", "hands", 0x3498DB); // Blue
    addStat("DISCARDS", "discards", 0xE74C3C); // Red
    addStat("MONEY", "dollars", 0xF1C40F); // Gold
    addStat("ANTE", "ante", 0xE67E22); // Orange
    addStat("ROUND", "round", 0xE67E22); 
}

function updateHUD() {
    hudTexts.score.text = `${STATE.score} / ${STATE.targetScore}`;
    hudTexts.hands.text = STATE.hands;
    hudTexts.discards.text = STATE.discards;
    hudTexts.dollars.text = `$${STATE.dollars}`;
    hudTexts.ante.text = STATE.ante;
    hudTexts.round.text = STATE.round;
}

function createGameUI() {
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

    // ボタン作成関数
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
    const cx = app.screen.width / 2 + 125; // 左サイドバー(250px)分ずらす
    const cy = app.screen.height;

    if(infoText) {
        infoText.x = cx;
        infoText.y = 100;
        scoreText.x = cx;
        scoreText.y = 150;
        
        btnPlay.x = cx - 120;
        btnPlay.y = cy - 250;
        
        btnDiscard.x = cx + 120;
        btnDiscard.y = cy - 250;
    }
    
    layoutHand();
}

function layoutHand() {
    const centerX = app.screen.width / 2 + 125;
    const centerY = app.screen.height - 100;
    
    gameContainer.x = centerX;
    gameContainer.y = centerY;

    STATE.handCards.forEach((card, i) => {
        const offset = i - (STATE.handCards.length - 1) / 2;
        card.x = offset * 90; 
        let targetY = Math.abs(offset) * 10; 
        if (card.selected) targetY -= 40; 
        
        card.y = targetY;
        card.rotation = offset * 0.05;
        card.zIndex = i;
    });
    gameContainer.sortableChildren = true;
}

init();