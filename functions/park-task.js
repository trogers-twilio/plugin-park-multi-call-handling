const TokenValidator = require('twilio-flex-token-validator').functionValidator;
const Twilio = require('twilio');

exports.handler = TokenValidator(function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS POST');
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { taskSid, targetWorker, worker } = event;

  // TODO: This function will spawn a new task in the Park queue for the
  // target worker, optionally with an attribute that prevents assignment
  // until the worker indicates they are ready to receive it if the target
  // worker is the worker parking the task.

  response.setBody(JSON.stringify({ success: true }));
  callback(null, response);
});
