import * as PIXI from 'pixi.js';
import { AssetLoader } from './AssetLoader.js';
import { CardSprite } from './CardSprite.js';
import { JokerSprite } from './objects/JokerSprite.js';
import { Button } from './objects/Button.js';
import { Poker } from './Poker.js';
import { initPCards, initPCenters, initHandStats, initJokers } from './definitions.js';
import { G, C } from './globals.js';
import { Event, EventManager } from './engine/EventManager.js';

// --- Init PixiJS ---
PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;
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
    layoutAll();
});

// --- Global Setup ---
G.E_MANAGER = new EventManager();
initPCards();
initPCenters();
initHandStats();
initJokers();

const pxToGu = (px) => px / (G.TILESIZE * G.TILESCALE);

// --- Layers ---
const gameContainer = new PIXI.Container(); // カードプレイ画面用
const shopContainer = new PIXI.Container(); // ショップ画面用
const jokerContainer = new PIXI.Container(); // 所持ジョーカー（共通）
const uiContainer = new PIXI.Container();   // UI（共通・最前面）

// 描画順序
app.stage.addChild(gameContainer);
app.stage.addChild(shopContainer);
app.stage.addChild(jokerContainer);
app.stage.addChild(uiContainer);

// --- Tooltip Setup (ツールチップ) ---
const tooltipContainer = new PIXI.Container();
const tooltipBg = new PIXI.Graphics();
const tooltipText = new PIXI.Text('', {
    fontFamily: 'Arial', fontSize: 20, fill: 0xFFFFFF,
    align: 'center', wordWrap: true, wordWrapWidth: 200
});
tooltipContainer.addChild(tooltipBg);
tooltipContainer.addChild(tooltipText);
tooltipContainer.visible = false;
uiContainer.addChild(tooltipContainer); // UIのさらに手前

// グローバル関数として登録
G.showTooltip = (text, targetBounds) => {
    tooltipText.text = text;
    const padding = 10;
    const width = tooltipText.width + padding * 2;
    const height = tooltipText.height + padding * 2;
    
    tooltipBg.clear();
    tooltipBg.beginFill(0x000000, 0.9);
    tooltipBg.lineStyle(2, 0xFFFFFF, 1);
    tooltipBg.drawRoundedRect(0, 0, width, height, 5);
    tooltipBg.endFill();
    
    tooltipText.x = padding;
    tooltipText.y = padding;

    // 位置合わせ
    tooltipContainer.x = targetBounds.x + (targetBounds.width - width) / 2;
    tooltipContainer.y = targetBounds.y - height - 10;
    
    // 画面外補正
    if (tooltipContainer.x < 0) tooltipContainer.x = 10;
    if (tooltipContainer.y < 0) tooltipContainer.y = targetBounds.y + targetBounds.height + 10;

    tooltipContainer.visible = true;
};

G.hideTooltip = () => {
    tooltipContainer.visible = false;
};

// --- Game State ---
let currentScene = 'LOADING'; // LOADING, PLAYING, SHOP
const STATE = {
    deck: [],
    handCards: [],
    jokers: [],     // 所持しているジョーカー
    shopJokers: [], // ショップに並んでいるジョーカー
    score: 0,
    targetScore: 300,
    hands: 4,
    discards: 3,
    ante: 1,
    dollars: 4,
    round: 1,
    isRoundOver: false
};

// UI Refs
let infoText, scoreText, btnPlay, btnDiscard, btnNextRound;
let hudTexts = {};

// --- Initialization ---
async function init() {
    await AssetLoader.load();
    createHUD();
    createGameUI();
    
    // 最初はショップから開始（デッキ構築フェーズ的な意味で）
    changeScene('SHOP');
}

// --- Scene Management ---
function changeScene(scene) {
    currentScene = scene;
    
    // UI表示切り替え
    if (scene === 'PLAYING') {
        gameContainer.visible = true;
        shopContainer.visible = false;
        btnPlay.visible = true;
        btnDiscard.visible = true;
        btnNextRound.visible = false;
        
        infoText.text = "Select cards";
        infoText.style.fill = 0xFFFFFF;
        
        startRound();
    } else if (scene === 'SHOP') {
        gameContainer.visible = false;
        shopContainer.visible = true;
        btnPlay.visible = false;
        btnDiscard.visible = false;
        btnNextRound.visible = true;
        
        infoText.text = "SHOP - Buy Jokers";
        infoText.style.fill = 0xAAAAAA;
        scoreText.text = "";

        // 所持ジョーカーの配置調整
        layoutJokers(STATE.jokers, { y: 100 });
        
        // ショップの商品補充
        populateShop();
    }
}

