//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ERC20 contract implemented by EIP-20 Token Standart
/// @author Xenia Shape
/// @notice This contract can be used for only the most basic ERC20 test experiments
contract ERC20 is AccessControl {
    // owner => balance
    mapping(address => uint256) private _balances;
    // owner => spender => amount
    mapping(address => mapping(address => uint256)) private _allowances;

    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 initialSupply,
        address supplyOwner
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
        _mint(supplyOwner, initialSupply);
    }

    /// @notice Function for getting the owner's balance
    /// @param owner Address of the account
    function balanceOf(address owner) public view returns (uint256) {
        return _balances[owner];
    }

    /// @notice Function for sending money to the recipient
    /// @param to Recipient's address
    /// @param value Amount to send
    /// @dev Function emits Transfer event
    function transfer(address to, uint256 value) public returns(bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    /// @notice Function for sending money from sender to the recipient
    /// @param from Sender's address
    /// @param to Recipient's address
    /// @param value Amount to send
    /// @dev Amount to send should be more than allowance
    /// @dev Function emits Transfer and Approval events
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        uint256 currentAllowance = allowance(from, msg.sender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= value, "Insufficient allowance");
            _approve(from, msg.sender, currentAllowance - value);
        }
        
        _transfer(from, to, value);
        return true;
    }

    /// @notice Function for approving tokens to spender
    /// @param spender Spender's address
    /// @param value Amount to approve
    /// @dev Function does not allow to approve from or to the zero address
    /// @dev Function emits Approval event
    function approve(address spender, uint256 value) public returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    /// @notice Function for getting the allowance
    /// @param owner Owner's address
    /// @param spender Spender's address
    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    /// @notice Function for minting tokens to the account
    /// @param owner Address of the account to mint tokens
    /// @param value Amount to mint
    /// @dev Function does not allow to mint to the zero address
    /// @dev Function emits Transfer event
    function mint(address owner, uint256 value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _mint(owner, value);
    }

    /// @notice Function for burning tokens by the account
    /// @param value Amount to burn
    /// @dev Function does not allow to burn from the zero address
    /// @dev Function emits Transfer event
    function burn(uint256 value) public {
        _burn(msg.sender, value);
    }

    /// @notice Function for approving tokens from owner to spender
    /// @param owner Owner's address
    /// @param spender Spender's address
    /// @param value Amount to approve
    /// @dev Function does not allow to approve from or to the zero address
    /// @dev Function emits Approval event
    function _approve(address owner, address spender, uint256 value) internal {
        require(owner != address(0), "Approve from the zero address");
        require(spender != address(0), "Approve to the zero address");
        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    /// @notice Function for sending money from sender to the recipient
    /// @param from Sender's address
    /// @param to Recipient's address
    /// @param value Amount to send
    /// @dev Function does not allow to send amount more than balance
    /// @dev Function emits Transfer event
    function _transfer(address from, address to, uint256 value) internal {
        require(_balances[from] >= value, "Not enough tokens");
        _balances[from] -= value;
        _balances[to] += value;
        emit Transfer(from, to, value);
    }

    /// @notice Function for minting tokens to the account
    /// @param owner Address of the account to mint tokens
    /// @param value Amount to mint
    /// @dev Function does not allow to mint to the zero address
    /// @dev Function emits Transfer event
    function _mint(address owner, uint256 value) internal {
        require(owner != address(0), "Mint to the zero address");
        totalSupply += value;
        _balances[owner] += value;
        emit Transfer(address(0), owner, value);
    }

    /// @notice Function for burning tokens by the account
    /// @param value Amount to burn
    /// @dev Function does not allow to burn from the zero address
    /// @dev Function does not allow to burn tokens more than balance
    /// @dev Function emits Transfer event
    function _burn(address owner, uint256 value) internal {
        require(owner != address(0), "Burn from the zero address");
        uint256 ownerBalance = _balances[owner];
        require(ownerBalance >= value, "Burn amount exceeds balance");
        _balances[owner] = ownerBalance - value;
        totalSupply -= value;
        emit Transfer(owner, address(0), value);
    }
}