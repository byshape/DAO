import { ethers } from "hardhat";

import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // get signer
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  //get vote token
  const voteToken = await ethers.getContract("VoteToken");

  // deploy DAO contract
  await deploy("DAO", {
    from: deployer,
    args: [
      deployer,
      voteToken.address,
      process.env.MINIMUM_QUORUM as string,
      process.env.DEBATING_DURATION as string],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });
};
export default func;
func.tags = ["DAO"];