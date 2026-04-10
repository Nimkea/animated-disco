// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title XNRTToken
 * @notice BEP-20 / ERC-20 token for the XNRT crypto-earning platform.
 *         Tokens are minted on demand by the platform owner (deployer wallet)
 *         when a user's withdrawal is approved. There is no fixed supply cap.
 * @dev Inherits OpenZeppelin ERC20 and Ownable. Only the owner may call mint().
 */
contract XNRTToken is ERC20, Ownable {
    event Minted(address indexed to, uint256 amount);

    /**
     * @param initialOwner Address that will own the contract (deployer wallet).
     */
    constructor(address initialOwner)
        ERC20("XNRT Token", "XNRT")
        Ownable(initialOwner)
    {}

    /**
     * @notice Mint `amount` (in wei, 18 decimals) XNRT to `to`.
     * @dev Only callable by the contract owner (platform wallet).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Minted(to, amount);
    }
}
