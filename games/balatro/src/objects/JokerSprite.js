import * as PIXI from 'pixi.js';
import { AssetLoader } from '../AssetLoader.js';
import { G } from '../globals.js';
import { Moveable } from '../engine/Moveable.js';

export class JokerSprite extends Moveable {
    constructor(key, jokerDef) {
        super(0, 0, G.CARD_W, G.CARD_H);
        
        this.key = key;
        this.def = jokerDef;
        this.container = new PIXI.Container();

        this.price = 0;
        this.buyButton = null;

        // 画像生成
        const tex = AssetLoader.getJokerTexture(jokerDef.pos);
        this.sprite = new PIXI.Sprite(tex);
        this.sprite.anchor.set(0.5);
        
        this.sprite.width = this.T.w * G.TILESIZE;
        this.sprite.height = this.T.h * G.TILESIZE;

        this.container.addChild(this.sprite);

        this.container.eventMode = 'static';
        this.container.cursor = 'help';
        
        // --- Tooltip Event Listeners ---
        this.container.on('pointerover', () => {
            this.VT.scale = 1.1;
            this.container.zIndex = 100;

            // 画面上の絶対座標を取得してツールチップを表示
            const bounds = this.container.getBounds();
            if (G.showTooltip) {
                G.showTooltip(this.def.desc, bounds);
            }
        });

        this.container.on('pointerout', () => {
            this.VT.scale = 1.0;
            this.container.zIndex = 0;
            
            // ツールチップ非表示
            if (G.hideTooltip) {
                G.hideTooltip();
            }
        });
    }

    triggerEffect() {
        this.juiceUp(0.6, 0.2);
    }

    update(dt) {
        super.update(dt);
        
        // Pixi座標変換 (物理演算 -> 描画)
        const pxX = this.VT.x; // layoutJokersでPixi座標系を入れているため変換不要
        const pxY = this.VT.y;
        
        this.container.position.set(pxX, pxY);
        this.container.scale.set(this.VT.scale * G.TILESCALE);
        this.container.rotation = this.VT.r;
    }
}