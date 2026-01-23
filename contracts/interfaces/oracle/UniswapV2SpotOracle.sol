// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../GPTStakingInterface.sol";

/* =========================
   Uniswap V2 Spot Oracle (DEMO)
   - reads reserves and gives a spot quote
   - production: use TWAP oracle (cumulative prices) to avoid manipulation
   ========================= */

contract UniswapV2SpotOracle is IPriceOracle {
    address public immutable pair;
    address public immutable weth;

    constructor(address _pair, address _weth) {
        pair = _pair;
        weth = _weth;
    }

    function quoteEthOut(address tokenIn, uint256 amountIn) external view returns (uint256 ethOut) {
        require(amountIn > 0, "ZERO_IN");

        IUniswapV2Pair p = IUniswapV2Pair(pair);
        (uint112 r0, uint112 r1, ) = p.getReserves();

        address t0 = p.token0();
        address t1 = p.token1();

        // spot price quote: amountIn * reserveOut / reserveIn (no fee, no slippage model)
        // This is ONLY a sanity bound; user still supplies minOut.
        if (tokenIn == t0 && t1 == weth) {
            require(r0 > 0 && r1 > 0, "NO_LIQ");
            ethOut = amountIn * uint256(r1) / uint256(r0);
        } else if (tokenIn == t1 && t0 == weth) {
            require(r0 > 0 && r1 > 0, "NO_LIQ");
            ethOut = amountIn * uint256(r0) / uint256(r1);
        } else {
            revert("PAIR_MISMATCH");
        }
    }
}