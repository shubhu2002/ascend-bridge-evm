"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.saveEvent = saveEvent;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const utils_1 = require("../utils");
const security_1 = require("../utils/security");
exports.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function saveEvent(type, token, from, to, amount, tx_hash, log_index, block_number) {
    const metadata = await (0, utils_1.getMetadata)(utils_1.ethProvider, token ?? undefined);
    const account = type === 'DEPOSIT' ? from : to;
    await (0, security_1.ensureAccountExists)(account, true);
    try {
        const { data, error } = await exports.supabase
            .from('evm_birdge_events')
            .insert({
            contract_address: utils_1.CONTRACT_ADDRESS,
            account_address: account, // NEW FK SAFE
            tx_hash,
            log_index,
            event_type: type,
            from_address: from,
            to_address: to,
            token: token, // NULL for native ETH
            amount: amount.toString(),
            block_number,
            metadata: metadata,
        })
            .select();
        if (error?.code === '23505') {
            console.log('⚠ Duplicate tx skipped:', tx_hash);
            return;
        }
        if (error) {
            console.error('❌ Supabase insert error:', error);
            throw error;
        }
        console.log('✅ Event stored:', data);
    }
    catch (error) {
        console.log(error);
        return;
    }
    await udpateAscendAccountDelta(type === 'DEPOSIT' ? from : to, token, amount, type, utils_1.ethProvider);
}
async function udpateAscendAccountDelta(address, token, amount, type, provider) {
    const isToken = token !== null;
    const tokenKey = token ?? 'ETH';
    const delta = type === 'DEPOSIT' ? amount : -amount;
    const { data, error } = await exports.supabase
        .from('ascend-accounts')
        .select('tokens, balance')
        .eq('address', address)
        .single();
    if (error)
        throw error;
    const tokens = data?.tokens ?? {};
    if (!tokens[tokenKey] ||
        !tokens[tokenKey].symbol ||
        tokens[tokenKey].decimals === undefined) {
        console.log('metadata fetch');
        const meta = await (0, utils_1.getMetadata)(provider, token ?? undefined);
        console.log({ meta });
        tokens[tokenKey] = {
            symbol: meta.symbol,
            decimals: meta.decimals,
            contract_type: meta.contract_type,
            available_balance: tokens[tokenKey]?.available_balance ?? '0',
        };
        console.log({ tokens });
        console.log('🛠 Migrated token metadata:', tokenKey, meta.symbol);
    }
    const current = BigInt(tokens[tokenKey]?.available_balance ?? '0');
    const newBalance = current + delta;
    if (newBalance < 0n) {
        throw new Error(`Negative balance detected for ${address}`);
    }
    tokens[tokenKey].available_balance = newBalance.toString();
    console.log({ tokens });
    const updatePayload = { tokens };
    if (isToken) {
        updatePayload.balance = Number(newBalance);
    }
    const { error: updateError } = await exports.supabase
        .from('ascend-accounts')
        .update(updatePayload)
        .eq('address', address);
    if (updateError)
        throw updateError;
    const symbol = tokens[tokenKey].symbol;
    const decimals = tokens[tokenKey].decimals;
    console.log(`💰 ${type} ${symbol}:`, address, (0, utils_1.formatTokenAmount)(current, decimals, symbol), '→', (0, utils_1.formatTokenAmount)(newBalance, decimals, symbol));
}
