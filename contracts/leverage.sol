//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import './interfaces/IERC20.sol';

interface IPair {
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external view returns (uint amountOut);
    function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast);
    function swapToken(uint amountIn, address tokenIn, address tokenOut, address to) external;
}

contract Leverage {
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    struct PositionInfo {
        address _token;
        uint _leverage;
        uint _amount;
    }

    // token0 is the base token to estimate the value
    address token0;
    address token1;
    address pair;
    uint maxLeverage;

    mapping(address=>mapping(address=>uint)) public userDepositeInfo;
    mapping(address=>uint) public userDepositeValue;
    mapping(address=>PositionInfo[]) public userPositionInfo;
    mapping(address=>uint) public userPositionValue;

    constructor(address _token0, address _token1, address _pair, uint _maxLeverage) {
        token0 = _token0;
        token1 = _token1;
        pair = _pair;
        maxLeverage = _maxLeverage;
    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'UniswapV2: TRANSFER_FAILED');
    }

    function deposite(uint amount, address token) public {
        TransferHelper.safeTransferFrom(token, msg.sender, address(this), amount);
        userDepositeInfo[msg.sender][token] = amount;
        (uint112 _reserve0, uint112 _reserve1,) = IPair(pair).getReserves(); // gas savings
        uint value = token == token0 ? amount : IPair(pair).getAmountOut(amount, _reserve1, _reserve0);
        userDepositeValue[msg.sender] += value;
    }

    function createPosition(address token, uint amount, uint leverage) public{
        uint remaining = getRemainingValue(msg.sender);
        require(remaining >= amount, "leverage: not enough deposite");
        PositionInfo memory info = PositionInfo(
            token, leverage, amount
        );
        userPositionInfo[msg.sender].push(info);
        (uint112 _reserve0, uint112 _reserve1,) = IPair(pair).getReserves(); // gas savings
        uint value = token == token0 ? amount : IPair(pair).getAmountOut(amount, _reserve1, _reserve0);
        userPositionValue[msg.sender] += value;
    }

    function getRemainingValue(address user) public view returns(uint) {
        uint value = 10 * userDepositeValue[user] - userPositionValue[user];
        return value;
    }

    function getOutput(address token, uint amountIn) public view returns(uint amountOut){
        (uint112 _reserve0, uint112 _reserve1,) = IPair(pair).getReserves(); // gas savings
        amountOut = token == token0 ? IPair(pair).getAmountOut(amountIn, _reserve0, _reserve1) : IPair(pair).getAmountOut(amountIn, _reserve1, _reserve0);
    }

    function swapPosition(uint positionIndex, uint amountIn) public {
        address tokenIn = userPositionInfo[msg.sender][positionIndex]._token;
        address tokenOut = tokenIn == token0 ? token1 : token0;
        uint leverage = userPositionInfo[msg.sender][positionIndex]._leverage;
        uint amount = userPositionInfo[msg.sender][positionIndex]._amount;
        require(amount >= amountIn, "leverage.swapPosition() : amount exceed");
        // _safeTransfer(tokenIn, pair, amountIn);
        uint amountOut = getOutput(tokenIn, amountIn);
        IERC20(token0).approve(pair, amountIn);
        IPair(pair).swapToken(amountIn, tokenIn, tokenOut, address(this));
        if(amount == amountIn) {
            delete userPositionInfo[msg.sender][positionIndex];
            PositionInfo memory info = PositionInfo(tokenOut, leverage, amountOut);
            userPositionInfo[msg.sender][positionIndex] = info;
        } else {
            userPositionInfo[msg.sender][positionIndex]._amount -= amountIn;
            PositionInfo memory info = PositionInfo(tokenOut, leverage, amountOut);
            userPositionInfo[msg.sender].push(info);
        }
    }
}