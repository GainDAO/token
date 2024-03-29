// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

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

    error InvalidBeneficiary();
    error InvalidRate();
    error InvalidDividerRate();
    error Unauthorized();
    error KYCNotSet();
    error InvalidKYCToken();
    error KYCTokenExpired();
    error DistributionOutOfRange();
    error PurchaseNotAllowed();
    error CurrentRateExceedsLimit();
    error CurrentRateExceedsLimitSlippage();
    error InsufficientTokenApproval();
    error FiatTransferFailed();
 
    event TokensSold(address recipient, uint256 amountFiat, uint256 amountToken, uint256 actualRate);
    event kycApproverChanged(address newKYCApprover);
    
    IERC20 public immutable _fiat_token; // Contract address for the payment token
    IERC20 public immutable _trusted_token; // Contract address for the distributed token

    address payable private immutable _beneficiary;

    address public _kyc_approver; // address that signs the KYC approval

    uint256 private immutable _startrate_distribution; // specified in paymenttokens / gain token 
    uint256 private immutable _endrate_distribution;   // specified in paymenttokens / gain token 
    uint256 private immutable _divider_rate;   // scaling factor for start and end rate
    
    uint256 private immutable _total_distribution_balance;  // total volume of initial distribution
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
        if(distBeneficiary == address(0)) revert InvalidBeneficiary();
        
        if(distStartRate == 0 || distEndRate == 0) revert InvalidRate();

        if(distStartRate > distEndRate) revert InvalidRate();
               
        if(dividerRate == 0) revert InvalidDividerRate();
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(KYCMANAGER_ROLE, msg.sender);

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
        * @dev standard getter for beneficiary (address)
        */
    function beneficiary() external view virtual returns (address) {
      return _beneficiary;
    }

    /**
        * @dev standard getter for callee fiat token balance
        */
    function user_fiattoken_balance() external view virtual returns(uint256){ 
      return _fiat_token.balanceOf(msg.sender);// balanceOf function is already declared in ERC20 token function
    }    
     
    /**
        * @dev getter for user allowance (fiat token)
        */
    function fiattoken_allowance() public view virtual returns(uint256){
      return _fiat_token.allowance(msg.sender, address(this));
    }  
    
    /**
        * @dev getter for contract fiat balance
        */
    function fiattoken_contractbalance() external view virtual returns(uint256){
      return _fiat_token.balanceOf(address(this));
    }    

    /**
        * @dev standard getter for startrate_distribution (tokens/ETH)
        */
    function startrate_distribution() external view virtual returns (uint256) {
      return _startrate_distribution;
    }

    /**
        * @dev standard getter for endrate_distribution (tokens/ETH)
        */
    function endrate_distribution() external view virtual returns (uint256) {
      return _endrate_distribution;
    }

    /**
        * @dev standard getter for divider_rate (no unit)
        */
    function dividerrate_distribution() external view virtual returns (uint256) {
      return _divider_rate;
    }

    /**
      * @dev standard getter for total_distribution_balance
      */
    function total_distribution_balance() external view virtual returns (uint256) {
      return _total_distribution_balance;
    }
    
    /**
        * @dev standard getter for current_distribution_balance (ETH)
        */
    function current_distributed_balance() external view virtual returns (uint256) {
      return _current_distributed_balance;
    }

    /**
        * @dev Function that starts distribution.
        */
    function startDistribution() whenPaused external {
      if(hasRole(DEFAULT_ADMIN_ROLE, msg.sender)==false) revert Unauthorized();

      _unpause();
    }
    
    /**
        * @dev Getter for the distribution state.
        */
    function distributionStarted() external view virtual returns (bool) {
      return !paused();
    }
    
    /**
        * @dev KYC signature check
        */
    function purchaseAllowed(bytes calldata proof, address from, uint256 validto) whenNotPaused public view virtual returns (bool) {
      if(_kyc_approver == address(0)) revert KYCNotSet();
      
      bytes32 expectedHash =
        hashForKYC(from, validto)
          .toEthSignedMessageHash();
          
      if(validto <= block.number) revert KYCTokenExpired();

      if(expectedHash.recover(proof) != _kyc_approver) revert InvalidKYCToken();
      
      return true;
    }
    
    function hashForKYC(address sender, uint256 validTo) public view returns (bytes32) {
        return keccak256(abi.encode(sender, validTo, block.chainid, address(this)));
    }
    
    /**
        * @dev Function that sets a new KYC Approver address
        */
    function changeKYCApprover(address newKYCApprover) external {
      if(false == hasRole(KYCMANAGER_ROLE, msg.sender)) revert Unauthorized();
        
      _kyc_approver = newKYCApprover;

      emit kycApproverChanged(newKYCApprover);
    }
    
    // After distribution has started, the contract can no longer be paused
    // function pause() public {
    //     require(hasRole(PAUSER_ROLE, msg.sender));
    //     _pause();
    // }
    
    /**
        * @dev Function that calculates the current distribution rate based
        * on the inital distribution volume, the remaining volume and the
        * amount of erc20 tokens to be bought
        */
    function currentRateUndivided(uint256 amountWei) public view returns (uint256) {
      if(_current_distributed_balance + amountWei > _total_distribution_balance) revert DistributionOutOfRange();
        
            // Distribution active: ascending or flat fractional linear rate (distribution slope)
            uint256 rateDelta =  
              _endrate_distribution.sub(_startrate_distribution);
            // uint256 offset_e18 = _current_distributed_balance.add(amountWei.div(2));

            uint256 currentRate = rateDelta
              .mul(_current_distributed_balance)
              .div(_total_distribution_balance)
              .add(_startrate_distribution);
            return currentRate;
    }
    
    /**
        * @dev Function that allows the beneficiary to retrieve
              the current ERC20 balance from the distribution contract
        */
    function claimFiatToken() external {
      if(msg.sender != _beneficiary) revert Unauthorized();
      
      _fiat_token.safeTransfer(_beneficiary, _fiat_token.balanceOf(address(this)));
    }
    
    /**
        * @dev Function that is used to purchase tokens at the given rate.
          Calculates total number of tokens that can be bought for the given Ether
          Ether to the benificiary address
        * @param trustedtoken_amount number of gain tokens to purchase (wei)
        * @param limitrate purchase tokens only at this rate (wei)
        * @param proof proof data for kyc validation
        * @param validTo expiry block for kyc proof
        */
    function purchaseTokens(
      uint256 trustedtoken_amount,
      uint256 limitrate,
      bytes calldata proof,
      uint256 validTo) external {
      
      // anyone but contract admins must pass kyc
      if(hasRole(DEFAULT_ADMIN_ROLE, msg.sender)==false) {
        if(false==purchaseAllowed(proof, msg.sender, validTo)) revert PurchaseNotAllowed();
      }

      uint256 actualrate = currentRateUndivided(trustedtoken_amount);
      if(actualrate>limitrate) revert CurrentRateExceedsLimit();
      if(limitrate>actualrate.mul(110).div(100)) revert CurrentRateExceedsLimitSlippage();
      
      uint256 fiattoken_amount = trustedtoken_amount.mul(actualrate).div(_divider_rate);

      if(fiattoken_amount > fiattoken_allowance()) revert InsufficientTokenApproval();
      
      uint256 pool_balance = _trusted_token.balanceOf(address(this));
      require(trustedtoken_amount<=pool_balance); // insufficient tokens available in the distribution pool
      
      _current_distributed_balance = _current_distributed_balance.add(trustedtoken_amount);

      _fiat_token.safeTransferFrom(msg.sender, address(this), fiattoken_amount);

      _trusted_token.safeTransfer(msg.sender, trustedtoken_amount);

      emit TokensSold(msg.sender, fiattoken_amount, trustedtoken_amount, actualrate);
    }
  }
