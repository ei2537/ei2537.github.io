import { G, C } from './globals.js';

// Standard Playing Cards Definition (P_CARDS)
export function initPCards() {
    const suits = ['Hearts', 'Clubs', 'Diamonds', 'Spades'];
    const ranks = ['2','3','4','5','6','7','8','9','10','Jack','Queen','King','Ace'];
    
    // Coordinates in the sprite sheet
    // Assumes standard 8BitDeck.png layout
    const suitMap = { 'Hearts': 0, 'Clubs': 1, 'Diamonds': 2, 'Spades': 3 };
    const rankMap = { 
        '2':0, '3':1, '4':2, '5':3, '6':4, '7':5, '8':6, '9':7, '10':8, 
        'Jack':9, 'Queen':10, 'King':11, 'Ace':12 
    };

    let p_cards = {};
    
    suits.forEach(suit => {
        ranks.forEach(rank => {
            let key = `${suit.substring(0,1)}_${rank.substring(0,1) === '1' ? 'T' : rank.substring(0,1)}`; // e.g. H_T, S_A
            p_cards[key] = {
                name: `${rank} of ${suit}`,
                value: rank,
                suit: suit,
                pos: { x: rankMap[rank], y: suitMap[suit] } // Atlas grid position
            };
        });
    });
    
    G.P_CARDS = p_cards;
}

// Centers (Jokers, Tarots, Planet, etc.) Definition
// Based on game.lua init_item_prototypes
export function initPCenters() {
    G.P_CENTERS = {
        // --- DEFAULTS ---
        c_base: {
            name: "Default Base",
            set: "Default",
            effect: "Base",
            pos: { x: 1, y: 0 } // from Enhancers.png
        },
        
        // --- JOKERS (Sample) ---
        j_joker: {
            name: "Joker",
            set: "Joker",
            rarity: 1,
            cost: 2,
            pos: { x: 0, y: 0 }, // from Jokers.png
            config: { mult: 4 },
            effect: "Mult",
            desc: ["+4 Mult"]
        },
        j_greedy_joker: {
            name: "Greedy Joker",
            set: "Joker",
            rarity: 1,
            cost: 5,
            pos: { x: 6, y: 1 },
            config: { extra: { s_mult: 3, suit: 'Diamonds' } },
            effect: "Suit Mult",
            desc: ["Played cards with", "Diamond suit give", "+3 Mult when scored"]
        },
        // ... 他のジョーカーも同様に定義 ...
        
        // --- PLANETS ---
        c_mercury: {
            name: "Mercury",
            set: "Planet",
            cost: 3,
            pos: { x: 0, y: 3 },
            config: { hand_type: 'Pair' },
            desc: ["Level up Pair"]
        },
        // ... 他の惑星 ...
    };
    
    // Add logic to categorize them into POOLS (Common, Rare, etc.)
}