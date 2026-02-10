// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice 简单的测试用 ERC20 代币
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        // 铸造初始供应量给部署者
        _mint(msg.sender, 10000000 * 10 ** decimals_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice 铸造代币（测试用）
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice 销毁代币（测试用）
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    /// @notice WETH-like deposit
    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Transfer(address(0), msg.sender, msg.value);
    }

    /// @notice WETH-like withdraw
    function withdraw(uint256 amount) public {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
        emit Transfer(msg.sender, address(0), amount);
    }

    receive() external payable {
        deposit();
    }
}
