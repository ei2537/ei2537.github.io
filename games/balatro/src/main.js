import * as PIXI from 'pixi.js';
import { G, C } from './globals.js';
import { Card } from './objects/Card.js';
import { Event, EventManager } from './engine/EventManager.js';
import { PokerLogic } from './logic/PokerLogic.js';
import { initPCards, initPCenters } from './definitions.js';

// --- 1. Init PixiJS ---
// ドット絵をくっきり表示する設定
PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x374244, // Balatro Background Color
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
});
document.body.appendChild(app.view);

// Resize handler
window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
});

// --- 2. Global Setup ---
G.E_MANAGER = new EventManager();
initPCards();
initPCenters();

// Conversion Helper: Pixels to Game Units
const pxToGu = (px) => px / (G.TILESIZE * G.TILESCALE);

// --- 3. Resource Loading ---
const loader = PIXI.Assets;

// ここで textures 変数を宣言します
let textures = {}; 

async function setup() {
    // 複数の画像を読み込む
    // ※パスが間違っている場合は適宜修正してください
    textures.cards = await loader.load('resources/textures/1x/8BitDeck.png');
    textures.centers = await loader.load('resources/textures/1x/Enhancers.png');
    
    // --- 4. Game Logic Initialization ---
    
    // Create some cards (Royal Flush + others)
    const cardList = ['S_A', 'S_K', 'S_Q', 'S_J', 'S_T', 'H_2', 'C_5']; 
    let handCards = [];

    // Calculate center position in Game Units
    const screenCenterX = pxToGu(window.innerWidth / 2);
    const screenCenterY = pxToGu(window.innerHeight / 2);
    const offScreenY = pxToGu(window.innerHeight + 300);

    cardList.forEach((key, index) => {
        // Create Card
        const card = new Card(
            screenCenterX, offScreenY, // Start off-screen bottom (Game Units)
            G.CARD_W, G.CARD_H, 
            G.P_CARDS[key], 
            G.P_CENTERS['c_base'], 
            textures // ★ここで読み込んだ画像セットを渡す
        );

        // Add to Pixi Stage
        app.stage.addChild(card.container);
        
        // Add to Hand Logic List
        handCards.push(card);
        G.I.CARD.push(card);

        // Queue Animation: Deal cards to hand position
        G.E_MANAGER.add_event(new Event({
            trigger: 'ease',
            delay: 0.1 * index, // Staggered deal
            ease: 'elastic', // Bouncy landing (Juice-like easing)
            ref_table: card.T,
            ref_value: 'y',
            ease_to: screenCenterY, // Target Y (Game Units)
            func: (val) => {
                // Spread X position centered
                // (index - 3) centers the 7 cards around 0
                const spreadX = (index - 3) * (G.CARD_W * 1.1); 
                card.T.x = screenCenterX + spreadX;
                
                // Fan rotation
                card.T.r = (index - 3) * 0.1; 
                return true;
            }
        }));

        // Interaction
        card.container.eventMode = 'dynamic';
        card.container.cursor = 'pointer';
        card.container.on('pointerdown', () => {
            card.flip(); // Test flip logic
            card.juiceUp(0.6, 0.2); // Test juice
            console.log(`Clicked ${card.cardDef.name}`);
        });
    });

    // Test Poker Logic after deal
    G.E_MANAGER.add_event(new Event({
        trigger: 'after',
        delay: 2.0, // Wait for deal animation
        func: () => {
            const results = PokerLogic.evaluatePokerHand(handCards);
            console.log("Poker Hand Evaluation:", results.top);
            
            // Visual Feedback (Juice the scoring cards)
            if(results.top) {
                 results.top.cards.forEach(c => {
                     c.juiceUp(1.0, 0.5); // Big wobble for scoring cards
                 });
            }
            return true;
        }
    }));
}

// --- 5. Main Loop (Ticker) ---
app.ticker.add((delta) => {
    // Convert PIXI delta (frames) to seconds
    const dt = delta / 60; 

    // Update Timers
    G.TIMERS.REAL += dt;
    G.TIMERS.TOTAL += dt;

    // Update Event Manager
    G.E_MANAGER.update(dt);

    // Update All Game Objects
    G.I.CARD.forEach(card => card.update(dt));
});

// Start
setup();