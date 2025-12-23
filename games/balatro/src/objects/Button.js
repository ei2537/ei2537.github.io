import * as PIXI from 'pixi.js';
import { G, C } from '../globals.js';
import { Moveable } from '../engine/Moveable.js';

export class Button extends Moveable {
    constructor(x, y, w, h, text, color, callback) {
        super(x, y, w, h);
        this.callback = callback;
        this.color = color;
        this.textString = text;

        this.container = new PIXI.Container();
        this.container.eventMode = 'static';
        this.container.cursor = 'pointer';

        this.bg = new PIXI.Graphics();
        this.container.addChild(this.bg);

        this.text = new PIXI.Text(text, {
            fontFamily: 'Arial', fontSize: 24, fill: 0xFFFFFF, fontWeight: 'bold', align: 'center',
        });
        this.text.anchor.set(0.5);
        this.container.addChild(this.text);

        this.container.on('pointerdown', () => this.onClick());
        this.container.on('pointerover', () => this.onHover());
        this.container.on('pointerout', () => this.onOut());

        this.redraw();
    }

    onClick() {
        this.juiceUp(0.3, 0.1);
        if (this.callback) this.callback();
    }

    onHover() {
        this.VT.scale = 1.1; 
    }

    onOut() {
        this.VT.scale = 1.0;
    }

    redraw() {
        const pxW = this.T.w * G.TILESIZE * G.TILESCALE;
        const pxH = this.T.h * G.TILESIZE * G.TILESCALE;
        this.bg.clear();
        this.bg.beginFill(this.color);
        this.bg.lineStyle(2, C.WHITE, 1);
        this.bg.drawRoundedRect(-pxW/2, -pxH/2, pxW, pxH, 10);
        this.bg.endFill();
        this.container.hitArea = new PIXI.Rectangle(-pxW/2, -pxH/2, pxW, pxH);
    }

    update(dt) {
        super.update(dt);
        const pxX = this.VT.x * G.TILESIZE * G.TILESCALE;
        const pxY = this.VT.y * G.TILESIZE * G.TILESCALE;
        this.container.position.set(pxX, pxY);
        this.container.scale.set(this.VT.scale);
        this.container.rotation = this.VT.r;
    }
}