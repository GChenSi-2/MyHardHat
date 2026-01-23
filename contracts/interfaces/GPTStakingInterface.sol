// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* =========================
   Interfaces
   ========================= */

interface IStakingAdapter {
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external; // may be async
    function stakedBalance() external view returns (uint256);
    function claimRewards() external returns (uint256 gained);
}

interface IPriceOracle {
    /// @notice Quote ETH out for tokenIn amount (used as sanity check)
    function quoteEthOut(address tokenIn, uint256 amountIn) external view returns (uint256 ethOut);
}

interface IUniswapV2Router02 {
    function WETH() external pure returns (address);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path, // [tokenIn, WETH]
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);

    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}