// --- Shop Logic ---
function populateShop() {
    shopContainer.removeChildren();
    STATE.shopJokers = [];

    const jokerKeys = Object.keys(G.P_JOKERS);
    // ランダムに3つ選出
    for (let i = 0; i < 3; i++) {
        const key = jokerKeys[Math.floor(Math.random() * jokerKeys.length)];
        const def = G.P_JOKERS[key];
        
        // ジョーカー生成
        const joker = new JokerSprite(key, def);
        joker.price = 4; // 仮価格

        // 購入ボタン追加
        const btn = new Button(0, 150, 150, 50, `BUY $${joker.price}`, C.ORANGE, () => buyJoker(joker));
        joker.container.addChild(btn);
        joker.buyButton = btn;

        STATE.shopJokers.push(joker);
        shopContainer.addChild(joker.container);
    }
    
    layoutJokers(STATE.shopJokers, { y: 350 }); // ショップエリアに配置
}

function buyJoker(joker) {
    if (STATE.dollars < joker.price) return; // 金不足
    if (STATE.jokers.length >= 5) return;    // 枠不足

    // 支払い
    STATE.dollars -= joker.price;
    updateHUD();

    // 管理リスト移動
    const idx = STATE.shopJokers.indexOf(joker);
    if (idx > -1) STATE.shopJokers.splice(idx, 1);
    STATE.jokers.push(joker);

    // コンテナ移動
    shopContainer.removeChild(joker.container);
    jokerContainer.addChild(joker.container); // 所持品レイヤーへ

    // ボタン削除 & 設定変更
    joker.container.removeChild(joker.buyButton);
    joker.buyButton = null;
    joker.container.cursor = 'help';

    // 再配置
    layoutJokers(STATE.shopJokers, { y: 350 });
    layoutJokers(STATE.jokers, { y: 100 });
}

// --- Game Logic ---
function startRound() {
    STATE.isRoundOver = false;
    STATE.score = 0;
    STATE.hands = 4;
    STATE.discards = 3;
    STATE.handCards = [];
    
    // 目標スコア計算
    STATE.targetScore = 300 * Math.pow(1.5, STATE.ante - 1) * STATE.round;
    STATE.targetScore = Math.floor(STATE.targetScore / 100) * 100;

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
    if (STATE.isRoundOver) return;
    for(let i=0; i<count; i++) {
        if (STATE.deck.length === 0) break;
        const data = STATE.deck.pop();
        const card = new CardSprite(data.rank, data.suit);
        card.scale.set(2.5);
        
        card.on('pointerdown', () => {
            if (STATE.isRoundOver) return;
            card.toggleSelect();
            updateScorePreview();
            layoutHand();
        });

        STATE.handCards.push(card);
        gameContainer.addChild(card.container);
    }
    layoutHand();
    updateScorePreview();
}

function calculateScore(selectedCards) {
    const pokerResult = Poker.evaluate(selectedCards);
    
    let chips = pokerResult.baseChips + pokerResult.playedChips;
    let mult = pokerResult.baseMult;

    const context = {
        scoringCards: selectedCards,
        discards: STATE.discards,
        hands: STATE.hands,
        dollars: STATE.dollars
    };

    let scoreObj = { chips: chips, mult: mult };

    // ジョーカー効果適用
    STATE.jokers.forEach(joker => {
        if (joker.def.effect) {
            const triggered = joker.def.effect(scoreObj, context);
            if (triggered) joker.triggerEffect();
        }
    });

    const total = scoreObj.chips * scoreObj.mult;
    return {
        chips: scoreObj.chips,
        mult: scoreObj.mult,
        total: total,
        name: pokerResult.name
    };
}

function updateScorePreview() {
    if (STATE.isRoundOver) return;
    const selected = STATE.handCards.filter(c => c.selected);
    
    if (selected.length > 0) {
        const result = Poker.evaluate(selected);
        infoText.text = result.name;
        scoreText.text = `Base: ${result.baseChips + result.playedChips} x ${result.baseMult}`; 

        const canPlay = selected.length <= 5 && STATE.hands > 0;
        const canDiscard = selected.length <= 5 && STATE.discards > 0;
        btnPlay.alpha = canPlay ? 1.0 : 0.5; btnPlay.eventMode = canPlay ? 'static' : 'none';
        btnDiscard.alpha = canDiscard ? 1.0 : 0.5; btnDiscard.eventMode = canDiscard ? 'static' : 'none';
    } else {
        infoText.text = "Select cards";
        scoreText.text = "";
        btnPlay.alpha = 0.5; btnPlay.eventMode = 'none';
        btnDiscard.alpha = 0.5; btnDiscard.eventMode = 'none';
    }
}

