//contracts/ICO.sol
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

using SafeERC20 for IERC20;

contract ICO is Pausable, Ownable {
    IERC20 public token;
    uint public price = 1 ether;
    uint public totalTokensSold;

    constructor(address _tokenAddress) Ownable(msg.sender) {
        token = IERC20(_tokenAddress);
    }

    function buyToken() external payable whenNotPaused {
        uint256 weiAmount = msg.value;
        uint256 numberOfToken = weiAmount / price * 10 ** 18;

        token.safeTransferFrom(owner(), msg.sender, numberOfToken);
        totalTokensSold += numberOfToken;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdrawal() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}