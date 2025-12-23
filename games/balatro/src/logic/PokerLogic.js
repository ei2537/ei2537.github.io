import { G } from '../globals.js';

export class PokerLogic {
    // ... evaluatePokerHand and getXSame logic remains the same ...

    static evaluatePokerHand(hand) {
        const results = {
            "Flush Five": [], "Flush House": [], "Five of a Kind": [], "Straight Flush": [],
            "Four of a Kind": [], "Full House": [], "Flush": [], "Straight": [],
            "Three of a Kind": [], "Two Pair": [], "Pair": [], "High Card": [],
            top: null
        };

        const parts = {
            _5: this.getXSame(5, hand),
            _4: this.getXSame(4, hand),
            _3: this.getXSame(3, hand),
            _2: this.getXSame(2, hand),
            _flush: this.getFlush(hand),
            _straight: this.getStraight(hand),
            _highest: this.getHighest(hand)
        };

        // Determine hierarchy (Simplified for brevity, same logic as before)
        if (parts._5.length > 0 && parts._flush.length > 0) {
            results["Flush Five"] = parts._5;
            if (!results.top) results.top = { hand: "Flush Five", cards: parts._5[0] };
        }
        else if (parts._3.length > 0 && parts._2.length > 0 && parts._flush.length > 0) {
            const fh_hand = [...parts._3[0], ...parts._2[0]];
            results["Flush House"].push(fh_hand);
            if (!results.top) results.top = { hand: "Flush House", cards: fh_hand };
        }
        else if (parts._5.length > 0) {
            results["Five of a Kind"] = parts._5;
            if (!results.top) results.top = { hand: "Five of a Kind", cards: parts._5[0] };
        }
        else if (parts._flush.length > 0 && parts._straight.length > 0) {
            results["Straight Flush"] = parts._straight;
            if (!results.top) results.top = { hand: "Straight Flush", cards: parts._straight[0] };
        }
        else if (parts._4.length > 0) {
            results["Four of a Kind"] = parts._4;
            if (!results.top) results.top = { hand: "Four of a Kind", cards: parts._4[0] };
        }
        else if (parts._3.length > 0 && parts._2.length > 0) {
            const fh_hand = [...parts._3[0], ...parts._2[0]];
            results["Full House"].push(fh_hand);
            if (!results.top) results.top = { hand: "Full House", cards: fh_hand };
        }
        else if (parts._flush.length > 0) {
            results["Flush"] = parts._flush;
            if (!results.top) results.top = { hand: "Flush", cards: parts._flush[0] };
        }
        else if (parts._straight.length > 0) {
            results["Straight"] = parts._straight;
            if (!results.top) results.top = { hand: "Straight", cards: parts._straight[0] };
        }
        else if (parts._3.length > 0) {
            results["Three of a Kind"] = parts._3;
            if (!results.top) results.top = { hand: "Three of a Kind", cards: parts._3[0] };
        }
        else if (parts._2.length >= 2) {
            const tp_hand = [...parts._2[0], ...parts._2[1]];
            results["Two Pair"].push(tp_hand);
            if (!results.top) results.top = { hand: "Two Pair", cards: tp_hand };
        }
        else if (parts._2.length > 0) {
            results["Pair"] = parts._2;
            if (!results.top) results.top = { hand: "Pair", cards: parts._2[0] };
        }
        else if (parts._highest.length > 0) {
            results["High Card"] = parts._highest;
            if (!results.top) results.top = { hand: "High Card", cards: parts._highest[0] };
        }

        return results;
    }

    static getXSame(num, hand) {
        let vals = {};
        for (let i = 0; i < hand.length; i++) {
            // FIXED: Now hand[i].base.id is guaranteed to exist
            let id = hand[i].base.id;
            if (!vals[id]) vals[id] = [];
            vals[id].push(hand[i]);
        }
        let ret = [];
        for (let id in vals) {
            if (vals[id].length >= num) {
                ret.push(vals[id].slice(0, num));
            }
        }
        return ret;
    }

    static getFlush(hand) {
        let ret = [];
        let suits = ["Spades", "Hearts", "Clubs", "Diamonds"];
        const minCount = 5;

        if (hand.length < minCount) return ret;

        for (let s of suits) {
            let t = [];
            for (let card of hand) {
                // FIXED: card.isSuit() is now implemented
                if (card.isSuit(s)) {
                    t.push(card);
                }
            }
            if (t.length >= minCount) {
                ret.push(t);
                return ret; 
            }
        }
        return ret;
    }

    static getStraight(hand) {
        let ret = [];
        const minCount = 5;
        if (hand.length < minCount) return ret;

        let sortedHand = [...hand].sort((a, b) => a.base.id - b.base.id);
        
        // Ace High handling (if ID is 14) -> Can be 1 for A-2-3-4-5 straight
        // For simplicity in this demo, standard logic:
        
        let consecutive = 1;
        let t = [sortedHand[0]];
        
        for (let i = 0; i < sortedHand.length - 1; i++) {
            let idCurrent = sortedHand[i].base.id;
            let idNext = sortedHand[i+1].base.id;
            
            if (idNext === idCurrent + 1) {
                consecutive++;
                t.push(sortedHand[i+1]);
            } else if (idNext !== idCurrent) {
                consecutive = 1;
                t = [sortedHand[i+1]];
            }

            if (consecutive >= minCount) {
                ret.push(t.slice(-minCount)); 
                return ret;
            }
        }
        
        // Special case: Wheel (A-2-3-4-5) logic would check if A(14) exists and 2,3,4,5 exist.
        
        return ret;
    }

    static getHighest(hand) {
        if (hand.length === 0) return [];
        let highest = hand[0];
        for (let card of hand) {
            if (card.base.id > highest.base.id) highest = card;
        }
        return [[highest]];
    }
}