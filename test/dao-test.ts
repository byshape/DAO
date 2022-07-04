import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, deployments } from "hardhat";

import { BigNumber, Contract } from "ethers";

describe("DAO", function () {
  const initialSupply: bigint = BigInt(1000 * 10 ** 18);
  const daoMint: bigint = BigInt(100 * 10 ** 18);
  const userMint: bigint = BigInt(10 * 10 ** 18);
  const adminReward: bigint = BigInt(1 * 10 ** 18);
  const debatingDuration: number = 3 * 24 * 60 * 60; // 3 days
  const depositAmount: bigint = initialSupply / BigInt(2);

  let deployer: SignerWithAddress;
  let admin2: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let voteToken: Contract;
  let rewardToken: Contract;
  let dao: Contract;
  let proposalsCounter: number = 0;

  function getCallData(name: string, args: Array<any>): string {
    var jsonAbi = [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "transfer",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

    const iface = new ethers.utils.Interface(jsonAbi);
    return iface.encodeFunctionData(name, args);
  }

  const setupTest = deployments.createFixture(
    async ({deployments, getNamedAccounts, ethers}, options) => {
        await deployments.fixture();
        const { deployer } = await getNamedAccounts();
        const VoteContract = await ethers.getContract("VoteToken", deployer);
        const RewardContract = await ethers.getContract("RewardToken", deployer);
        const DAOContract = await ethers.getContract("DAO", deployer);

        return {
          voteToken: VoteContract,
          rewardToken: RewardContract,
          dao: DAOContract,
        };
    }
);

  before(async () => {
    deployer = await ethers.getNamedSigner("deployer");
    [admin2, user, user2, user3] = await ethers.getUnnamedSigners();
    
    const setup = await setupTest();
    voteToken = setup.voteToken;
    rewardToken = setup.rewardToken;
    dao = setup.dao;

    expect(await rewardToken.mint(dao.address, daoMint)).to.emit(voteToken, "Transfer").withArgs(
      ethers.constants.AddressZero, dao.address, daoMint
    );
    expect(await voteToken.mint(user.address, userMint)).to.emit(voteToken, "Transfer").withArgs(
      ethers.constants.AddressZero, user.address, userMint
    );
    expect(await voteToken.mint(user2.address, userMint)).to.emit(voteToken, "Transfer").withArgs(
      ethers.constants.AddressZero, user2.address, userMint
    );
  });

  it("Adds proposal", async () => {
    let callData: string = getCallData("transfer", [admin2.address, adminReward]);

    expect(await dao.addProposal(
      callData, rewardToken.address, "Reward admin2 with 10 tokens"
    )).to.emit(dao, "NewProposal").withArgs(
      proposalsCounter, callData, rewardToken.address, "Reward admin2 with 10 tokens"
    );
  });

  it("Deposits vote tokens", async() => {
    expect(await voteToken.connect(deployer).approve(dao.address, initialSupply)).to.emit(voteToken, "Approval").withArgs(
      deployer.address, dao.address, initialSupply
    );
    expect(await voteToken.connect(user).approve(dao.address, userMint)).to.emit(voteToken, "Approval").withArgs(
      user.address, dao.address, userMint
    );
    expect(await voteToken.connect(user2).approve(dao.address, userMint)).to.emit(voteToken, "Approval").withArgs(
      user2.address, dao.address, userMint
    );
    
    expect(await dao.connect(deployer).deposit(depositAmount)).to.emit(dao, "NewDeposit").withArgs(
      deployer.address, depositAmount
    );
    expect(await dao.connect(user).deposit(userMint)).to.emit(dao, "NewDeposit").withArgs(
      user.address, userMint
    );
    expect(await dao.connect(user2).deposit(userMint)).to.emit(dao, "NewDeposit").withArgs(
      user2.address, userMint
    );
    expect(await voteToken.balanceOf(deployer.address)).to.be.equal(initialSupply - depositAmount);
    expect(await voteToken.balanceOf(user.address)).to.be.equal(0);
    expect(await voteToken.balanceOf(dao.address)).to.be.equal(depositAmount + userMint * BigInt(2));
  });

  it("Accept votes for proposal", async() => {
    expect(await dao.vote(proposalsCounter, true)).to.emit(dao, "Vote").withArgs(
      proposalsCounter, deployer.address, depositAmount, true
    );
  });

  it("Does not accept votes for the same proposal twice", async() => {
    await expect(dao.vote(proposalsCounter, true)).to.be.revertedWith(`VotedAlready("${deployer.address}", ${proposalsCounter})`);
  });

  it("Does not accept votes for invalid proposal", async() => {
    let proposalId: number = 100;
    await expect(dao.vote(proposalId, true)).to.be.revertedWith(`InvalidProposal(${proposalId})`);
  });

  it("Accepts not locked vote tokens withdrawal", async() => {
    expect(await dao.connect(user).withdraw(userMint)).to.emit(dao, "Withdrawal").withArgs(user.address, userMint);
    expect(await voteToken.balanceOf(user.address)).to.be.equal(userMint);
  });

  it("Does not accept vote tokens withdrawal when it is locked", async() => {
    let adminBalance: BigNumber = await voteToken.balanceOf(deployer.address);
    await expect(dao.withdraw(depositAmount)).to.be.revertedWith("WrongPeriod");
    expect(await voteToken.balanceOf(deployer.address)).to.be.equal(adminBalance);
  });

  it("Does not finish proposal during debating period", async() => {
    expect(await rewardToken.balanceOf(admin2.address)).to.be.equal(0);
    await expect(dao.finishProposal(proposalsCounter))
    .to.be.revertedWith("WrongPeriod");
    expect(await rewardToken.balanceOf(admin2.address)).to.be.equal(0);
  });

  it("Does not finish non-existing proposal", async() => {
    let proposalId: number = 100;
    await expect(dao.finishProposal(proposalId))
    .to.be.revertedWith(`InvalidProposal(${proposalId})`);
    expect(await rewardToken.balanceOf(admin2.address)).to.be.equal(0);
  });

  it("Finishes proposal with quorum and calls call data on recipient", async() => {
    await ethers.provider.send('evm_increaseTime', [debatingDuration * 2]);

    expect(await rewardToken.balanceOf(admin2.address)).to.be.equal(0);
    expect(await dao.finishProposal(proposalsCounter))
    .to.emit(dao, "ProposalFinished").withArgs(proposalsCounter);
    expect(await rewardToken.balanceOf(admin2.address)).to.be.equal(adminReward);
  });

  it("Does not finish proposal twice", async() => {
    let admin2Balance = await rewardToken.balanceOf(admin2.address);
    await expect(dao.finishProposal(proposalsCounter))
    .to.be.revertedWith(`InvalidProposal(${proposalsCounter})`);
    expect(await rewardToken.balanceOf(admin2.address)).to.be.equal(admin2Balance);
  });

  it("Does not finish proposal with invalid call data", async() => {
    let callData: string = getCallData("transferFrom", [user3.address, deployer.address, userMint]);
    proposalsCounter++;
    expect(await dao.addProposal(
      callData, rewardToken.address, "Call invalid calldata"
    )).to.emit(dao, "NewProposal").withArgs(
      proposalsCounter, callData, rewardToken.address, "Call invalid calldata"
    );
    expect(await dao.connect(deployer).vote(proposalsCounter, true)).to.emit(dao, "Vote").withArgs(
      proposalsCounter, deployer.address, initialSupply + userMint, true
    );
    expect(await dao.connect(user2).vote(proposalsCounter, true)).to.emit(dao, "Vote").withArgs(
      proposalsCounter, user2.address, initialSupply + userMint, true
    );

    await ethers.provider.send('evm_increaseTime', [debatingDuration * 2]);
    await expect(dao.finishProposal(proposalsCounter))
    .to.be.revertedWith(`FunctionCallError()`);
  });

  it("Finishes proposal without quorum and without calling call data on recipient", async() => {
    let callData: string = getCallData("transfer", [admin2.address, adminReward]);
    proposalsCounter++;
    expect(await dao.addProposal(
      callData, rewardToken.address, "Reward admin2 with 10 tokens"
    )).to.emit(dao, "NewProposal").withArgs(
      proposalsCounter, callData, rewardToken.address, "Reward admin2 with 10 tokens"
    );
    expect(await dao.connect(user2).vote(proposalsCounter, true)).to.emit(dao, "Vote").withArgs(
      proposalsCounter, user2.address, userMint, true
    );

    await ethers.provider.send('evm_increaseTime', [debatingDuration * 2]);

    let admin2Balance: BigNumber = await rewardToken.balanceOf(admin2.address);
    expect(await dao.finishProposal(proposalsCounter))
    .to.emit(dao, "ProposalFinished").withArgs(proposalsCounter);
    expect(await rewardToken.balanceOf(admin2.address)).to.be.equal(admin2Balance);
  });

  it("Finishes proposal with quorum, voted against, without calling call data on recipient", async() => {
    expect(await voteToken.mint(user2.address, initialSupply)).to.emit(voteToken, "Transfer").withArgs(
      ethers.constants.AddressZero, user2.address, initialSupply
    );
    expect(await voteToken.connect(user2).approve(dao.address, initialSupply)).to.emit(voteToken, "Approval").withArgs(
      user2.address, dao.address, initialSupply
    );
    expect(await dao.connect(user2).deposit(initialSupply)).to.emit(dao, "NewDeposit").withArgs(
      user2.address, initialSupply
    );
    
    let callData: string = getCallData("transfer", [admin2.address, adminReward]);
    proposalsCounter++;
    expect(await dao.addProposal(
      callData, rewardToken.address, "Reward admin2 with 10 tokens"
    )).to.emit(dao, "NewProposal").withArgs(
      proposalsCounter, callData, rewardToken.address, "Reward admin2 with 10 tokens"
    );
    expect(await dao.connect(deployer).vote(proposalsCounter, true)).to.emit(dao, "Vote").withArgs(
      proposalsCounter, deployer.address, depositAmount, true
    );
    expect(await dao.connect(user2).vote(proposalsCounter, false)).to.emit(dao, "Vote").withArgs(
      proposalsCounter, user2.address, userMint + initialSupply, true
    );

    await ethers.provider.send('evm_increaseTime', [debatingDuration * 2]);

    let admin2Balance: BigNumber = await rewardToken.balanceOf(admin2.address);
    expect(await dao.finishProposal(proposalsCounter))
    .to.emit(dao, "ProposalFinished").withArgs(proposalsCounter);
    expect(await rewardToken.balanceOf(admin2.address)).to.be.equal(admin2Balance);
  });

  it("Does not accept vote tokens withdrawal more than deposit", async() => {
    let invalidAmount: bigint = depositAmount * BigInt(2);
    let adminBalance: BigNumber = await voteToken.balanceOf(deployer.address);
    await expect(dao.withdraw(invalidAmount)).to.be.revertedWith(`InvalidAmount(${invalidAmount})`);
    expect(await voteToken.balanceOf(deployer.address)).to.be.equal(adminBalance);
  });

  it("Accepts partial vote tokens withdrawal", async() => {
    let withdrawAmount = depositAmount / BigInt(2);
    let adminBalance: BigNumber = await voteToken.balanceOf(deployer.address);
    expect(await dao.withdraw(withdrawAmount)).to.emit(dao, "Withdrawal").withArgs(deployer.address, withdrawAmount);
    expect(await voteToken.balanceOf(deployer.address)).to.be.equal(adminBalance.add(withdrawAmount));
  });

  it("Does not accept votes for the proposal after debating period", async() => {
    let proposalId: number = 0;
    await expect(dao.vote(proposalId, true)).to.be.revertedWith("WrongPeriod");
  });
});
