import * as PIXI from 'pixi.js';
import { AssetLoader } from './AssetLoader.js';
import { CardSprite } from './CardSprite.js';
import { JokerSprite } from './objects/JokerSprite.js';
import { Button } from './objects/Button.js';
import { Event, EventManager } from './engine/EventManager.js';
import { Poker } from './Poker.js'; // ★修正: パスを ./logic/Poker.js から変更
import { initPCards, initPCenters, initHandStats, initJokers } from './definitions.js';
import { G, C } from './globals.js';

// --- Init ---
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

// --- Global & Layers ---
G.E_MANAGER = new EventManager();
initPCards();
initPCenters();
initHandStats();
initJokers();

const pxToGu = (px) => px / (G.TILESIZE * G.TILESCALE);

const jokerContainer = new PIXI.Container();
const gameContainer = new PIXI.Container();
const uiContainer = new PIXI.Container();

// レイヤー順序
app.stage.addChild(gameContainer);
app.stage.addChild(jokerContainer);
app.stage.addChild(uiContainer);

// --- State ---
const STATE = {
    deck: [],
    handCards: [],
    jokers: [],
    score: 0,
    targetScore: 300,
    hands: 4,
    discards: 3,
    ante: 1,
    round: 1,
    isRoundOver: false
};

// UI Refs
let infoText, scoreText, btnPlay, btnDiscard;
let hudTexts = {};

async function init() {
    await AssetLoader.load();
    createHUD();
    createGameUI();
    
    // 初期ジョーカー
    addJoker('j_joker');
    addJoker('j_banner');
    
    startRound();
}

function addJoker(key) {
    if (STATE.jokers.length >= 5) return;
    
    const def = G.P_JOKERS[key];
    const joker = new JokerSprite(key, def);
    STATE.jokers.push(joker);
    jokerContainer.addChild(joker.container);
    layoutJokers();
}

function startRound() {
    STATE.isRoundOver = false;
    STATE.score = 0;
    STATE.hands = 4;
    STATE.discards = 3;
    STATE.handCards = [];
    STATE.targetScore = 300 * Math.pow(1.5, STATE.ante - 1) * STATE.round;
    STATE.targetScore = Math.floor(STATE.targetScore / 100) * 100;

    updateHUD();
    resetDeck();
    drawCards(8);
    
    infoText.text = "Select cards";
    scoreText.text = "";
    btnPlay.alpha = 0.5;
    btnDiscard.alpha = 0.5;
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

    STATE.jokers.forEach(joker => {
        if (joker.def.effect) {
            const triggered = joker.def.effect(scoreObj, context);
            if (triggered) {
                joker.triggerEffect();
            }
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
    updateHUD();

    removeSelectedCards();

    if (STATE.score >= STATE.targetScore) {
        STATE.isRoundOver = true;
        infoText.text = "BLIND DEFEATED!";
        infoText.style.fill = 0xF1C40F;
        scoreText.text = "";
        btnPlay.alpha = 0; btnDiscard.alpha = 0;
        setTimeout(nextRound, 2000);
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

function nextRound() {
    STATE.handCards.forEach(c => gameContainer.removeChild(c.container));
    STATE.handCards = [];
    STATE.round++;
    if (STATE.round > 3) {
        STATE.round = 1;
        STATE.ante++;
    }
    btnPlay.alpha = 0.5; btnDiscard.alpha = 0.5;
    startRound();
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
    
    layoutAll();
}

function layoutAll() {
    const cx = app.screen.width / 2 + 125;
    const cy = app.screen.height;

    // ジョーカーエリア
    jokerContainer.y = 100;
    jokerContainer.x = app.screen.width / 2 + 125;
    
    layoutJokers();
    layoutHand();
    
    if(infoText) {
        infoText.x = cx;
        infoText.y = 250;
        scoreText.x = cx;
        scoreText.y = 300;
        btnPlay.x = cx - 120;
        btnPlay.y = cy - 250;
        btnDiscard.x = cx + 120;
        btnDiscard.y = cy - 250;
    }
}

function layoutJokers() {
    STATE.jokers.forEach((joker, i) => {
        const offset = i - (STATE.jokers.length - 1) / 2;
        joker.T.x = offset * (G.CARD_W * 1.1);
        joker.T.y = 0;
        joker.T.r = 0;
    });
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

app.ticker.add((delta) => {
    const dt = delta / 60; 
    G.TIMERS.REAL += dt;
    G.TIMERS.TOTAL += dt;
    G.E_MANAGER.update(dt);
    
    G.I.CARD.forEach(c => c.update(dt));
    G.I.UIBOX.forEach(u => u.update(dt));
    STATE.jokers.forEach(j => j.update(dt));
});

init();