const TokenValidator = require('twilio-flex-token-validator').functionValidator;
const Twilio = require('twilio');

const SegmentTypes = {
  park: 'park',
  transfer: 'transfer'
};

const SidPrefixes = {
  worker: 'WK',
  queue: 'WQ'
};

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

const handleParkTask = async (context, event, callback, client, response, task) => {
  const { requestingWorker, target, taskSid } = event;

  const taskAttributes = JSON.parse(task.attributes);
  const taskChannel = task.taskChannelUniqueName;
  const taskQueue = task.taskQueueFriendlyName;

  const parkedTaskAttributes = {
    ...taskAttributes,
    autoAnswer: true,
    autoCompleteTask: undefined,
    holdAssignment: requestingWorker === target,
    selfPark: requestingWorker === target,
    targetWorker: target,
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
};

const getTaskQueueName = async (client, workspaceSid, taskQueueSid) => {
  let taskQueue;
  try {
    taskQueue = await client.taskrouter
      .workspaces(workspaceSid)
      .taskQueues(taskQueueSid)
      .fetch();
    console.log('Retrieved TaskQueue:', taskQueue);
    return taskQueue.friendlyName;
  } catch (error) {
    console.error('Error retrieving TaskQueue', taskQueueSid, error);
    return undefined;
  }
};

const handleTransferTask = async (context, event, callback, client, response, task) => {
  const { target, taskSid } = event;
  const {
    TWILIO_WORKSPACE_SID: workspaceSid,
    TWILIO_TRANSFER_WORKFLOW_SID: transferWorkflowSid
  } = context;

  const taskAttributes = JSON.parse(task.attributes);
  const taskChannel = task.taskChannelUniqueName;
  const taskQueue = task.taskQueueFriendlyName;

  const transferTaskAttributes = {
    ...taskAttributes
  };

  const targetSidPrefix = target && target.slice(0, 2);
  switch (targetSidPrefix) {
    case SidPrefixes.queue: {
      const targetTaskQueueName = await getTaskQueueName(client, workspaceSid);
      transferTaskAttributes.targetQueue = targetTaskQueueName;
      transferTaskAttributes.conversations = {
        ...transferTaskAttributes.conversations,
        queue: targetTaskQueueName
      };
      break;
    }
    case SidPrefixes.worker: {
      transferTaskAttributes.targetWorker = target;
      transferTaskAttributes.conversations = {
        ...transferTaskAttributes.conversations,
        queue: taskQueue
      };
      break;
    }
    default: {
      const message = `Unhandled targetSidPrefix ${targetSidPrefix}`;
      return errorHandler(null, message, response, callback);
    }
  }

  if (!transferTaskAttributes.conversations.conversation_id) {
    transferTaskAttributes.conversations.conversation_id = taskSid;
  }
  let transferTask;
  try {
    transferTask = await client.taskrouter
      .workspaces(workspaceSid)
      .tasks
      .create({
        workflowSid: transferWorkflowSid,
        taskChannel,
        attributes: JSON.stringify(transferTaskAttributes),
        priority: 1000
      });
    console.log('Created transfer task, SID', transferTask.sid);
  } catch (error) {
    const message = ('Error creating transfer task.', error);
    return errorHandler(error, message, response, callback);
  }

  const transferTaskSid = transferTask.sid;
  response.setBody(JSON.stringify({ success: true, transferTaskSid }));
  return callback(null, response);
};

exports.handler = TokenValidator(async function (context, event, callback) {
  const {
    ACCOUNT_SID: accountSid,
    AUTH_TOKEN: authToken,
    TWILIO_WORKSPACE_SID: workspaceSid
  } = context;
  const client = Twilio(accountSid, authToken);
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS POST');
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');

  const {
    taskSid,
    segmentType
  } = event;

  let task;
  try {
    task = await client.taskrouter
      .workspaces(workspaceSid)
      .tasks(taskSid)
      .fetch();
  } catch (error) {
    const message = (`Error fetching task SID ${taskSid}.`, error);
    return errorHandler(error, message, response, callback);
  }

  switch (segmentType) {
    case SegmentTypes.park:
      return handleParkTask(context, event, callback, client, response, task);
    case SegmentTypes.transfer:
      return handleTransferTask(context, event, callback, client, response, task);
    default: {
      const message = `Unhandled segmentType ${segmentType}`;
      return errorHandler(null, message, response, callback);
    }
  }
});
