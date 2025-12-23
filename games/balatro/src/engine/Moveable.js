import { G } from '../globals.js';

/**
 * Moveable: Base class for objects that move with "Juice" (interpolation & springs)
 * Ported from engine/moveable.lua
 */
export class Moveable {
    constructor(x, y, w, h) {
        // T: Target Transform (あるべき場所・サイズ)
        this.T = { x: x || 0, y: y || 0, w: w || 0, h: h || 0, r: 0, scale: 1 };
        
        // VT: Visible Transform (現在描画される場所・サイズ - Tに向かって補間される)
        this.VT = { x: this.T.x, y: this.T.y, w: this.T.w, h: this.T.h, r: this.T.r, scale: this.T.scale };
        
        // Velocity (速度・慣性計算用)
        this.velocity = { x: 0, y: 0, r: 0, scale: 0 };

        // Juice state (プルプル震える演出用)
        this.juice = null;

        // Pinch (フリップアニメーション用: 幅や高さを0にするフラグ)
        this.pinch = { x: false, y: false };

        // ID generation (for randomness consistency)
        this.ID = Math.random(); 
    }

    /**
     * "Juice Up": Trigger the wobbly spring effect
     * @param {number} amount - Magnitude of the wobble (default 0.4)
     * @param {number} rot_amt - Magnitude of rotation wobble
     */
    juiceUp(amount = 0.4, rot_amt = 0) {
        // Lua: self.VT.scale = 1 - 0.6 * amount
        // 衝撃で一瞬縮んでから、ビヨヨンと戻る挙動
        this.VT.scale = 1 - 0.6 * amount;

        const currentTime = G.TIMERS.REAL;
        const randomSign = Math.random() > 0.5 ? 1 : -1;
        
        this.juice = {
            scale: 0,
            scale_amt: amount,
            r: 0,
            r_amt: rot_amt ? (0.4 * randomSign * rot_amt) : (randomSign * 0.16),
            start_time: currentTime,
            end_time: currentTime + 0.4 // 0.4秒で収束
        };
    }

    /**
     * Calculate the "Juice" (spring physics) based on time
     * @param {number} dt 
     */
    moveJuice(dt) {
        if (this.juice) {
            if (this.juice.end_time < G.TIMERS.REAL) {
                this.juice = null;
            } else {
                // Decay calculation derived from Lua's move_juice logic
                const timeDiff = G.TIMERS.REAL - this.juice.start_time;
                const duration = this.juice.end_time - this.juice.start_time;
                const remainingRatio = (this.juice.end_time - G.TIMERS.REAL) / duration;
                
                // Scale wobble (Sin wave * Cubic decay)
                // math.sin(50.8 * time)
                this.juice.scale = this.juice.scale_amt * 
                                   Math.sin(50.8 * timeDiff) * 
                                   Math.pow(Math.max(0, remainingRatio), 3);

                // Rotation wobble (Sin wave * Squared decay)
                // math.sin(40.8 * time)
                this.juice.r = this.juice.r_amt * 
                               Math.sin(40.8 * timeDiff) * 
                               Math.pow(Math.max(0, remainingRatio), 2);
            }
        }
    }

    /**
     * Main update loop for physics and interpolation
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Pre-calculate exponential decay factors based on dt (Simulating G.exp_times)
        // Lua: math.exp(-constant * dt)
        const expXY = Math.exp(-50 * dt);
        const expScale = Math.exp(-60 * dt);
        const expR = Math.exp(-190 * dt);

        // 1. Move Juice (Calculate spring offsets)
        this.moveJuice(dt);

        // 2. Move XY (Interpolate Position)
        if (Math.abs(this.T.x - this.VT.x) > 0.01 || Math.abs(this.velocity.x) > 0.01 ||
            Math.abs(this.T.y - this.VT.y) > 0.01 || Math.abs(this.velocity.y) > 0.01) {
            
            // Velocity Verlet-like integration for smooth damping
            this.velocity.x = expXY * this.velocity.x + (1 - expXY) * (this.T.x - this.VT.x) * 35 * dt;
            this.velocity.y = expXY * this.velocity.y + (1 - expXY) * (this.T.y - this.VT.y) * 35 * dt;

            this.VT.x += this.velocity.x;
            this.VT.y += this.velocity.y;
        } else {
            // Snap to target if close enough to stop micro-jitter
            this.VT.x = this.T.x;
            this.VT.y = this.T.y;
            this.velocity.x = 0;
            this.velocity.y = 0;
        }

        // 3. Move Rotation
        // Add juice rotation to target rotation
        const juiceR = this.juice ? this.juice.r * 2 : 0;
        const desR = this.T.r + juiceR; // + velocity based tilt (skipped for simplicity in step 1)

        if (Math.abs(desR - this.VT.r) > 0.001 || Math.abs(this.velocity.r) > 0.001) {
            this.velocity.r = expR * this.velocity.r + (1 - expR) * (desR - this.VT.r);
            this.VT.r += this.velocity.r;
        } else {
            this.VT.r = this.T.r;
            this.velocity.r = 0;
        }

        // 4. Move Scale
        // Add juice scale and zoom effects
        const juiceScale = this.juice ? this.juice.scale : 0;
        const desScale = this.T.scale + juiceScale; // + hover zoom logic would go here

        if (Math.abs(desScale - this.VT.scale) > 0.001 || Math.abs(this.velocity.scale) > 0.001) {
            this.velocity.scale = expScale * this.velocity.scale + (1 - expScale) * (desScale - this.VT.scale);
            this.VT.scale += this.velocity.scale;
        }

        // 5. Move Width/Height (Pinch effect for flipping)
        // If pinch.x is true, ease Width to 0. Else ease to T.w
        if (this.pinch.x) {
            this.VT.w = this.VT.w * (1 - 15 * dt); // Quick shrink
            if (this.VT.w < 0.1) this.VT.w = 0;
        } else {
            if (Math.abs(this.VT.w - this.T.w) > 0.01) {
                this.VT.w = this.VT.w + (this.T.w - this.VT.w) * 15 * dt;
            } else {
                this.VT.w = this.T.w;
            }
        }
    }

    /**
     * Instantly set transform (Teleport)
     */
    hardSetT(x, y, w, h) {
        this.T.x = x; this.T.y = y; this.T.w = w; this.T.h = h;
        this.VT.x = x; this.VT.y = y; this.VT.w = w; this.VT.h = h;
        this.velocity = { x: 0, y: 0, r: 0, scale: 0 };
    }
}