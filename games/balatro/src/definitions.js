import { G } from './globals.js';

export function initPCards() {
    const suits = ['Hearts', 'Clubs', 'Diamonds', 'Spades'];
    // Map to sprite sheet rows
    const suitMap = { 'Hearts': 0, 'Clubs': 1, 'Diamonds': 2, 'Spades': 3 };
    
    // Atlas Columns: 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A
    const ranks = ['2','3','4','5','6','7','8','9','10','Jack','Queen','King','Ace'];
    const rankMap = { 
        '2':0, '3':1, '4':2, '5':3, '6':4, '7':5, '8':6, '9':7, '10':8, 
        'Jack':9, 'Queen':10, 'King':11, 'Ace':12 
    };

    let p_cards = {};
    
    suits.forEach(suit => {
        ranks.forEach(rank => {
            // Key generation: H_2, H_T, H_K, etc.
            let rankKey = rank;
            if (rank === '10') rankKey = 'T';
            else if (rank === 'Jack') rankKey = 'J';
            else if (rank === 'Queen') rankKey = 'Q';
            else if (rank === 'King') rankKey = 'K';
            else if (rank === 'Ace') rankKey = 'A';

            let key = `${suit.substring(0,1)}_${rankKey}`; 
            
            p_cards[key] = {
                name: `${rank} of ${suit}`,
                value: rank, // '2', '10', 'Ace', etc.
                suit: suit,
                pos: { x: rankMap[rank], y: suitMap[suit] } 
            };
        });
    });
    
    G.P_CARDS = p_cards;
}

export function initPCenters() {
    G.P_CENTERS = {
        c_base: {
            name: "Default Base",
            set: "Default",
            effect: "Base",
            pos: { x: 1, y: 0 }
        },
        b_red: {
            name: "Red Deck",
            set: "Back",
            pos: { x: 0, y: 0 }
        },
        // 必要に応じてジョーカーなどを追加
    };
}