const web3util = require('web3-utils');
const dateFormat    = require('dateformat');

/*
 ascii escape codes

 Black        0;30     Dark Gray     1;30
 Red          0;31     Light Red     1;31
 Green        0;32     Light Green   1;32
 Brown/Orange 0;33     Yellow        1;33
 Blue         0;34     Light Blue    1;34
 Purple       0;35     Light Purple  1;35
 Cyan         0;36     Light Cyan    1;36
 Light Gray   0;37     White         1;37

 */

let colors = {
    none:         "\x1B[0m",
    black:        '\x1B[0;30m',
    dark_gray:    '\x1B[1;30m',
    red:          '\x1B[0;31m',
    light_red:    '\x1B[1;31m',
    green:        '\x1B[0;32m',
    light_green:  '\x1B[1;32m',
    orange:       '\x1B[0;33m',
    yellow:       '\x1B[1;33m',
    blue:         '\x1B[0;34m',
    light_blue:   '\x1B[1;34m',
    purple:       '\x1B[0;35m',
    light_purple: '\x1B[1;35m',
    cyan:         '\x1B[0;36m',
    light_cyan:   '\x1B[1;36m',
    light_gray:   '\x1B[0;37m',
    white:        '\x1B[1;37m'
};

let logPre = "      ";

module.exports = {
    hasEvent(tx, eventNamePlusReturn) {
        let eventSig = web3util.sha3(eventNamePlusReturn);
        return tx.logs.filter(x => x.topics[0] === eventSig);
    },
    getEventArgs(tx) {
        // tx.receipt.logs[0].topics[2];
    },
    colors,
    toLog( what, color = colors.white ) {
        console.log(color, what, colors.none);
    },
    toDate(seconds) {
        return dateFormat(parseInt(seconds) * 1000, "yyyy-mm-dd, HH:MM:ss TT");
    },
    topicToAddress(hexString) {
        return hexString.replace("0x000000000000000000000000", "0x");
    },
    toDateFromHex(hex) {
        return this.toDate( web3util.toDecimal(hex) );
    },
    async getBalance(helpers, address) {
        return new helpers.BN( await new helpers.web3Instance.eth.getBalance(address) );
    },
    transferTo(artifacts, _val, _from, _to) {
        let solAccUtils = artifacts.require('SolidityAccountUtils');
        return solAccUtils.new().then(function(instance){ return instance.transferTo(_to, {value: _val, from: _from}) });
    },

    /*
        This is useless for testing.. time is going to really depend on testrpc internal time,
        and we can't do anything about going back to test multiple things.

        instead we mock block number in our Contract
    */
    /*
    async timeTravelTo(helpers, time) {
        console.log("timeTravelTo: ", helpers.utils.toDate(time) );
        let now = new Date().getTime() / 1000; // seconds
        let difference = parseInt(time).toFixed(0) - parseInt(now).toFixed(0);
        if(difference > 0) {
            return new Promise((resolve, reject) => {
                helpers.web3.currentProvider.sendAsync({
                    jsonrpc: "2.0",
                    method: "evm_increaseTime",
                    params: [difference],
                    id: new Date().getTime()
                }, (err, result) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(result)
                });
            })
        } else {
            return ;
        }
    },
    */
    async evm_snapshot(helpers) {
        return new Promise((resolve, reject) => {
            helpers.web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_snapshot",
                params: [],
                id: new Date().getTime()
            }, (err, result) => {
                if (err) {
                    return reject(err)
                }
                return resolve(result)
            });
        })
    },
    async evm_revert(helpers, snapshotId) {
        return new Promise((resolve, reject) => {
            helpers.web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_revert",
                params: [snapshotId],
                id: new Date().getTime()
            }, (err, result) => {
                if (err) {
                    return reject(err)
                }
                return resolve(result)
            });
        })
    },
    getAccounts: function(web3) {
        return web3.eth.getAccounts();
    },
    async getAbi(name) {
        const data = await require("../../../build/contracts/"+name+".json");
        return data.abi;
    },
    async getAbiFile(name) {
        return require("../../../build/contracts/"+name+".json");
    },
    async getContractInstance(helpers, name, address) {
        return new helpers.web3.eth.Contract(
            await helpers.utils.getAbi(name),
            address
        );
    },
    async deployNewContractInstance(helpers, name, options) {
        // Load contract data from file
        const ContractData = await helpers.utils.getAbiFile(name);

        let from = accounts[0];
        let gas = helpers.networkConfig.gas;
        let gasPrice = helpers.networkConfig.gasPrice;

        if(options && options.from) {
            from = options.from;
        }

        if(options && options.gas) {
            gas = options.gas;
        }

        if(options && options.gasPrice) {
            gasPrice = options.gasPrice;
        }

        if(options && options.debug) {
            console.log("Deploying new contract ["+name+"]");
        }

        const deployArguments = {
            data: ContractData.bytecode
        }
        if(options && options.arguments) {
            deployArguments.arguments = options.arguments;
        }

        if(helpers.networkName == "coverage") {
            // override gas and gas price for coverage runs no matter what.
            gas = helpers.networkConfig.gas;
            gasPrice = helpers.networkConfig.gasPrice;
        }

        let ContractReceipt;
        const ContractInstance = await new helpers.web3Instance.eth.Contract(
            ContractData.abi,
            "0x0000000000000000000000000000000000000000"
        ).deploy(
            deployArguments
        ).send({
            from: from,
            gas: gas,
            gasPrice: gasPrice,
        }, function(error, transactionHash){
            if( error ) {
                console.log("error", error);
            }
        }).on('receipt', function(receipt){
            let Contract_address = receipt.contractAddress;
            ContractReceipt = receipt;
            if(options && options.debug) {
                console.log("New address: "+Contract_address);
            }
        });

        ContractInstance.receipt = ContractReceipt;
        return ContractInstance;
    },
    async showAccountBalances(helpers, accounts) {
        helpers.utils.toLog(logPre + " TestRPC Balances: ");
        for (let i = 0; i < accounts.length; i++) {
            let balance = await helpers.utils.getBalance(helpers, accounts[i]);
            helpers.utils.toLog(
                logPre +
                "["+i+"] "+accounts[i]+ ": "+ helpers.web3util.fromWei(balance, "ether")
            );
        }
    },
    async showContractBalance(helpers, contract) {
        helpers.utils.toLog("\n" + logPre + " Contract Balances: ");
        let balance = await helpers.utils.getBalance(helpers, contract.address.toString());
        helpers.utils.toLog(
            logPre +
            contract.address.toString()+ ": "+ helpers.web3util.fromWei(balance, "ether")
        );
    },
    toEth(helpers, amount) {
        return helpers.web3util.fromWei(amount, "ether");
    },
    async showGasUsage(helpers, tx, name) {
        helpers.utils.toLog(name + " GAS USAGE: " +
            helpers.utils.colors.purple +
            tx.receipt.cumulativeGasUsed
        );
    },
    async getGasPrice(helpers) {
        let stub = await helpers.getContract("EmptyStub");
        return stub.class_defaults.gasPrice;
    },
    async getGasUsage(helpers, tx, name) {
        return(name + "GAS USAGE: " +
            helpers.utils.colors.purple +
            tx.receipt.cumulativeGasUsed
        );
    },
    async measureCallExecution(Call, gas = true, options = {} ) {
        const startTime = process.hrtime();
        const item = await Call.call( options );
        const endTime = process.hrtime(startTime);
        const actualTime = endTime[0] + endTime[1] / 1000000000;
        let gasUsage = 0;
        if(gas) {
            gasUsage = await Call.estimateGas();
        }
        const callBinary = Call.encodeABI();
        return {
            data: item,
            gas: gasUsage,
            time: actualTime,
            bin: callBinary,
        }
    },
    async measureExecution(Call) {
        const startTime = process.hrtime();
        const item = await Call();
        const endTime = process.hrtime(startTime);
        const actualTime = endTime[0] + endTime[1] / 1000000000;

        return { item, actualTime }
    },
    resetAccountNonceCache(helpers) {
        helpers.web3Instance.currentProvider.engine._providers[1].nonceCache = {};
    },
    toFullToken(helpers, balance) {
        return helpers.web3util.fromWei(balance, "ether");
    },
    getCurrentGlobalUnlockRatio(helpers, currentBlock, BuyPhaseStartBlock, BuyPhaseEndBlock, precision) {

        currentBlock = new helpers.BN(currentBlock);
        BuyPhaseStartBlock = new helpers.BN(BuyPhaseStartBlock);
        BuyPhaseEndBlock = new helpers.BN(BuyPhaseEndBlock);
        BuyPhaseBlockCount = BuyPhaseEndBlock.sub(BuyPhaseStartBlock).add(new helpers.BN(1));

        precision = new helpers.BN(precision);

        if(currentBlock.gte(BuyPhaseStartBlock) && currentBlock.lte(BuyPhaseEndBlock)) {
            
            // get the number of blocks that have "elapsed" since the buyPhase start
            const passedBlocks = currentBlock.sub(BuyPhaseStartBlock).add(new helpers.BN(1));    // + 1 since we count current as well.
            const BuyPhaseBlockCount = new helpers.BN(BuyPhaseEndBlock).sub(BuyPhaseStartBlock).add(new helpers.BN("1"));
            return passedBlocks.mul(
                new helpers.BN("10").pow( new helpers.BN(precision) )
            ).div(BuyPhaseBlockCount);

        } else if (currentBlock.gt(BuyPhaseEndBlock)) {
            return new helpers.BN(1).mul(new helpers.BN("10").pow( new helpers.BN(precision)));
        } else {
            return new helpers.BN(0);
        }

    },
    calculatereservedTokensAtBlockForBoughtAmount(helpers, currentBlock, BuyPhaseStartBlock, BuyPhaseEndBlock, tokenAmount) {

        tokenAmount = new helpers.BN(tokenAmount);
        if (tokenAmount.gt( new helpers.BN("0") ) ) {
            if(currentBlock < BuyPhaseStartBlock) {
                // commit phase
                return tokenAmount;
            } else if(currentBlock < BuyPhaseEndBlock) {
                // buy phase
                const precision = new helpers.BN(20);
                const unlocked = tokenAmount.mul(
                    helpers.utils.getCurrentGlobalUnlockRatio(
                        helpers,
                        currentBlock,
                        BuyPhaseStartBlock,
                        BuyPhaseEndBlock,
                        precision
                    )
                ).div(
                    new helpers.BN("10").pow( precision )
                );
                return tokenAmount.sub(unlocked);
            } 
            // after buyPhase's end
            return new helpers.BN("0");
        }
        return new helpers.BN("0");
    },
    async getTokenAmountForEthAtStage(helpers, contract, ethValue, stageId) {
        const stageData = await contract.methods.stages(stageId).call();
        return new helpers.BN(ethValue.toString()).mul(
            new helpers.BN("10").pow( new helpers.BN("18") )
        ).div(
            new helpers.BN(stageData.tokenPrice)
        );
    },
    getTokenAmountForEthAtValue(helpers, ethValue, tokenPrice) {
        return new helpers.BN(ethValue.toString()).mul(
            new helpers.BN("10").pow( new helpers.BN("18") )
        ).div(
            new helpers.BN(tokenPrice)
        );
    },
    async jumpToContractStage ( contract, deployingAddress, stageId, end = false, addToBlockNumber = false ) {
        const stageData = await contract.methods.stages(stageId).call();
        let block = Number(stageData.startBlock);
        if(end) {
            block = Number(stageData.endBlock);
        }

        if(addToBlockNumber !== false) {
            block = parseInt(block) + parseInt(addToBlockNumber);
        }

        await contract.methods.jumpToBlockNumber(
            block
        ).send({
            from: deployingAddress, gas: 200000
        });

        return block;
    },
    async displayContributions(helpers, contract, participant_address, max = null, tokenContract = null) {

        
        let totalSentETH = await contract.methods.totalSentETH().call();
        let returnedETH = await contract.methods.returnedETH().call();
        let committedETH = await contract.methods.committedETH().call();
        let withdrawnETH = await contract.methods.withdrawnETH().call();
        let allocatedETH = await contract.methods._projectUnlockedETH().call();
        let projectWithdrawnETH = await contract.methods.projectWithdrawnETH().call();
        let ContractBalance = await helpers.utils.getBalance(helpers, contract.receipt.contractAddress);

        let ParticipantByAddress = await contract.methods.participants(participant_address).call();
        let ParticipantTotalStats = await contract.methods.participantAggregatedStats(participant_address).call();

        let StageCount = await contract.methods.stageCount().call();
        const contributions = ParticipantByAddress.contributions;
        const LockedBalance = await contract.methods.getParticipantReservedTokens(participant_address).call();

        let UnlockedBalance, BalanceOf;
        if(tokenContract !== null) {
            UnlockedBalance = await tokenContract.methods.getUnlockedBalance(participant_address).call();
            BalanceOf = await tokenContract.methods.balanceOf(participant_address).call();
        }

        console.log();
        console.log("Globals");
        console.log("Real Balance:             ", helpers.utils.toEth(helpers, ContractBalance.toString()) +" eth" );
        console.log("Total amount Received:    ", helpers.utils.toEth(helpers, totalSentETH.toString()) +" eth" );
        console.log("Total amount Returned:    ", helpers.utils.toEth(helpers, returnedETH.toString()) +" eth" );
        console.log("Total amount Committed:   ", helpers.utils.toEth(helpers, committedETH.toString()) +" eth" );
        console.log("Total amount Withdrawn:   ", helpers.utils.toEth(helpers, withdrawnETH.toString()) +" eth" );
        console.log("Total amount Allocated:   ", helpers.utils.toEth(helpers, allocatedETH.toString()) +" eth" );
        console.log("Project ETH Withdrawn:    ", helpers.utils.toEth(helpers, projectWithdrawnETH.toString()) +" eth" );

        console.log("Contributions for address:", participant_address);
        console.log("Count:                    ", contributions.toString());
        console.log("Total totalSentETH:       ", helpers.utils.toEth(helpers, ParticipantTotalStats.totalSentETH.toString())   +" eth" );
        console.log("Total returnedETH:        ", helpers.utils.toEth(helpers, ParticipantTotalStats.returnedETH.toString())    +" eth" );
        console.log("Total committedETH:       ", helpers.utils.toEth(helpers, ParticipantTotalStats.committedETH.toString())    +" eth" );
        console.log("Total withdrawnETH:       ", helpers.utils.toEth(helpers, ParticipantTotalStats.withdrawnETH.toString())   +" eth" );
        console.log("Total allocatedETH:       ", helpers.utils.toEth(helpers, ParticipantTotalStats.allocatedETH.toString())   +" eth" );
        console.log("Total pendingTokens:      ", helpers.utils.toEth(helpers, ParticipantTotalStats.pendingTokens.toString()) +" tokens" );
        console.log("Total reservedTokens:", helpers.utils.toEth(helpers, ParticipantTotalStats.reservedTokens.toString())   +" tokens" );
        console.log("Total returnedTokens:     ", helpers.utils.toEth(helpers, ParticipantTotalStats.returnedTokens.toString()) +" tokens" );
        console.log("Total allocatedTokens:    ", helpers.utils.toEth(helpers, ParticipantTotalStats.allocatedTokens.toString()) +" tokens" );
        console.log("Locked Token Balance:     ", helpers.utils.toEth(helpers, LockedBalance.toString()) +" tokens" );

        if(tokenContract !== null) {
            console.log("Unlocked Token Balance:   ", helpers.utils.toEth(helpers, UnlockedBalance.toString()) +" tokens" );
            console.log("Total Token Balance:      ", helpers.utils.toEth(helpers, BalanceOf.toString()) +" tokens" );
        }
        
        if(max > 0) {
            StageCount = max;
        }

        for(let i = 0; i < StageCount; i++) {
            const ParticipantStageDetails = await contract.methods.getParticipantDetailsByStage(participant_address, i).call();
            console.log("-------------------------------------------");
            console.log("stageId:           ", i);
            console.log("totalSentETH:        ", helpers.utils.toEth(helpers,ParticipantStageDetails.stagetotalSentETH.toString() )   +" eth" );
            console.log("reservedTokens: ", helpers.utils.toEth(helpers,ParticipantStageDetails.stageTotalReservedTokens.toString() )   +" tokens" );
            console.log("returnedETH:         ", helpers.utils.toEth(helpers,ParticipantStageDetails.stageReturnedETH.toString() )    +" eth" );
            console.log("committedETH:        ", helpers.utils.toEth(helpers,ParticipantStageDetails.stageCommittedETH.toString() )    +" eth" );
            console.log("withdrawnETH:        ", helpers.utils.toEth(helpers,ParticipantStageDetails.stageWithdrawnETH.toString() )   +" eth" );
            console.log("allocatedETH:        ", helpers.utils.toEth(helpers,ParticipantStageDetails.stageAllocatedETH.toString() )   +" eth" );
            console.log("pendingTokens:       ", helpers.utils.toEth(helpers,ParticipantStageDetails.stagePendingTokens.toString() ) +" tokens" );
            console.log("returnedTokens:      ", helpers.utils.toEth(helpers,ParticipantStageDetails.stageReturnedTokens.toString() ) +" tokens" );
            console.log("allocatedTokens:     ", helpers.utils.toEth(helpers,ParticipantStageDetails.stageAllocatedTokens.toString() )   +" tokens" );
        }

        console.log("\n");
    },
    async getEthAmountForTokensAtStage(helpers, contract, token_amount, stage_id) {
        // get stage pricing
        let stageData = await contract.methods.stages(stage_id).call();
        return token_amount.mul(
            new helpers.BN(stageData.tokenPrice)
        ).div(
            new helpers.BN("10").pow(
                new helpers.BN("18")
            )
        );
    },
    async getAvailableEthAndTokensForWithdraw(helpers, contract, _from, _returned_token_amount) {

        let _returnedTokenAmount = new helpers.BN(_returned_token_amount);

        let returnValues = {
            eth: new helpers.BN("0"),
            project_allocated_eth: new helpers.BN("0"),
            initial_tokens: _returnedTokenAmount,
            returned_tokens: new helpers.BN("0"),
            withdrawn_tokens:  new helpers.BN("0"),
        };

        const maxLocked = new helpers.BN( await contract.methods.getParticipantReservedTokens(_from).call() );
        const participantStats = await contract.methods.participants(_from).call();
        const currentStageNumber = await contract.methods.getCurrentStage().call();
        const pow20 = new helpers.BN(10).pow(new helpers.BN(20));


        if(maxLocked > 0) {

            // Contributors can send more tokens than they have locked,
            // thus make sure we only try to return for said amount
            let RemainingTokenAmount = _returnedTokenAmount;
            let ReturnTokenAmount = new helpers.BN("0");

            // if returned amount is greater than the locked amount...
            // set it equal to locked, keep track of the overflow tokens (remainingTokenAmount)
            if(RemainingTokenAmount.gt(maxLocked)) {
                ReturnTokenAmount = RemainingTokenAmount.sub(maxLocked);
                RemainingTokenAmount = maxLocked;
            }

            // decrease the total allocated ETH by the equivalent participant's allocated amount
            // _projectUnlockedETH = _projectUnlockedETH.sub(ParticipantRecord.allocatedETH);

            if(RemainingTokenAmount.gt( new helpers.BN("0") )) {

                if(currentStageNumber === '0') {

                    ReturnETHAmount = new helpers.BN(await contract.methods.getEthAmountForTokensAtStage(RemainingTokenAmount.toString(), "0").call());

                    // For any other stage, calculate the avg price of all contributions
                } else {
                    ReturnETHAmount = new helpers.BN(participantStats.committedETH).mul(
                        RemainingTokenAmount.mul(pow20)
                        .div(new helpers.BN(participantStats.reservedTokens))
                    ).div(pow20);
                }

                returnValues.eth = ReturnETHAmount;
                // returnValues.project_allocated_eth = allocatedEthAmount;
                returnValues.withdrawn_tokens = _returnedTokenAmount.sub(ReturnTokenAmount);
                returnValues.returned_tokens = ReturnTokenAmount;

                return returnValues;
            }
            return returnValues;
        }
        return returnValues;

    }

};
