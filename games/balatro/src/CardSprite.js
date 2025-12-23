import * as PIXI from 'pixi.js';
import { AssetLoader } from './AssetLoader.js';

export class CardSprite extends PIXI.Container {
    constructor(rank, suit) {
        super();
        this.rank = rank;
        this.suit = suit;
        this.selected = false;

        // 1. 台紙 (白)
        const base = new PIXI.Sprite(AssetLoader.textures.base);
        base.anchor.set(0.5);
        this.addChild(base);

        // 2. 絵柄 (ランク・スート)
        const front = new PIXI.Sprite(AssetLoader.getCardTexture(rank, suit));
        front.anchor.set(0.5);
        this.addChild(front);

        // 3. インタラクション
        this.eventMode = 'static';
        this.cursor = 'pointer';
        this.on('pointerdown', () => this.toggleSelect());
    }

    toggleSelect() {
        this.selected = !this.selected;
    }
}