// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IManager.sol";
import "./ITreasuryPool.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

struct UserStruct {
    bool registered;
    bool valid;
    uint8 totalLevels;
    address[20] levels;
    address[] referrals;
    uint directs;
}

contract UserPoolGames is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IManager feeManager;

    event UserAdded(address indexed user, address indexed sponsor);

    mapping(address => UserStruct) private users;
    mapping(address => uint) public userTotalEarned;

    IERC20 private usdc;
    address private treasuryPool;

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Cannot be zero");

        address[] memory referrals;
        address[20] memory levels20;
        users[msg.sender] = UserStruct({
            registered: true,
            totalLevels: 0,
            levels: levels20,
            referrals: referrals,
            directs: 0,
            valid: true
        });

        usdc = IERC20(_usdc);
    }
    function setManager(address managerAddress) external onlyOwner {
        require(address(feeManager) == address(0));
        feeManager = IManager(managerAddress);
    }

    function createUser(address _sponsor) public {
        require(_sponsor != address(0), "Zero address");

        require(!users[msg.sender].registered, "Already Registered");
        require(users[_sponsor].registered, "Invalid Sponsor");

        UserStruct storage newUser = users[msg.sender];
        address[20] memory levels;
        newUser.registered = true;
        newUser.levels = levels;
        newUser.levels[0] = _sponsor;
        users[_sponsor].referrals.push(msg.sender);
        UserStruct storage sponsor = users[_sponsor];
        for (uint8 i = 1; i <= sponsor.totalLevels && i < 20; i++) {
            newUser.levels[i] = sponsor.levels[i - 1];
        }
        newUser.totalLevels = uint8(
            sponsor.totalLevels + 1 <= 20 ? sponsor.totalLevels + 1 : 20
        );
        emit UserAdded(msg.sender, _sponsor);
    }

    function getUser(
        address _address
    ) external view returns (UserStruct memory) {
        return users[_address];
    }
    function setTreasuryPool(address newPool) external onlyOwner {
        treasuryPool = newPool;
    }

    function increaseDirectMember(address user) external {
        require(msg.sender == address(treasuryPool));
        users[user].directs++;
    }
    function setValid(address user) external {
        require(msg.sender == address(treasuryPool));
        users[user].valid = true;
    }
    function distributeUnilevel(address user, uint amount) public nonReentrant {
        usdc.safeTransferFrom(msg.sender, address(this), (amount * 75) / 100);

        address[20] memory levels = (users[user].levels);

        uint excess;
        for (uint8 i = 1; i <= 20; i++) {
            uint share = (amount * getPercentageByLevel(i)) / 100;
            address _user = levels[i - 1];
            if (
                users[_user].directs >= getDirectsRequiredByLevel(i) &&
                ITreasuryPool(_user).valueInPool(_user) >=
                getPoolValueRequiredByLevel(i)
            ) {
                usdc.safeTransfer(_user, share);
                userTotalEarned[_user] += share;
            } else {
                excess += share;
            }
        }

        if (excess > 0) {
            usdc.approve(address(feeManager), excess);
            feeManager.incrementBalance(excess, address(usdc));
        }
    }
    function getPercentageByLevel(uint8 level) public pure returns (uint8) {
        require(level > 0 && level <= 20, "Invalid level");

        uint8[20] memory levelPercent = [
            20,
            8,
            3,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            3,
            5,
            8
        ];
        return levelPercent[level - 1];
    }
    function getDirectsRequiredByLevel(uint8 level) public pure returns (uint) {
        require(level > 0 && level <= 20, "Invalid level");

        uint8[20] memory levelDirect = [
            1,
            2,
            3,
            3,
            3,
            5,
            5,
            5,
            5,
            5,
            7,
            7,
            7,
            7,
            7,
            10,
            10,
            10,
            10,
            10
        ];
        return levelDirect[level - 1];
    }
    function getPoolValueRequiredByLevel(
        uint8 level
    ) public pure returns (uint) {
        require(level > 0 && level <= 20, "Invalid level");

        return level * 100e6;
    }
}
