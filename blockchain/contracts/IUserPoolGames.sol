// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
struct UserStruct {
    bool registered;
    bool valid;
    uint8 totalLevels;
    address[20] levels;
    address[] referrals;
    uint directs;
}

interface IUserPoolGames {
    function getUser(
        address _address
    ) external view returns (UserStruct memory);
    function increaseDirectMember(address user) external;
    function setValid(address user) external;
}