function onPlay() {
    const selected = STATE.handCards.filter(c => c.selected);
    if (selected.length === 0 || STATE.hands <= 0) return;

    const result = calculateScore(selected);
    
    STATE.score += result.total;
    STATE.hands--;
    // 勝利報酬（仮）
    STATE.dollars += 4; 

    updateHUD();
    removeSelectedCards();

    if (STATE.score >= STATE.targetScore) {
        STATE.isRoundOver = true;
        infoText.text = "BLIND DEFEATED!";
        infoText.style.fill = 0xF1C40F; 
        scoreText.text = "";
        btnPlay.alpha = 0; btnDiscard.alpha = 0;
        
        // 勝利したらショップへ
        setTimeout(() => {
            // クリーンアップ
            STATE.handCards.forEach(c => gameContainer.removeChild(c.container));
            STATE.handCards = [];
            STATE.round++;
            if (STATE.round > 3) { STATE.round = 1; STATE.ante++; }
            
            changeScene('SHOP');
        }, 2000);

    } else if (STATE.hands === 0) {
        STATE.isRoundOver = true;
        infoText.text = "GAME OVER";
        infoText.style.fill = 0xE74C3C;
        scoreText.text = `Final Score: ${STATE.score}`;
        btnPlay.alpha = 0; btnDiscard.alpha = 0;
    } else {
        infoText.text = `${result.name}!`;
        scoreText.text = `${result.chips} x ${result.mult} = ${result.total}`;
        scoreText.style.fill = 0xFFCC00;

        setTimeout(() => {
            scoreText.style.fill = 0xAAAAAA;
            drawCards(Math.min(8 - STATE.handCards.length, STATE.deck.length));
        }, 1200);
    }
}

function onDiscard() {
    if (STATE.isRoundOver) return;
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
            gameContainer.removeChild(c.container);
        } else {
            keep.push(c);
        }
    });
    STATE.handCards = keep;
}

// --- Layouts & UI ---

function layoutAll() {
    layoutJokers(STATE.jokers, { y: 100 });
    if(currentScene === 'SHOP') layoutJokers(STATE.shopJokers, { y: 350 });
    
    layoutHand();
    layoutUI();
}

function layoutUI() {
    const cx = app.screen.width / 2 + 125;
    const cy = app.screen.height;

    infoText.x = cx;
    infoText.y = 250;
    scoreText.x = cx;
    scoreText.y = 300;

    btnPlay.x = cx - 120;
    btnPlay.y = cy - 200;
    btnDiscard.x = cx + 120;
    btnDiscard.y = cy - 200;

    btnNextRound.x = cx;
    btnNextRound.y = cy - 100;
}

function layoutJokers(jokerList, options = {}) {
    const yPos = options.y || 100;
    jokerList.forEach((joker, i) => {
        const total = jokerList.length;
        const offset = i - (total - 1) / 2;
        // MoveableのTを更新
        joker.T.x = (app.screen.width / 2 + 125) + offset * 120; // 125はサイドバー分
        joker.T.y = yPos;
        joker.T.r = 0;
    });
}

function layoutHand() {
    const centerX = app.screen.width / 2 + 125;
    const centerY = app.screen.height - 150;
    STATE.handCards.forEach((card, i) => {
        const offset = i - (STATE.handCards.length - 1) / 2;
        card.x = offset * 90; 
        let targetY = Math.abs(offset) * 10; 
        if (card.selected) targetY -= 40; 
        card.y = targetY;
        card.rotation = offset * 0.05;
        card.zIndex = i;
    });
    gameContainer.x = centerX;
    gameContainer.y = centerY;
    gameContainer.sortableChildren = true;
}

function createHUD() {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x2C3E50);
    bg.drawRect(0, 0, 250, window.innerHeight);
    bg.endFill();
    uiContainer.addChild(bg);
    const style = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 24, fill: 0xFFFFFF, fontWeight: 'bold' });
    const labelStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 18, fill: 0x95A5A6 });
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
    addStat("SCORE / TARGET", "score", 0xFFFFFF);
    y += 10;
    addStat("HANDS", "hands", 0x3498DB);
    addStat("DISCARDS", "discards", 0xE74C3C);
    addStat("MONEY", "dollars", 0xF1C40F);
    addStat("ANTE", "ante", 0xE67E22);
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
    const style = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 36, fill: 0xFFFFFF, fontWeight: 'bold', dropShadow: true, dropShadowDistance: 2, align: 'center' });
    infoText = new PIXI.Text('Select cards', style);
    infoText.anchor.set(0.5);
    uiContainer.addChild(infoText);
    scoreText = new PIXI.Text('', { ...style, fontSize: 24, fill: 0xFFCC00 });
    scoreText.anchor.set(0.5);
    uiContainer.addChild(scoreText);

    btnPlay = new Button(0, 0, 200, 60, "PLAY HAND", C.ORANGE, onPlay);
    uiContainer.addChild(btnPlay);
    btnDiscard = new Button(0, 0, 200, 60, "DISCARD", C.RED, onDiscard);
    uiContainer.addChild(btnDiscard);
    btnNextRound = new Button(0, 0, 240, 60, "NEXT ROUND", C.BLUE, () => changeScene('PLAYING'));
    uiContainer.addChild(btnNextRound);
    
    layoutUI();
}

// --- Main Loop ---
app.ticker.add((delta) => {
    const dt = delta / 60; 
    G.TIMERS.REAL += dt;
    G.TIMERS.TOTAL += dt;
    G.E_MANAGER.update(dt);
    
    G.I.CARD.forEach(c => c.update(dt));
    [...STATE.jokers, ...STATE.shopJokers].forEach(j => j.update(dt));
});

init();