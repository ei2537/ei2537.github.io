import * as PIXI from 'pixi.js';
import { G, C } from './globals.js';
import { Card } from './objects/Card.js';
import { Button } from './objects/Button.js';
import { Event, EventManager } from './engine/EventManager.js';
import { PokerLogic } from './logic/PokerLogic.js';
import { initPCards, initPCenters } from './definitions.js';

PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x374244,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
});
document.body.appendChild(app.view);

window.addEventListener('resize', () => app.renderer.resize(window.innerWidth, window.innerHeight));

// --- Global Setup ---
G.E_MANAGER = new EventManager();
initPCards();
initPCenters();

const pxToGu = (px) => px / (G.TILESIZE * G.TILESCALE);

// --- Layers ---
// レイヤーを分けることで、カードがUIの手前に来たりするのを防ぐ
const gameLayer = new PIXI.Container(); // カードなどはここ
const uiLayer = new PIXI.Container();   // ボタンやテキストはここ（常に手前）
app.stage.addChild(gameLayer);
app.stage.addChild(uiLayer);

// --- Game State ---
const GAME_STATE = {
    hand: [],
};

const loader = PIXI.Assets;
let textures = {}; 

async function setup() {
    textures.cards = await loader.load('resources/textures/1x/8BitDeck.png');
    textures.centers = await loader.load('resources/textures/1x/Enhancers.png');
    
    // --- UI Setup (uiLayerに追加) ---
    const infoText = new PIXI.Text('Select cards', {
        fontFamily: 'Arial', fontSize: 36, fill: 0xFFFFFF, align: 'center',
        dropShadow: true, dropShadowDistance: 2
    });
    infoText.anchor.set(0.5);
    infoText.x = window.innerWidth / 2;
    infoText.y = 100;
    uiLayer.addChild(infoText);

    const btnPlay = new Button(
        pxToGu(window.innerWidth / 2 - 150), pxToGu(window.innerHeight - 150),
        4, 1.5, "PLAY HAND", C.ORANGE, () => playHand()
    );
    G.I.UIBOX.push(btnPlay);
    uiLayer.addChild(btnPlay.container);

    const btnDiscard = new Button(
        pxToGu(window.innerWidth / 2 + 150), pxToGu(window.innerHeight - 150),
        4, 1.5, "DISCARD", C.RED, () => discardHand()
    );
    G.I.UIBOX.push(btnDiscard);
    uiLayer.addChild(btnDiscard.container);

    // --- Deal Cards (gameLayerに追加) ---
    const allCardKeys = Object.keys(G.P_CARDS);
    const handSize = 8;
    const screenCenterX = pxToGu(window.innerWidth / 2);
    // カードの配置位置を少し上に調整（ボタンと被らないように）
    const handY = pxToGu(window.innerHeight - 300); 

    for (let i = 0; i < handSize; i++) {
        const key = allCardKeys[Math.floor(Math.random() * allCardKeys.length)];
        
        const card = new Card(
            screenCenterX, pxToGu(window.innerHeight + 200),
            G.CARD_W, G.CARD_H, 
            G.P_CARDS[key], G.P_CENTERS['c_base'], textures
        );
        
        // ★ここで gameLayer に追加
        gameLayer.addChild(card.container);
        GAME_STATE.hand.push(card);
        G.I.CARD.push(card);

        card.container.eventMode = 'dynamic';
        card.container.on('pointerdown', () => {
            card.toggleSelection();
            updateHandInfo();
        });

        G.E_MANAGER.add_event(new Event({
            trigger: 'ease',
            delay: 0.1 * i,
            ease: 'elastic',
            ref_table: card.T,
            ref_value: 'y',
            ease_to: handY,
            func: () => {
                const spreadX = (i - (handSize-1)/2) * (G.CARD_W * 0.9);
                card.T.x = screenCenterX + spreadX;
                card.T.r = (i - (handSize-1)/2) * 0.05;
                return true;
            }
        }));
    }

    function updateHandInfo() {
        const selectedCards = GAME_STATE.hand.filter(c => c.selected);
        if (selectedCards.length > 0) {
            const result = PokerLogic.evaluatePokerHand(selectedCards);
            if (result.top) {
                infoText.text = `${result.top.hand}`;
            }
        } else {
            infoText.text = "Select cards";
        }
    }

    function playHand() {
        const selectedCards = GAME_STATE.hand.filter(c => c.selected);
        if (selectedCards.length === 0) return;

        const result = PokerLogic.evaluatePokerHand(selectedCards);
        const handName = result.top ? result.top.hand : "High Card";

        selectedCards.forEach(c => c.juiceUp(1.2, 0.5));
        infoText.text = `PLAYED: ${handName}!`;
        infoText.style.fill = C.ORANGE;

        setTimeout(() => {
            infoText.style.fill = 0xFFFFFF;
            updateHandInfo();
        }, 1500);
    }

    function discardHand() {
        const selectedCards = GAME_STATE.hand.filter(c => c.selected);
        if (selectedCards.length === 0) return;

        selectedCards.forEach(c => {
            c.juiceUp(0.5, 1.0);
            c.toggleSelection();
        });
        infoText.text = "Discarded!";
        setTimeout(() => { updateHandInfo(); }, 1000);
    }
}

app.ticker.add((delta) => {
    const dt = delta / 60; 
    G.TIMERS.REAL += dt;
    G.TIMERS.TOTAL += dt;
    G.E_MANAGER.update(dt);
    
    // 手前にあるカードほど手前に描画されるようにソート（簡易的なZソート）
    // gameLayer.children.sort((a, b) => a.y - b.y); 
    // ※今回は配られた順序で良いのでソート不要ですが、必要ならここで制御します

    G.I.CARD.forEach(c => c.update(dt));
    G.I.UIBOX.forEach(u => u.update(dt));
});

setup();