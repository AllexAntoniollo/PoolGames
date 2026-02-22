// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "hardhat/console.sol";
import "./IUserPoolGames.sol";
struct UserDonation {
    uint id;
    uint deposit;
    uint balance;
    uint startedTimestamp;
    uint lastClaimTimestamp;
    uint daysPaid;
    uint valueClaimed;
    uint claimPeriod;
    uint maxPeriod;
}
enum DonatePlan {
    ONE_DAY,
    FIVE_DAYS,
    TEN_DAYS,
    TWENTY_DAYS,
    NINETY_DAYS,
    THREE_SIXTY_DAYS
}

struct PlanConfig {
    uint maxPeriod;
    uint profitPercent;
}

contract TreasuryPool is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    event UserContributed(address indexed user, uint amount);
    event UserClaimed(address indexed user, uint amount);

    uint64 private constant MAX_ROOF = 10000e6;
    uint64 private constant MIN_ROOF = 10e6;

    IERC20 private immutable usdc;
    IUserPoolGames private userContract;

    mapping(address => UserDonation[]) private users;
    mapping(address => uint) public valueInPool;

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }
    function setUser(address userAddress) external onlyOwner {
        require(address(userAddress) == address(0));
        userContract = IUserPoolGames(userAddress);
    }

    function timeUntilNextWithdrawal(
        address user,
        uint index
    ) public view returns (uint256) {
        require(index < users[user].length, "Invalid Index");

        UserDonation memory userDonation = users[user][index];

        if (userDonation.daysPaid >= userDonation.maxPeriod) {
            return 0;
        }

        uint256 timeSinceLastClaim = block.timestamp -
            userDonation.lastClaimTimestamp;

        uint256 claimInterval = 30 days;

        if (timeSinceLastClaim >= claimInterval) {
            return 0;
        }

        uint256 remainingDays = userDonation.maxPeriod - userDonation.daysPaid;

        uint256 maxAllowedInterval = remainingDays * 1 days;

        uint256 effectiveInterval = claimInterval < maxAllowedInterval
            ? claimInterval
            : maxAllowedInterval;

        return effectiveInterval - timeSinceLastClaim;
    }
    function getPlanConfig(
        DonatePlan plan
    ) public pure returns (PlanConfig memory) {
        if (plan == DonatePlan.ONE_DAY) {
            return PlanConfig(1, 1);
        }

        if (plan == DonatePlan.FIVE_DAYS) {
            return PlanConfig(5, 7); // 0.7%
        }

        if (plan == DonatePlan.TEN_DAYS) {
            return PlanConfig(10, 30); // 3%
        }

        if (plan == DonatePlan.TWENTY_DAYS) {
            return PlanConfig(20, 80); // 8%
        }

        if (plan == DonatePlan.NINETY_DAYS) {
            return PlanConfig(90, 450); // 45%
        }

        return PlanConfig(360, 2400); // 240%
    }
    function _createDonation(
        address user,
        uint amount,
        DonatePlan plan
    ) internal {
        PlanConfig memory config = getPlanConfig(plan);

        uint id = users[msg.sender].length;

        uint profit = (amount * config.profitPercent) / 1000;
        uint totalReturn = amount + profit;

        users[user].push(
            UserDonation({
                id: id,
                deposit: amount,
                balance: totalReturn,
                startedTimestamp: block.timestamp,
                lastClaimTimestamp: block.timestamp,
                daysPaid: 0,
                valueClaimed: 0,
                claimPeriod: config.maxPeriod * 1 days,
                maxPeriod: config.maxPeriod
            })
        );
    }

    function contribute(uint amount, DonatePlan plan) external nonReentrant {
        require(
            amount >= MIN_ROOF && amount <= MAX_ROOF,
            "Min 10 USDC / Max 10.000 USDC"
        );
        valueInPool[msg.sender] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        _createDonation(msg.sender, amount, plan);

        emit UserContributed(msg.sender, amount);
        UserStruct memory aux = userContract.getUser(msg.sender);
        if (valueInPool[msg.sender] >= 100e6 && !aux.valid) {
            userContract.increaseDirectMember(aux.levels[0]);
            userContract.setValid(msg.sender);
        }
    }

    function getActiveContributions(
        address user,
        uint startIndex
    ) external view returns (UserDonation[] memory) {
        if (users[user].length == 0) {
            UserDonation[] memory arr;
            return arr;
        }
        require(startIndex > 0, "Start index > 0");
        require(
            startIndex <= users[user].length,
            "Start index is out of bounds"
        );

        uint totalContributions = users[user].length;
        uint maxActiveContributions = 50;
        UserDonation[] memory tempContributions = new UserDonation[](
            maxActiveContributions
        );

        uint count = 0;
        for (
            uint i = startIndex;
            i <= totalContributions && count < maxActiveContributions;
            i++
        ) {
            if (users[user][i].daysPaid < users[user][i].maxPeriod) {
                tempContributions[count] = users[user][i];
                count++;
            }
        }

        UserDonation[] memory activeContributions = new UserDonation[](count);
        for (uint j = 0; j < count; j++) {
            activeContributions[j] = tempContributions[j];
        }

        return activeContributions;
    }
    function getInactiveContributions(
        address user,
        uint startIndex
    ) external view returns (UserDonation[] memory) {
        if (users[user].length == 0) {
            UserDonation[] memory arr;
            return arr;
        }
        require(startIndex > 0, "Start index > 0");
        require(
            startIndex <= users[user].length,
            "Start index is out of bounds"
        );

        uint totalContributions = users[user].length;
        uint maxInactiveContributions = 50;
        UserDonation[] memory tempContributions = new UserDonation[](
            maxInactiveContributions
        );

        uint count = 0;
        for (
            uint i = startIndex;
            i <= totalContributions && count < maxInactiveContributions;
            i++
        ) {
            if (users[user][i].daysPaid == users[user][i].maxPeriod) {
                tempContributions[count] = users[user][i];
                count++;
            }
        }

        UserDonation[] memory inactiveContributions = new UserDonation[](count);
        for (uint j = 0; j < count; j++) {
            inactiveContributions[j] = tempContributions[j];
        }

        return inactiveContributions;
    }

    function calculateDaysElapsedToClaim(
        address user,
        uint index
    ) public view returns (uint) {
        require(index < users[user].length, "Invalid Index");

        uint daysElapsed = (block.timestamp -
            users[user][index].lastClaimTimestamp) / 1 days;
        if (
            daysElapsed + users[user][index].daysPaid >
            users[user][index].maxPeriod
        ) {
            return users[user][index].maxPeriod - users[user][index].daysPaid;
        } else {
            return daysElapsed;
        }
    }

    function calculateValue(
        address user,
        uint index,
        uint daysElapsed
    ) internal view returns (uint) {
        require(index < users[user].length, "Invalid Index");
        return
            ((users[user][index].balance - users[user][index].deposit) *
                daysElapsed) / users[user][index].maxPeriod;
    }

    function claimContribution(uint index) external nonReentrant {
        require(index < users[msg.sender].length, "Invalid index");

        UserDonation memory userDonation = users[msg.sender][index];
        require(
            userDonation.daysPaid < userDonation.maxPeriod,
            "Already claimed"
        );

        uint daysSinceLastClaim = (block.timestamp -
            userDonation.lastClaimTimestamp) / 1 days;

        require(
            daysSinceLastClaim >= 30 ||
                userDonation.daysPaid + daysSinceLastClaim >=
                userDonation.maxPeriod,
            "Claim allowed only after 30 days or at plan end"
        );

        uint periodElapsed = calculateDaysElapsedToClaim(msg.sender, index);
        if (periodElapsed > 30) {
            periodElapsed = 30;
        }
        users[msg.sender][index].daysPaid += periodElapsed;
        users[msg.sender][index].lastClaimTimestamp =
            users[msg.sender][index].startedTimestamp +
            (users[msg.sender][index].daysPaid * 1 days);
        uint totalValueInUSD = calculateValue(msg.sender, index, periodElapsed);

        uint fee = totalValueInUSD / 10;
        if (
            users[msg.sender][index].daysPaid ==
            users[msg.sender][index].maxPeriod
        ) {
            totalValueInUSD += userDonation.deposit;
            valueInPool[msg.sender] -= userDonation.deposit;
        }
        users[msg.sender][index].valueClaimed += totalValueInUSD;

        usdc.safeTransfer(msg.sender, (totalValueInUSD - fee));

        emit UserClaimed(msg.sender, totalValueInUSD);
    }

    function getDonation(
        address _user,
        uint index
    ) public view returns (UserDonation memory) {
        require(index < users[_user].length, "Invalid Index");
        UserDonation memory userDonation = users[_user][index];
        return userDonation;
    }
}
