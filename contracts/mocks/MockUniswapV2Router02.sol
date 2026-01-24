// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapV2Router02 {
    address public immutable WETH;
    
    // 用于测试：设置固定的汇率 (inputToken per ETH)
    mapping(address => uint256) public exchangeRates;

    event SwapExecuted(
        address indexed tokenIn,
        uint256 amountIn,
        uint256 ethOut,
        address indexed to
    );

    constructor(address _weth) {
        WETH = _weth;
    }

    /// @notice 设置代币的汇率（测试用）
    /// @param token 代币地址
    /// @param rate 汇率，例如 1000 表示 1000 token = 1 ETH
    function setExchangeRate(address token, uint256 rate) external {
        exchangeRates[token] = rate;
    }

    /// @notice 模拟 Uniswap V2 的 swapExactTokensForETH
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "INVALID_PATH");
        require(path[path.length - 1] == WETH, "INVALID_PATH_END");
        require(block.timestamp <= deadline, "EXPIRED");

        address tokenIn = path[0];
        
        // 从调用者转入代币
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "TRANSFER_FROM_FAILED"
        );

        // 计算输出的 ETH 数量
        uint256 ethOut = _calculateEthOut(tokenIn, amountIn);
        require(ethOut >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
        require(address(this).balance >= ethOut, "INSUFFICIENT_ETH_BALANCE");

        // 转 ETH 给接收者
        (bool success, ) = to.call{value: ethOut}("");
        require(success, "ETH_TRANSFER_FAILED");

        // 返回金额数组
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = ethOut;

        emit SwapExecuted(tokenIn, amountIn, ethOut, to);
    }

    /// @dev 根据汇率计算 ETH 输出
    function _calculateEthOut(address tokenIn, uint256 amountIn) 
        internal 
        view 
        returns (uint256) 
    {
        uint256 rate = exchangeRates[tokenIn];
        require(rate > 0, "EXCHANGE_RATE_NOT_SET");
        
        // ethOut = amountIn / rate
        // 例如: 100 token, rate = 1000 => 100 / 1000 = 0.1 ETH
        return (amountIn * 1e18) / rate;
    }

    /// @notice 给合约充值 ETH（测试用）
    receive() external payable {}

    /// @notice 提取合约中的 ETH（测试用）
    function withdrawETH(address to, uint256 amount) external {
        (bool success, ) = to.call{value: amount}("");
        require(success, "WITHDRAW_FAILED");
    }

    /// @notice 提取合约中的代币（测试用）
    function withdrawToken(address token, address to, uint256 amount) external {
        require(IERC20(token).transfer(to, amount), "TRANSFER_FAILED");
    }

    /// @notice 获取合约 ETH 余额
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
