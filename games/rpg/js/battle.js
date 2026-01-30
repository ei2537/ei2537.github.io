class BattleScene {
    constructor(ctx, loader, gameApp) { 
        this.ctx = ctx;
        this.loader = loader;
        this.game = gameApp;
        this.probEngine = new ProbabilityEngine();

        this.player = {
            hp: 100, maxHp: 100, mp: 50,
            baseHit: 80,
            imgKey: 'player'
        };

        this.enemy = {
            hp: 80, maxHp: 80,
            name: "GLITCH_ENTITY", // 名前を汎用的に変更
            nextActionRate: 60,
            imgKey: 'enemy'
        };

        // バトルの状態管理
        // 'TURN_START', 'PLAYER_IDLE', 'HACK_MENU', 'ANIMATING', 'ENEMY_TURN', 'WIN', 'LOSE'
        this.state = 'PLAYER_IDLE';
        this.message = "ENCOUNTERED GLITCH!";
        this.shake = 0;

        // HACKメニュー用データ
        this.hackMenu = {
            active: false,
            cursor: 0,
            options: [
                { name: "OVERFLOW",  cost: 20, desc: "RATE +50% / POWER UP" },
                { name: "UNDERFLOW", cost: 15, desc: "RATE -30% / SYSTEM ERR" },
                { name: "INVERT",    cost: 25, desc: "FLIP SUCCESS/FAIL" }
            ]
        };
    }

    start(enemyType) {
        this.state = 'PLAYER_IDLE';
        this.message = `ENCOUNTERED ${enemyType}!`;
        // 敵のHPなどをリセット
        this.enemy.hp = (enemyType === 'BOSS') ? 200 : 80;
        this.enemy.maxHp = this.enemy.hp;
        this.enemy.name = (enemyType === 'BOSS') ? "CHAOS_ENGINE" : "GLITCH_SLIME";
        this.enemy.imgKey = (enemyType === 'BOSS') ? 'boss' : 'enemy'; // 画像切り替え
    }


    // --- 入力ハンドリング ---
    handleInput(key) {
        if (this.state === 'ANIMATING' || this.state === 'ENEMY_TURN') return;

        // 通常状態 (攻撃かHACKか)
        if (this.state === 'PLAYER_IDLE') {
            if (key === 'confirm') { // Zキー: 通常攻撃
                this.executeAttack(0, 'ATTACK'); // 補正なし
            }
            if (key === 'cancel') { // Xキー: HACKメニューを開く
                this.state = 'HACK_MENU';
                this.hackMenu.active = true;
                this.hackMenu.cursor = 0;
                this.message = "SELECT HACK PROTOCOL...";
            }
        }
        // HACKメニュー操作中
        else if (this.state === 'HACK_MENU') {
            if (key === 'up') {
                this.hackMenu.cursor = Math.max(0, this.hackMenu.cursor - 1);
            }
            if (key === 'down') {
                this.hackMenu.cursor = Math.min(this.hackMenu.options.length - 1, this.hackMenu.cursor + 1);
            }
            if (key === 'cancel') { // Xキー: 閉じる
                this.state = 'PLAYER_IDLE';
                this.hackMenu.active = false;
                this.message = "COMMAND?";
            }
            if (key === 'confirm') { // Zキー: 決定
                this.selectHack(this.hackMenu.cursor);
            }
        }
    }

    // --- ロジック ---
    selectHack(index) {
        const skill = this.hackMenu.options[index];
        
        // MPチェック
        if (this.player.mp < skill.cost) {
            this.message = "NOT ENOUGH MP!";
            return;
        }

        // MP消費
        this.player.mp -= skill.cost;
        this.hackMenu.active = false; // メニュー閉じる

        // 効果適用
        let rateMod = 0;
        let actionName = skill.name;

        // 効果分岐 (とりあえず今は確率加算だけ実装)
        if (skill.name === "OVERFLOW") {
            rateMod = 50;
        } else if (skill.name === "UNDERFLOW") {
            rateMod = -30;
            // TODO: 敵にかける場合はターゲット選択が必要だが、今は自分(攻撃)にかけることにする
        } else if (skill.name === "INVERT") {
            // INVERTは特殊なので後で実装（今は演出のみ）
            this.message = "INVERT LOGIC NOT READY YET";
            return; 
        }

        this.executeAttack(rateMod, actionName);
    }

    executeAttack(rateMod, actionName) {
        this.state = 'ANIMATING';
        let hitRate = this.player.baseHit + rateMod;
        let damage = 10; // 基本ダメージ

        // 確率判定
        const result = this.probEngine.roll(hitRate, actionName);

        if (result.success) {
            const finalDamage = Math.floor(damage * result.damageMultiplier);
            this.enemy.hp -= finalDamage;
            this.message = `${result.message} DMG: ${finalDamage}`;
            this.shake = result.isOverflow ? 20 : 5;
        } else {
            this.message = result.message;
        }

        // ターン終了へ
        setTimeout(() => {
            if (this.enemy.hp <= 0) {
                this.state = 'WIN';
                this.message = "TARGET DELETED. RETURNING...";
                // 1秒後にマップへ戻る
                setTimeout(() => {
                    this.game.returnToMap();
                }, 1000);
            } else {
                this.state = 'ENEMY_TURN';
                this.enemyAction();
            }
        }, 1500);
    }

    enemyAction() {
        // 敵の行動
        setTimeout(() => {
            const result = this.probEngine.roll(this.enemy.nextActionRate, "Enemy Attack");
            if (result.success) {
                this.player.hp -= 15;
                this.message = `ENEMY HIT! DMG: 15`;
                this.shake = 10;
            } else {
                this.message = `ENEMY MISSED.`;
            }
            
            // プレイヤーのターンに戻す
            this.state = 'PLAYER_IDLE';
        }, 1000);
    }

    update() {
        if (this.shake > 0) this.shake -= 1;
    }

    // --- 描画 ---
    draw() {
        const ctx = this.ctx;
        // 背景クリア
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 640, 360);

        // 床
        const floorImg = this.loader.get('floor');
        if (floorImg) {
            ctx.globalAlpha = 0.2;
            for(let y=100; y<300; y+=32) {
                for(let x=0; x<640; x+=32) ctx.drawImage(floorImg, x, y, 32, 32);
            }
            ctx.globalAlpha = 1.0;
        }

        // シェイク
        const shakeX = (Math.random() - 0.5) * this.shake;
        const shakeY = (Math.random() - 0.5) * this.shake;
        ctx.save();
        ctx.translate(shakeX, shakeY);

        // UI: 敵情報
        ctx.fillStyle = '#fff';
        ctx.font = '24px "VT323"';
        ctx.fillText(`ENEMY: ${this.enemy.name}`, 20, 40);
        this.drawBar(20, 50, 200, 15, this.enemy.hp, this.enemy.maxHp, '#f44');
        ctx.fillStyle = '#aaa';
        ctx.fillText(`⚠ NEXT: ATTACK (${this.enemy.nextActionRate}%)`, 20, 90);

        // キャラクター
        const size = 64; 
        const enemyImg = this.loader.get(this.enemy.imgKey);
        if (enemyImg) ctx.drawImage(enemyImg, 450, 100, size, size);
        
        const playerImg = this.loader.get(this.player.imgKey);
        if (playerImg) ctx.drawImage(playerImg, 100, 200, size, size);

        // UI: プレイヤー情報
        ctx.fillStyle = '#fff';
        ctx.fillText(`YOU  HP: ${this.player.hp}/${this.player.maxHp}  MP: ${this.player.mp}`, 100, 300);
        
        // メッセージログ
        ctx.fillStyle = '#ff0';
        ctx.textAlign = 'center';
        ctx.fillText(`> ${this.message}`, 320, 340);
        ctx.textAlign = 'left';

        // ガイド
        if (this.state === 'PLAYER_IDLE') {
            ctx.fillStyle = '#888';
            ctx.font = '16px "VT323"';
            ctx.fillText("[Z] ATTACK  [X] HACK MENU", 450, 340);
        }

        ctx.restore(); // シェイク解除

        // --- HACKメニューウィンドウ描画 (最前面) ---
        if (this.hackMenu.active) {
            this.drawHackMenu();
        }
    }

    drawHackMenu() {
        const ctx = this.ctx;
        const x = 50;
        const y = 50;
        const w = 300;
        const h = 200;

        // ウィンドウ背景（半透明黒）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(x, y, w, h);
        // 枠線
        ctx.strokeStyle = '#0f0'; // ハッカーっぽい緑
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // タイトル
        ctx.fillStyle = '#0f0';
        ctx.font = '24px "VT323"';
        ctx.fillText("- HACK PROTOCOLS -", x + 60, y + 30);

        // リスト描画
        this.hackMenu.options.forEach((opt, i) => {
            const isSelected = (i === this.hackMenu.cursor);
            const py = y + 70 + (i * 30);
            
            // カーソル
            if (isSelected) {
                ctx.fillStyle = '#0f0';
                ctx.fillText("> ", x + 20, py);
            } else {
                ctx.fillStyle = '#444'; // 非選択は暗く
            }

            // スキル名とコスト
            ctx.fillStyle = isSelected ? '#fff' : '#888';
            ctx.fillText(`${opt.name}`, x + 40, py);
            ctx.fillText(`${opt.cost}MP`, x + 220, py);
        });

        // 説明文 (下部)
        const selectedOpt = this.hackMenu.options[this.hackMenu.cursor];
        ctx.fillStyle = '#0f0';
        ctx.font = '18px "VT323"';
        ctx.fillText(`[INFO]: ${selectedOpt.desc}`, x + 20, y + h - 20);
    }

    drawBar(x, y, w, h, val, max, color) {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x, y, w, h);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, Math.max(0, w * (val / max)), h);
    }
}