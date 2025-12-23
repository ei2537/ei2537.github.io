import * as PIXI from 'pixi.js';
import { Moveable } from './engine/Moveable.js';
import { AssetLoader } from './AssetLoader.js';
import { G } from './globals.js';

export class CardSprite extends Moveable {
    constructor(rank, suit) {
        // Moveable初期化 (w, h はゲーム内単位)
        super(0, 0, G.CARD_W, G.CARD_H);
        
        this.rank = rank;
        this.suit = suit;
        this.selected = false;
        
        // --- 役判定用IDの計算 ---
        const rankMap = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'T':10,'Jack':11,'Queen':12,'King':13,'Ace':14};
        // チップ計算用 (J,Q,K=10, A=11)
        const chipMap = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'T':10,'Jack':10,'Queen':10,'King':10,'Ace':11};
        
        this.base = {
            name: `${rank} of ${suit}`,
            suit: suit,
            value: rank,
            id: rankMap[rank] || 0,
            nominal: chipMap[rank] || 0
        };

        // --- PixiJS ---
        this.container = new PIXI.Container();
        
        // 1. 台紙 (白)
        const base = new PIXI.Sprite(AssetLoader.textures.base);
        base.anchor.set(0.5);
        base.width = this.T.w * G.TILESIZE;
        base.height = this.T.h * G.TILESIZE;
        this.container.addChild(base);

        // 2. 絵柄
        const front = new PIXI.Sprite(AssetLoader.getCardTexture(rank, suit));
        front.anchor.set(0.5);
        front.width = this.T.w * G.TILESIZE;
        front.height = this.T.h * G.TILESIZE;
        this.container.addChild(front);

        // インタラクション (main.jsでリスナー登録)
        this.container.eventMode = 'static';
        this.container.cursor = 'pointer';
    }
    
    // イベントリスナーのラッパー (Pixiコンテナへのイベントを流す)
    on(event, fn) {
        this.container.on(event, fn);
    }

    toggleSelect() {
        this.selected = !this.selected;
        // 選択時にぷるんとさせる
        if (this.selected) {
            this.juiceUp(0.5, 0.1);
        } else {
            this.juiceUp(0.3, 0.05);
        }
    }

    update(dt) {
        super.update(dt); // Moveableの物理計算 (Juice含む)
        
        // PixiJSへの反映 (親のレイアウト座標 + 物理オフセット)
        // main.jsのlayoutHandで設定された this.x, this.y をベースにする
        // MoveableのT, VTはローカルアニメーション用に使う
        
        // コンテナのスケールにJuiceを適用
        const scale = this.VT.scale;
        this.container.scale.set(scale, scale);
        
        // 回転 (基本回転 + Juice回転)
        this.container.rotation = this.rotation + this.VT.r;
        
        // 座標 (基本座標 + Juice的なズレがあれば)
        this.container.x = this.x;
        this.container.y = this.y;
    }
}