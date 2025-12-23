import { G } from '../globals.js';

/**
 * Poker Hand Evaluation Logic
 * Ported from functions/misc_functions.lua
 */
export class PokerLogic {
    
    /**
     * Evaluate the poker hand from a set of cards
     * @param {Array<Card>} hand - Array of Card objects
     * @returns {Object} - Results table compatible with Lua output
     */
    static evaluatePokerHand(hand) {
        // Lua: results table initialization
        const results = {
            "Flush Five": [],
            "Flush House": [],
            "Five of a Kind": [],
            "Straight Flush": [],
            "Four of a Kind": [],
            "Full House": [],
            "Flush": [],
            "Straight": [],
            "Three of a Kind": [],
            "Two Pair": [],
            "Pair": [],
            "High Card": [],
            top: null
        };

        // Helper parts calculation
        const parts = {
            _5: this.getXSame(5, hand),
            _4: this.getXSame(4, hand),
            _3: this.getXSame(3, hand),
            _2: this.getXSame(2, hand),
            _flush: this.getFlush(hand),
            _straight: this.getStraight(hand),
            _highest: this.getHighest(hand)
        };

        // --- Hand Determination Logic (Order matters!) ---

        // Flush Five
        if (parts._5.length > 0 && parts._flush.length > 0) {
            results["Flush Five"] = parts._5;
            if (!results.top) results.top = { hand: "Flush Five", cards: parts._5[0] };
        }

        // Flush House (3 of a kind + 2 of a kind, all flush)
        if (parts._3.length > 0 && parts._2.length > 0 && parts._flush.length > 0) {
            // Need to verify strict suit matching in JS if needed, 
            // but based on Lua logic, if both sets exist and flush exists, it checks out.
            // Lua logic constructs the hand by combining the sets.
            const fh_hand = [...parts._3[0], ...parts._2[0]];
            results["Flush House"].push(fh_hand);
            if (!results.top) results.top = { hand: "Flush House", cards: fh_hand };
        }

        // Five of a Kind
        if (parts._5.length > 0) {
            results["Five of a Kind"] = parts._5;
            if (!results.top) results.top = { hand: "Five of a Kind", cards: parts._5[0] };
        }

        // Straight Flush
        if (parts._flush.length > 0 && parts._straight.length > 0) {
            // Intersection logic required: check if straight cards are also flush cards
            // Simplified for now assuming standard deck constraints
            results["Straight Flush"] = parts._straight;
            if (!results.top) results.top = { hand: "Straight Flush", cards: parts._straight[0] };
        }

        // Four of a Kind
        if (parts._4.length > 0) {
            results["Four of a Kind"] = parts._4;
            if (!results.top) results.top = { hand: "Four of a Kind", cards: parts._4[0] };
        }

        // Full House
        if (parts._3.length > 0 && parts._2.length > 0) {
            const fh_hand = [...parts._3[0], ...parts._2[0]];
            results["Full House"].push(fh_hand);
            if (!results.top) results.top = { hand: "Full House", cards: fh_hand };
        }

        // Flush
        if (parts._flush.length > 0) {
            results["Flush"] = parts._flush;
            if (!results.top) results.top = { hand: "Flush", cards: parts._flush[0] };
        }

        // Straight
        if (parts._straight.length > 0) {
            results["Straight"] = parts._straight;
            if (!results.top) results.top = { hand: "Straight", cards: parts._straight[0] };
        }

        // Three of a Kind
        if (parts._3.length > 0) {
            results["Three of a Kind"] = parts._3;
            if (!results.top) results.top = { hand: "Three of a Kind", cards: parts._3[0] };
        }

        // Two Pair
        if (parts._2.length >= 2) {
            const tp_hand = [...parts._2[0], ...parts._2[1]];
            results["Two Pair"].push(tp_hand);
            if (!results.top) results.top = { hand: "Two Pair", cards: tp_hand };
        }

        // Pair
        if (parts._2.length > 0) {
            results["Pair"] = parts._2;
            if (!results.top) results.top = { hand: "Pair", cards: parts._2[0] };
        }

        // High Card
        if (parts._highest.length > 0) {
            results["High Card"] = parts._highest;
            if (!results.top) results.top = { hand: "High Card", cards: parts._highest[0] };
        }

        return results;
    }

    /**
     * Get X cards of the same rank
     */
    static getXSame(num, hand) {
        let vals = {}; // Group by ID (rank)
        
        for (let i = 0; i < hand.length; i++) {
            let id = hand[i].base.id;
            if (!vals[id]) vals[id] = [];
            vals[id].push(hand[i]);
        }

        let ret = [];
        for (let id in vals) {
            if (vals[id].length >= num) {
                // Return just the first 'num' cards to match Lua's behavior if > num
                ret.push(vals[id].slice(0, num));
            }
        }
        return ret;
    }

    /**
     * Get Flush
     */
    static getFlush(hand) {
        let ret = [];
        let suits = ["Spades", "Hearts", "Clubs", "Diamonds"];
        // Check jokers for "Four Fingers" (allow 4 card flush)
        // const fourFingers = G.JOKERS.has('Four Fingers'); 
        const minCount = 5; // - (fourFingers ? 1 : 0);

        if (hand.length < minCount) return ret;

        for (let s of suits) {
            let t = [];
            for (let card of hand) {
                // isSuit logic should handle Wild Cards
                if (card.isSuit(s)) {
                    t.push(card);
                }
            }
            if (t.length >= minCount) {
                ret.push(t);
                return ret; // Lua returns early
            }
        }
        return ret;
    }

    /**
     * Get Straight
     */
    static getStraight(hand) {
        let ret = [];
        // const fourFingers = G.JOKERS.has('Four Fingers');
        // const shortcut = G.JOKERS.has('Shortcut');
        const minCount = 5; // - (fourFingers ? 1 : 0);
        
        if (hand.length < minCount) return ret;

        // Sort by ID for straight check
        let sortedHand = [...hand].sort((a, b) => a.base.id - b.base.id);
        
        // Straight Logic (Simplified for now, needs full implementation of Shortcut/Ace-Low)
        // This is where Lua's complex indexing logic resides.
        // JS implementation:
        let consecutive = 1;
        let t = [sortedHand[0]];
        
        for (let i = 0; i < sortedHand.length - 1; i++) {
            let idCurrent = sortedHand[i].base.id;
            let idNext = sortedHand[i+1].base.id;
            
            if (idNext === idCurrent + 1) {
                consecutive++;
                t.push(sortedHand[i+1]);
            } else if (idNext === idCurrent) {
                // Skip duplicate rank (don't break straight, but don't add count)
            } else {
                consecutive = 1;
                t = [sortedHand[i+1]];
            }

            if (consecutive >= minCount) {
                ret.push(t.slice(-minCount)); // Grab last 5
                return ret;
            }
        }
        
        // Ace Low check (A, 2, 3, 4, 5) needs separate handling if A=14
        return ret;
    }

    /**
     * Get Highest Card
     */
    static getHighest(hand) {
        if (hand.length === 0) return [];
        let highest = hand[0];
        for (let card of hand) {
            if (card.base.id > highest.base.id) highest = card;
        }
        return [[highest]];
    }
}