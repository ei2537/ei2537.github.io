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
        this.container.eventMode = 'dynamic';
        this.container.cursor = 'pointer';

        // 背景
        this.bg = new PIXI.Graphics();
        this.container.addChild(this.bg);

        // テキスト
        this.text = new PIXI.Text(text, {
            fontFamily: 'Arial', // 後でフォント読み込みに対応
            fontSize: 24,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
            align: 'center'
        });
        this.text.anchor.set(0.5);
        this.container.addChild(this.text);

        // イベント定義
        this.container.on('pointerdown', () => this.onClick());
        this.container.on('pointerover', () => this.onHover());
        this.container.on('pointerout', () => this.onOut());

        this.redraw();
    }

    onClick() {
        this.juiceUp(0.3, 0.1); // 押した感触
        if (this.callback) this.callback();
    }

    onHover() {
        this.VT.scale = 1.1; // 少し大きく
        this.container.cursor = 'pointer';
    }

    onOut() {
        this.VT.scale = 1.0;
    }

    redraw() {
        this.bg.clear();
        this.bg.beginFill(this.color);
        this.bg.lineStyle(2, C.WHITE, 1);
        // 角丸長方形
        const pxW = this.T.w * G.TILESIZE * G.TILESCALE;
        const pxH = this.T.h * G.TILESIZE * G.TILESCALE;
        this.bg.drawRoundedRect(-pxW/2, -pxH/2, pxW, pxH, 10);
        this.bg.endFill();
    }

    update(dt) {
        super.update(dt); // 物理演算

        // 座標更新
        const pxX = this.VT.x * G.TILESIZE * G.TILESCALE;
        const pxY = this.VT.y * G.TILESIZE * G.TILESCALE;
        this.container.position.set(pxX, pxY);
        this.container.scale.set(this.VT.scale);
        this.container.rotation = this.VT.r;
    }
}