import * as PIXI from 'pixi.js';
import { Moveable } from '../engine/Moveable.js';
import { G } from '../globals.js';

export class Card extends Moveable {
    constructor(x, y, w, h, cardDef, centerDef, textureSet) {
        super(x, y, w, h);
        
        this.cardDef = cardDef;
        this.centerDef = centerDef;
        this.textureSet = textureSet;

        this.container = new PIXI.Container();
        
        // スプライト参照用
        this.children = {
            shadow: null,
            back: null,
            center: null, // ← これが「台紙（白い部分）」です
            front: null,  // ← これが「絵柄（ハートの7など）」です
        };

        this.facing = 'front'; 
        this.spriteFacing = 'front';
        
        this.base = { suit: 'Spades', value: 'Ace', id: 14, nominal: 11 }; // 初期値

        if (this.cardDef) this.initBase(this.cardDef);
        this.initSprites();
    }

    initBase(card) {
        this.base.name = card.name;
        this.base.suit = card.suit;
        this.base.value = card.value;
        // ... (ID計算ロジックは前回と同じなので省略可、必要なら前回のコードを使用) ...
        // 簡易実装としてIDだけ設定しておきます
        const rankMap = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'T':10,'Jack':11,'Queen':12,'King':13,'Ace':14};
        this.base.id = rankMap[card.value] || 0;
    }

    isSuit(suit) {
        return this.base.suit === suit;
    }

    initSprites() {
        const texW = 71; 
        const texH = 95;

        // --- 1. Back (裏面) ---
        // 赤デッキの位置 (Enhancers.png の x:0, y:0 と仮定。定義に合わせて調整)
        const backPos = G.P_CENTERS['b_red'] ? G.P_CENTERS['b_red'].pos : {x:0, y:0};
        const backTex = new PIXI.Texture(this.textureSet.centers.baseTexture, new PIXI.Rectangle(backPos.x * texW, backPos.y * texH, texW, texH));
        
        this.children.back = new PIXI.Sprite(backTex);
        this.children.back.anchor.set(0.5);
        this.children.back.width = this.T.w * G.TILESIZE; 
        this.children.back.height = this.T.h * G.TILESIZE;
        this.children.back.visible = false;
        this.container.addChild(this.children.back);

        // --- 2. Center (表面の台紙) ---
        // Enhancers.png から取得。通常は c_base (x:1, y:0) が白いカード
        if (this.centerDef) {
            const centerPos = this.centerDef.pos;
            const centerTex = new PIXI.Texture(this.textureSet.centers.baseTexture, new PIXI.Rectangle(centerPos.x * texW, centerPos.y * texH, texW, texH));

            this.children.center = new PIXI.Sprite(centerTex);
            this.children.center.anchor.set(0.5);
            this.children.center.width = this.T.w * G.TILESIZE;
            this.children.center.height = this.T.h * G.TILESIZE;
            this.container.addChild(this.children.center);
        }

        // --- 3. Front (表面の絵柄) ---
        // 8BitDeck.png から取得。
        if (this.cardDef) {
            const frontPos = this.cardDef.pos;
            const frontTex = new PIXI.Texture(this.textureSet.cards.baseTexture, new PIXI.Rectangle(frontPos.x * texW, frontPos.y * texH, texW, texH));

            this.children.front = new PIXI.Sprite(frontTex);
            this.children.front.anchor.set(0.5);
            this.children.front.width = this.T.w * G.TILESIZE;
            this.children.front.height = this.T.h * G.TILESIZE;
            this.container.addChild(this.children.front);
        }
    }

    flip() {
        if (this.facing === 'front') {
            this.facing = 'back';
            this.pinch.x = true;
        } else {
            this.facing = 'front';
            this.pinch.x = true;
        }
    }

    update(dt) {
        super.update(dt);

        // フリップアニメーション制御
        if (this.pinch.x && this.VT.w < 0.1) {
            this.spriteFacing = (this.facing === 'back') ? 'back' : 'front';
            this.pinch.x = false;
        }

        // 座標更新
        const pixelX = this.VT.x * G.TILESIZE * G.TILESCALE;
        const pixelY = this.VT.y * G.TILESIZE * G.TILESCALE;
        
        this.container.position.set(
            pixelX + (this.VT.w * G.TILESIZE * G.TILESCALE / 2), 
            pixelY + (this.VT.h * G.TILESIZE * G.TILESCALE / 2)
        );
        this.container.rotation = this.VT.r;
        this.container.scale.set(this.VT.scale * G.TILESCALE, this.VT.scale * G.TILESCALE);

        // 描画切り替え
        const squeezeFactor = this.VT.w / this.T.w;
        
        if (this.spriteFacing === 'front') {
            // 表面: Center(台紙) と Front(絵柄) を表示
            if (this.children.center) {
                this.children.center.visible = true;
                this.children.center.scale.x = squeezeFactor;
            }
            if (this.children.front) {
                this.children.front.visible = true;
                this.children.front.scale.x = squeezeFactor;
            }
            if (this.children.back) this.children.back.visible = false;
        } else {
            // 裏面: Backのみ表示
            if (this.children.center) this.children.center.visible = false;
            if (this.children.front) this.children.front.visible = false;
            if (this.children.back) {
                this.children.back.visible = true;
                this.children.back.scale.x = squeezeFactor;
            }
        }
    }
}