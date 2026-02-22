// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ITreasuryPool {
    function valueInPool(address user) external view returns (uint totalValue);
}
