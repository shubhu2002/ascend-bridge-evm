"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimRow = claimRow;
exports.processDeposit = processDeposit;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const utils_1 = require("../utils");
const abis_1 = require("../utils/abis");
const supabase_1 = require("../supabase");
dotenv_1.default.config();
const middleman = new ethers_1.ethers.Wallet(process.env.MIDDLEMAN_PK, utils_1.ethProvider);
const token = new ethers_1.ethers.Contract(utils_1.USDT_ADDRESS, abis_1.MIDDLEMAN_ERC20_ABI, utils_1.ethProvider);
const signer = new ethers_1.NonceManager(middleman);
const tokenWithSigner = token.connect(signer);
async function alreadySwept(row) {
    const fromBlock = row.block_number;
    const toBlock = await utils_1.ethProvider.getBlockNumber();
    const transferFilter = token.filters.Transfer(middleman.address, utils_1.CONTRACT_ADDRESS);
    const logs = await token.queryFilter(transferFilter, fromBlock, toBlock);
    for (const log of logs) {
        if (!(log instanceof ethers_1.EventLog))
            continue;
        const { value } = log.args;
        if (BigInt(value) === BigInt(row.amount)) {
            console.log('🔎 Found matching sweep:', log.transactionHash);
            return log.transactionHash;
        }
    }
    return null;
}
async function claimRow(id) {
    const { data, error } = await supabase_1.supabase
        .from('evm_bridge_middleman_deposits')
        .update({ processing: true, status: 'PROCESSING' })
        .eq('id', id)
        .eq('processing', false)
        .in('status', ['PENDING', 'FAILED'])
        .select('id')
        .maybeSingle();
    if (error) {
        console.error('claim error', error);
        return false;
    }
    return !!data; // true only if WE locked it
}
async function finalizeDeposit(row, hash) {
    await (0, supabase_1.saveEvent)('DEPOSIT', row.token_address, row.from_address, row.to_address, BigInt(row.amount), hash, row.log_index, row.block_number);
    await supabase_1.supabase
        .from('evm_bridge_middleman_deposits')
        .update({ status: 'SUCCESS', processing: false })
        .eq('id', row.id);
}
async function processDeposit(row) {
    try {
        console.log('Sweeping:', row.from_address, row.amount);
        if (row.sweep_tx) {
            const receipt = await utils_1.ethProvider.getTransactionReceipt(row.sweep_tx);
            if (receipt && receipt.status === 1) {
                console.log('🔁 Recovered mined tx:', row.sweep_tx);
                await finalizeDeposit(row, row.sweep_tx);
                return;
            }
        }
        const recovered = await alreadySwept(row);
        // Detect if already swept (RPC crash recovery)
        if (recovered) {
            console.log('🧠 Recovered confirmed sweep:', recovered);
            await finalizeDeposit(row, recovered);
            return;
        }
        const tx = await tokenWithSigner.transfer(utils_1.CONTRACT_ADDRESS, row.amount);
        await supabase_1.supabase
            .from('evm_bridge_middleman_deposits')
            .update({ sweep_tx: tx.hash })
            .eq('id', row.id);
        const receipt = await tx.wait();
        if (!receipt) {
            console.log('Receipt not exists ');
            return;
        }
        await finalizeDeposit(row, receipt.hash);
    }
    catch (err) {
        console.error('❌ Sweep failed:', err);
        await supabase_1.supabase
            .from('evm_bridge_middleman_deposits')
            .update({ status: 'FAILED', processing: false })
            .eq('id', row.id);
    }
}
