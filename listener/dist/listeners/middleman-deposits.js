"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartMiddlemanListener = StartMiddlemanListener;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabase_1 = require("../supabase");
const abis_1 = require("../utils/abis");
const security_1 = require("../utils/security");
const middleman_1 = require("../utils/middleman");
const utils_1 = require("../utils");
let lastBlock = 0;
let sweeping = false;
const token = new ethers_1.ethers.Contract(utils_1.USDT_ADDRESS, abis_1.MIDDLEMAN_ERC20_ABI, utils_1.ethProvider);
async function StartMiddlemanListener() {
    lastBlock = await utils_1.ethProvider.getBlockNumber();
    console.log('🛰 Middleman listener started from block', lastBlock);
    setInterval(async () => {
        try {
            const latest = await utils_1.ethProvider.getBlockNumber();
            // query to check txs , filter it and insert in db as PENDING
            if (latest > lastBlock) {
                const events = await token.queryFilter(token.filters.Transfer(null, utils_1.middlemanWallet.address), lastBlock + 1, latest);
                for (const ev of events) {
                    if (!(ev instanceof ethers_1.EventLog))
                        continue;
                    console.log('📥 Deposit detected:', ev.transactionHash);
                    try {
                        const { from, to, value } = ev.args;
                        // Check if user(from_address) belongs to "ascend-accounts"
                        const exists = await (0, security_1.ensureAccountExists)(from, false);
                        if (!exists) {
                            console.log('🚫 Ignoring unknown depositor:', from);
                            return;
                        }
                        const metadata = await (0, utils_1.getMetadata)(utils_1.ethProvider, utils_1.USDT_ADDRESS);
                        const { data, error } = await supabase_1.supabase
                            .from('evm_bridge_middleman_deposits')
                            .insert({
                            tx_hash: ev.transactionHash,
                            log_index: ev.index,
                            block_number: ev.blockNumber,
                            from_address: from,
                            to_address: to,
                            amount: value.toString(),
                            token_address: ev.address,
                            status: 'PENDING',
                            metadata,
                            processing: false,
                        })
                            .select()
                            .single();
                        if (error && error?.code === '23505') {
                            console.log('⚠ Duplicate tx skipped:', ev.transactionHash);
                            return;
                        }
                        if (error) {
                            console.error('❌ Supabase insert error:', error);
                            throw error;
                        }
                        console.log('✅ ERC_20 external event stored:', data.tx_hash);
                    }
                    catch (error) {
                        console.log('Inserting Pending Error: ', error);
                    }
                }
                lastBlock = latest;
            }
            // process PENDING txs , locked it and process deposits to contract
            if (sweeping)
                return;
            sweeping = true;
            try {
                const { data } = await supabase_1.supabase
                    .from('evm_bridge_middleman_deposits')
                    .select('*')
                    .in('status', ['PENDING', 'FAILED'])
                    .order('block_number', { ascending: true })
                    .limit(5);
                if (!data?.length)
                    return;
                for (const row of data) {
                    // change status to "processing" to lock the tx to overwrite
                    const locked = await (0, middleman_1.claimRow)(row.id);
                    if (!locked)
                        continue;
                    await (0, middleman_1.processDeposit)(row);
                }
            }
            catch (error) {
                console.log('Processing Queue Error: ', error);
            }
            finally {
                sweeping = false;
            }
        }
        catch (error) {
            console.error('Middleman Listener Error:', error);
        }
    }, 10000);
}
