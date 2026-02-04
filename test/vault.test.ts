import { ethers } from "hardhat";
import { expect } from "chai";

describe("OwnerWithdrawVault", () => {
  it("deposit + withdraw flow", async () => {
    const [owner, user] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("OwnerWithdrawVault");
    const vault = await Vault.deploy(owner.address);

    await user.sendTransaction({
      to: await vault.getAddress(),
      value: ethers.parseEther("1"),
    });

    expect(await ethers.provider.getBalance(vault.getAddress()))
      .to.equal(ethers.parseEther("1"));

    await vault.withdrawETH(owner.address, ethers.parseEther("0.5"));

    expect(await ethers.provider.getBalance(vault.getAddress()))
      .to.equal(ethers.parseEther("0.5"));
  });
});