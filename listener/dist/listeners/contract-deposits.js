"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startListener = startListener;
const ethers_1 = require("ethers");
const utils_1 = require("../utils");
const abis_1 = require("../utils/abis");
const supabase_1 = require("../supabase");
const contract = new ethers_1.ethers.Contract(utils_1.CONTRACT_ADDRESS, abis_1.CONTRACTS_ABI, utils_1.ethProvider);
let lastProcessedBlock = 0;
async function startListener() {
    lastProcessedBlock = await utils_1.ethProvider.getBlockNumber();
    console.log('lastProcessedBlock - ', lastProcessedBlock);
    let latestBlock = 0;
    setInterval(async () => {
        latestBlock = await utils_1.ethProvider.getBlockNumber();
        console.log('⛏ polling...');
        try {
            latestBlock = await utils_1.ethProvider.getBlockNumber();
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
                    await (0, supabase_1.saveEvent)('DEPOSIT', null, from, utils_1.CONTRACT_ADDRESS, amount, ev.transactionHash, ev.index, ev.blockNumber);
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
                    await (0, supabase_1.saveEvent)('WITHDRAW', null, utils_1.CONTRACT_ADDRESS, to, amount, ev.transactionHash, ev.index, ev.blockNumber);
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
                console.log('listnere', ev);
                await (0, supabase_1.saveEvent)('DEPOSIT', token, from, utils_1.CONTRACT_ADDRESS, amount, ev.transactionHash, ev.index, ev.blockNumber);
            }
            // -------- ERC20 WITHDRAW --------
            const erc20Withdraws = await contract.queryFilter(contract.filters.WithdrawERC20(), lastProcessedBlock + 1, latestBlock);
            for (const ev of erc20Withdraws) {
                if (!(ev instanceof ethers_1.EventLog))
                    continue;
                const [token, to, amount] = ev.args;
                await (0, supabase_1.saveEvent)('WITHDRAW', token, utils_1.CONTRACT_ADDRESS, to, amount, ev.transactionHash, ev.index, ev.blockNumber);
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
