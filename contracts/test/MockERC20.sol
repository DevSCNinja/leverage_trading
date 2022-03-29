//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable  {
    uint256 private constant SUPPLY = 100_000_000e18;
    constructor(string memory name, string memory symbol) ERC20(name, symbol)  {        
        _mint(msg.sender, SUPPLY); // 100M
    }
}