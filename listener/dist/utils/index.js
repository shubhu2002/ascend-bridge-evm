"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.middlemanWallet = exports.ownerWallet = exports.ethProvider = exports.USDT_ADDRESS = exports.CONTRACT_ADDRESS = void 0;
exports.formatTokenAmount = formatTokenAmount;
exports.getMetadata = getMetadata;
const ethers_1 = require("ethers");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const file = path_1.default.join(__dirname, '../../../deployments/addresses.json');
_a = JSON.parse(fs_1.default.readFileSync(file, 'utf-8')), exports.CONTRACT_ADDRESS = _a.vault, exports.USDT_ADDRESS = _a.usdt;
// ======== Wallets & Provier
exports.ethProvider = new ethers_1.ethers.JsonRpcProvider(process.env.BUILDBEAR_HTTP_RPC);
exports.ownerWallet = new ethers_1.ethers.Wallet(process.env.TREASURY_OWNER_PK, exports.ethProvider);
exports.middlemanWallet = new ethers_1.ethers.Wallet(process.env.MIDDLEMAN_PK, exports.ethProvider);
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
