import * as PIXI from 'pixi.js';

export class AssetLoader {
    static textures = {};

    static async load() {
        PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;
        
        const sheet = await PIXI.Assets.load('resources/textures/1x/8BitDeck.png');
        const centers = await PIXI.Assets.load('resources/textures/1x/Enhancers.png');
        const jokers = await PIXI.Assets.load('resources/textures/1x/Jokers.png'); // 追加

        const w = 71;
        const h = 95;

        // --- Cards ---
        const suits = ['Hearts', 'Clubs', 'Diamonds', 'Spades'];
        const ranks = ['2','3','4','5','6','7','8','9','10','Jack','Queen','King','Ace'];

        this.textures.cards = {};
        suits.forEach((suit, row) => {
            ranks.forEach((rank, col) => {
                const rect = new PIXI.Rectangle(col * w, row * h, w, h);
                this.textures.cards[`${rank}_${suit}`] = new PIXI.Texture(sheet.baseTexture, rect);
            });
        });

        // --- Centers & Back ---
        this.textures.back = new PIXI.Texture(centers.baseTexture, new PIXI.Rectangle(0, 0, w, h));
        this.textures.base = new PIXI.Texture(centers.baseTexture, new PIXI.Rectangle(w, 0, w, h));

        // --- Jokers ---
        // Jokers.png もグリッド状 (例: 10x16)
        this.textures.jokers = {};
        // 簡易的に全エリアをキャッシュせず、getJokerTextureで動的に切り出す形にします
        this.jokerBaseTexture = jokers.baseTexture;
    }

    static getCardTexture(rank, suit) {
        return this.textures.cards[`${rank}_${suit}`];
    }

    static getJokerTexture(pos) {
        const w = 71;
        const h = 95;
        const rect = new PIXI.Rectangle(pos.x * w, pos.y * h, w, h);
        return new PIXI.Texture(this.jokerBaseTexture, rect);
    }
}