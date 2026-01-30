window.onload = async function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const loader = new ImageLoader();
    try {
        console.log("Loading assets...");
        await Promise.all([
            // あなたが選んだプレイヤー (5番)
            loader.load('player', 'assets/micro-roguelike/Tiles/Colored/tile_0005.png'),
            
            // ★敵は、あなたが選んでくれた28番に戻します（これが確実！）
            loader.load('enemy', 'assets/micro-roguelike/Tiles/Colored/tile_0028.png'),
            
            // 壁 (9番: 赤茶色のブロック)
            loader.load('wall',  'assets/micro-roguelike/Tiles/Colored/tile_0009.png'), 
            // 宝箱 (88番: 閉じた箱)
            loader.load('chest', 'assets/micro-roguelike/Tiles/Colored/tile_0088.png'), 
            // ボス (122番: ドクロ)
            loader.load('boss',  'assets/micro-roguelike/Tiles/Colored/tile_0122.png'), 
            // 階段 (66番: 下り階段)
            loader.load('stairs','assets/micro-roguelike/Tiles/Colored/tile_0066.png')
            
            // ※床画像は読み込みますが、描画はしません（黒背景にします）
        ]);
        console.log("Assets loaded!");
    } catch (e) {
        console.error("Critical Error:", e);
        return;
    }

    const game = new GameApp(ctx, loader);

    function gameLoop() {
        game.update();
        game.draw();
        requestAnimationFrame(gameLoop);
    }

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        let input = null;
        if (key === 'arrowup') input = 'up';
        else if (key === 'arrowdown') input = 'down';
        else if (key === 'arrowleft') input = 'left';
        else if (key === 'arrowright') input = 'right';
        else if (key === 'z') input = 'confirm';
        else if (key === 'x') input = 'cancel';
        
        if (input) game.handleInput(input);
    });

    gameLoop();
};