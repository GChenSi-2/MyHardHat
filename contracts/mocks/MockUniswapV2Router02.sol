// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/GPTStakingInterface.sol";

contract MockUniswapV2Router02 {
    address public immutable WETH;
    
    // 用于测试：设置固定的汇率 (inputToken per ETH)
    mapping(address => uint256) public exchangeRates;
    
    // Pair 合约地址映射 (token -> pair address)
    mapping(address => address) public pairs;

    event SwapExecuted(
        address indexed tokenIn,
        uint256 amountIn,
        uint256 ethOut,
        address indexed to
    );

    constructor(address _weth) {
        WETH = _weth;
    }

    /// @notice 设置代币的汇率（测试用，向后兼容）
    /// @param token 代币地址
    /// @param rate 汇率，例如 1000 表示 1000 token = 1 ETH
    function setExchangeRate(address token, uint256 rate) external {
        exchangeRates[token] = rate;
    }

    /// @notice 设置代币的 Pair 合约地址
    /// @param token 代币地址
    /// @param pair Pair 合约地址
    function setPair(address token, address pair) external {
        pairs[token] = pair;
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
        
        // 计算输出的 ETH 数量
        uint256 ethOut = _calculateEthOut(tokenIn, amountIn);
        require(ethOut >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");

        // 简化实现：直接从调用者接收代币，Router 用自己的 ETH 支付
        // 真实 Uniswap 会通过 Pair 合约进行 swap
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "TRANSFER_FROM_FAILED"
        );
        
        require(address(this).balance >= ethOut, "INSUFFICIENT_ETH_BALANCE");
        (bool success, ) = to.call{value: ethOut}("");
        require(success, "ETH_TRANSFER_FAILED");

        // 返回金额数组
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = ethOut;

        emit SwapExecuted(tokenIn, amountIn, ethOut, to);
    }

    /// @dev 根据 Pair 储备量或汇率计算 ETH 输出
    function _calculateEthOut(address tokenIn, uint256 amountIn) 
        internal 
        view 
        returns (uint256) 
    {
        address pair = pairs[tokenIn];
        
        // 优先使用 Pair 合约（如果设置了）
        if (pair != address(0)) {
            return _calculateEthOutFromPair(pair, tokenIn, amountIn);
        }
        
        // 否则使用简单汇率（向后兼容）
        uint256 rate = exchangeRates[tokenIn];
        require(rate > 0, "EXCHANGE_RATE_NOT_SET");
        
        // ethOut = amountIn / rate
        // 例如: 100 token, rate = 1000 => 100 / 1000 = 0.1 ETH
        return (amountIn * 1e18) / rate;
    }

    /// @dev 从 Pair 合约计算输出（使用恒定乘积公式 x * y = k）
    function _calculateEthOutFromPair(address pair, address tokenIn, uint256 amountIn)
        internal
        view
        returns (uint256)
    {
        IUniswapV2Pair pairContract = IUniswapV2Pair(pair);
        (uint112 reserve0, uint112 reserve1, ) = pairContract.getReserves();
        
        address token0 = pairContract.token0();
        address token1 = pairContract.token1();
        
        uint256 reserveIn;
        uint256 reserveOut;
        
        // 确定哪个是输入代币，哪个是 WETH
        if (tokenIn == token0 && token1 == WETH) {
            reserveIn = uint256(reserve0);
            reserveOut = uint256(reserve1);
        } else if (tokenIn == token1 && token0 == WETH) {
            reserveIn = uint256(reserve1);
            reserveOut = uint256(reserve0);
        } else {
            revert("INVALID_PAIR");
        }
        
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        
        // Uniswap V2 恒定乘积公式（简化版，不考虑手续费）
        // amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
        return (amountIn * reserveOut) / (reserveIn + amountIn);
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
