import * as PIXI from 'pixi.js';
import { G, C } from './globals.js';
import { Card } from './objects/Card.js';
import { Event, EventManager } from './engine/EventManager.js';
import { PokerLogic } from './logic/PokerLogic.js';
import { initPCards, initPCenters } from './definitions.js'; // Data loaders

// --- 1. Init PixiJS ---
const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x374244, // G.C.DYN_UI.MAIN (Balatro Background)
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
});
document.body.appendChild(app.view);

// Resize handler
window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    // Update G.ROOM if needed for responsive layout
});

// --- 2. Global Setup ---
G.E_MANAGER = new EventManager();
initPCards();
initPCenters();

// --- 3. Resource Loading ---
// Note: In a real build, use PIXI.Assets.load for async loading
// For this snippet, we assume 8BitDeck.png is available.
const loader = PIXI.Assets;
let atlasTexture = null;

async function setup() {
    // Load Texture Atlas
    atlasTexture = await loader.load('resources/textures/1x/8BitDeck.png');
    
    // --- 4. Game Logic Initialization ---
    
    // Create "Hand" area visual debug
    const handY = G.ROOM.H / 2 + 200;
    
    // Create some cards
    const cardList = ['S_A', 'S_K', 'S_Q', 'S_J', 'S_T', 'H_2', 'C_5']; // Royal Flush + others
    let handCards = [];

    cardList.forEach((key, index) => {
        // Create Card
        // (x, y, w, h, cardDef, centerDef, texture)
        const card = new Card(
            G.ROOM.W / 2, G.ROOM.H + 300, // Start off-screen bottom
            G.CARD_W, G.CARD_H, 
            G.P_CARDS[key], 
            G.P_CENTERS['c_base'], 
            atlasTexture
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
            ease: 'elastic', // Bouncy landing
            ref_table: card.T,
            ref_value: 'y',
            ease_to: 400, // Middle of screen
            func: (val) => {
                // Update X based on index to spread them out
                card.T.x = (window.innerWidth / 2) + (index - 3.5) * (G.CARD_W * G.TILESIZE * 1.1);
                card.T.r = (index - 3.5) * 0.1; // Fan rotation
                return true;
            }
        }));

        // Interaction
        card.container.eventMode = 'dynamic';
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
                 results.top.cards.forEach(c => c.juiceUp(1.0, 0.5));
            }
            return true;
        }
    }));
}

// --- 5. Main Loop (Ticker) ---
app.ticker.add((delta) => {
    // Convert PIXI delta to seconds
    const dt = delta / 60; 

    // Update Timers
    G.TIMERS.REAL += dt;
    G.TIMERS.TOTAL += dt;

    // Update Event Manager
    G.E_MANAGER.update(dt);

    // Update All Game Objects
    G.I.CARD.forEach(card => card.update(dt));
    
    // (Moveable updates are handled within Card.update -> super.update)
});

// Start
setup();