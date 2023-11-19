# GainDAO Solidity contracts

## GainDAO Token
The GainDAO token is an ERC20 token that supports the following requirements:
- it has a maximum supply (cap) of 42M units.
- it is first deployed in a "paused" state, meaning that token holders cannot transfer tokens
  until it is unpaused.
- any account with the `MINTER_ROLE` can mint new units, even when the token is still paused,
  as long as the maximum supply is not reached.

## Distribution
A contract that can be used to distribute tokens at a rate that has a linear relation to the total
number of tokens distributed at a certain moment.

