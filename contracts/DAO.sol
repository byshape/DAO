//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/// @title DAO contract to add proposals and vote for them
/// @author Xenia Shape
/// @notice This contract can be used for only the most basic DAO test experiments
contract DAO is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20Metadata;

    struct Deposit {
        uint256 amount;
        uint256 lockTimestamp;
    }

    struct Proposal {
        bytes callData;
        address recipient;
        string description;
        uint256 startTimestamp;
        uint256 votedFor;
        uint256 votedAgainst;
        mapping(address => bool) voted;
        bool finished;
    }

    /// @dev Emits when the new proposal was added
    event NewProposal(uint256 indexed proposalId, bytes callData, address recipient, string description);
    /// @dev Emits when account deposited vote tokens to DAO
    event NewDeposit(address indexed account, uint256 amount);
    /// @dev Emits when account voted for or against the proposal
    event Vote(uint256 indexed proposalId, address indexed account, uint256 votesAmount, bool answer);
    /// @dev Emits when proposal was finished
    event ProposalFinished(uint256 indexed proposalId);
    /// @dev Emits when account withdrew deposited vote tokens from DAO
    event Withdrawal(address indexed account, uint256 amount);

    error WrongPeriod();
    error InvalidProposal(uint256 proposalId);
    error VotedAlready(address account, uint256 proposalId);
    error FunctionCallError();
    error InvalidAmount(uint256 amount);

    // this role can add new proposals
    bytes32 public constant CHAIRPERSON_ROLE = keccak256("CHAIRPERSON_ROLE");

    // holders of this ERC20 token can vote for proposals
    IERC20Metadata internal _voteToken;
    // minimum percent of votes, 18 digits
    uint256 internal _minimumQuorum;
    // amount in seconds
    uint256 internal _debatingDuration;
    // user address => Deposit
    mapping(address => Deposit) internal _deposits;
    // proposal id => Proposal
    mapping(uint256 => Proposal) internal _proposals;
    // it is used as an id for the new proposal
    Counters.Counter internal _proposalsCounter;

    constructor(
        address chairPerson,
        IERC20Metadata voteToken,
        uint256 minimumQuorum,
        uint256 debatingDuration
    ) {
        _setupRole(CHAIRPERSON_ROLE, chairPerson);
        _voteToken = voteToken;
        _minimumQuorum = minimumQuorum;
        _debatingDuration = debatingDuration;
    }

    /// @notice Function for adding a new proposal
    /// @param callData Data for calling in case if the proposal is accepted
    /// @param recipient Address of account to call
    /// @param description Description of the proposal
    /** @dev
    Function can be called only by the chairperson.
    Function emits NewProposal event.
    */
    function addProposal(
        bytes memory callData,
        address recipient,
        string calldata description
    ) external onlyRole(CHAIRPERSON_ROLE) {
        _saveProposalData(callData, recipient, description);
        emit NewProposal(_proposalsCounter._value, callData, recipient, description);
        _proposalsCounter.increment();
    }

    /// @notice Function for depositing the vote tokens
    /// @param amount Amount of tokens to deposit
    /**  @dev
    Tokens should be approved to DAO preliminary.
    Function emits Transfer and NewDeposit events.
    */
    function deposit(uint256 amount) external {
        // save data in storage
        _deposits[msg.sender].amount += amount;
        // transfer tokens to the DAO
        _voteToken.safeTransferFrom(msg.sender, address(this), amount);
        emit NewDeposit(msg.sender, amount);
    }

    /// @notice Function for voting for (or against) the proposal
    /// @param proposalId Proposal id to vote
    /// @param answer Vote for or against
    /** @dev
    Function does not allow to vote for non-existing proposal.
    Function does not allow to vote after debating period is over.
    Function does not allow to vote twice.
    Function emits Vote event.
    */
    function vote(uint256 proposalId, bool answer) external {
        Proposal storage proposal = _proposals[proposalId];
        // check if proposal with proposalId exists
        // solhint-disable not-rely-on-time
        if(proposal.startTimestamp == 0) revert InvalidProposal(proposalId);
        // check if debating period is over
        if(block.timestamp >= proposal.startTimestamp + _debatingDuration) revert WrongPeriod();
        // check if caller already voted
        // solhint-enable not-rely-on-time
        if(proposal.voted[msg.sender]) revert VotedAlready(msg.sender, proposalId);
        // save data 
        _saveVoteData(proposalId, answer);
        emit Vote(proposalId, msg.sender, _deposits[msg.sender].amount, answer);
    }

    /// @notice Function for finishing the proposal
    /// @param proposalId Proposal id to finish
    /** @dev
    Function does not allow to finish non-existing proposal.
    Function does not allow to finish proposal during debating period.
    Function emits ProposalFinished event.
    */
    function finishProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = _proposals[proposalId];
        // check if proposal with proposalId exists and it wasn't finished yet
        // solhint-disable not-rely-on-time
        if(proposal.startTimestamp == 0 || proposal.finished == true) revert InvalidProposal(proposalId);
        // check if debating period is over
        if(block.timestamp < proposal.startTimestamp + _debatingDuration) revert WrongPeriod();
        // get token's decimals to remove extra zeros used for computation accuracy
        uint256 divider = 10 ** _voteToken.decimals();
        // check if quorum was reached
        // solhint-enable not-rely-on-time
        if(proposal.votedFor + proposal.votedAgainst > (_voteToken.totalSupply() * _minimumQuorum / divider)) {
            // check if majority voted for the proposal
            if(proposal.votedFor > proposal.votedAgainst) {
                // call calldata on recipient
                // solhint-disable-next-line avoid-low-level-calls
                (bool success, ) = proposal.recipient.call{value: 0}(proposal.callData);
                // raise error if call failed
                if(success == false) revert FunctionCallError();
            }
        }
        proposal.finished = true;
        emit ProposalFinished(proposalId);
        
        
    }

    /// @notice Function for withdrawal the deposited vote tokens
    /// @param amount Amount to withdraw
    /** @dev
    Function does not allow to withdraw during last caller's debating period.
    Function does not allow to withdraw more than deposit.
    Function emits Withdrawal event.
    */
    function withdraw(uint256 amount) external nonReentrant {
        Deposit storage callerDeposit =  _deposits[msg.sender];
        // require unlocked deposit
        // solhint-disable-next-line not-rely-on-time
        if(callerDeposit.lockTimestamp > block.timestamp) revert WrongPeriod();
        if(callerDeposit.amount < amount) revert InvalidAmount(amount);
        // save data in storage
        callerDeposit.amount -= amount;
        // call transfer(msg.sender, amount)
        _voteToken.safeTransfer(msg.sender, amount);
        emit Withdrawal(msg.sender, amount);
    }

    function _saveProposalData(
        bytes memory callData,
        address recipient,
        string calldata description
    ) internal {
        Proposal storage proposal = _proposals[_proposalsCounter._value];
        proposal.callData = callData;
        proposal.recipient = recipient;
        proposal.description = description;
        // solhint-disable-next-line not-rely-on-time
        proposal.startTimestamp = block.timestamp;
    }

    function _saveVoteData(uint256 proposalId, bool answer) internal {
        Proposal storage proposal = _proposals[proposalId];
        proposal.voted[msg.sender] = true;
        uint256 votesAmount = _deposits[msg.sender].amount;
        answer == true ? proposal.votedFor += votesAmount : proposal.votedAgainst += votesAmount;
        // solhint-disable-next-line not-rely-on-time
        _deposits[msg.sender].lockTimestamp = proposal.startTimestamp + _debatingDuration;
    }
}