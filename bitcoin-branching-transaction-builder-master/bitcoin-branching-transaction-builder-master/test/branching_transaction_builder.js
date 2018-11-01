var assert = require('assert')

var bitcoin = require('bitcoinjs-lib');
var BranchingTransactionBuilder = require('../src/branching_transaction_builder');

var ECKey = bitcoin.ECKey;
var ECPubKey = bitcoin.ECPubKey;
var TransactionBuilder = bitcoin.TransactionBuilder;
var Transaction = bitcoin.Transaction;
var Script = bitcoin.Script;
var Address = bitcoin.Address;
var scripts = bitcoin.scripts;
var BigInteger = require('bigi');

describe('BranchingTransactionBuilder', function() {

    // TODO: If this thing gets much bigger we should move this into fixtures
    var pubkeys1 = ['02f3a32b55520c115cc61860066c8280d0adbb471abe5b89e0b5e864948a34961e','03d93547f38370b35471a8ee463b4245d6b1282a0feccce8e149c4ada76d32df1a'].map( function(x) { return new ECPubKey.fromHex(x) } );
    var pubkeys2 = ['0247e6c3a88d76ab7505c147e5a9bcf0011226f7690081dd728042831f90a391ed','0389688a084ff6f83c9ed3c91236e0f46d060cef32da23dfc6fc147fde6af9ca10'].map( function(x) { return new ECPubKey.fromHex(x) } );
    var pubkeys3 = ['02f3a32b55520c115cc61860066c8280d0adbb471abe5b89e0b5e864948a34961e', '0247e6c3a88d76ab7505c147e5a9bcf0011226f7690081dd728042831f90a391ed' ].map( function(x) { return new ECPubKey.fromHex(x) } );
    var expected_redeem_script = '6363522102f3a32b55520c115cc61860066c8280d0adbb471abe5b89e0b5e864948a34961e2103d93547f38370b35471a8ee463b4245d6b1282a0feccce8e149c4ada76d32df1a52ae6752210247e6c3a88d76ab7505c147e5a9bcf0011226f7690081dd728042831f90a391ed210389688a084ff6f83c9ed3c91236e0f46d060cef32da23dfc6fc147fde6af9ca1052ae6867522102f3a32b55520c115cc61860066c8280d0adbb471abe5b89e0b5e864948a34961e210247e6c3a88d76ab7505c147e5a9bcf0011226f7690081dd728042831f90a391ed52ae68';
    var expected_p2sh_addr = '39a6Ur9hJXDwdvR4TYKPnzWjaYiNfZ4Zxp';
    var test_output2 = {"unspent_outputs":[
            {
            "tx_hash":"0343d77440f7989eb828f884bd2d9d559c9525ea659eb27951525a2269225350",
            "tx_hash_big_endian":"50532269225a525179b29e65ea25959c559d2dbd84f828b89e98f74074d74303",
            "tx_index":69269456,
            "tx_output_n": 0,   
            "script":"a9145671e6049b22779f46a70a4ab6d927963f1faf3787",
            "value": 40000,
            "value_hex": "009c40",
            "confirmations":120
            }
        ]};

    var gp_builder = new BranchingTransactionBuilder();

    combo1 = scripts.multisigOutput(2, pubkeys1);
    combo2 = scripts.multisigOutput(2, pubkeys2);
    combo3 = scripts.multisigOutput(2, pubkeys3);

    gp_builder.addSubScript(combo1);
    gp_builder.addSubScript(combo2);
    gp_builder.addSubScript(combo3);
    var gp_redeem_script = gp_builder.script();

    describe('script', function() {

        it('produces the expected P2SH address', function() {
            var scriptPubKey = bitcoin.scripts.scriptHashOutput(gp_redeem_script.getHash())
            var multisigAddress = bitcoin.Address.fromOutputScript(scriptPubKey).toString()

            assert.equal(gp_redeem_script.buffer.toString('hex'), expected_redeem_script);
            assert.equal(multisigAddress, expected_p2sh_addr);
        })

        it('produces the same thing from ASM', function() {
            var combo1_from_asm = Script.fromASM("OP_2 02f3a32b55520c115cc61860066c8280d0adbb471abe5b89e0b5e864948a34961e 03d93547f38370b35471a8ee463b4245d6b1282a0feccce8e149c4ada76d32df1a OP_2 OP_CHECKMULTISIG")
            var combo1_from_asm_different = Script.fromASM("OP_1 02f3a32b55520c115cc61860066c8280d0adbb471abe5b89e0b5e864948a34961e 03d93547f38370b35471a8ee463b4245d6b1282a0feccce8e149c4ada76d32df1a OP_2 OP_CHECKMULTISIG")
            assert.equal(combo1_from_asm.buffer.toString('hex'), combo1.buffer.toString('hex'));
            assert.notEqual(combo1_from_asm_different.buffer.toString('hex'), combo1.buffer.toString('hex'));
        })

        it('produces the expected signed spending transaction', function() {
            var spend_builder = new TransactionBuilder();
            spend_builder.addInput(test_output2['unspent_outputs'][0]['tx_hash_big_endian'], 0);
            spend_builder.addOutput("1Dc8JwPsxxwHJ9zX1ERYo9q7NQA9SRLqbC", test_output2['unspent_outputs'][0]['value'] - 10000);

            var priv1 = ECKey.fromWIF('L3bG2JdtcZtWd7fk8XYAtgnGHJYuPBFkDznJqw21bFWS5B8Pw1Zd');
            var priv2 = ECKey.fromWIF('L3MRgBTuEtfvEpwb4CcGtDm4s79fDR8UK1AhVYcDdRL4pRpsy686');
            var gp_builder = new BranchingTransactionBuilder(spend_builder);

            gp_builder.selectInputBranch(0, 1, 3);
            gp_builder.signBranch(0, priv1, gp_redeem_script, null, combo2)
            gp_builder.signBranch(0, priv2, gp_redeem_script, null, combo2)
            var tx = gp_builder.build();

            assert.equal(tx.toHex(), '01000000010343d77440f7989eb828f884bd2d9d559c9525ea659eb27951525a226922535000000000fd720100483045022100de328c41155b7cf28fcbb48dcfe5c737aef7bad905f053ab1cf5662fcf462e8e02205ac70d68cba2c4ecc8ebf6be788a2006ee4531a9406ba6f265c0e62c7312515701483045022100dbd675d398969732d8d65151432a6cd87ad968f40383593debefb77ea98f73c702203152c8f8b049efebf5af9c01843cd29870a247b445c6a26bcea328061eaaae070100514cdb6363522102f3a32b55520c115cc61860066c8280d0adbb471abe5b89e0b5e864948a34961e2103d93547f38370b35471a8ee463b4245d6b1282a0feccce8e149c4ada76d32df1a52ae6752210247e6c3a88d76ab7505c147e5a9bcf0011226f7690081dd728042831f90a391ed210389688a084ff6f83c9ed3c91236e0f46d060cef32da23dfc6fc147fde6af9ca1052ae6867522102f3a32b55520c115cc61860066c8280d0adbb471abe5b89e0b5e864948a34961e210247e6c3a88d76ab7505c147e5a9bcf0011226f7690081dd728042831f90a391ed52ae68ffffffff0130750000000000001976a9148a462b671791d0bfbd8fd0d3987f652258d06dd088ac00000000');
        })

        it('can do pay to public key hash transactions', function() {

            var k1 = ECKey.fromWIF('L3bG2JdtcZtWd7fk8XYAtgnGHJYuPBFkDznJqw21bFWS5B8Pw1Zd');
            var k2 = ECKey.fromWIF('L3MRgBTuEtfvEpwb4CcGtDm4s79fDR8UK1AhVYcDdRL4pRpsy686');
            var addr1 = k1.pub.getAddress();
            var addr2 = k2.pub.getAddress();
            assert.equal('1Fratqwo3Bu2FwMBzAex8WgDbmmGgJYLGH', addr1.toString());
            assert.equal('112jFbM3Lp3qRSjezGFCv2rejT3UQ6rH5Z', addr2.toString());

            // Not really testing our thing, just showing how to get from an address to a hash you can feed scripts
            var addr1_check = Address.fromBase58Check(addr1.toString());
            assert.equal(addr1_check.hash.toString('hex'), addr1.hash.toString('hex'));
            assert.equal(addr1_check.hash.toString('hex'), 'a2f26faf639c9a7e6a3ae5076bf7bbbf6cf1732a');

            var branch1 = scripts.pubKeyHashOutput(addr1.hash);
            var branch2 = scripts.pubKeyHashOutput(addr2.hash);


            var branch_builder = new BranchingTransactionBuilder();
            branch_builder.addSubScript(branch1);
            branch_builder.addSubScript(branch2);
            var branch_redeem_script = branch_builder.script();
            assert.equal(branch_redeem_script.toASM(), 'OP_IF OP_DUP OP_HASH160 a2f26faf639c9a7e6a3ae5076bf7bbbf6cf1732a OP_EQUALVERIFY OP_CHECKSIG OP_ELSE OP_DUP OP_HASH160 0053af91626c8e511b63f651161208b56ad0adac OP_EQUALVERIFY OP_CHECKSIG OP_ENDIF');
            var scriptPubKey = bitcoin.scripts.scriptHashOutput(branch_redeem_script.getHash())
            var multisigAddress = bitcoin.Address.fromOutputScript(scriptPubKey).toString()
            assert.equal('3PcxJeW5f6Tp4mVAXe4ggGRvDREAPCMF4o', multisigAddress);

            // Here are some transactions we prepared earlier
            var test_output = {"unspent_outputs":[
                    {
                        "tx_hash":"f1e10f7dce25421a5f7a1793796eda901ba9130cc8daca3332db778f62ce84ca",
                        "tx_hash_big_endian":"ca84ce628f77db3233cadac80c13a91b90da6e7993177a5f1a4225ce7d0fe1f1",
                        "tx_index":74217510,
                        "tx_output_n": 1,
                        "script":"a914f08e151def9e83a2d96b44b5d87c719dcd374d8a87",
                        "value": 60000,
                        "value_hex": "00ea60",
                        "confirmations":1
                    }
                  
                ]
            };

            // https://blockchain.info/unspent?active=3PcxJeW5f6Tp4mVAXe4ggGRvDREAPCMF4o
            var test_output2 = {"unspent_outputs":[
                {
                "tx_hash":"399db526b9602711d864e229222be30d2df49f7fddf0ab5b301bf335c32327ca",
                "tx_hash_big_endian":"ca2723c335f31b305babf0dd7f9ff42d0de32b2229e264d8112760b926b59d39",
                "tx_index":74129248,
                "tx_output_n": 0,
                "script":"a914f08e151def9e83a2d96b44b5d87c719dcd374d8a87",
                "value": 65000,
                "value_hex": "00fde8",
                "confirmations":1
                }
            ]};

            // now the spend, with the first branch
            var spend_builder = new TransactionBuilder();
            spend_builder.addInput(test_output['unspent_outputs'][0]['tx_hash_big_endian'], test_output['unspent_outputs'][0]['tx_output_n']);
            spend_builder.addOutput("1Dc8JwPsxxwHJ9zX1ERYo9q7NQA9SRLqbC", test_output['unspent_outputs'][0]['value'] - 10000);

            var priv1 = ECKey.fromWIF('L3bG2JdtcZtWd7fk8XYAtgnGHJYuPBFkDznJqw21bFWS5B8Pw1Zd');
            var gp_builder = new BranchingTransactionBuilder(spend_builder);
            // input 0 of the tx, first branch of 2 (index 0)
            gp_builder.selectInputBranch(0, 0, 2);
            gp_builder.signBranch(0, priv1, branch_redeem_script, null, branch1)
            var tx = gp_builder.build();
            assert.equal(tx.toHex(), '0100000001f1e10f7dce25421a5f7a1793796eda901ba9130cc8daca3332db778f62ce84ca01000000a147304402205e03edd02fb8895fbea867a42ea95d3da13fd5891351fc85489c92b4132caf2a022039898eacbf6c527269c71c324d3e115738834e49c44903a2a7cc2bcf79987f4601210247e6c3a88d76ab7505c147e5a9bcf0011226f7690081dd728042831f90a391ed51356376a914a2f26faf639c9a7e6a3ae5076bf7bbbf6cf1732a88ac6776a9140053af91626c8e511b63f651161208b56ad0adac88ac68ffffffff0150c30000000000001976a9148a462b671791d0bfbd8fd0d3987f652258d06dd088ac00000000');
            // We successfully broadcast this through a bitcoin 0.10 node

            // now the spend, let's use the second key/branch
            var spend_builder = new TransactionBuilder();
            spend_builder.addInput(test_output2['unspent_outputs'][0]['tx_hash_big_endian'], test_output2['unspent_outputs'][0]['tx_output_n']);
            spend_builder.addOutput("1Dc8JwPsxxwHJ9zX1ERYo9q7NQA9SRLqbC", test_output2['unspent_outputs'][0]['value'] - 10000);

            var priv2 = ECKey.fromWIF('L3MRgBTuEtfvEpwb4CcGtDm4s79fDR8UK1AhVYcDdRL4pRpsy686');
            var gp_builder = new BranchingTransactionBuilder(spend_builder);

            // input 0 of the tx, second branch of 2 (index 1)
            gp_builder.selectInputBranch(0, 1, 2);
            gp_builder.signBranch(0, priv2, branch_redeem_script, null, branch2)
            var tx = gp_builder.build();

            assert.equal(tx.toHex(), '0100000001399db526b9602711d864e229222be30d2df49f7fddf0ab5b301bf335c32327ca00000000a147304402201183dd21b0f484d7efe56d9cd79b3f06cb9ae1dad1a59743abedf263ad48079e022026775aec0fefaab63f15f4561dfe6aa8c5047e54995db9ea97bcc4e9e89c7b7901210389688a084ff6f83c9ed3c91236e0f46d060cef32da23dfc6fc147fde6af9ca1000356376a914a2f26faf639c9a7e6a3ae5076bf7bbbf6cf1732a88ac6776a9140053af91626c8e511b63f651161208b56ad0adac88ac68ffffffff01d8d60000000000001976a9148a462b671791d0bfbd8fd0d3987f652258d06dd088ac00000000');
            // We successfully broadcast this through blockchain.info

                        
        })
    })
});
