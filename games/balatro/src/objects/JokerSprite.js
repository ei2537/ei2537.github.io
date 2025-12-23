import * as PIXI from 'pixi.js';
import { AssetLoader } from '../AssetLoader.js';
import { G } from '../globals.js';
import { Moveable } from '../engine/Moveable.js';

export class JokerSprite extends Moveable {
    constructor(key, jokerDef) {
        // ジョーカーのサイズはカードと同じ
        super(0, 0, G.CARD_W, G.CARD_H);
        
        this.key = key;
        this.def = jokerDef;
        this.container = new PIXI.Container();

        // 画像生成
        const tex = AssetLoader.getJokerTexture(jokerDef.pos);
        this.sprite = new PIXI.Sprite(tex);
        this.sprite.anchor.set(0.5);
        
        // サイズ合わせ
        this.sprite.width = this.T.w * G.TILESIZE;
        this.sprite.height = this.T.h * G.TILESIZE;

        this.container.addChild(this.sprite);

        // 物理演算用
        this.container.eventMode = 'static';
        this.container.cursor = 'help'; // ホバーで説明出る感
        
        this.container.on('pointerover', () => {
            this.VT.scale = 1.1;
            this.container.zIndex = 100; // 最前面へ
        });
        this.container.on('pointerout', () => {
            this.VT.scale = 1.0;
            this.container.zIndex = 0;
        });
    }

    // 効果発動時のアニメーション
    triggerEffect() {
        this.juiceUp(0.6, 0.2); // ぷるんと揺れる
        // TODO: ここに「+4 Mult」みたいなポップアップを出すと完璧
    }

    update(dt) {
        super.update(dt);
        
        const pxX = this.VT.x * G.TILESIZE * G.TILESCALE;
        const pxY = this.VT.y * G.TILESIZE * G.TILESCALE;
        
        this.container.position.set(pxX, pxY);
        this.container.scale.set(this.VT.scale * G.TILESCALE);
        this.container.rotation = this.VT.r;
    }
}