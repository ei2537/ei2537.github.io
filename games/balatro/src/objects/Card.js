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
     * @param {Object} textureSet - { cards: Texture, centers: Texture }
     * @param {Object} centerDef - { set, name, config, pos } from G.P_CENTERS (Back/Joker/etc)
     * @param {PIXI.Texture} atlasTexture - The loaded spritesheet texture
     */
    constructor(x, y, w, h, cardDef, centerDef, atlasTexture) {
        super(x, y, w, h);
        
        this.cardDef = cardDef;   // e.g. 2 of Hearts data
        this.centerDef = centerDef; // e.g. Red Deck or Joker data
        this.atlas = atlasTexture;
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
        // TODO: Add Stone Card check, Wild Card check, Debuff check
        return this.base.suit === suit;
    }

    /**
     * Create Pixi Sprites based on definitions
     */
    initSprites() {
        const texW = 71; 
        const texH = 95;
        
        // 1. Setup Card Back
        const backPos = G.P_CENTERS['b_red'] ? G.P_CENTERS['b_red'].pos : {x:0, y:0};
        const backRect = new PIXI.Rectangle(backPos.x * texW, backPos.y * texH, texW, texH);
        const backTex = new PIXI.Texture(this.textureSet.centers.baseTexture, backRect);
        
        this.children.back = new PIXI.Sprite(backTex);
        this.children.back.anchor.set(0.5);
        this.children.back.width = this.T.w * G.TILESIZE; 
        this.children.back.height = this.T.h * G.TILESIZE;
        this.children.back.visible = false;
        this.container.addChild(this.children.back);

        // 2. Setup Front (Rank & Suit)
        if (this.cardDef) {
            const frontPos = this.cardDef.pos;
            const frontRect = new PIXI.Rectangle(frontPos.x * texW, frontPos.y * texH, texW, texH);
            const frontTex = new PIXI.Texture(this.textureSet.cards.baseTexture, frontRect);

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

        if (this.pinch.x && this.VT.w < 0.1) {
            if (this.facing === 'back') {
                this.spriteFacing = 'back';
            } else {
                this.spriteFacing = 'front';
            }
            this.pinch.x = false;
        }

        const pixelX = this.VT.x * G.TILESIZE * G.TILESCALE;
        const pixelY = this.VT.y * G.TILESIZE * G.TILESCALE;
        
        this.container.position.set(pixelX + (this.VT.w * G.TILESIZE * G.TILESCALE / 2), pixelY + (this.VT.h * G.TILESIZE * G.TILESCALE / 2));
        this.container.rotation = this.VT.r;
        this.container.scale.set(this.VT.scale * G.TILESCALE, this.VT.scale * G.TILESCALE);

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