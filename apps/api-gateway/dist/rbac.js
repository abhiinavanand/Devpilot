"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.getRole = void 0;
const getRole = (req) => {
    const role = (req.header('x-role') || 'viewer').toLowerCase();
    if (role === 'admin' || role === 'manager')
        return role;
    return 'viewer';
};
exports.getRole = getRole;
const requireRole = (allowed) => (req, res, next) => {
    const role = (0, exports.getRole)(req);
    if (!allowed.includes(role)) {
        return res.status(403).json({ message: 'Insufficient role for this action.' });
    }
    return next();
};
exports.requireRole = requireRole;
