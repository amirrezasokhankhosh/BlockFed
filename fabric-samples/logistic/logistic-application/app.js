'use strict';


const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const jsonParser = bodyParser.json();
const port = 3000;

const crypto = require("crypto");
const grpc = require("@grpc/grpc-js");
const {connect, Contract, Identity, Signer, signers} = require("@hyperledger/fabric-gateway");
const fs = require("fs/promises");
const path = require("path");
const {TextDecoder} = require("util");

const channelName = "mychannel";
const chaincodeName = "logistic";
const mspId = "Org1MSP";

const cryptoPath = path.resolve(__dirname, '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com');
const keyDirPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
const certPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'User1@org1.example.com-cert.pem');
const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');

const peerEndPoint = "localhost:7051";
const peerHostAlias = "peer0.org1.example.com";

const contract = InitConnection();
const utf8Decoder = new TextDecoder();

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndPoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity() {
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner() {
    const files = await fs.readdir(keyDirPath);
    const keyPath = path.resolve(keyDirPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

async function InitConnection() {
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 500000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 1500000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 500000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 6000000 }; // 1 minute
        },
    });

    const network = gateway.getNetwork(channelName);

    return network.getContract(chaincodeName);
}

async function initLedger(contract, numClients) {
    try {
        await (await contract).submitTransaction('InitLedger', numClients.toString());
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

async function getAllParams(contract) {
    try {
        const paramsBinary = await (await contract).evaluateTransaction("GetAllParams");
        const paramString = utf8Decoder.decode(paramsBinary);
        return JSON.parse(paramString);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

async function readParam(contract, id) {
    try {
        const paramBinary = await (await contract).evaluateTransaction("ReadParam", id);
        const paramString = utf8Decoder.decode(paramBinary);
        return JSON.parse(paramString);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

async function createParam(contract, id, W, b) {
    try {
        const paramBinary = await (await contract).submitTransaction("CreateParam", id, JSON.stringify(W), JSON.stringify(b));
        const paramString = utf8Decoder.decode(paramBinary);
        return JSON.parse(paramString)
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

async function updateParam(contract, id, W, b) {
    try {
        const oldParamBinary = await (await contract).submitTransaction("UpdateParam", id, JSON.stringify(W), JSON.stringify(b));
        const oldParamString = utf8Decoder.decode(oldParamBinary);
        return JSON.parse(oldParamString);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

async function deleteParam(contract, id) {
    try {
        await (await contract).submitTransaction("DeleteParam", id);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

async function getParamsByRound(contract, round, num_clients) {
    try {
        const paramsBinary = await (await contract).evaluateTransaction("GetParamsByRound", round.toString(), num_clients.toString());
        const paramString = utf8Decoder.decode(paramsBinary);
        return JSON.parse(paramString);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

async function getRound(contract, id) {
    try {
        const roundBinary = await (await contract).evaluateTransaction("GetRound");
        return utf8Decoder.decode(roundBinary);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

async function updateGlobal(contact) {
    try {
        const paramBinary = await (await contract).submitTransaction("UpdateGlobal");
        const paramString = utf8Decoder.decode(paramBinary);
        return JSON.parse(paramString);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

app.get('/', (req, res) => {
    res.send("Hello World");
});

app.post('/ledger', jsonParser, async (req, res) => {
    await initLedger(contract, req.body.numClients);
    res.send("Ledger was initialized successfully.");
});

app.get('/params', jsonParser, async (req, res) => {
    let params = NaN;
    if (!req.body.round){
        params = await getAllParams(contract);
    } else {
        params = await getParamsByRound(contract, req.body.round, req.body.num_clients);
    }
    res.send(params);
});

app.get('/param', jsonParser, async (req, res) => {
    const param = await readParam(contract, req.body.id);
    res.send(param)
});

app.post('/param', jsonParser, async (req, res) => {
    const param = await createParam(contract, req.body.id, req.body.W, req.body.b);
    res.send(param);
});

app.put('/param', jsonParser, async (req, res) => {
    const oldParam = await updateParam(contract, req.body.id, req.body.W, req.body.b);
    res.send(oldParam);
});

app.delete('/param', jsonParser, async (req, res) => {
    await deleteParam(contract, req.body.id);
    res.send("Transaction was successfully submitted.");
});

app.get('/round', jsonParser, async (req, res) => {
    const round = await getRound(contract);
    res.send(round)
});

app.post('/update', async (req, res) => {
    const param = await updateGlobal(contract);
    res.send(param);
});

app.listen(port, () => {
    console.log(`Connection established at port ${port}.`)
});
