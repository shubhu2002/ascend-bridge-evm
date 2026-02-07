"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenAddress = exports.CONTRACT_ADDRESS = exports.ABI = exports.supabase = void 0;
exports.formatTokenAmount = formatTokenAmount;
exports.getMetadata = getMetadata;
exports.ensureAccountExists = ensureAccountExists;
exports.applyAccountDelta = applyAccountDelta;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
exports.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
exports.ABI = [
    // ===== WRITE FUNCTIONS =====
    'function withdrawETH(address to, uint256 amount)',
    'function withdrawERC20(address token, address to, uint256 amount)',
    // ===== OPTIONAL (read) =====
    'function owner() view returns(address)',
    // ===== EVENTS =====
    'event DepositETH(address indexed from, uint256 amount)',
    'event WithdrawETH(address indexed to, uint256 amount)',
    'event DepositERC20(address indexed token, address indexed from, uint256 amount)',
    'event WithdrawERC20(address indexed token, address indexed to, uint256 amount)',
];
const file = path_1.default.join(__dirname, '../../deployments/addresses.json');
_a = JSON.parse(fs_1.default.readFileSync(file, 'utf-8')), exports.CONTRACT_ADDRESS = _a.vault, exports.tokenAddress = _a.usdt;
const cache = new Map();
function formatTokenAmount(amount, decimals, symbol) {
    return `${(0, ethers_1.formatUnits)(amount, decimals)} ${symbol}`;
}
async function getMetadata(provider, token) {
    // Native ETH
    if (!token) {
        return {
            symbol: 'ETH',
            decimals: 18,
            contract_type: 'ETH',
        };
    }
    let meta = cache.get(token);
    if (meta)
        return meta;
    const erc20 = new ethers_1.ethers.Contract(token, [
        'function symbol() view returns(string)',
        'function decimals() view returns(uint8)',
    ], provider);
    let symbol = 'TOKEN';
    let decimals = 18;
    try {
        symbol = await erc20.symbol();
        decimals = await erc20.decimals();
    }
    catch {
        console.log('⚠ Could not fetch token metadata:', token);
    }
    meta = {
        symbol,
        decimals: Number(decimals),
        contract_type: 'ERC_20',
    };
    cache.set(token, meta);
    return meta;
}
async function ensureAccountExists(address) {
    const { data } = await exports.supabase
        .from('ascend-accounts')
        .select('address')
        .eq('address', address)
        .maybeSingle();
    if (data)
        return;
    const { error } = await exports.supabase.from('ascend-accounts').insert({
        address,
        tokens: {},
        created_at: new Date().toISOString(),
    });
    if (error && error.code !== '23505') {
        throw error;
    }
    console.log('🆕 Created account:', address);
}
async function applyAccountDelta(address, token, amount, type, provider) {
    console.log('provider exists?', !!provider);
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
        const meta = await getMetadata(provider, token ?? undefined);
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
    console.log(`💰 ${type} ${symbol}:`, address, formatTokenAmount(current, decimals, symbol), '→', formatTokenAmount(newBalance, decimals, symbol));
}
