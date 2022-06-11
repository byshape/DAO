# Description
This is a DAO contract to add proposals and vote for them. It's main features:
* DAO adds chairperson's proposals.
* DAO deposits vote tokens from users.
* DAO allow users to vote for or against the proposals.
* DAO runs calldata if quorum was reached and the majority voted for the proposal.

## Launch instructions
Run this command in terminal
```
npm install --save-dev hardhat
```
When installation process is finished, create `.env` file and add `API_URL`, `PRIVATE_KEY` and `ETHERSCAN_API_KEY`
variables there. Also you need to put `MINIMUM_QUORUM` and `DEBATING_DURATION` constants in `.env` file.

Run:
* `npx hardhat test --deploy-fixture` to run tests
* `npx hardhat coverage` to get coverage report
* `npx hardhat run --network rinkeby scripts/deploy-erc20.ts` to deploy tokens ERC20 smart contracts to the rinkeby
testnet
* `npx hardhat run --network rinkeby scripts/deploy-dao.ts` to deploy DAO smart contract to the rinkeby testnet
* `npx hardhat verify --network rinkeby DEPLOYED_CONTRACT_ADDRESS` to verify DAO or tokens' contracts
* `npx hardhat help` to get the list of available tasks, including tasks for interaction with deployed contracts.