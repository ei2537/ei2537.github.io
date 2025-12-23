import * as PIXI from 'pixi.js';
import { G, C } from './globals.js';
import { Card } from './objects/Card.js';
import { Button } from './objects/Button.js'; // 追加
import { Event, EventManager } from './engine/EventManager.js';
import { PokerLogic } from './logic/PokerLogic.js';
import { initPCards, initPCenters } from './definitions.js';

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

window.addEventListener('resize', () => app.renderer.resize(window.innerWidth, window.innerHeight));

// --- Global Setup ---
G.E_MANAGER = new EventManager();
initPCards();
initPCenters();

const pxToGu = (px) => px / (G.TILESIZE * G.TILESCALE);

// --- Game State ---
const GAME_STATE = {
    hand: [],       // 手札のCardオブジェクトリスト
    score: 0,
    roundScore: 0,
    chips: 0,
    mult: 0
};

// --- Resources ---
const loader = PIXI.Assets;
let textures = {}; 

async function setup() {
    textures.cards = await loader.load('resources/textures/1x/8BitDeck.png');
    textures.centers = await loader.load('resources/textures/1x/Enhancers.png');
    
    // --- UI Layer ---
    const uiContainer = new PIXI.Container();
    app.stage.addChild(uiContainer);

    // スコア表示用テキスト
    const infoText = new PIXI.Text('Select cards & Play Hand', {
        fontFamily: 'Arial', fontSize: 36, fill: 0xFFFFFF, align: 'center',
        dropShadow: true, dropShadowDistance: 2
    });
    infoText.anchor.set(0.5);
    infoText.x = window.innerWidth / 2;
    infoText.y = 100;
    uiContainer.addChild(infoText);

    // --- Play Button ---
    const btnPlay = new Button(
        pxToGu(window.innerWidth / 2 - 150), pxToGu(window.innerHeight - 100),
        4, 1.5, // width, height (Game Units)
        "PLAY HAND", C.ORANGE,
        () => playHand()
    );
    G.I.UIBOX.push(btnPlay);
    app.stage.addChild(btnPlay.container);

    // --- Discard Button ---
    const btnDiscard = new Button(
        pxToGu(window.innerWidth / 2 + 150), pxToGu(window.innerHeight - 100),
        4, 1.5, 
        "DISCARD", C.RED,
        () => discardHand()
    );
    G.I.UIBOX.push(btnDiscard);
    app.stage.addChild(btnDiscard.container);


    // --- Deal Cards ---
    // ランダムに7枚配る（実際のデッキロジックは後回し）
    const allCardKeys = Object.keys(G.P_CARDS);
    const handSize = 8;
    const screenCenterX = pxToGu(window.innerWidth / 2);
    const handY = pxToGu(window.innerHeight - 250);

    for (let i = 0; i < handSize; i++) {
        // ランダム選出
        const key = allCardKeys[Math.floor(Math.random() * allCardKeys.length)];
        
        const card = new Card(
            screenCenterX, pxToGu(window.innerHeight + 200), // 画面外から
            G.CARD_W, G.CARD_H, 
            G.P_CARDS[key], G.P_CENTERS['c_base'], textures
        );
        
        app.stage.addChild(card.container);
        GAME_STATE.hand.push(card);
        G.I.CARD.push(card);

        // クリックイベント上書き: 選択トグル
        card.container.eventMode = 'dynamic';
        card.container.on('pointerdown', () => {
            card.toggleSelection();
            updateHandInfo();
        });

        // 配るアニメーション
        G.E_MANAGER.add_event(new Event({
            trigger: 'ease',
            delay: 0.1 * i,
            ease: 'elastic',
            ref_table: card.T,
            ref_value: 'y',
            ease_to: handY,
            func: () => {
                // 扇状に配置
                const spreadX = (i - (handSize-1)/2) * (G.CARD_W * 0.9);
                card.T.x = screenCenterX + spreadX;
                card.T.r = (i - (handSize-1)/2) * 0.05;
                return true;
            }
        }));
    }

    // --- Logic Functions ---

    // 選択中のカード情報を更新
    function updateHandInfo() {
        const selectedCards = GAME_STATE.hand.filter(c => c.selected);
        if (selectedCards.length > 0) {
            const result = PokerLogic.evaluatePokerHand(selectedCards);
            if (result.top) {
                infoText.text = `${result.top.hand}`;
                // 将来ここでチップ計算予測を表示
            }
        } else {
            infoText.text = "Select cards";
        }
    }

    // プレイ実行
    function playHand() {
        const selectedCards = GAME_STATE.hand.filter(c => c.selected);
        if (selectedCards.length === 0 || selectedCards.length > 5) return;

        const result = PokerLogic.evaluatePokerHand(selectedCards);
        const handName = result.top ? result.top.hand : "High Card";

        // 演出: 選択カードをJuiceさせ、スコアを表示
        selectedCards.forEach(c => c.juiceUp(1.2, 0.5));
        
        infoText.text = `PLAYED: ${handName}!`;
        infoText.style.fill = C.ORANGE; // 色変更

        // 擬似的な処理完了後、テキストを戻す
        setTimeout(() => {
            infoText.style.fill = 0xFFFFFF;
            updateHandInfo();
        }, 1500);
    }

    // ディスカード（今回はアニメーションのみ）
    function discardHand() {
        const selectedCards = GAME_STATE.hand.filter(c => c.selected);
        if (selectedCards.length === 0 || selectedCards.length > 5) return;

        selectedCards.forEach(c => {
            c.juiceUp(0.5, 1.0); // 激しく揺れる
            // 本来はここでカードを削除・補充するロジックが入る
            // 今回はデモとして「選択解除」のみ
            c.toggleSelection();
        });
        infoText.text = "Discarded!";
    }
}

// --- Main Loop ---
app.ticker.add((delta) => {
    const dt = delta / 60; 
    G.TIMERS.REAL += dt;
    G.TIMERS.TOTAL += dt;
    G.E_MANAGER.update(dt);
    
    // Update Objects
    G.I.CARD.forEach(c => c.update(dt));
    G.I.UIBOX.forEach(u => u.update(dt));
});

setup();