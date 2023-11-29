'use strict';

const patientTransfer = require('./lib/patientTransfer');

module.exports.PatientTransfer = patientTransfer;
module.exports.contracts = [patientTransfer]