import { EventEmitter } from 'node:events';

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(0);

export const emitKitEvent = (kitId, type, data = {}) =>
  eventBus.emit(`kit:${kitId}`, { type, kitId, ...data });