import * as PIXI from 'pixi.js';
import { Moveable } from '../engine/Moveable.js';
import { G } from '../globals.js';

/**
 * Card: The core game object.
 * Extends Moveable to inherit physics/juice, manages PixiJS rendering.
 */
export class Card extends Moveable {
    /**
     * @param {Object} cardDef - { suit, value, name, pos } from G.P_CARDS
     * @param {Object} centerDef - { set, name, config, pos } from G.P_CENTERS (Back/Joker/etc)
     * @param {Object} textureSet - { cards: Texture, centers: Texture }
     */
    constructor(x, y, w, h, cardDef, centerDef, textureSet) {
        super(x, y, w, h);
        
        this.cardDef = cardDef;   // e.g. 2 of Hearts data
        this.centerDef = centerDef; // e.g. Red Deck or Joker data
        
        // 重要: ここで受け取った textureSet を this.textureSet に保存します
        this.textureSet = textureSet;

        // Base stats (Rank, Suit, ID for poker eval)
        this.base = {
            name: 'Template',
            suit: 'Spades',
            value: 'Ace',
            nominal: 0,
            id: 0,
            face_nominal: 0,
            cost: 0
        };

        // PixiJS Container
        this.container = new PIXI.Container();
        
        // Sprite Layers
        this.children = {
            shadow: null,
            back: null,
            center: null,
            front: null,
        };

        this.facing = 'front'; 
        this.spriteFacing = 'front';

        // Initialize Logic and Sprites
        if (this.cardDef) {
            this.initBase(this.cardDef);
        }
        this.initSprites();
    }

    /**
     * Initialize base stats based on card definition (Ported from card.lua set_base)
     */
    initBase(card) {
        this.base.name = card.name;
        this.base.suit = card.suit;
        this.base.value = card.value;
        this.base.nominal = 0;
        this.base.suit_nominal = 0;
        this.base.face_nominal = 0;

        // ID and Nominal mapping
        // 2-9 return number, T=10, J=11, Q=12, K=13, A=14
        const v = this.base.value;
        if (['2','3','4','5','6','7','8','9'].includes(v)) {
            this.base.nominal = parseInt(v);
            this.base.id = parseInt(v);
        } else if (v === '10' || v === 'T') {
            this.base.nominal = 10;
            this.base.id = 10;
        } else if (v === 'Jack') {
            this.base.nominal = 10;
            this.base.face_nominal = 0.1;
            this.base.id = 11;
        } else if (v === 'Queen') {
            this.base.nominal = 10;
            this.base.face_nominal = 0.2;
            this.base.id = 12;
        } else if (v === 'King') {
            this.base.nominal = 10;
            this.base.face_nominal = 0.3;
            this.base.id = 13;
        } else if (v === 'Ace') {
            this.base.nominal = 11;
            this.base.face_nominal = 0.4;
            this.base.id = 14;
        }
    }

    /**
     * Check if card matches suit (Used by PokerLogic)
     * @param {string} suit - 'Hearts', 'Clubs', etc.
     */
    isSuit(suit) {
        return this.base.suit === suit;
    }

    /**
     * Create Pixi Sprites based on definitions
     */
    initSprites() {
        const texW = 71; 
        const texH = 95;

        // 1. Setup Card Back (裏面)
        // Red Deckの座標を取得（なければ 0,0）
        const backPos = G.P_CENTERS['b_red'] ? G.P_CENTERS['b_red'].pos : {x:0, y:0};
        
        // 修正ポイント: this.textureSet.centers を使う
        const backRect = new PIXI.Rectangle(backPos.x * texW, backPos.y * texH, texW, texH);
        const backTex = new PIXI.Texture(this.textureSet.centers.baseTexture, backRect);
        
        this.children.back = new PIXI.Sprite(backTex);
        this.children.back.anchor.set(0.5);
        this.children.back.width = this.T.w * G.TILESIZE; 
        this.children.back.height = this.T.h * G.TILESIZE;
        this.children.back.visible = false;
        this.container.addChild(this.children.back);

        // 2. Setup Front (表面)
        if (this.cardDef) {
            const frontPos = this.cardDef.pos;
            
            // 修正ポイント: this.textureSet.cards を使う
            const frontRect = new PIXI.Rectangle(frontPos.x * texW, frontPos.y * texH, texW, texH);
            const frontTex = new PIXI.Texture(this.textureSet.cards.baseTexture, frontRect);

            this.children.front = new PIXI.Sprite(frontTex);
            this.children.front.anchor.set(0.5);
            this.children.front.width = this.T.w * G.TILESIZE;
            this.children.front.height = this.T.h * G.TILESIZE;
            this.container.addChild(this.children.front);
        }
    }

    /**
     * Trigger a flip animation
     */
    flip() {
        if (this.facing === 'front') {
            this.facing = 'back';
            this.pinch.x = true;
        } else {
            this.facing = 'front';
            this.pinch.x = true;
        }
    }

    /**
     * Main update loop for Card
     */
    update(dt) {
        super.update(dt);

        // フリップアニメーションの制御（幅が極小になったら絵柄を切り替える）
        if (this.pinch.x && this.VT.w < 0.1) {
            if (this.facing === 'back') {
                this.spriteFacing = 'back';
            } else {
                this.spriteFacing = 'front';
            }
            this.pinch.x = false;
        }

        // ゲーム内座標(VT)をPixiJSの描画座標(px)に変換
        const pixelX = this.VT.x * G.TILESIZE * G.TILESCALE;
        const pixelY = this.VT.y * G.TILESIZE * G.TILESCALE;
        
        // コンテナの更新
        this.container.position.set(
            pixelX + (this.VT.w * G.TILESIZE * G.TILESCALE / 2), 
            pixelY + (this.VT.h * G.TILESIZE * G.TILESCALE / 2)
        );
        this.container.rotation = this.VT.r;
        this.container.scale.set(this.VT.scale * G.TILESCALE, this.VT.scale * G.TILESCALE);

        // フリップ時の歪み補正（コンテナはJuiceで変形させたいので、子供のスプライトだけ潰す）
        const squeezeFactor = this.VT.w / this.T.w;
        
        if (this.children.front) {
            this.children.front.visible = (this.spriteFacing === 'front');
            this.children.front.scale.x = squeezeFactor;
        }
        if (this.children.back) {
            this.children.back.visible = (this.spriteFacing === 'back');
            this.children.back.scale.x = squeezeFactor;
        }
    }
}