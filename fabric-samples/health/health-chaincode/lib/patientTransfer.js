'use strict';


const stringify  = require('json-stringify-deterministic');
const sortKeysRecursive  = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');


class PatientTransfer extends Contract {
    
    async InitLedger(ctx) {
        const patients = [
            {
                id : "1",
                name : "Amirreza Sokhankhosh",
                illness : "Cold",
                hospital : "H1"
            },
            {
                id : "2",
                name : "Hasti Khajeh",
                illness : "Headache",
                hospital : "H1"
            },
            {
                id : "3",
                name : "Harry Potter",
                illness : "Headache",
                hospital : "H2"
            }
        ];

        for (const patient of patients) {
            await ctx.stub.putState(patient.id, Buffer.from(stringify(sortKeysRecursive(patient))));
        }
    }

    async PatientExists(ctx, id) {
        const patient = await ctx.stub.getState(id);
        return patient && patient.length > 0;
    }

    async CreatePatient(ctx, id, name, illness, hospital) {
        const exists = await this.PatientExists(ctx, id);

        if (exists) {
            throw new Error(`A patient with id ${id} already exists`);
        }

        const patient = {
            id : id,
            name : name,
            illness : illness,
            hospital : hospital
        };

        await ctx.stub.putState(patient.id, Buffer.from(stringify(sortKeysRecursive(patient))))

        return JSON.stringify(patient);
    }


    async UpdatePatient(ctx, id, name, illness, hospital) {
        const patientJSON = await ctx.stub.getState(id);
        if (!patient || patient.length === 0) {
            throw new Error(`A patient with id ${id} does not exist!`);
        }

        const newPatient = {
            id : id,
            name : name,
            illness : illness,
            hospital : hospital
        };

        await ctx.stub.putState(newPatient.id, Buffer.from(stringify(sortKeysRecursive(newPatient))));

        return patientJSON.toString()
    }

    async DeletePatient(ctx, id) {
        const exists = await this.PatientExists(ctx, id);
        if (!exists) {
            throw new Error(`A patient with id ${id} does not exist.`);
        }
        await ctx.stub.deleteState(id);
    }

    async ReadPatient(ctx, id) {
        const patientJSON = await ctx.stub.getState(id);
        if (!patientJSON && patientJSON.length === 0) {
            throw new Error(`A patient with id ${id} does not exist.`);
        }
        return patientJSON.toString()
    }

    async TransferPatient(ctx, id, hospital) {
        const patientString = await this.ReadPatient(ctx, id);
        const patient = JSON.parse(patientString);
        const oldHospital = patient.hospital;
        patient.hospital = hospital;
        await ctx.stub.putState(patient.id, Buffer.from(stringify(sortKeysRecursive(patient))));
        return oldHospital;
    }

    async GetAllPatients(ctx) {
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
}

module.exports = PatientTransfer;   