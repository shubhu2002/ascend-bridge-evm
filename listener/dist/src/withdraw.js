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
exports.withdraw = withdraw;
const ethers_1 = require("ethers");
const dotenv = __importStar(require("dotenv"));
const utils_1 = require("../utils");
const logger_1 = __importDefault(require("../utils/logger"));
const security_1 = require("../utils/security");
dotenv.config();
const provider = new ethers_1.ethers.JsonRpcProvider(process.env.BUILDBEAR_HTTP_RPC);
const ownerWallet = new ethers_1.ethers.Wallet(process.env.TREASURY_OWNER_PK, provider);
const vaultContract = new ethers_1.ethers.Contract(utils_1.CONTRACT_ADDRESS, utils_1.ABI, ownerWallet);
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
        const { data, error } = await utils_1.supabase
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
            tx = await vaultContract.withdrawETH(signer, requestedBalance);
            logger_1.default.info('🚀 Sending ETH withdraw...', {
                address,
                token,
                amount,
            });
        }
        else {
            // ERC20
            tx = await vaultContract.withdrawERC20(token, signer, requestedBalance);
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
