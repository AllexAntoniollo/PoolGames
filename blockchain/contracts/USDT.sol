// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDT is ERC20 {
    constructor() ERC20("USDT", "USDT") {}

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
