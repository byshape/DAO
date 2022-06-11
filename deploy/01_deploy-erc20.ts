import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const initialSupply: string = BigInt(1000 * 10 ** 18).toString();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  // deploy vote token
  await deploy("VoteToken", {
    contract: "ERC20",
    from: deployer,
    args: ["Test DAO vote token", "TDAOV", 18, initialSupply, deployer],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  // deploy reward token
  await deploy("RewardToken", {
    contract: "ERC20",
    from: deployer,
    args: ["Test DAO reward token", "TDAOR", 18, initialSupply, deployer],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });
};
export default func;
func.tags = ["ERC20"];
