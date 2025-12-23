import { G } from './globals.js';

// --- 1. トランプ（52枚）の定義 ---
export function initPCards() {
    const suits = ['Hearts', 'Clubs', 'Diamonds', 'Spades'];
    // スプライトシート上の行番号 (Hearts=0, Clubs=1, ...)
    const suitMap = { 'Hearts': 0, 'Clubs': 1, 'Diamonds': 2, 'Spades': 3 };
    
    const ranks = ['2','3','4','5','6','7','8','9','10','Jack','Queen','King','Ace'];
    // スプライトシート上の列番号
    const rankMap = { 
        '2':0, '3':1, '4':2, '5':3, '6':4, '7':5, '8':6, '9':7, '10':8, 
        'Jack':9, 'Queen':10, 'King':11, 'Ace':12 
    };

    let p_cards = {};
    
    suits.forEach(suit => {
        ranks.forEach(rank => {
            // キー生成: H_2, H_T, S_A など
            let rankKey = rank;
            if (rank === '10') rankKey = 'T';
            else if (rank === 'Jack') rankKey = 'J';
            else if (rank === 'Queen') rankKey = 'Q';
            else if (rank === 'King') rankKey = 'K';
            else if (rank === 'Ace') rankKey = 'A';

            let key = `${suit.substring(0,1)}_${rankKey}`; 
            
            p_cards[key] = {
                name: `${rank} of ${suit}`,
                value: rank, 
                suit: suit,
                pos: { x: rankMap[rank], y: suitMap[suit] } 
            };
        });
    });
    
    G.P_CARDS = p_cards;
}

// --- 2. センター（裏面や消耗品など）の定義 ---
export function initPCenters() {
    G.P_CENTERS = {
        // 白い台紙
        c_base: {
            name: "Default Base",
            set: "Default",
            effect: "Base",
            pos: { x: 1, y: 0 } // Enhancers.png
        },
        // 赤いデッキ裏面
        b_red: {
            name: "Red Deck",
            set: "Back",
            pos: { x: 0, y: 0 } // Enhancers.png
        }
    };
}

// --- 3. ポーカー役のスコア定義 ---
export function initHandStats() {
    G.HAND_STATS = {
        "High Card":        { chips: 5,  mult: 1 },
        "Pair":             { chips: 10, mult: 2 },
        "Two Pair":         { chips: 20, mult: 2 },
        "Three of a Kind":  { chips: 30, mult: 3 },
        "Straight":         { chips: 30, mult: 4 },
        "Flush":            { chips: 35, mult: 4 },
        "Full House":       { chips: 40, mult: 4 },
        "Four of a Kind":   { chips: 60, mult: 7 },
        "Straight Flush":   { chips: 100, mult: 8 },
        "Royal Flush":      { chips: 100, mult: 8 },
        "Five of a Kind":   { chips: 120, mult: 12 },
        "Flush Five":       { chips: 160, mult: 16 },
        "Flush House":      { chips: 140, mult: 14 }
    };
}

// --- 4. ジョーカーの定義 (今回追加) ---
export function initJokers() {
    G.P_JOKERS = {
        'j_joker': {
            name: "Joker",
            pos: { x: 0, y: 0 }, // Jokers.png の座標
            desc: "+4 Mult",
            effect: (score) => { 
                score.mult += 4; 
                return true; // trueを返すと発動演出が入る
            }
        },
        'j_greedy_joker': {
            name: "Greedy Joker",
            pos: { x: 6, y: 1 },
            desc: "Played Diamond cards give +4 Mult",
            effect: (score, context) => {
                let triggered = false;
                context.scoringCards.forEach(card => {
                    if (card.suit === 'Diamonds') {
                        score.mult += 4;
                        triggered = true;
                    }
                });
                return triggered;
            }
        },
        'j_banner': {
            name: "Banner",
            pos: { x: 1, y: 2 },
            desc: "+40 Chips for each remaining Discard",
            effect: (score, context) => {
                if (context.discards > 0) {
                    score.chips += (40 * context.discards);
                    return true;
                }
                return false;
            }
        },
        'j_mystic_summit': {
            name: "Mystic Summit",
            pos: { x: 2, y: 2 },
            desc: "+15 Mult when 0 Discards remaining",
            effect: (score, context) => {
                if (context.discards === 0) {
                    score.mult += 15;
                    return true;
                }
                return false;
            }
        }
    };
}