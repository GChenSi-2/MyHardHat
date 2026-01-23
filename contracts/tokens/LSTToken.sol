// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* =========================
   LST Token (shares)
   ========================= */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract LSTToken is ERC20, AccessControl {
    uint8 private _decimals;   
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");


    constructor(string memory name_, string memory symbol_, address vault, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
        _grantRole(DEFAULT_ADMIN_ROLE, vault);
        _grantRole(MINTER_ROLE, vault);
        _mint(msg.sender, 1000000 * 10 ** decimals_);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }
}
