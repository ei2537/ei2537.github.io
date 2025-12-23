/**
 * Balatro Web - Global Constants & Game State
 * Based on globals.lua from LocalThunk
 */

// Colors converted from Lua HEX() to PixiJS friendly Hex Numbers
export const C = {
    MULT: 0xFE5F55,
    CHIPS: 0x009dff,
    MONEY: 0xf3b958,
    XMULT: 0xFE5F55,
    FILTER: 0xff9a00,
    BLUE: 0x009dff,
    RED: 0xFE5F55,
    GREEN: 0x4BC292,
    PALE_GREEN: 0x56a887,
    ORANGE: 0xfda200,
    IMPORTANT: 0xff9a00,
    GOLD: 0xeac058,
    YELLOW: 0xFFFF00, // Lua {1,1,0,1}
    CLEAR: 0x00000000, // Transparent
    WHITE: 0xFFFFFF,
    PURPLE: 0x8867a5,
    BLACK: 0x374244,
    L_BLACK: 0x4f6367,
    GREY: 0x5f7377,
    CHANCE: 0x4BC292,
    JOKER_GREY: 0xbfc7d5,
    VOUCHER: 0xcb724c,
    BOOSTER: 0x646eb7,
    ETERNAL: 0xc75985,
    PERISHABLE: 0x4f5da1,
    RENTAL: 0xb18f43,
    
    // Dynamic UI Colors (Will be updated during runtime based on blind)
    DYN_UI: {
        MAIN: 0x374244,
        DARK: 0x374244,
        BOSS_MAIN: 0x374244,
        BOSS_DARK: 0x374244,
        BOSS_PALE: 0x374244
    },

    // Suit Colors
    SUITS: {
        Hearts: 0xFE5F55,
        Diamonds: 0xFE5F55,
        Spades: 0x374649,
        Clubs: 0x424e54,
    },

    // UI Colors
    UI: {
        TEXT_LIGHT: 0xFFFFFF,
        TEXT_DARK: 0x4F6367,
        TEXT_INACTIVE: 0x888888, // Alpha needs handling in renderer
        BACKGROUND_LIGHT: 0xB8D8D8,
        BACKGROUND_WHITE: 0xFFFFFF,
        BACKGROUND_DARK: 0x7A9E9F,
        BACKGROUND_INACTIVE: 0x666666,
        OUTLINE_LIGHT: 0xD8D8D8,
        OUTLINE_DARK: 0x7A9E9F,
        HOVER: 0x000000 // Alpha 0.33 applied in renderer
    },

    // Card Set Colors
    SET: {
        Default: 0xcdd9dc,
        Enhanced: 0xcdd9dc,
        Joker: 0x424e54,
        Tarot: 0x424e54,
        Planet: 0x424e54,
        Spectral: 0x424e54,
        Voucher: 0x424e54,
    },
    
    // Rarity Colors
    RARITY: [
        0x009dff, // Common
        0x4BC292, // Uncommon
        0xfe5f55, // Rare
        0xb26cbb  // Legendary
    ],

    // Hand Level Colors (Level 1 to 7+)
    HAND_LEVELS: [
        0xefefef, // Level 1
        0x95acff,
        0x65efaf,
        0xfae37e,
        0xffc052,
        0xf87d75,
        0xcaa0ef  // Level 7+
    ]
};

// Game Constants
export const G = {
    // Game Dimensions (Virtual Resolution)
    // Based on TILESIZE=20, TILESCALE=3.65 (approx width ~1000-1200 logical units)
    // We will use a fixed logical resolution and scale up/down.
    ROOM: {
        W: 1200, 
        H: 800,
        T: { x:0, y:0, w:0, h:0 } // Transformed coordinates
    },

    // Card Dimensions (from globals.lua)
    // self.CARD_W = 2.4*35/41 => approx 2.05 game units
    // self.CARD_H = 2.4*47/41 => approx 2.75 game units
    CARD_W: 2.05, 
    CARD_H: 2.75,
    TILESIZE: 20,
    TILESCALE: 3.65,

    // Time & Frame
    TIMERS: {
        TOTAL: 0,
        REAL: 0,
        REAL_SHADER: 0,
        UPTIME: 0
    },
    FPS: 60,
    SPEEDFACTOR: 1,

    // Enums for Game States (from globals.lua)
    STATES: {
        SELECTING_HAND: 1,
        HAND_PLAYED: 2,
        DRAW_TO_HAND: 3,
        GAME_OVER: 4,
        SHOP: 5,
        PLAY_TAROT: 6,
        BLIND_SELECT: 7,
        ROUND_EVAL: 8,
        TAROT_PACK: 9,
        PLANET_PACK: 10,
        MENU: 11,
        TUTORIAL: 12,
        SPLASH: 13,
        SANDBOX: 14,
        SPECTRAL_PACK: 15,
        DEMO_CTA: 16,
        STANDARD_PACK: 17,
        BUFFOON_PACK: 18,
        NEW_ROUND: 19,
    },

    // Instance Lists (Registry for active game objects)
    I: {
        CARD: [],
        MOVEABLE: [],
        UIBOX: [],
        PARTICLES: [],
        JOKER: [],
        CONSUMABLE: []
    },

    // Game Logic Data Stores (Populated from other files)
    P_CENTERS: {}, // Card definitions
    P_BLINDS: {},  // Blind definitions
    P_TAGS: {},    // Tag definitions
    P_SEALS: {},
    P_CARDS: {},   // Standard 52 card definitions

    // Runtime Game State
    GAME: {
        round_resets: {
            ante: 1,
            round: 0,
        },
        dollars: 4,
        hands: {}, // Hand stats (level, chips, mult)
        jokers: { cards: [] },
        consumeables: { cards: [] },
        hand: { cards: [] },
        deck: { cards: [] },
        discard: { cards: [] },
        play: { cards: [] },
        blind: null,
    },
    
    // Asset references (Atlases)
    ASSET_ATLAS: {},
    
    // Core Functions
    FUNCS: {},
};

// Helper: Hex String to Int (if needed for runtime conversion)
export function HEX(hexStr) {
    return parseInt(hexStr.replace('#', ''), 16);
}

// Helper: Mix two colors
export function mixColours(c1, c2, ratio) {
    // Simplistic RGB Lerp for visual effects
    const r = Math.round(((c1 >> 16) & 0xFF) * ratio + ((c2 >> 16) & 0xFF) * (1 - ratio));
    const g = Math.round(((c1 >> 8) & 0xFF) * ratio + ((c2 >> 8) & 0xFF) * (1 - ratio));
    const b = Math.round((c1 & 0xFF) * ratio + (c2 & 0xFF) * (1 - ratio));
    return (r << 16) | (g << 8) | b;
}