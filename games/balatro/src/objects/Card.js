import * as PIXI from 'pixi.js';
import { Moveable } from '../engine/Moveable.js';
import { G, C } from '../globals.js';

/**
 * Card: The core game object.
 * Extends Moveable to inherit physics/juice, manages PixiJS rendering.
 */
export class Card extends Moveable {
    /**
     * @param {Object} cardDef - { suit, value, name, pos } from G.P_CARDS
     * @param {Object} centerDef - { set, name, config, pos } from G.P_CENTERS (Back/Joker/etc)
     * @param {PIXI.Texture} atlasTexture - The loaded spritesheet texture
     */
    constructor(x, y, w, h, cardDef, centerDef, atlasTexture) {
        super(x, y, w, h);
        
        this.cardDef = cardDef;   // e.g. 2 of Hearts data
        this.centerDef = centerDef; // e.g. Red Deck or Joker data
        this.atlas = atlasTexture;

        // PixiJS Container
        this.container = new PIXI.Container();
        // Pivot set to center for proper rotation/scaling
        // Note: We need to adjust position by w/2, h/2 when rendering because Pixi pivots are relative
        
        // Sprite Layers
        this.children = {
            shadow: null, // To be implemented (Shader/Graphics)
            back: null,
            center: null, // Enhanced effect / background
            front: null,  // Rank & Suit
        };

        this.facing = 'front'; // 'front' or 'back'
        this.spriteFacing = 'front'; // Actual render state (changes when width ~ 0 during flip)

        this.initSprites();
    }

    /**
     * Create Pixi Sprites based on definitions
     */
    initSprites() {
        // 1. Setup Card Back
        // Assuming we are using the standard asset layout
        // G.CARD_W/H logic needs to map to texture pixel dimensions.
        // For 8BitDeck.png: width=71px, height=95px per card.
        const texW = 71; 
        const texH = 95;

        // Define Back Texture
        // Default to Red Deck (pos {x:0, y:0}) if not specified
        const backPos = G.P_CENTERS['b_red'] ? G.P_CENTERS['b_red'].pos : {x:0, y:0};
        const backRect = new PIXI.Rectangle(backPos.x * texW, backPos.y * texH, texW, texH);
        const backTex = new PIXI.Texture(this.atlas.baseTexture, backRect);
        
        this.children.back = new PIXI.Sprite(backTex);
        this.children.back.anchor.set(0.5); // Center anchor
        this.children.back.width = this.T.w * G.TILESIZE; // Map game units to pixels
        this.children.back.height = this.T.h * G.TILESIZE;
        this.children.back.visible = false;
        this.container.addChild(this.children.back);

        // 2. Setup Front (Rank & Suit)
        if (this.cardDef) {
            const frontPos = this.cardDef.pos; // {x, y}
            const frontRect = new PIXI.Rectangle(frontPos.x * texW, frontPos.y * texH, texW, texH);
            const frontTex = new PIXI.Texture(this.atlas.baseTexture, frontRect);

            this.children.front = new PIXI.Sprite(frontTex);
            this.children.front.anchor.set(0.5);
            this.children.front.width = this.T.w * G.TILESIZE;
            this.children.front.height = this.T.h * G.TILESIZE;
            this.container.addChild(this.children.front);
        }

        // TODO: Center (Enhancements/Stone/Gold) implementation
    }

    /**
     * Trigger a flip animation
     */
    flip() {
        if (this.facing === 'front') {
            this.facing = 'back';
            this.pinch.x = true; // Trigger Moveable pinch logic
        } else {
            this.facing = 'front';
            this.pinch.x = true;
        }
    }

    /**
     * Main update loop for Card
     * Syncs Physics (Moveable) -> Renderer (Pixi)
     */
    update(dt) {
        // 1. Calculate Physics (Moveable.js)
        super.update(dt);

        // 2. Handle Flip Logic
        // When width is pinched to near zero, switch the sprite visibility
        if (this.pinch.x && this.VT.w < 0.1) {
            if (this.facing === 'back') {
                this.spriteFacing = 'back';
            } else {
                this.spriteFacing = 'front';
            }
            this.pinch.x = false; // Release pinch, Moveable will ease width back to T.w
        }

        // 3. Update PixiJS Container Transform
        // Convert Game Units to Pixi Pixels
        const pixelX = this.VT.x * G.TILESIZE * G.TILESCALE;
        const pixelY = this.VT.y * G.TILESIZE * G.TILESCALE;
        
        this.container.position.set(pixelX + (this.VT.w * G.TILESIZE * G.TILESCALE / 2), pixelY + (this.VT.h * G.TILESIZE * G.TILESCALE / 2));
        this.container.rotation = this.VT.r;
        this.container.scale.set(this.VT.scale * G.TILESCALE, this.VT.scale * G.TILESCALE);

        // 4. Update Width/Height distortion (for flipping/pinching)
        // Pixi scale is already set, but we might need to squeeze just the X axis for the flip
        // We act on the children sprites to maintain the container's scale property for Juice
        const squeezeFactor = this.VT.w / this.T.w;
        
        if (this.children.front) {
            this.children.front.visible = (this.spriteFacing === 'front');
            this.children.front.scale.x = squeezeFactor; // Squeeze width
        }
        if (this.children.back) {
            this.children.back.visible = (this.spriteFacing === 'back');
            this.children.back.scale.x = squeezeFactor;
        }
    }
}