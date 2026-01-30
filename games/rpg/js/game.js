class GameApp {
    constructor(ctx, loader) {
        this.ctx = ctx;
        this.loader = loader;
        
        // シーン管理 ('MAP' または 'BATTLE')
        this.currentScene = 'MAP';
        
        // 各シーンのインスタンス作成
        this.mapScene = new MapScene(ctx, loader, this);
        this.battleScene = new BattleScene(ctx, loader, this); // thisを渡して戻れるようにする
    }

    // 入力分配
    handleInput(key) {
        if (this.currentScene === 'MAP') {
            this.mapScene.handleInput(key);
        } else if (this.currentScene === 'BATTLE') {
            this.battleScene.handleInput(key);
        }
    }

    // 更新ループ
    update() {
        if (this.currentScene === 'MAP') this.mapScene.update();
        else this.battleScene.update();
    }

    // 描画ループ
    draw() {
        if (this.currentScene === 'MAP') this.mapScene.draw();
        else this.battleScene.draw();
    }

    // --- シーン切り替え用メソッド ---
    
    // バトル開始
    startBattle(enemyType) {
        this.currentScene = 'BATTLE';
        // 敵データをリセットして開始（後で敵タイプごとの分岐も可能）
        this.battleScene.start(enemyType); 
    }

    // マップに戻る
    returnToMap() {
        this.currentScene = 'MAP';
    }
}