class ProbabilityEngine {
    constructor() {
        this.log = []; // 計算履歴
    }

    /**
     * 確率判定を行うコアメソッド
     * @param {number} rate - 成功確率 (%)
     * @param {string} actionName - 行動名（ログ用）
     * @returns {object} 結果オブジェクト
     */
    roll(rate, actionName = "Action") {
        // 0〜100の乱数生成 (小数含む)
        const rollValue = Math.random() * 100;
        
        let result = {
            success: false,
            isCritical: false,
            isOverflow: false,
            isUnderflow: false,
            rollValue: rollValue,
            rate: rate,
            damageMultiplier: 1.0,
            message: ""
        };

        // --- OVERFLOW判定 (100%超え) ---
        if (rate > 100) {
            result.isOverflow = true;
            result.success = true; // 100%超えは確定成功
            
            // 超過分に応じてダメージ倍率アップなどのボーナス
            // 例: 150%なら (150-100)% = 50% 分のボーナス加算
            const overflowAmount = rate - 100;
            result.damageMultiplier = 1.0 + (overflowAmount / 100);
            result.message = `[OVERFLOW] RATE ${rate}% >> POWER x${result.damageMultiplier.toFixed(1)}`;
        }
        
        // --- UNDERFLOW判定 (0%未満) ---
        else if (rate < 0) {
            result.isUnderflow = true;
            // マイナスの挙動：今回は「判定が反転する」を採用してみる
            // -30%なら、30%の確率で「逆効果（自爆/敵回復）」あるいは「絶対成功」など
            // ここではシンプルに「絶対失敗」＋「異常発生」とする
            result.success = false;
            result.message = `[UNDERFLOW] RATE ${rate}% >> SYSTEM ERROR`;
        }

        // --- 通常判定 (0 - 100%) ---
        else {
            if (rollValue < rate) {
                result.success = true;
                result.message = "HIT!";
            } else {
                result.success = false;
                result.message = "MISS";
            }
        }

        console.log(`[${actionName}] Rate: ${rate}%, Roll: ${rollValue.toFixed(1)}, Result: ${result.success}`);
        return result;
    }
}