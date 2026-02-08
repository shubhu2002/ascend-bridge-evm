"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireWithdrawLock = acquireWithdrawLock;
exports.releaseWithdrawLock = releaseWithdrawLock;
exports.ensureAccountExists = ensureAccountExists;
const supabase_1 = require("../supabase");
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
async function ensureAccountExists(address, createNew) {
    const { data } = await supabase_1.supabase
        .from('ascend-accounts')
        .select('address')
        .eq('address', address)
        .maybeSingle();
    if (createNew && !data) {
        const { error } = await supabase_1.supabase.from('ascend-accounts').insert({
            address,
            tokens: {},
            created_at: new Date().toISOString(),
        }).select().single();
        if (error && error.code !== '23505') {
            throw error;
        }
        console.log('🆕 Created account:', address);
    }
    return !!data;
}
