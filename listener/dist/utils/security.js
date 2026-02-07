"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireWithdrawLock = acquireWithdrawLock;
exports.releaseWithdrawLock = releaseWithdrawLock;
const activeWithdraws = new Set();
function acquireWithdrawLock(address) {
    address = address.toLowerCase();
    if (activeWithdraws.has(address))
        return false;
    activeWithdraws.add(address);
    return true;
}
function releaseWithdrawLock(address) {
    activeWithdraws.delete(address.toLowerCase());
}
