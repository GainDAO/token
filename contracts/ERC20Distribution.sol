// SPDX-License-Identifier: MIT
pragma solidity =0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

/**
 * @title ERC20Distribution
 * @dev A token distribution contract that sells an initial supply of tokens at a
   linearly decreasing exchange rate. After depletion of the initial supply, tokens
   can be recycled and resold at the end rate
 */
contract ERC20Distribution is Pausable, AccessControlEnumerable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    
    bytes32 public constant KYCMANAGER_ROLE = keccak256("KYCMANAGER_ROLE");
 
    event TokensSold(address recipient, uint256 amountToken, uint256 amountEth, uint256 actualRate);
    event DepositReceived(address sender);
    event kycApproverChanged(address newKYCApprover);
    
    IERC20 public _fiat_token; // Contract address for the payment token
    IERC20 public _trusted_token; // Contract address for the distributed token

    address payable public _beneficiary;

    address public _kyc_approver; // address that signs the KYC approval

    uint256 private _startrate_distribution; // stored internally in high res
    uint256 private _endrate_distribution;   // stored internally in high res
    uint256 private _divider_rate;   // scaling factor for start and end rate
    
    uint256 private _total_distribution_balance;  // total volume of initial distribution
    uint256 private _current_distributed_balance; // total volume sold upto now

    /**
     * @dev Creates a distribution contract that sells any ERC20 _trusted_token to the
     * beneficiary using an ERC20 as fiat currency, based on a ascending linear exchange rate
     * @param distToken address of the token contract whose tokens are distributed
     * @param distBeneficiary address of the beneficiary to whom received Ether is sent
     * @param distStartRate exchange rate at start of distribution 
     * @param distEndRate exhange rate at the end of distribution
     * @param dividerRate scale factor that is to be applied to the start/end rate
     * @param distVolumeTokens total distribution volume
    */
    constructor(
        IERC20 fiatToken,
        IERC20 distToken,
        address payable distBeneficiary,
        uint256 distStartRate,
        uint256 distEndRate,
        uint256 dividerRate,
        uint256 distVolumeTokens
    ) {
        require(
            distBeneficiary != address(0),
            "TokenDistribution: distBeneficiary is the zero address"
        );
        
        require(
            distStartRate > 0 && distEndRate > 0,
            "TokenDistribution: rates should > 0"
        );

        require(
            distStartRate < distEndRate,
            "TokenDistribution: start rate should be smaller than end rate"
        );
        
        require(
          dividerRate > 0,
          "TokenDistribution: rate divider must be larger than zero"
        );
        
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(KYCMANAGER_ROLE, _msgSender());

        _fiat_token = fiatToken;
        _trusted_token = distToken;
        _beneficiary = distBeneficiary;
        
        _startrate_distribution  = distStartRate;
        _endrate_distribution  = distEndRate;
        _divider_rate = dividerRate;
        
        _total_distribution_balance = distVolumeTokens;
        _current_distributed_balance = 0;
        
        // when the contract is deployed, it starts as paused
        _pause();
    }
    
    /**
        * @dev standard getter for callee fiat token balance
        */
    function user_fiattoken_balance() public view returns(uint256){ 
      return _fiat_token.balanceOf(msg.sender);// balanceOf function is already declared in ERC20 token function
    }    
     
    /**
        * @dev getter for user allowance (fiat token)
        */
    function fiattoken_allowance() public view returns(uint256){
      return _fiat_token.allowance(msg.sender, address(this));
    }  
    
    /**
        * @dev getter for contract fiat balance
        */
    function fiattoken_contractbalance() public view returns(uint256){
      return _fiat_token.balanceOf(address(this));
    }    

    /**
        * @dev standard getter for startrate_distribution (tokens/ETH)
        */
    function startrate_distribution() public view virtual returns (uint256) {
      return _startrate_distribution;
    }

    /**
        * @dev standard getter for endrate_distribution (tokens/ETH)
        */
    function endrate_distribution() public view virtual returns (uint256) {
      return _endrate_distribution;
    }

    /**
        * @dev standard getter for divider_rate (no unit)
        */
    function dividerrate_distribution() public view virtual returns (uint256) {
      return _divider_rate;
    }

    /**
      * @dev standard getter for total_distribution_balance
      */
    function total_distribution_balance() public view virtual returns (uint256) {
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
        _trusted_token.balanceOf(address(this))==_total_distribution_balance,
        'Initial distribution balance must be correct'
        );
        
      _unpause();
    }
    
    /**
        * @dev Getter for the distribution state.
        */
    function distributionStarted() public view virtual returns (bool) {
      return !paused();
    }
    
    /**
        * @dev KYC signature check
        */
    function purchaseAllowed(bytes calldata proof, address from, uint256 validto) whenNotPaused public view virtual returns (bool) {
      require(_kyc_approver != address(0),
        "No KYC approver set: unable to validate buyer"
      );
      
      bytes32 expectedHash =
        hashForKYC(from, validto)
          .toEthSignedMessageHash();
          
      require(expectedHash.recover(proof) == _kyc_approver,
        "KYC: invalid token"
      );
      
      require(validto > block.number,
        "KYC: token expired"
      );
      
      return true;
    }
    
    function hashForKYC(address sender, uint256 validTo) public pure returns (bytes32) {
        return keccak256(abi.encode(sender, validTo));
    }
    
    /**
        * @dev Function that sets a new KYC Approver address
        */
    function changeKYCApprover(address newKYCApprover) public {
      require(
          hasRole(KYCMANAGER_ROLE, _msgSender()),
          "KYC: _msgSender() does not have the KYC manager role"
      );
        
      _kyc_approver = newKYCApprover;

      emit kycApproverChanged(newKYCApprover);
    }
    
    // After distribution has started, the contract can no longer be paused
    // function pause() public {
    //     require(hasRole(PAUSER_ROLE, _msgSender()));
    //     _pause();
    // }
    
    /**
        * @dev Function that calculates the current distribution rate based
        * on the inital distribution volume, the remaining volume and the
        * amount of erc20 tokens to be bought
        */
    function currentRateUndivided(uint256 amountWei) public view returns (uint256) {
        require(_current_distributed_balance + amountWei <= _total_distribution_balance,
            "Currentrate: out of range"
        );
        
            // Distribution active: ascending fractional linear rate (distribution slope)
            uint256 rateDelta =  
              _endrate_distribution.sub(_startrate_distribution);
            uint256 offset_e18 = _current_distributed_balance.add(amountWei.div(2));

            uint256 currentRate = rateDelta
              .mul(offset_e18)
              .div(_total_distribution_balance)
              .add(_startrate_distribution);
            return currentRate;
    }
    
    /**
        * @dev Function that allows the beneficiary to retrieve
              the current ERC20 balance from the distribution contract
        */
    function claimFiatToken() public {
      require(msg.sender==_beneficiary,
          "Claim: only the beneficiary can claim fiat token funds from the distribution contract"
      );
      
      bool result = _fiat_token.transfer(_beneficiary, _fiat_token.balanceOf(address(this)));
      require(result,
        "Claim: transfer must succeed"
      );
    }
    
    /**
        * @dev Function that is used to purchase tokens at the given rate.
          Calculates total number of tokens that can be bought for the given Ether
          Ether to the benificiary address
        * @param trustedtoken_amount number of gain tokens to purchase (wei)
        * @param limitrate purchase tokens only at this rate or above
        * @param proof proof data for kyc validation
        * @param validTo expiry block for kyc proof
        */
    function purchaseTokens(
      uint256 trustedtoken_amount,
      uint256 limitrate,
      bytes calldata proof,
      uint256 validTo) public payable {
      
      // anyone but contract admins must pass kyc
      if(hasRole(DEFAULT_ADMIN_ROLE, _msgSender())==false) {
        require(
          purchaseAllowed(proof, msg.sender, validTo),
          "Buyer did not pass KYC procedure"
        );
      }

      uint256 actualrate = currentRateUndivided(trustedtoken_amount);
      require(actualrate<=limitrate); // current rate is below requested rate
      
      uint256 fiattoken_amount = trustedtoken_amount.mul(actualrate).div(_divider_rate);

      require(
        fiattoken_amount <= fiattoken_allowance(), 
        "unable to sell: insufficient tokens approved"
      );
      
      uint256 pool_balance = _trusted_token.balanceOf(address(this));
      require(trustedtoken_amount<=pool_balance); // insufficient tokens available in the distribution pool
      
      _current_distributed_balance = _current_distributed_balance.add(trustedtoken_amount);

      uint256 initfiatbalance = _fiat_token.balanceOf(address(this));
      bool result1 = _fiat_token.transferFrom(msg.sender, address(this), fiattoken_amount);
      require(
        result1 == true && 
          _fiat_token.balanceOf(address(this)) - initfiatbalance == fiattoken_amount,
        "PurchaseTokens: fiat transfer must succeed"
      );

      uint256 inittokenbalance = _trusted_token.balanceOf(address(this));
      bool result2 = _trusted_token.transfer(msg.sender, trustedtoken_amount);
      require(
        result2==true && 
          inittokenbalance - _trusted_token.balanceOf(address(this))==trustedtoken_amount,
        "PurchaseTokens: token transfer must succeed"
      );

      emit TokensSold(msg.sender, msg.value, trustedtoken_amount, actualrate);
    }
  }
