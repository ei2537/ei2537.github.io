import { G } from '../globals.js';

export class Event {
    constructor(config) {
        this.trigger = config.trigger || 'immediate';
        this.blocking = config.blocking !== undefined ? config.blocking : true;
        this.blockable = config.blockable !== undefined ? config.blockable : true;
        this.func = config.func || (() => true);
        this.delay = config.delay || 0;
        this.no_delete = config.no_delete || false;
        
        this.timer = 'REAL'; 
        this.startTime = null;
        this.complete = false;

        if (this.trigger === 'ease') {
            this.ease = {
                type: config.ease || 'lerp',
                ref_table: config.ref_table,
                ref_value: config.ref_value,
                start_val: config.ref_table[config.ref_value],
                end_val: config.ease_to,
                duration: config.delay 
            };
        }
    }

    handle() {
        if (this.startTime === null) {
            this.startTime = G.TIMERS[this.timer];
        }
        const currentTime = G.TIMERS[this.timer];
        const elapsedTime = currentTime - this.startTime;

        if (this.trigger === 'immediate') {
            if (this.func()) this.complete = true;
        }
        else if (this.trigger === 'after') {
            if (elapsedTime >= this.delay) {
                if (this.func()) this.complete = true;
            }
        }
        else if (this.trigger === 'ease') {
            if (elapsedTime >= this.ease.duration) {
                this.ease.ref_table[this.ease.ref_value] = this.ease.end_val;
                if (this.func(this.ease.end_val)) this.complete = true;
            } else {
                const t = elapsedTime / this.ease.duration;
                const currentVal = this.ease.start_val * (1 - t) + this.ease.end_val * t;
                this.ease.ref_table[this.ease.ref_value] = currentVal;
                this.func(currentVal);
            }
        }
    }
}

export class EventManager {
    constructor() {
        this.queues = { base: [], other: [] };
    }

    add_event(event, queueName = 'base') {
        if (!this.queues[queueName]) this.queues[queueName] = [];
        this.queues[queueName].push(event);
    }

    update(dt) {
        for (let key in this.queues) {
            const queue = this.queues[key];
            if (queue.length === 0) continue;
            const event = queue[0];
            event.handle();
            if (event.complete) {
                if (!event.no_delete) queue.shift();
            } else if (event.blocking) {
                continue; 
            }
        }
    }
}