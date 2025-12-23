import * as PIXI from 'pixi.js';

export class Button extends PIXI.Container {
    constructor(x, y, width, height, text, color, callback) {
        super();
        this.position.set(x, y);
        
        const bg = new PIXI.Graphics();
        bg.beginFill(color);
        bg.lineStyle(2, 0xFFFFFF);
        bg.drawRoundedRect(-width/2, -height/2, width, height, 10);
        bg.endFill();
        this.addChild(bg);

        const txt = new PIXI.Text(text, { 
            fontFamily:'Arial', fontSize:24, fill:0xFFFFFF, fontWeight:'bold',
            align: 'center'
        });
        txt.anchor.set(0.5);
        this.addChild(txt);

        this.eventMode = 'static';
        this.cursor = 'pointer';
        
        this.on('pointerdown', (e) => {
            e.stopPropagation(); // イベント伝播を止める
            if(callback) callback();
        });

        // ホバーエフェクト
        this.on('pointerover', () => this.scale.set(1.1));
        this.on('pointerout', () => this.scale.set(1.0));
    }
}