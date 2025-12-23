import { G } from '../globals.js';

export class Moveable {
    constructor(x, y, w, h) {
        this.T = { x: x || 0, y: y || 0, w: w || 0, h: h || 0, r: 0, scale: 1 };
        this.VT = { x: this.T.x, y: this.T.y, w: this.T.w, h: this.T.h, r: this.T.r, scale: this.T.scale };
        this.velocity = { x: 0, y: 0, r: 0, scale: 0 };
        this.juice = null;
        this.pinch = { x: false, y: false };
        this.ID = Math.random(); 
    }

    juiceUp(amount = 0.4, rot_amt = 0) {
        this.VT.scale = 1 - 0.6 * amount;
        const currentTime = G.TIMERS.REAL;
        const randomSign = Math.random() > 0.5 ? 1 : -1;
        this.juice = {
            scale: 0, scale_amt: amount,
            r: 0, r_amt: rot_amt ? (0.4 * randomSign * rot_amt) : (randomSign * 0.16),
            start_time: currentTime, end_time: currentTime + 0.4
        };
    }

    moveJuice(dt) {
        if (this.juice) {
            if (this.juice.end_time < G.TIMERS.REAL) {
                this.juice = null;
            } else {
                const timeDiff = G.TIMERS.REAL - this.juice.start_time;
                const duration = this.juice.end_time - this.juice.start_time;
                const remainingRatio = (this.juice.end_time - G.TIMERS.REAL) / duration;
                this.juice.scale = this.juice.scale_amt * Math.sin(50.8 * timeDiff) * Math.pow(Math.max(0, remainingRatio), 3);
                this.juice.r = this.juice.r_amt * Math.sin(40.8 * timeDiff) * Math.pow(Math.max(0, remainingRatio), 2);
            }
        }
    }

    update(dt) {
        const expXY = Math.exp(-50 * dt);
        const expScale = Math.exp(-60 * dt);
        const expR = Math.exp(-190 * dt);

        this.moveJuice(dt);

        if (Math.abs(this.T.x - this.VT.x) > 0.01 || Math.abs(this.velocity.x) > 0.01 ||
            Math.abs(this.T.y - this.VT.y) > 0.01 || Math.abs(this.velocity.y) > 0.01) {
            this.velocity.x = expXY * this.velocity.x + (1 - expXY) * (this.T.x - this.VT.x) * 35 * dt;
            this.velocity.y = expXY * this.velocity.y + (1 - expXY) * (this.T.y - this.VT.y) * 35 * dt;
            this.VT.x += this.velocity.x;
            this.VT.y += this.velocity.y;
        } else {
            this.VT.x = this.T.x; this.VT.y = this.T.y;
            this.velocity.x = 0; this.velocity.y = 0;
        }

        const juiceR = this.juice ? this.juice.r * 2 : 0;
        const desR = this.T.r + juiceR;
        if (Math.abs(desR - this.VT.r) > 0.001 || Math.abs(this.velocity.r) > 0.001) {
            this.velocity.r = expR * this.velocity.r + (1 - expR) * (desR - this.VT.r);
            this.VT.r += this.velocity.r;
        } else {
            this.VT.r = this.T.r; this.velocity.r = 0;
        }

        const juiceScale = this.juice ? this.juice.scale : 0;
        const desScale = this.T.scale + juiceScale;
        if (Math.abs(desScale - this.VT.scale) > 0.001 || Math.abs(this.velocity.scale) > 0.001) {
            this.velocity.scale = expScale * this.velocity.scale + (1 - expScale) * (desScale - this.VT.scale);
            this.VT.scale += this.velocity.scale;
        }

        if (this.pinch.x) {
            this.VT.w = this.VT.w * (1 - 15 * dt);
            if (this.VT.w < 0.1) this.VT.w = 0;
        } else {
            if (Math.abs(this.VT.w - this.T.w) > 0.01) {
                this.VT.w = this.VT.w + (this.T.w - this.VT.w) * 15 * dt;
            } else {
                this.VT.w = this.T.w;
            }
        }
    }
}