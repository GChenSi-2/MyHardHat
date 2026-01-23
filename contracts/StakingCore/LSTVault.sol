// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* =========================
   LST Vault (route 1 + UniV2)
   - deposit -> mint shares
   - withdraw (protocol redemption) -> buffer only; if buffer low, use exit queue (async)
   - swapExit (primary instant exit) -> user sells shares to UniV2 for ETH (no burn!)
   - fees: mint feeShares to treasury when profit increases
   ========================= */

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../tokens/LSTToken.sol";
import "../interfaces/GPTStakingInterface.sol";

contract LSTVault is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    LSTToken public immutable lst;

    // staking
    IStakingAdapter public adapter;

    // uniswap
    IUniswapV2Router02 public router;
    IPriceOracle public oracle; // sanity oracle (demo spot or TWAP)
    uint16 public maxSlippageBps = 300; // 3% default

    // fees (mint shares on profit)
    address public treasury;
    uint16 public protocolFeeBps = 500; // 5% of profit
    uint256 public lastTotalAssets;      // for profit calc

    // buffer strategy
    uint16 public targetBufferBps = 500; // 5% assets as buffer

    // exit queue (fallback)
    enum ExitStatus { None, Pending, Finalized, Claimed }
    struct ExitRequest {
        address owner;
        uint256 shares;
        uint256 assetsEstimated; // snapshot estimate
        ExitStatus status;
        uint40  timestamp;
    }
    uint256 public nextExitId = 1;
    mapping(uint256 => ExitRequest) public exits;
    uint256 public pendingExitShares; // locked shares total

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);

    event SwapExit(address indexed user, uint256 sharesIn, uint256 ethOut);
    event ExitRequested(uint256 indexed id, address indexed user, uint256 shares, uint256 estAssets);
    event ExitFinalized(uint256 indexed id, uint256 claimableAssets);
    event ExitClaimed(uint256 indexed id, address indexed user, uint256 assets);

    event AdapterSet(address adapter);
    event RouterSet(address router);
    event OracleSet(address oracle);
    event ParamsSet(string indexed key);
    event FeesAccrued(uint256 profit, uint256 feeShares);

    constructor(
        address admin,
        address _treasury
    ) {
        require(admin != address(0) && _treasury != address(0), "ZERO_ADDR");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);

        treasury = _treasury;

        lst = new LSTToken("Mini Liquid Staking Token", "mLST", address(this), 18);
    }

    receive() external payable {}

    /* ---------- admin / governance (timelock recommended) ---------- */

    function setAdapter(address _adapter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        adapter = IStakingAdapter(_adapter);
        emit AdapterSet(_adapter);
    }

    function setRouter(address _router) external onlyRole(DEFAULT_ADMIN_ROLE) {
        router = IUniswapV2Router02(_router);
        emit RouterSet(_router);
    }

    function setOracle(address _oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        oracle = IPriceOracle(_oracle);
        emit OracleSet(_oracle);
    }

    function setMaxSlippageBps(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 2000, "TOO_HIGH"); // <= 20%
        maxSlippageBps = bps;
        emit ParamsSet("maxSlippageBps");
    }

    function setFees(uint16 _protocolFeeBps, address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_protocolFeeBps <= 2000, "FEE_TOO_HIGH"); // <= 20%
        require(_treasury != address(0), "ZERO_ADDR");
        protocolFeeBps = _protocolFeeBps;
        treasury = _treasury;
        emit ParamsSet("fees");
    }

    function setTargetBufferBps(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 3000, "TOO_HIGH"); // <= 30%
        targetBufferBps = bps;
        emit ParamsSet("targetBufferBps");
    }

    /* ---------- pause ---------- */

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /* ---------- accounting ---------- */

    function totalAssets() public view returns (uint256) {
        uint256 buffer = address(this).balance;
        uint256 staked = address(adapter) == address(0) ? 0 : adapter.stakedBalance();
        return buffer + staked;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = lst.totalSupply();
        if (supply == 0) return assets; // init 1:1
        uint256 ta = totalAssets();
        require(ta > 0, "TA_ZERO");
        return assets * supply / ta;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = lst.totalSupply();
        if (supply == 0) return shares;
        return shares * totalAssets() / supply;
    }

    /// @notice accrue fees by minting shares to treasury when profit increases
    function accrueFees() public {
        uint256 ta = totalAssets();
        if (lastTotalAssets == 0) {
            lastTotalAssets = ta;
            return;
        }
        if (ta <= lastTotalAssets) {
            lastTotalAssets = ta;
            return; // no profit or slashed
        }

        uint256 profit = ta - lastTotalAssets;
        uint256 feeAssets = profit * protocolFeeBps / 10_000;
        if (feeAssets == 0) {
            lastTotalAssets = ta;
            return;
        }

        // mint fee shares based on current price
        uint256 feeShares = convertToShares(feeAssets);
        if (feeShares > 0) {
            lst.mint(treasury, feeShares);
            emit FeesAccrued(profit, feeShares);
        }

        lastTotalAssets = ta;
    }

    /* ---------- user: protocol deposit/redeem ---------- */

    function deposit() external payable whenNotPaused nonReentrant returns (uint256 shares) {
        require(msg.value > 0, "ZERO");
        accrueFees();
        shares = convertToShares(msg.value);
        lst.mint(msg.sender, shares);
        emit Deposit(msg.sender, msg.value, shares);
    }

    /// @notice protocol redemption: ONLY uses buffer for instant; otherwise use exit queue
    function withdraw(uint256 shares) external whenNotPaused nonReentrant returns (uint256 assets) {
        require(shares > 0, "ZERO");
        accrueFees();

        assets = convertToAssets(shares);
        // burn first (safe w/ nonReentrant)
        lst.burn(msg.sender, shares);

        require(address(this).balance >= assets, "BUFFER_LOW_USE_EXIT");
        (bool ok, ) = msg.sender.call{value: assets}("");
        require(ok, "SEND_FAIL");

        emit Withdraw(msg.sender, assets, shares);
    }

    /* ---------- user: primary instant exit via Uniswap v2 (secondary market) ---------- */
    /// @dev This is NOT protocol redemption. No burn. User sells LST to market for ETH.
    function swapExit(
        uint256 sharesIn,
        uint256 minEthOut,
        uint256 deadline
    ) external whenNotPaused nonReentrant returns (uint256 ethOut) {
        require(sharesIn > 0, "ZERO");
        require(address(router) != address(0), "NO_ROUTER");
        require(address(oracle) != address(0), "NO_ORACLE");

        // sanity check against oracle quote to prevent user being sandwiched into absurd minOut
        uint256 quote = oracle.quoteEthOut(address(lst), sharesIn);
        uint256 floor = quote * (10_000 - maxSlippageBps) / 10_000;
        require(minEthOut >= floor, "MINOUT_TOO_LOW");

        // pull shares from user
        require(lst.transferFrom(msg.sender, address(this), sharesIn), "TRANSFER_FAIL");

        // approve router
        lst.approve(address(router), 0);
        lst.approve(address(router), sharesIn);

        // declare path
        address[] memory path = new address[](2);
        path[0] = address(lst);
        path[1] = router.WETH();

        uint256[] memory amounts = router.swapExactTokensForETH(
            sharesIn,
            minEthOut,
            path,
            address(this),
            deadline
        );

        ethOut = amounts[amounts.length - 1];
        (bool ok, ) = msg.sender.call{value: ethOut}("");
        require(ok, "SEND_FAIL");

        emit SwapExit(msg.sender, sharesIn, ethOut);
    }

    /* ---------- exit queue (fallback) ---------- */

    /// @notice fallback: lock shares, operator later unstake+finalize; user claims when buffer has funds
    function requestExit(uint256 shares) external whenNotPaused nonReentrant returns (uint256 id) {
        require(shares > 0, "ZERO");
        accrueFees();

        // lock shares inside vault (not burned yet)
        require(lst.transferFrom(msg.sender, address(this), shares), "TRANSFER_FAIL");

        id = nextExitId++;
        exits[id] = ExitRequest({
            owner: msg.sender,
            shares: shares,
            assetsEstimated: convertToAssets(shares),
            status: ExitStatus.Pending,
            timestamp: uint40(block.timestamp)
        });

        pendingExitShares += shares;
        emit ExitRequested(id, msg.sender, shares, exits[id].assetsEstimated);
    }

    /// @notice operator marks a request finalized once enough ETH is available in buffer
    function finalizeExit(uint256 id, uint256 claimableAssets) external onlyRole(OPERATOR_ROLE) {
        ExitRequest storage r = exits[id];
        require(r.status == ExitStatus.Pending, "BAD_STATUS");
        require(claimableAssets > 0, "ZERO");
        // In route-1 design, operator is responsible to ensure funds are/will be available
        r.assetsEstimated = claimableAssets;
        r.status = ExitStatus.Finalized;
        emit ExitFinalized(id, claimableAssets);
    }

    function claimExit(uint256 id) external nonReentrant {
        ExitRequest storage r = exits[id];
        require(r.status == ExitStatus.Finalized, "NOT_FINAL");
        require(r.owner == msg.sender, "NOT_OWNER");

        uint256 assets = r.assetsEstimated;
        require(address(this).balance >= assets, "BUFFER_LOW");

        // burn locked shares now (protocol redemption)
        r.status = ExitStatus.Claimed;
        pendingExitShares -= r.shares;
        lst.burn(address(this), r.shares);

        (bool ok, ) = msg.sender.call{value: assets}("");
        require(ok, "SEND_FAIL");

        emit ExitClaimed(id, msg.sender, assets);
    }

    /* ---------- operator: staking & buffer management ---------- */

    function stakeFromBuffer(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        require(address(adapter) != address(0), "NO_ADAPTER");
        accrueFees();
        require(amount <= address(this).balance, "BUFFER_LOW");
        adapter.stake(amount);
    }

    /// @notice operator can request unstake to refill buffer; async depending on adapter
    function requestUnstake(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        require(address(adapter) != address(0), "NO_ADAPTER");
        adapter.unstake(amount);
    }

    /// @notice optional: pull rewards if adapter needs explicit claim
    function claimRewards() external onlyRole(OPERATOR_ROLE) {
        require(address(adapter) != address(0), "NO_ADAPTER");
        adapter.claimRewards();
    }

    /// @notice simple rebalance: if buffer > target, stake the excess
    function rebalance() external onlyRole(OPERATOR_ROLE) {
        require(address(adapter) != address(0), "NO_ADAPTER");
        accrueFees();

        uint256 ta = totalAssets();
        if (ta == 0) return;

        uint256 desiredBuffer = ta * targetBufferBps / 10_000;
        uint256 buffer = address(this).balance;

        if (buffer > desiredBuffer) {
            uint256 excess = buffer - desiredBuffer;
            adapter.stake(excess);
        }
        // if buffer < desiredBuffer, operator should requestUnstake(amountNeeded)
    }
}