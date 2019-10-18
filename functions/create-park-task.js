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

  const { requestingWorker, taskSid, targetWorker } = event;

  let task;
  try {
    task = await client.taskrouter
      .workspaces(context.TWILIO_WORKSPACE_SID)
      .tasks(taskSid)
      .fetch();
  } catch (error) {
    const message = (`Error fetching task SID ${taskSid}.`, error);
    return errorHandler(error, message, response, callback);
  }
  const taskAttributes = JSON.parse(task.attributes);
  const taskChannel = task.taskChannelUniqueName;
  const taskQueue = task.taskQueueFriendlyName;

  const parkedTaskAttributes = {
    ...taskAttributes,
    autoAnswer: true,
    autoCompleteTask: undefined,
    holdAssignment: requestingWorker === targetWorker,
    selfPark: requestingWorker === targetWorker,
    targetWorker,
    conversations: {
      ...taskAttributes.conversations,
      queue_time: 0
    }
  };
  if (!parkedTaskAttributes.conversations.queue) {
    // Overriding the queue name for reporting purposes, so each
    // park segment shows as being in the original queue even though
    // it's in a separate park queue
    parkedTaskAttributes.conversations.queue = taskQueue;
  }
  if (!parkedTaskAttributes.conversations.conversation_id) {
    parkedTaskAttributes.conversations.conversation_id = taskSid;
  }
  let parkedTask;
  try {
    parkedTask = await client.taskrouter
      .workspaces(context.TWILIO_WORKSPACE_SID)
      .tasks
      .create({
        workflowSid: context.TWILIO_PARK_WORKFLOW_SID,
        taskChannel,
        attributes: JSON.stringify(parkedTaskAttributes),
        priority: 1000
      });
    console.log('Created parked task, SID', parkedTask.sid);
  } catch (error) {
    const message = ('Error creating parked task.', error);
    return errorHandler(error, message, response, callback);
  }

  const parkedTaskSid = parkedTask.sid;
  response.setBody(JSON.stringify({ success: true, parkedTaskSid }));
  return callback(null, response);
});
