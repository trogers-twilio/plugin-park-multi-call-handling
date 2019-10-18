const TokenValidator = require('twilio-flex-token-validator').functionValidator;
const Twilio = require('twilio');

const errorHandler = (error, message, response, callback) => {
  console.error(message);
  const responseBody = {
    success: false,
    message
  };
  response.setBody(JSON.stringify(responseBody));
  response.setStatusCode((error && error.status) || 500);
  return callback(null, response);
};

exports.handler = TokenValidator(async function (context, event, callback) {
  const client = Twilio(context.ACCOUNT_SID, context.AUTH_TOKEN);
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS POST');
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { taskSid, attributes } = event;

  let task;
  try {
    task = await client.taskrouter
      .workspaces(context.TWILIO_WORKSPACE_SID)
      .tasks(taskSid)
      .update({
        attributes
      });
  } catch (error) {
    const message = (`Error updating task SID ${taskSid}.`, error);
    return errorHandler(error, message, response, callback);
  }
  const taskAttributes = JSON.parse(task.attributes);

  response.setBody(JSON.stringify({
    success: true,
    taskSid,
    attributes: taskAttributes
  }));
  return callback(null, response);
});
