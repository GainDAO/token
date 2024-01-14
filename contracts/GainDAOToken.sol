// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract GainDAOToken is AccessControlEnumerable, ERC20Capped {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    error Unauthorized();

    constructor(string memory name_, string memory symbol_, uint256 cap_)
        ERC20(name_, symbol_)
        ERC20Capped(cap_)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) public {
        if(false == hasRole(MINTER_ROLE, msg.sender)) revert Unauthorized();

        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
    }
}
