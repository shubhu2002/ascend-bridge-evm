"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vaultContract = void 0;
exports.withdraw = withdraw;
const ethers_1 = require("ethers");
const supabase_1 = require("../supabase");
const logger_1 = __importDefault(require("../utils/logger"));
const abis_1 = require("../utils/abis");
const utils_1 = require("../utils");
const security_1 = require("../utils/security");
exports.vaultContract = new ethers_1.ethers.Contract(utils_1.CONTRACT_ADDRESS, abis_1.CONTRACTS_ABI, utils_1.ownerWallet);
async function withdraw(req, res) {
    const { address, token, amount, message, signature } = req.body;
    if (!address || !amount || !message || !signature)
        return res.status(400).json({ error: 'missing params' });
    if (!(0, security_1.acquireWithdrawLock)(address)) {
        return res.status(429).json({
            error: 'Withdraw Already Processing',
        });
    }
    try {
        const { data, error } = await supabase_1.supabase
            .from('ascend-accounts')
            .select('tokens, balance')
            .eq('address', address)
            .single();
        if (error || !data)
            return res.status(404).json({ error: 'Account Not Found' });
        const signer = ethers_1.ethers.verifyMessage(message, signature);
        if (signer.toLowerCase() !== address.toLowerCase())
            return res.status(401).json({ error: 'Invalid Signature' });
        console.log('✅ Withdraw requested by:', signer);
        const tokenKey = token ?? 'ETH';
        const availableBalance = BigInt(data.tokens?.[tokenKey]?.available_balance ?? data.balance ?? '0');
        const requestedBalance = BigInt(amount);
        if (availableBalance < requestedBalance)
            return res.status(400).json({ error: 'Insufficient Balance' });
        let tx;
        if (!token) {
            // ETH
            tx = await exports.vaultContract.withdrawETH(signer, requestedBalance);
            logger_1.default.info('🚀 Sending ETH withdraw...', {
                address,
                token,
                amount,
            });
        }
        else {
            // ERC20
            tx = await exports.vaultContract.withdrawERC20(token, signer, requestedBalance);
            logger_1.default.info('🚀 Sending USDT withdraw...', {
                address,
                token,
                amount,
            });
        }
        logger_1.default.info('⛓ Sending tx:', tx.hash);
        return res.json({
            success: true,
            txHash: tx.hash,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, error });
    }
    finally {
        // always release lock
        (0, security_1.releaseWithdrawLock)(address);
    }
}
