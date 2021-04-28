// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the
 * owner.
 * Taken from https://github.com/DeversiFi/ethereum-vesting and slightly updated.
 */
contract ERC20Vesting is Ownable {
    // The vesting schedule is time-based (i.e. using block timestamps as opposed to e.g. block numbers), and is
    // therefore sensitive to timestamp manipulation (which is something miners can do, to a certain degree). Therefore,
    // it is recommended to avoid using short time durations (less than a minute). Typical vesting schemes, with a
    // cliff period of a year and a duration of four years, are safe to use.
    // solhint-disable not-rely-on-time

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event TokensReleased(address token, uint256 amount);
    event TokenVestingRevoked(address token);

    // beneficiary of tokens after they are released
    address public beneficiary;

    // Durations and timestamps are expressed in UNIX time, the same units as block.timestamp.
    uint256 public cliff;
    uint256 public start;
    uint256 public duration;

    bool public revocable;

    mapping(address => uint256) public released;
    mapping(address => bool) public revoked;

    /**
     * @dev Creates a vesting contract that vests its balance of any ERC20 token to the
     * beneficiary, gradually in a linear fashion until start + duration. By then all
     * of the balance will have vested.
     * @param grantBeneficiary address of the beneficiary to whom vested tokens are transferred
     * @param cliffDuration duration in seconds of the cliff in which tokens will begin to vest
     * @param grantStart the time (as Unix time) at which point vesting starts
     * @param grantDuration duration in seconds of the period in which the tokens will vest
     * @param isRevocable whether the vesting is revocable or not
     */
    constructor(
        address grantBeneficiary,
        uint256 grantStart,
        uint256 cliffDuration,
        uint256 grantDuration,
        bool isRevocable
    ) Ownable() {
        require(
            grantBeneficiary != address(0),
            "TokenVesting: grantBeneficiary is the zero address"
        );
        // solhint-disable-next-line max-line-length
        require(
            cliffDuration <= grantDuration,
            "TokenVesting: cliff is longer than duration"
        );
        require(grantDuration > 0, "TokenVesting: duration is 0");
        // solhint-disable-next-line max-line-length
        require(
            grantStart.add(grantDuration) > block.timestamp,
            "TokenVesting: final time is before current time"
        );

        beneficiary = grantBeneficiary;
        revocable = isRevocable;
        duration = grantDuration;
        cliff = grantStart.add(cliffDuration);
        start = grantStart;
    }

    /**
     * @notice Transfers vested tokens to beneficiary.
     * @param token ERC20 token which is being vested
     */
    function release(IERC20 token) public {
        uint256 unreleased = _releasableAmount(token);

        require(unreleased > 0, "TokenVesting: no tokens are due");

        released[address(token)] = released[address(token)].add(unreleased);

        token.safeTransfer(beneficiary, unreleased);

        emit TokensReleased(address(token), unreleased);
    }

    /**
     * @notice Allows the owner to revoke the vesting. Tokens already vested
     * remain in the contract, the rest are returned to the owner.
     * @param token ERC20 token which is being vested
     */
    function revoke(IERC20 token) public onlyOwner {
        require(revocable, "TokenVesting: cannot revoke");
        require(
            !revoked[address(token)],
            "TokenVesting: token already revoked"
        );

        uint256 balance = token.balanceOf(address(this));

        uint256 unreleased = _releasableAmount(token);
        uint256 refund = balance.sub(unreleased);

        revoked[address(token)] = true;

        token.safeTransfer(owner(), refund);

        emit TokenVestingRevoked(address(token));
    }

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     * @param token ERC20 token which is being vested
     */
    function _releasableAmount(IERC20 token) private view returns (uint256) {
        return _vestedAmount(token).sub(released[address(token)]);
    }

    /**
     * @dev Calculates the amount that has already vested.
     * @param token ERC20 token which is being vested
     */
    function _vestedAmount(IERC20 token) private view returns (uint256) {
        uint256 currentBalance = token.balanceOf(address(this));
        uint256 totalBalance = currentBalance.add(released[address(token)]);

        if (block.timestamp < cliff) {
            return 0;
        } else if (
            block.timestamp >= start.add(duration) || revoked[address(token)]
        ) {
            return totalBalance;
        } else {
            return totalBalance.mul(block.timestamp.sub(start)).div(duration);
        }
    }
}
