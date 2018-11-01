# BranchingTransactionBuilder

### Features

Allows you to make and spend transactions using "OR" combinations of conditions.

For example: 
- Alice + Bob 
- OR 
- Chika + Dave 
* But not (Alice + Chika) or (Bob + Dave)

Each of these sets of conditions is treated as a "subscript".
Subscripts should look like standard transactions that bitcoinjs-lib understands, such as:
- PubKeyHash (The normal way to pay a bitcoin address)
- Pubkey 
- MultiSig (m of n PubKeys)

See test/branching_transaction_builder.js for examples.


## License

This library is free and open-source software released under the MIT license.


## Copyright

- Edmund Edgar, 2014
- Includes code from BitcoinJS (c) 2011-2014 Bitcoinjs-lib contributors
- Released under MIT license
