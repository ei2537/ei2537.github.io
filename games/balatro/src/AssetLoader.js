import * as PIXI from 'pixi.js';

export class AssetLoader {
    static textures = {};

    static async load() {
        // 画像のロード（ドット絵設定）
        PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;
        
        const sheet = await PIXI.Assets.load('resources/textures/1x/8BitDeck.png');
        const centers = await PIXI.Assets.load('resources/textures/1x/Enhancers.png');

        // カードサイズ定義 (8BitDeck.png)
        const w = 71;
        const h = 95;

        // スートとランクの並び順定義
        const suits = ['Hearts', 'Clubs', 'Diamonds', 'Spades'];
        const ranks = ['2','3','4','5','6','7','8','9','10','Jack','Queen','King','Ace'];

        // テクスチャを切り出してキャッシュする
        this.textures.cards = {};
        
        suits.forEach((suit, row) => {
            ranks.forEach((rank, col) => {
                const rect = new PIXI.Rectangle(col * w, row * h, w, h);
                const tex = new PIXI.Texture(sheet.baseTexture, rect);
                this.textures.cards[`${rank}_${suit}`] = tex;
            });
        });

        // 裏面 (Enhancers.png の特定位置: 赤デッキは 0,0 と仮定)
        const backRect = new PIXI.Rectangle(0, 0, w, h);
        this.textures.back = new PIXI.Texture(centers.baseTexture, backRect);
        
        // 台紙 (Enhancers.png の白いカード: 1,0 と仮定)
        const baseRect = new PIXI.Rectangle(w, 0, w, h);
        this.textures.base = new PIXI.Texture(centers.baseTexture, baseRect);
    }

    static getCardTexture(rank, suit) {
        return this.textures.cards[`${rank}_${suit}`];
    }
}