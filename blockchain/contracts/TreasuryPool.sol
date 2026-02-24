// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "hardhat/console.sol";
import "./IUserPoolGames.sol";
import "./IManager.sol";
struct UserDonation {
    uint id;
    uint deposit;
    uint balance;
    uint startedTimestamp;
    uint lastClaimTimestamp;
    uint daysPaid;
    uint valueClaimed;
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
    event UserCanceled(address indexed user, uint amount);

    uint64 private constant MAX_ROOF = 10000e6;
    uint64 private constant MIN_ROOF = 10e6;

    IERC20 private immutable usdc;
    IUserPoolGames private userContract;
    address private botWallet;

    mapping(address => UserDonation[]) private users;
    mapping(address => uint) public valueInPool;
    mapping(address => uint) public totalProfitToClaim;
    mapping(address => uint) public totalUnilevelProfit;
    IManager feeManager;

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        botWallet = msg.sender;
    }
    function setUser(address userAddress) external onlyOwner {
        // require(address(userContract) == address(0));
        userContract = IUserPoolGames(userAddress);
    }
    function setBowWallet(address newAddress) external onlyOwner {
        botWallet = (newAddress);
    }
    function setManager(address managerAddress) external onlyOwner {
        // require(address(feeManager) == address(0));
        feeManager = IManager(managerAddress);
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
    function increaseProfitUnilevel(address user, uint amount) external {
        require(msg.sender == address(userContract));

        totalUnilevelProfit[user] += amount;
        if (totalUnilevelProfit[user] > totalProfitToClaim[user]) {
            totalUnilevelProfit[user] = totalProfitToClaim[user];
        }
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
    ) internal returns (uint profit) {
        PlanConfig memory config = getPlanConfig(plan);

        uint id = users[user].length;

        profit = (amount * config.profitPercent) / 1000;
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
                maxPeriod: config.maxPeriod
            })
        );
    }

    function contribute(uint amount, DonatePlan plan) external nonReentrant {
        UserStruct memory aux = userContract.getUser(msg.sender);

        require(aux.registered, "Not registered");
        require(
            amount >= MIN_ROOF && valueInPool[msg.sender] + amount <= MAX_ROOF,
            "Min 10 USDC / Max 10.000 USDC"
        );
        valueInPool[msg.sender] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        uint profit = _createDonation(msg.sender, amount, plan);
        totalProfitToClaim[msg.sender] += profit;
        emit UserContributed(msg.sender, amount);
        if (valueInPool[msg.sender] >= 100e6 && !aux.valid) {
            userContract.increaseDirectMember(aux.levels[0]);
            userContract.setValid(msg.sender);
        }

        usdc.approve(address(userContract), (profit * 75) / 100);
        userContract.distributeUnilevel(msg.sender, profit);
    }

    function getActiveContributions(
        address user,
        uint startIndex
    ) external view returns (UserDonation[] memory) {
        uint totalContributions = users[user].length;

        if (totalContributions == 0 || startIndex >= totalContributions) {
            UserDonation[] memory arr;
            return arr;
        }

        uint maxActiveContributions = 50;
        UserDonation[] memory tempContributions = new UserDonation[](
            maxActiveContributions
        );

        uint count = 0;

        for (
            uint i = startIndex;
            i < totalContributions && count < maxActiveContributions;
            i++
        ) {
            UserDonation memory donation = users[user][i];

            if (donation.daysPaid < donation.maxPeriod) {
                tempContributions[count] = donation;
                count++;
            }
        }

        UserDonation[] memory activeContributions = new UserDonation[](count);
        for (uint j = 0; j < count; j++) {
            activeContributions[j] = tempContributions[j];
        }

        return activeContributions;
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
    function cancelContribution(uint index) external nonReentrant {
        require(index < users[msg.sender].length, "Invalid index");

        UserDonation memory donation = users[msg.sender][index];

        require(
            donation.daysPaid < donation.maxPeriod,
            "Contribution already finished"
        );
        uint half = donation.deposit / 2;
        uint fee = ((half + donation.valueClaimed) * 20) / 100;

        uint refundAmount = donation.valueClaimed >= half
            ? 0
            : half - donation.valueClaimed;
        valueInPool[msg.sender] -= donation.deposit;

        uint profit = donation.balance - donation.deposit;

        if (totalProfitToClaim[msg.sender] >= profit) {
            totalProfitToClaim[msg.sender] -= profit;
        } else {
            totalProfitToClaim[msg.sender] = 0;
        }

        users[msg.sender][index].daysPaid = donation.maxPeriod;

        usdc.safeTransfer(msg.sender, refundAmount);
        usdc.approve(address(feeManager), fee);
        feeManager.incrementBalance(fee, address(usdc));
        emit UserCanceled(msg.sender, refundAmount);
    }
    function claimContribution(address user, uint index) external nonReentrant {
        require(msg.sender == user || botWallet == msg.sender);

        require(index < users[user].length, "Invalid index");

        UserDonation memory userDonation = users[user][index];
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

        uint periodElapsed = calculateDaysElapsedToClaim(user, index);
        if (periodElapsed > 30) {
            periodElapsed = 30;
        }
        users[user][index].daysPaid += periodElapsed;
        users[user][index].lastClaimTimestamp =
            users[user][index].startedTimestamp +
            (users[user][index].daysPaid * 1 days);
        uint totalValueInUSD = calculateValue(user, index, periodElapsed);
        users[user][index].valueClaimed += totalValueInUSD;

        if (totalUnilevelProfit[user] >= totalValueInUSD) {
            totalUnilevelProfit[user] -= totalValueInUSD;
            totalProfitToClaim[user] -= totalValueInUSD;
            totalValueInUSD = 0;
        } else {
            totalProfitToClaim[user] -= totalValueInUSD;
            totalValueInUSD -= totalUnilevelProfit[user];
            totalUnilevelProfit[user] = 0;
        }
        if (users[user][index].daysPaid == users[user][index].maxPeriod) {
            totalValueInUSD += userDonation.deposit;
            users[user][index].valueClaimed += userDonation.deposit;

            valueInPool[user] -= userDonation.deposit;
        }
        usdc.safeTransfer(user, totalValueInUSD);
        emit UserClaimed(user, totalValueInUSD);
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
