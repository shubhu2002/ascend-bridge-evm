// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract OwnerWithdrawVault {
    address public owner;

    event DepositETH(address indexed from, uint256 amount);
    event WithdrawETH(address indexed to, uint256 amount);

    event DepositERC20(address indexed token, address indexed from, uint256 amount);
    event WithdrawERC20(address indexed token, address indexed to, uint256 amount);

    constructor(address _owner) {
        owner = _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    // ETH
    receive() external payable {
        emit DepositETH(msg.sender, msg.value);
    }

    function depositETH() external payable {
        require(msg.value > 0, "ZERO_AMOUNT");
        emit DepositETH(msg.sender, msg.value);
    }

    function withdrawETH(address payable to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "INSUFFICIENT_BALANCE");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "TRANSFER_FAILED");
        emit WithdrawETH(to, amount);
    }

    // ERC20

    function depositERC20(address token, uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        emit DepositERC20(token, msg.sender, amount);
    }

    function withdrawERC20(address token, address to, uint256 amount)
        external
        onlyOwner
    {
        require(IERC20(token).balanceOf(address(this)) >= amount, "INSUFFICIENT_BALANCE");
        IERC20(token).transfer(to, amount);
        emit WithdrawERC20(token, to, amount);
    }

}