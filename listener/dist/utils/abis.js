"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTRACTS_ABI = exports.MIDDLEMAN_ERC20_ABI = void 0;
exports.MIDDLEMAN_ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
];
exports.CONTRACTS_ABI = [
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
