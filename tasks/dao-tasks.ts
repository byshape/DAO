import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const getContract = async (contract: string, hre:HardhatRuntimeEnvironment) => {
    const daoFactory = await hre.ethers.getContractFactory("DAO");
    return daoFactory.attach(contract);
  }

task("addProposal", "Adds a new proposal")
.addParam("contract", "DAO contract")
.addParam("calldata", "Data for calling in case the proposal is accepted", undefined, types.string)
.addParam("recipient", "Address of account to call", undefined, types.string)
.addParam("description", "Description of proposal", undefined, types.string)
.setAction(async (taskArgs, hre) => {
    const dao = await getContract(taskArgs.contract, hre);
    await dao.addProposal(taskArgs.calldata, taskArgs.recipient, taskArgs.description);
    console.log("Proposal was added");
});

task("deposit", "Deposits the vote tokens")
.addParam("contract", "DAO contract")
.addParam("amount", "Amount of tokens to deposit", undefined, types.string)
.setAction(async (taskArgs, hre) => {
    const dao = await getContract(taskArgs.contract, hre);
    await dao.deposit(taskArgs.amount);
    console.log("Tokens were deposited");
});

task("vote", "Finishes the proposal")
.addParam("contract", "DAO contract")
.addParam("proposalid", "Proposal id to finish", undefined, types.string)
.addParam("answer", "Vote for or against", undefined, types.boolean)
.setAction(async (taskArgs, hre) => {
    const dao = await getContract(taskArgs.contract, hre);
    await dao.vote(taskArgs.proposalid, taskArgs.answer);
    console.log("Voted successfully");
});

task("finishProposal", "Allows to vote for (or against) the proposal")
.addParam("contract", "DAO contract")
.addParam("proposalid", "Proposal id to vote", undefined, types.string)
.setAction(async (taskArgs, hre) => {
    const dao = await getContract(taskArgs.contract, hre);
    await dao.finishProposal(taskArgs.proposalid);
    console.log("Proposal was finished");
});

task("withdraw", "Allows to vote for (or against) the proposal")
.addParam("contract", "DAO contract")
.addParam("amount", "Amount to withdraw", undefined, types.string)
.setAction(async (taskArgs, hre) => {
    const dao = await getContract(taskArgs.contract, hre);
    await dao.withdraw(taskArgs.amount);
    console.log("Tokens were withdrew");
});