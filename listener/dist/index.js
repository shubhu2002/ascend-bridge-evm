"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ABI = exports.supabase = exports.CONTRACT_ADDRESS = void 0;
exports.startListener = startListener;
const ethers_1 = require("ethers");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const tokenMetadata_1 = require("./tokenMetadata");
const updateAccountTokens_1 = require("./updateAccountTokens");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const file = path_1.default.join(__dirname, '../../deployments/addresses.json');
exports.CONTRACT_ADDRESS = JSON.parse(fs_1.default.readFileSync(file, 'utf-8')).vault;
exports.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// ========== CONFIGURATION ============
exports.ABI = [
    'event DepositETH(address indexed from, uint256 amount)',
    'event WithdrawETH(address indexed to, uint256 amount)',
    'event DepositERC20(address indexed token, address indexed from, uint256 amount)',
    'event WithdrawERC20(address indexed token, address indexed to, uint256 amount)',
];
let lastProcessedBlock = 0;
const provider = new ethers_1.ethers.JsonRpcProvider(process.env.BUILDBEAR_HTTP_RPC);
const contract = new ethers_1.ethers.Contract(exports.CONTRACT_ADDRESS, exports.ABI, provider);
async function handleEvent(type, token, from, to, amount, ev) {
    const metadata = await (0, tokenMetadata_1.getMetadata)(provider, token ?? undefined);
    const account = type === 'DEPOSIT' ? from : to;
    await (0, updateAccountTokens_1.ensureAccountExists)(account);
    try {
        const { data, error } = await exports.supabase
            .from('evm_birdge_events')
            .insert({
            contract_address: exports.CONTRACT_ADDRESS,
            account_address: account, // NEW FK SAFE
            tx_hash: ev.transactionHash,
            log_index: ev.index,
            event_type: type,
            from_address: from,
            to_address: to,
            token: token, // NULL for native ETH
            amount: amount.toString(),
            block_number: ev.blockNumber,
            metadata: metadata,
        })
            .select();
        if (error?.code === '23505') {
            console.log('⚠ Duplicate tx skipped:', ev.transactionHash);
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
    await (0, updateAccountTokens_1.applyAccountDelta)(type === 'DEPOSIT' ? from : to, token, amount, type);
}
async function startListener() {
    lastProcessedBlock = await provider.getBlockNumber();
    console.log('lastProcessedBlock - ', lastProcessedBlock);
    let latestBlock = 0;
    setInterval(async () => {
        latestBlock = await provider.getBlockNumber();
        console.log('⛏ polling...');
        try {
            latestBlock = await provider.getBlockNumber();
            if (latestBlock <= lastProcessedBlock)
                return;
            console.log(`Scanning ${lastProcessedBlock + 1} → ${latestBlock}`);
            // -------- ETH DEPOSIT --------
            const ethDeposits = await contract.queryFilter(contract.filters.DepositETH(), lastProcessedBlock + 1, latestBlock);
            for (const ev of ethDeposits) {
                if (!(ev instanceof ethers_1.EventLog))
                    continue;
                const [from, amount] = ev.args;
                try {
                    await handleEvent('DEPOSIT', null, from, exports.CONTRACT_ADDRESS, amount, ev);
                }
                catch (e) {
                    console.log('⚠ Event failed but continuing:', ev.transactionHash);
                }
            }
            // -------- ETH WITHDRAW --------
            const ethWithdraws = await contract.queryFilter(contract.filters.WithdrawETH(), lastProcessedBlock + 1, latestBlock);
            for (const ev of ethWithdraws) {
                if (!(ev instanceof ethers_1.EventLog))
                    continue;
                const [to, amount] = ev.args;
                try {
                    await handleEvent('WITHDRAW', null, exports.CONTRACT_ADDRESS, to, amount, ev);
                }
                catch (e) {
                    console.log('⚠ Event failed but continuing:', ev.transactionHash);
                }
            }
            // -------- ERC20 DEPOSIT --------
            const erc20Deposits = await contract.queryFilter(contract.filters.DepositERC20(), lastProcessedBlock + 1, latestBlock);
            for (const ev of erc20Deposits) {
                if (!(ev instanceof ethers_1.EventLog))
                    continue;
                const [token, from, amount] = ev.args;
                await handleEvent('DEPOSIT', token, from, exports.CONTRACT_ADDRESS, amount, ev);
            }
            // -------- ERC20 WITHDRAW --------
            const erc20Withdraws = await contract.queryFilter(contract.filters.WithdrawERC20(), lastProcessedBlock + 1, latestBlock);
            for (const ev of erc20Withdraws) {
                if (!(ev instanceof ethers_1.EventLog))
                    continue;
                const [token, to, amount] = ev.args;
                await handleEvent('WITHDRAW', token, exports.CONTRACT_ADDRESS, to, amount, ev);
            }
        }
        catch (err) {
            console.error('🔥 Listener error:', err);
        }
        finally {
            lastProcessedBlock = latestBlock;
        }
    }, 10000);
}
startListener().catch((error) => {
    console.log(error);
});
