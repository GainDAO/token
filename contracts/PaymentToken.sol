// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

/**
 * @title SimUSD
 * @dev A simple simulated USD token for testing contracts that accept ERC20 tokens 
 */
contract PaymentToken is ERC20PresetMinterPauser {
    address _rejectedAddress;
    uint8 _decimals;

    constructor(uint256 initialSupply, string memory name_, string memory symbol,  address reject, uint8 decimals_ ) ERC20PresetMinterPauser(name_, symbol) {
        _rejectedAddress = reject;
        _mint(msg.sender, initialSupply);
        _decimals = decimals_;
    }

   function decimals() public view virtual override returns (uint8) {
     return _decimals;  
   }
   
   function transfer(address to, uint256 amount) override public returns (bool) {
     if(msg.sender!=_rejectedAddress && to!=_rejectedAddress) {
       return super.transfer(to, amount);
     } else {
       return false;
     }
   }

   function transferFrom(address sender, address recipient, uint256 amount) override public returns (bool) {
     if(sender!=_rejectedAddress && recipient!=_rejectedAddress) {
       return super.transferFrom(sender, recipient, amount);
     } else {
       return false;
     }
   }
}
