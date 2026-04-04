// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";

import "@openzeppelin/contracts/utils/Strings.sol";
import "./IManager.sol";

struct UserStruct {
    uint totalWeight;
    uint valueReceived;
}

contract PoolGamesNft is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;
    using Strings for uint256;

    mapping(address => UserStruct) public users;

    IERC20 private stable;

    mapping(address => bool) isAuthorized;
    uint[] private tokenIdToReceivePayment;
    uint[] private tokenIdToReceivePaymentPendings;

    uint public totalWeightNftToReceivePayment;
    uint public totalWeightNftToReceivePaymentPending;

    bool private isDistributePeriod;
    uint public valueToDistribute;

    uint private indexPaid;
    uint public valuePaidInDistribution;
    bool private alreadyDistributed;
    uint public batchProcessing;
    uint actualTokenId;
    IManager feeManager;
    address newPool;
    address oldPool;
    bool isMint;
    event NFTPurchased(
        address indexed owner,
        uint256 indexed tokenId,
        uint256 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
    function setBatchProcessing(uint newValue) external onlyOwner {
        require(!isDistributePeriod);
        require(newValue > 0);
        batchProcessing = newValue;
    }
    function setValuePaidInDistribution(uint newValue) external onlyOwner {
        valuePaidInDistribution = newValue;
    }

    function initialize(address _stable) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();

        __ERC721_init("PoolGames", "PoolGames");
        __ERC721URIStorage_init();

        batchProcessing = 100;
        isAuthorized[msg.sender] = true;
        stable = IERC20(_stable);
    }
    function setManager(address managerAddress) external onlyOwner {
        // require(address(feeManager) == address(0));
        feeManager = IManager(managerAddress);
    }
    function setOldPool(address _newPool) external onlyOwner {
        oldPool = _newPool;
    }
    function setNewPool(address _newPool) external onlyOwner {
        newPool = _newPool;
    }
    function setIsAuthorized(address _address, bool flag) external onlyOwner {
        isAuthorized[_address] = flag;
    }

    function addValueToDistribute(uint amount) external {
        require(!isDistributePeriod, "distribute period");
        stable.safeTransferFrom(msg.sender, address(this), amount);

        valueToDistribute += amount;
    }

    function getNftMetadata(
        uint256 tokenId
    ) public pure returns (string memory) {
        if (tokenId == 0 || tokenId > 240_000) {
            revert("Invalid tokenId");
        }

        string memory base = "";

        return string(abi.encodePacked(base, tokenId.toString(), ".json"));
    }
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721Upgradeable) returns (address previousOwner) {
        previousOwner = super._update(to, tokenId, auth);

        if (to != address(0)) {
            if (isMint) {
                if (!isDistributePeriod) {
                    tokenIdToReceivePayment.push(tokenId);
                    users[to].totalWeight++;
                    totalWeightNftToReceivePayment++;
                } else {
                    tokenIdToReceivePaymentPendings.push(tokenId);
                    totalWeightNftToReceivePaymentPending++;
                }
            } else {
                users[to].totalWeight++;
                users[previousOwner].totalWeight--;
            }
        }
    }

    function buy(uint256 amount) external nonReentrant {
        isMint = true;
        require(amount > 0, "Invalid amount");

        uint256 totalPrice;

        uint256 startTokenId = actualTokenId + 1;
        uint256 endTokenId = actualTokenId + amount;

        require(endTokenId <= 240_000, "Max supply reached");

        for (uint256 tokenId = startTokenId; tokenId <= endTokenId; tokenId++) {
            totalPrice += getPriceByTokenId(tokenId);
        }

        stable.safeTransferFrom(msg.sender, address(this), totalPrice);

        stable.safeTransfer(oldPool, (totalPrice * 50) / 100);
        stable.safeTransfer(newPool, (totalPrice * 30) / 100);
        stable.approve(address(feeManager), (totalPrice * 20) / 100);
        feeManager.incrementBalance((totalPrice * 20) / 100, address(stable));

        for (uint256 tokenId = startTokenId; tokenId <= endTokenId; tokenId++) {
            actualTokenId++;
            _safeMint(msg.sender, tokenId);
            string memory metadata = getNftMetadata(tokenId);
            _setTokenURI(tokenId, metadata);

            emit NFTPurchased(msg.sender, tokenId, block.timestamp);
        }
        isMint = false;
    }

    function getPriceByTokenId(uint256 tokenId) public pure returns (uint256) {
        require(tokenId > 0 && tokenId <= 240_000, "Invalid tokenId");

        if (tokenId <= 100_000) return 10e6;
        if (tokenId <= 150_000) return 20e6;
        if (tokenId <= 200_000) return 30e6;
        return 40e6;
    }

    function processPayments() external {
        require(isAuthorized[msg.sender], "Invalid sender");
        require(valueToDistribute > 0, "zero amount");
        if (!alreadyDistributed) {
            distributePayment();
        } else {
            processPendingIds();
        }
    }

    function distributePayment() internal {
        isDistributePeriod = true;
        uint currentIndex = indexPaid;
        uint length = tokenIdToReceivePayment.length;
        if (totalWeightNftToReceivePayment == 0) {
            revert("No NFTs to distribute");
        }
        if (currentIndex >= length) {
            alreadyDistributed = true;
            indexPaid = 0;
            return;
        }

        uint processed = 0;
        while (processed < batchProcessing && currentIndex < length) {
            ++indexPaid;
            processed++;
            uint tokenId = tokenIdToReceivePayment[currentIndex];
            uint share = valueToDistribute / totalWeightNftToReceivePayment;
            ++currentIndex;

            bool isLast = (currentIndex == length - 1);

            uint amountToSend = share;

            if (isLast) {
                uint remainder = valueToDistribute %
                    totalWeightNftToReceivePayment;

                amountToSend += remainder;
            }

            valuePaidInDistribution += amountToSend;

            address _user = ownerOf(tokenId);
            if (indexPaid == tokenIdToReceivePayment.length - 1) {
                uint remainder = valueToDistribute %
                    totalWeightNftToReceivePayment;
                share += remainder;
            }

            stable.safeTransfer(_user, share);
            users[_user].valueReceived += share;
        }
    }

    function processPendingIds() internal {
        isDistributePeriod = true;
        uint currentIndex = indexPaid;
        uint length = tokenIdToReceivePaymentPendings.length;
        if (currentIndex >= length) {
            alreadyDistributed = false;
            isDistributePeriod = false;
            if (valuePaidInDistribution < valueToDistribute) {
                revert("Not all value distributed");
            }
            valuePaidInDistribution = 0;
            indexPaid = 0;
            valueToDistribute = 0;
            totalWeightNftToReceivePaymentPending = 0;
            return;
        }
        uint processed = 0;
        while (processed < batchProcessing && currentIndex < length) {
            processed++;
            uint tokenId = tokenIdToReceivePaymentPendings[
                tokenIdToReceivePaymentPendings.length - 1
            ];
            tokenIdToReceivePayment.push(tokenId);
            users[ownerOf(tokenId)].totalWeight++;
            totalWeightNftToReceivePayment++;

            tokenIdToReceivePaymentPendings.pop();

            length--;
        }
    }

    receive() external payable {}
    fallback() external payable {}

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    function getMintedTokenIdsPaginated(
        uint256 start,
        uint256 limit
    ) external view returns (uint256[] memory) {
        require(limit > 0, "limit = 0");

        uint256 max = actualTokenId;

        if (start == 0) {
            start = 1;
        }

        if (start > max) {
            return new uint256[](0);
        }

        uint256 end = start + limit - 1;
        if (end > max) {
            end = max;
        }

        uint256 size = end - start + 1;
        uint256[] memory tokens = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            tokens[i] = start + i;
        }

        return tokens;
    }
    function getPendingTokenIdsPaginated(
        uint256 start,
        uint256 limit
    ) external view returns (uint256[] memory) {
        require(limit > 0, "limit = 0");

        uint256 length = tokenIdToReceivePaymentPendings.length;

        if (length == 0) {
            return new uint256[](0);
        }

        if (start >= length) {
            return new uint256[](0);
        }

        uint256 end = start + limit;
        if (end > length) {
            end = length;
        }

        uint256 size = end - start;
        uint256[] memory tokens = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            tokens[i] = tokenIdToReceivePaymentPendings[start + i];
        }

        return tokens;
    }
}
