# GainDAO Solidity contracts

## GainDAO Token
The GainDAO token is an ERC20 token that supports the following requirements:
- it has a maximum supply (cap) of 42M units.
- it is first deployed in a "paused" state, meaning that token holders cannot transfer tokens
  until it is unpaused.
- any account with the `MINTER_ROLE` can mint new units, even when the token is still paused,
  as long as the maximum supply is not reached.
- any account with the `PAUSER_ROLE` can unpause the token, there are no ways to pause the token
  again later on.

## TokenVesting
A contract that can be used to represent the vesting schedule of an ERC20 token. A vesting schedule
is represented by a cliff, and a total duration. Once the token is deployed for each beneficiary and
tokens are sent to its address, it is possible for the beneficiary to claim those according to the
configured vesting schedule.

We use vesting schedules with a configurable cliff and continuous vesting over time (it is possible
to claim tokens on every blocks). Tokens start vesting only when the cliff is reached.