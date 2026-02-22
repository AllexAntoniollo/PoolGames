// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./PaymentPool.sol";

contract FeeManager is PaymentPool {
    constructor() Ownable(msg.sender) {}
}
