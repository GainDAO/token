// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title ERC20Distribution
 * @dev A token distribution contract that sells an initial supply of tokens at a
   linearly decreasing exchange rate. After depletion of the initial supply, tokens
   can be recycled and resold at the end rate
 */
contract ERC20Distribution is Pausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event TokensSold(address recipient, uint256 amountToken, uint256 amountEth, uint256 actualRate);
    
    IERC20 public _trusted_token;
    address payable public _beneficiary;

    uint256 private _startrate_distribution_e18; // stored internally in high res
    uint256 private _endrate_distribution_e18;   // stored internally in high res
    
    uint256 private _total_distribution_balance;  // total volume of initial distribution
    uint256 private _current_distributed_balance; // total volume sold upto now

    /**
     * @dev Creates a distribution contract that sells any ERC20 _trusted_token to the
     * beneficiary, based on a linear exchange rate
     * @param distToken address of the token contract whose tokens are distributed
     * @param distBeneficiary address of the beneficiary to whom received Ether is sent
     * @param distStartRate exchange rate at start of distribution
     * @param distEndRate exhange rate at the end of distribution
     * @param distEndRate exhange rate at the end of distribution
    */
    constructor(
        IERC20 distToken,
        address payable distBeneficiary,
        uint256 distStartRate,
        uint256 distEndRate,
        uint256 distVolumeTokens
    ) {
        require(
            distBeneficiary != address(0),
            "TokenDistribution: distBeneficiary is the zero address"
        );
        
        require(
            distStartRate > distEndRate,
            "TokenDistribution: start rate should be > end rate"
        );
        
        require(
            distStartRate > 0 && distEndRate > 0,
            "TokenDistribution: rates should > 0"
        );

        _trusted_token = distToken;
        _beneficiary = distBeneficiary;

        _startrate_distribution_e18  = distStartRate * (10**18);
        _endrate_distribution_e18  = distEndRate * (10**18);
        
        _total_distribution_balance = distVolumeTokens;
        _current_distributed_balance = 0;

        // when the contract is deployed, it starts as paused
        _pause();
    }
    
    /**
        * @dev Getter for the address that receives the ether value of the sold tokens
        */
    function beneficiary() public view virtual returns (address) {
      return _beneficiary;
    }
    
    /**
        * @dev standard getter for startrate_distribution (tokens/ETH)
        */
    function startrate_distribution() public view virtual returns (uint256) {
      return _startrate_distribution_e18 / (10**18);
    }

    /**
        * @dev standard getter for endrate_distribution (tokens/ETH)
        */
    function endrate_distribution() public view virtual returns (uint256) {
      return _endrate_distribution_e18 / (10**18);
    }

    function total_distribution_balance() public view virtual returns (uint256) {
      /**
      * @dev standard getter for total_distribution_balance
      */
      return _total_distribution_balance;
    }
    
    /**
        * @dev standard getter for current_distribution_balance (ETH)
        */
    function current_distributed_balance() public view virtual returns (uint256) {
      return _current_distributed_balance;
    }

    /**
        * @dev Function that starts distribution.
        */
    function startDistribution() whenPaused public payable {
      require(
        paused(),
        'Distribution already started'
      );
      
      require(
        _trusted_token.balanceOf(address(this))==_total_distribution_balance,
        'Initial distribution balance must be correct'
        );
        
      _total_distribution_balance = _trusted_token.balanceOf(address(this));

      _unpause();
    }
    
    /**
        * @dev Getter for the distribution state.
        */
    function distributionStarted() public view virtual returns (bool) {
      return !paused();
    }
    
    // After distribution has started, the contract can no longer be paused
    // function pause() public {
    //     require(hasRole(PAUSER_ROLE, _msgSender()));
    //     _pause();
    // }
    
    /**
        * @dev Function that calculates the current distribution rate based
        * on the inital distribution volume and the remaining volume.
        */
    function currentRate() public view returns (uint256) {
        if(paused()) {
          // fixed rate (initial distribution slope)
          // return _startrate_distribution_e18 / (10**18);
          return 0;
        }
        
        if(_current_distributed_balance<_total_distribution_balance) {
          // Distribution active: fractional linear rate (distribution slope)
          uint256 rateDelta_e18 =
            _startrate_distribution_e18.sub(_endrate_distribution_e18);
          uint256 offset_e18 =
            _total_distribution_balance.sub(_current_distributed_balance);
          uint256 currentRate_e18 =
            _endrate_distribution_e18
            .add(rateDelta_e18.mul(offset_e18)
            .div(_total_distribution_balance));
          return currentRate_e18 / (10**18);
        } else {
          // distribution ended
          return 0;
        }
    }
    
    /**
        * @dev Function that is used to purchase tokens at the given rate.
          Calculates total number of tokens that can be bought for the given Ether
          value, transfers the tokens to the sender. Transfers the received
          Ether to the benificiary address
        * @param tokenbalance number of tokens to purchase
        * @param rate purchase tokens only at this rate
        */
    function purchaseTokens(uint256 tokenbalance, uint256 rate) public payable {
      uint256 actualrate = currentRate();
      require(
        rate==actualrate,
        "unable to sell at the given rate: rate has changed"
      );
      
      require(actualrate>0,
        "unable to sell at the given rate: distribution has ended"
      );
      
      uint256 ethbalance = tokenbalance.div(actualrate);
      require(
        msg.value>=ethbalance,
        "unable to purchase tokens: insufficient ether supplied"
      );

      uint256 pool_balance = _trusted_token.balanceOf(address(this));
      require(tokenbalance<=pool_balance,
        "insufficient tokens available in the distribution pool"
      );
      
      _current_distributed_balance = _current_distributed_balance.add(tokenbalance);
      _beneficiary.transfer(msg.value);

      _trusted_token.transfer(msg.sender, tokenbalance);

      emit TokensSold(msg.sender, ethbalance, tokenbalance, actualrate);
    }
}