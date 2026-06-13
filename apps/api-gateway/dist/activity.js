"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearActivity = exports.listActivity = exports.recordActivity = void 0;
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dataDir = path_1.default.resolve(__dirname, '..', '.data');
const activityPath = path_1.default.join(dataDir, 'activity.json');
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
const readLogs = () => {
    try {
        const parsed = JSON.parse(fs_1.default.readFileSync(activityPath, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
};
const writeLogs = (logs) => {
    fs_1.default.writeFileSync(activityPath, JSON.stringify(logs.slice(0, 200), null, 2));
};
const recordActivity = (entry) => {
    const logs = readLogs();
    const log = {
        id: (0, uuid_1.v4)(),
        timestamp: new Date().toISOString(),
        ...entry,
    };
    logs.unshift(log);
    writeLogs(logs);
    return log;
};
exports.recordActivity = recordActivity;
const listActivity = () => readLogs().slice(0, 50);
exports.listActivity = listActivity;
const clearActivity = () => {
    writeLogs([]);
};
exports.clearActivity = clearActivity;
