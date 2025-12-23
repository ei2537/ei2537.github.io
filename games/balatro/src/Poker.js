export class Poker {
    // ランクの強さ定義
    static RANK_TO_ID = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        '10': 10, 'Jack': 11, 'Queen': 12, 'King': 13, 'Ace': 14
    };

    // ランクのスコア値（J,Q,Kは10、Aは11）
    static RANK_TO_CHIPS = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        '10': 10, 'Jack': 10, 'Queen': 10, 'King': 10, 'Ace': 11
    };

    // 役の基本スコア定義
    static HAND_STATS = {
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
        "Five of a Kind":   { chips: 120, mult: 12 }
    };

    /**
     * 選択されたカードから役とスコアを計算
     */
    static evaluate(cards) {
        if (cards.length === 0) return this.formatResult("High Card", []);

        const handData = cards.map(c => ({
            id: this.RANK_TO_ID[c.rank],
            chip: this.RANK_TO_CHIPS[c.rank],
            suit: c.suit,
            card: c
        })).sort((a, b) => a.id - b.id);

        const counts = {};
        const suits = {};
        handData.forEach(c => {
            counts[c.id] = (counts[c.id] || 0) + 1;
            suits[c.suit] = (suits[c.suit] || 0) + 1;
        });

        const countValues = Object.values(counts).sort((a, b) => b - a);
        const isFlush = Object.values(suits).some(count => count >= 5);
        
        let isStraight = false;
        if (handData.length >= 5) {
            let consecutive = 1;
            for (let i = 0; i < handData.length - 1; i++) {
                if (handData[i+1].id === handData[i].id + 1) consecutive++;
                else if (handData[i+1].id !== handData[i].id) consecutive = 1;
                if (consecutive >= 5) isStraight = true;
            }
        }

        let handName = "High Card";

        if (isFlush && isStraight) {
            handName = (handData[handData.length-1].id === 14 && handData[0].id === 10) ? "Royal Flush" : "Straight Flush";
        } else if (countValues[0] === 5) {
            handName = "Five of a Kind";
        } else if (countValues[0] === 4) {
            handName = "Four of a Kind";
        } else if (countValues[0] === 3 && countValues[1] >= 2) {
            handName = "Full House";
        } else if (isFlush) {
            handName = "Flush";
        } else if (isStraight) {
            handName = "Straight";
        } else if (countValues[0] === 3) {
            handName = "Three of a Kind";
        } else if (countValues[0] === 2 && countValues[1] === 2) {
            handName = "Two Pair";
        } else if (countValues[0] === 2) {
            handName = "Pair";
        }

        return this.formatResult(handName, handData);
    }

    static formatResult(name, cards) {
        const stats = this.HAND_STATS[name];
        let playedChips = 0;
        cards.forEach(c => playedChips += c.chip);

        const totalChips = stats.chips + playedChips;
        const totalMult = stats.mult;
        
        return {
            name: name,
            baseChips: stats.chips,
            baseMult: stats.mult,
            playedChips: playedChips,
            score: totalChips * totalMult,
            text: `${totalChips} x ${totalMult} = ${totalChips * totalMult}`
        };
    }
}