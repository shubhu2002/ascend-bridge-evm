"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ABI = exports.tokenAddress = exports.CONTRACT_ADDRESS = void 0;
exports.startListener = startListener;
const ethers_1 = require("ethers");
const utils_1 = require("../utils");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const file = path_1.default.join(__dirname, '../../deployments/addresses.json');
_a = JSON.parse(fs_1.default.readFileSync(file, 'utf-8')), exports.CONTRACT_ADDRESS = _a.vault, exports.tokenAddress = _a.usdt;
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
    const metadata = await (0, utils_1.getMetadata)(provider, token ?? undefined);
    const account = type === 'DEPOSIT' ? from : to;
    await (0, utils_1.ensureAccountExists)(account);
    try {
        const { data, error } = await utils_1.supabase
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
    await (0, utils_1.applyAccountDelta)(type === 'DEPOSIT' ? from : to, token, amount, type, provider);
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
