"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshot = exports.bump = void 0;
const counters = {
    requests: 0,
    uploads: 0,
    searches: 0,
    chatMessages: 0,
};
const bump = (key) => {
    counters[key] += 1;
};
exports.bump = bump;
const snapshot = () => ({ ...counters });
exports.snapshot = snapshot;
