// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockStakingAdapter {
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;
    
    // 自定义错误
    error ZeroAmount();
    error InsufficientAllowance(uint256 required, uint256 available);
    error TransferFailed();
    error InsufficientBalance();
    error NoRewards();
    error RewardTransferFailed();
    
    // 全局状态
    uint256 public rewardRate;              // 每秒发放的奖励数量
    uint256 public lastUpdateTime;          // 上次更新奖励的时间
    uint256 public rewardPerTokenStored;    // 每个质押 token 累积的奖励
    uint256 public totalStaked;             // 总质押量
    
    // 用户状态
    mapping(address => uint256) private _stakedBalances;
    mapping(address => uint256) private _userRewardPerTokenPaid;  // 用户上次结算时的 rewardPerToken
    mapping(address => uint256) private _rewards;                 // 用户已累积但未领取的奖励

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);

    constructor(address _stakingToken, address _rewardToken) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        lastUpdateTime = block.timestamp;
    }

    /// @notice 设置奖励率（测试用）
    /// @param _rate 每秒发放的奖励数量（例如 1e18 表示每秒 1 token）
    function setRewardRate(uint256 _rate) external {
        _updateReward(address(0)); // 更新全局奖励状态
        rewardRate = _rate;
        emit RewardRateUpdated(_rate);
    }

    /* ========================
       核心奖励计算逻辑
       ======================== */

    /// @dev 计算每个质押 token 当前累积的奖励
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        
        // rewardPerToken = rewardPerTokenStored + (时间差 * rewardRate * 1e18 / totalStaked)
        uint256 timeDelta = block.timestamp - lastUpdateTime;
        return rewardPerTokenStored + (timeDelta * rewardRate * 1e18) / totalStaked;
    }

    /// @dev 计算用户当前已赚取的奖励
    function earned(address account) public view returns (uint256) {
        // earned = 质押量 * (当前 rewardPerToken - 用户上次结算的 rewardPerToken) / 1e18 + 已累积奖励
        return (_stakedBalances[account] * (rewardPerToken() - _userRewardPerTokenPaid[account])) / 1e18 + _rewards[account];
    }

    /// @dev 更新奖励状态（在任何质押量变化前调用）
    modifier updateReward(address account) {
        _updateReward(account);
        _;
    }

    function _updateReward(address account) internal {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        
        if (account != address(0)) {
            _rewards[account] = earned(account);
            _userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
    }

    /* ========================
       质押操作
       ======================== */

    /// @notice 质押代币
    function stake(uint256 amount) external updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        
        // 检查 allowance
        uint256 allowance = stakingToken.allowance(msg.sender, address(this));
        if (allowance < amount) {
            revert InsufficientAllowance(amount, allowance);
        }
        
        // 转入质押代币
        if (!stakingToken.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        
        _stakedBalances[msg.sender] += amount;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }

    /// @notice 取消质押
    function unstake(uint256 amount) external updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        if (_stakedBalances[msg.sender] < amount) revert InsufficientBalance();
        
        _stakedBalances[msg.sender] -= amount;
        totalStaked -= amount;
        
        // 返还质押代币
        if (!stakingToken.transfer(msg.sender, amount)) revert TransferFailed();
        
        emit Unstaked(msg.sender, amount);
    }

    /// @notice 查询质押余额
    function stakedBalance() external view returns (uint256) {
        return _stakedBalances[msg.sender];
    }

    /// @notice 查询指定地址的质押余额（辅助函数）
    function stakedBalanceOf(address user) external view returns (uint256) {
        return _stakedBalances[user];
    }

    /// @notice 领取奖励
    function claimRewards() external updateReward(msg.sender) returns (uint256 gained) {
        gained = _rewards[msg.sender];
        if (gained == 0) revert NoRewards();
        
        _rewards[msg.sender] = 0;
        
        // 转出奖励代币
        if (!rewardToken.transfer(msg.sender, gained)) revert RewardTransferFailed();
        
        emit RewardsClaimed(msg.sender, gained);
    }

    /* ========================
       查询函数
       ======================== */

    /// @notice 查看待领取的奖励
    function pendingRewards(address user) external view returns (uint256) {
        return earned(user);
    }

    /// @notice 给合约充值奖励代币（测试用）
    function fundRewards(uint256 amount) external {
        if (!rewardToken.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
    }

    /// @notice 查询合约中的奖励代币余额
    function rewardBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    /// @notice 查询合约中的质押代币余额
    function stakingBalance() external view returns (uint256) {
        return stakingToken.balanceOf(address(this));
    }
}
