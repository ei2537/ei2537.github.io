class MapScene {
    constructor(ctx, loader, gameApp) {
        this.ctx = ctx;
        this.loader = loader;
        this.game = gameApp;

        this.tileSize = 32;
        this.cols = 20;
        this.rows = 11;

        // フロア数管理
        this.floorLevel = 1;

        this.playerX = 1;
        this.playerY = 1;
        this.grid = [];
        
        this.generateMap();
        this.message = `FLOOR ${this.floorLevel}: START`;
    }

    generateMap() {
        // 1. 全て壁(1)で埋める
        this.grid = [];
        for (let y = 0; y < this.rows; y++) {
            let row = [];
            for (let x = 0; x < this.cols; x++) {
                row.push(1);
            }
            this.grid.push(row);
        }

        // 2. 部屋を作る (外周以外を床(0)に)
        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                // 15%の確率で壁を残す（障害物）
                if (Math.random() > 0.15) {
                    this.grid[y][x] = 0;
                }
            }
        }

        // 3. イベント配置
        this.placeEvent(2, 4 + Math.floor(this.floorLevel * 0.5)); // 敵 (フロアが進むと増える)
        this.placeEvent(3, 2); // 宝箱
        
        // 5階ごとにボス、それ以外は階段
        if (this.floorLevel % 5 === 0) {
            this.placeEvent(4, 1); // ボス
        } else {
            this.placeEvent(9, 1); // 階段
        }

        // プレイヤー位置確保
        this.grid[1][1] = 0;
        this.playerX = 1;
        this.playerY = 1;
        
        // メッセージ更新
        this.message = `FLOOR ${this.floorLevel}: SYSTEM UNSTABLE...`;
    }

    placeEvent(typeId, count) {
        for (let i = 0; i < count; i++) {
            let x, y;
            // ランダムな床の座標を探す
            let attempts = 0;
            do {
                x = Math.floor(Math.random() * (this.cols - 2)) + 1;
                y = Math.floor(Math.random() * (this.rows - 2)) + 1;
                attempts++;
            } while ((this.grid[y][x] !== 0 || (x === 1 && y === 1)) && attempts < 100);
            
            if (this.grid[y][x] === 0) {
                this.grid[y][x] = typeId;
            }
        }
    }

    handleInput(key) {
        let dx = 0, dy = 0;
        if (key === 'up') dy = -1;
        if (key === 'down') dy = 1;
        if (key === 'left') dx = -1;
        if (key === 'right') dx = 1;

        if (dx !== 0 || dy !== 0) {
            this.move(dx, dy);
        }
    }

    move(dx, dy) {
        const nextX = this.playerX + dx;
        const nextY = this.playerY + dy;

        // 壁判定
        const tile = this.grid[nextY][nextX];
        if (tile === 1) {
            this.message = "WALL BLOCKED.";
            return;
        }

        // 移動
        this.playerX = nextX;
        this.playerY = nextY;

        // イベント判定
        this.checkEvent(tile, nextX, nextY);
    }

    checkEvent(tile, x, y) {
        if (tile === 0) {
            this.message = "";
            return;
        }

        // 敵 (2)
        if (tile === 2) {
            this.message = "ENCOUNTER!";
            this.grid[y][x] = 0; // 敵消滅
            setTimeout(() => this.game.startBattle('GLITCH_MOB'), 200);
        }
        // 宝箱 (3)
        else if (tile === 3) {
            this.message = "FOUND ITEM! (MP RECOVERED)";
            this.grid[y][x] = 0; 
            // 簡易的にMP回復処理（本来はGameAppで管理すべきですが）
            if(this.game.battleScene.player) {
                this.game.battleScene.player.mp = Math.min(50, this.game.battleScene.player.mp + 20);
            }
        }
        // ボス (4)
        else if (tile === 4) {
            this.message = "WARNING: BOSS DETECTED";
            setTimeout(() => this.game.startBattle('BOSS'), 500);
        }
        // 階段 (9)
        else if (tile === 9) {
            this.message = "NEXT FLOOR...";
            this.floorLevel++;
            // 新しいマップを生成
            setTimeout(() => {
                this.generateMap();
            }, 500);
        }
    }

    update() {}

    draw() {
        const ctx = this.ctx;
        // ★背景を黒で塗りつぶす（これが床代わり！）
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 640, 360);

        // マップ描画
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                const px = x * this.tileSize;
                const py = y * this.tileSize;

                // ★床画像 (drawImage) は削除しました。
                // これで変な白い柵は表示されません。

                if (tile === 1) { // 壁
                    ctx.drawImage(this.loader.get('wall'), px, py, 32, 32);
                } else if (tile === 2) { // 敵
                    ctx.drawImage(this.loader.get('enemy'), px, py, 32, 32);
                } else if (tile === 3) { // 宝箱
                    ctx.drawImage(this.loader.get('chest'), px, py, 32, 32);
                } else if (tile === 4) { // ボス
                    ctx.drawImage(this.loader.get('boss'), px, py, 32, 32);
                } else if (tile === 9) { // 階段
                    ctx.drawImage(this.loader.get('stairs'), px, py, 32, 32);
                }
            }
        }

        // プレイヤー描画
        const pImg = this.loader.get('player');
        if (pImg) {
            ctx.drawImage(pImg, this.playerX * this.tileSize, this.playerY * this.tileSize, 32, 32);
        }

        // UI
        ctx.fillStyle = '#fff';
        ctx.font = '20px "VT323"';
        ctx.fillText(`FLOOR: ${this.floorLevel}  POS: [${this.playerX}, ${this.playerY}]`, 10, 20);
        ctx.fillText(this.message, 10, 350);
    }
}