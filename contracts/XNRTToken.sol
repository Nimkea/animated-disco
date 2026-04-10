// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title XNRTToken
 * @notice BEP-20 / ERC-20 token for the XNRT platform.
 *         Owner (platform deployer) can mint tokens to any address.
 *         Supply is open-ended: new XNRT is minted when users earn it
 *         (staking, mining, referrals) and withdraw to their real wallet.
 */
contract XNRTToken {
    string  public name     = "XNRT Token";
    string  public symbol   = "XNRT";
    uint8   public decimals = 18;
    uint256 public totalSupply;

    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Minted(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "XNRTToken: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    // ─── Ownership ────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "XNRTToken: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    // ─── Minting (owner only) ─────────────────────────────────────────────────

    /**
     * @notice Mint XNRT tokens to a user's wallet.
     * @dev Only callable by the platform's deployer wallet.
     * @param to     Recipient BSC address.
     * @param amount Amount in token-units (18 decimals). E.g. 1 XNRT = 1e18.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "XNRTToken: zero address");
        totalSupply         += amount;
        balanceOf[to]       += amount;
        emit Transfer(address(0), to, amount);
        emit Minted(to, amount);
    }

    // ─── ERC-20 core ─────────────────────────────────────────────────────────

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "XNRTToken: allowance exceeded");
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "XNRTToken: transfer from zero address");
        require(to   != address(0), "XNRTToken: transfer to zero address");
        require(balanceOf[from] >= amount, "XNRTToken: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
    }
}
