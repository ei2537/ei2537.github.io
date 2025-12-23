import { G } from '../globals.js';

/**
 * Event Class
 * Represents a single action that blocks or runs in background
 */
export class Event {
    constructor(config) {
        this.trigger = config.trigger || 'immediate'; // immediate, after, ease, condition
        this.blocking = config.blocking !== undefined ? config.blocking : true;
        this.blockable = config.blockable !== undefined ? config.blockable : true;
        this.func = config.func || (() => true);
        this.delay = config.delay || 0;
        this.no_delete = config.no_delete || false;
        
        this.timer = 'REAL'; // Default to Real time
        this.startTime = null;
        this.complete = false;

        // For Ease
        if (this.trigger === 'ease') {
            this.ease = {
                type: config.ease || 'lerp',
                ref_table: config.ref_table,
                ref_value: config.ref_value,
                start_val: config.ref_table[config.ref_value],
                end_val: config.ease_to,
                duration: config.delay // Reuse delay as duration for ease
            };
        }
    }

    handle() {
        // Initialize timer start
        if (this.startTime === null) {
            this.startTime = G.TIMERS[this.timer];
        }
        const currentTime = G.TIMERS[this.timer];
        const elapsedTime = currentTime - this.startTime;

        if (this.trigger === 'immediate') {
            if (this.func()) {
                this.complete = true;
            }
        }
        else if (this.trigger === 'after') {
            if (elapsedTime >= this.delay) {
                if (this.func()) {
                    this.complete = true;
                }
            }
        }
        else if (this.trigger === 'ease') {
            if (elapsedTime >= this.ease.duration) {
                this.ease.ref_table[this.ease.ref_value] = this.ease.end_val;
                if (this.func(this.ease.end_val)) this.complete = true;
            } else {
                const t = elapsedTime / this.ease.duration;
                // Linear lerp for now, add Elastic/Quad later
                const currentVal = this.ease.start_val * (1 - t) + this.ease.end_val * t;
                this.ease.ref_table[this.ease.ref_value] = currentVal;
                this.func(currentVal);
            }
        }
    }
}

/**
 * EventManager
 * Manages queues of events
 */
export class EventManager {
    constructor() {
        this.queues = {
            base: [],
            other: []
        };
    }

    add_event(event, queueName = 'base') {
        if (!this.queues[queueName]) this.queues[queueName] = [];
        this.queues[queueName].push(event);
    }

    update(dt) {
        for (let key in this.queues) {
            const queue = this.queues[key];
            if (queue.length === 0) continue;

            // Process first event
            const event = queue[0];
            event.handle();

            if (event.complete) {
                if (!event.no_delete) {
                    queue.shift(); // Remove completed event
                }
                // If event was not blocking, we might want to process next immediately (not implemented in basic version)
            } else if (event.blocking) {
                // If blocking and not complete, stop processing this queue
                continue; 
            }
        }
    }
}