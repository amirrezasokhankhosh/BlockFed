'use strict';


const stringify  = require('json-stringify-deterministic');
const sortKeysRecursive  = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');
const roundInfoId = "round_info";


class ParamContract extends Contract {
    async InitLedger(ctx, numClients) {
        const params = {
            id : "global_0",
            W : [0.1, 0.1],
            b : 0
        };

        const round_info = {
            id : roundInfoId,
            currRound : 1,
            remaining : JSON.parse(numClients),
            numClients : JSON.parse(numClients)
        };

        await ctx.stub.putState(params.id, Buffer.from(stringify(sortKeysRecursive(params))));
        await ctx.stub.putState(round_info.id, Buffer.from(stringify(sortKeysRecursive(round_info))));
    }

    async GetAllParams(ctx) {
        const allResults = [];
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

    async ParamExists(ctx, id) {
        const param = await ctx.stub.getState(id);
        return param && param.length > 0;
    }

    async CreateParam(ctx, id, W, b) {
        const exists = await this.ParamExists(ctx, id);
        if (exists) {
            throw new Error(`A parameter with id ${id} already exists`);
        }

        const param = {
            id : id,
            W : JSON.parse(W),
            b : JSON.parse(b)
        };

        const roundInfoBytes = await ctx.stub.getState(roundInfoId);
        const roundInfo = JSON.parse(roundInfoBytes.toString());
        roundInfo.remaining--;

        await ctx.stub.putState(param.id, Buffer.from(stringify(sortKeysRecursive(param))));
        await ctx.stub.putState(roundInfo.id, Buffer.from(stringify(sortKeysRecursive(roundInfo))));

        if (roundInfo.remaining === 0) {
            await this.UpdateGlobal(ctx, param);
        }

        return JSON.stringify(param);
    }

    async UpdateParam(ctx, id, W, b) {
        const paramBytes = await ctx.stub.getState(id);
        if (!paramBytes || paramBytes.length === 0) {
            throw new Error(`A parameter with id ${id} does not exist!`);
        }

        const newParam = {
            id : id,
            W : JSON.parse(W),
            b : JSON.parse(b)
        };

        await ctx.stub.putState(newParam.id, Buffer.from(stringify(sortKeysRecursive(newParam))));

        return paramBytes.toString();
    }

    async DeleteParam(ctx, id) {
        const exists = await this.ParamExists(ctx, id);
        if (!exists) {
            throw new Error(`A parameter with id ${id} does not exist.`);
        }
        await ctx.stub.deleteState(id);
    }

    async ReadParam(ctx, id) {
        const paramBytes = await ctx.stub.getState(id);
        if (!paramBytes && paramBytes.length === 0) {
            throw new Error(`A parameter with id ${id} does not exist.`);
        }
        return paramBytes.toString();
    }

    async GetRound(ctx) {
        const roundInfoBytes = await ctx.stub.getState(roundInfoId);
        return JSON.parse(roundInfoBytes.toString()).currRound.toString();
    }

    async UpdateGlobal(ctx, last_param) {
        let roundInfoBytes = await ctx.stub.getState(roundInfoId);
        let roundInfo = JSON.parse(roundInfoBytes.toString());

        let W = [0, 0];
        let b = 0;
        for (let i = 0 ; i < roundInfo.numClients; i++) {
            let temp_id = `local_${roundInfo.currRound}_${i + 1}`
            if (temp_id !== last_param.id) {
                let paramBytes = await ctx.stub.getState(`local_${roundInfo.currRound}_${i + 1}`);
                let param = JSON.parse(paramBytes.toString());
                b = b + param.b;
                for (let j = 0 ; j < W.length ; j ++) {
                    W[j] = W[j] + param.W[j];
                }
            } else {
                b = b + last_param.b;
                for (let j = 0 ; j < W.length ; j ++) {
                    W[j] = W[j] + last_param.W[j];
                }
            }
        }

        for (let i = 0 ; i < W.length ; i ++) {
            W[i] = W[i] / roundInfo.numClients;
        }
        b = b / roundInfo.numClients;

        const newGlobal = {
            id : `global_${roundInfo.currRound}`,
            W : W,
            b : b,
        }

        const newRoundInfo = {
            id : roundInfo.id,
            currRound : roundInfo.currRound + 1,
            remaining : roundInfo.numClients,
            numClients : roundInfo.numClients
        };

        // await ctx.stub.putState(newGlobal.id, Buffer.from(stringify(sortKeysRecursive(newGlobal))));
        await ctx.stub.putState(newRoundInfo.id, Buffer.from(stringify(sortKeysRecursive(newRoundInfo))));
        await ctx.stub.putState(newGlobal.id, Buffer.from(stringify(sortKeysRecursive(newGlobal))));

        return JSON.stringify(newGlobal);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}

module.exports = ParamContract;