const TokenValidator = require('twilio-flex-token-validator').functionValidator;
const Twilio = require('twilio');

const AssignmentStatuses = {
  pending: 'pending'
};

const syncMapSuffix = 'ParkedTasks';

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

const getSyncMapClient = (client, context, syncMapName) => {
  const syncClient = client.sync.services(context.TWILIO_SYNC_SERVICES_SID);
  const syncMapClient = syncClient.syncMaps(syncMapName);
  return syncMapClient;
};

const getSyncMap = async (syncMapClient, syncMapName) => {
  try {
    console.log('Retrieving Sync Map', syncMapName);
    const syncMap = await syncMapClient.fetch();
    if (syncMap.uniqueName === syncMapName) {
      return syncMap;
    }
    return undefined;
  } catch (error) {
    console.error('Failed to retrieve sync map.');
    return undefined;
  }
};

const createSyncMap = async (client, context, syncMapName) => {
  const syncClient = client.sync.services(context.TWILIO_SYNC_SERVICES_SID);
  console.log('Creating Sync Map', syncMapName);
  try {
    const syncMap = await syncClient.syncMaps.create({
      uniqueName: syncMapName,
      ttl: 86400
    });
    console.log('Sync Map created.');
    return syncMap;
  } catch (error) {
    console.error('Error creating Sync Map.');
    return undefined;
  }
};

const getSyncMapItems = async (syncMapClient) => {
  console.log('Retrieving all Sync Map Items');
  try {
    const syncMapItems = await syncMapClient.syncMapItems.list({ limit: 100 });
    console.log('Retrieved all Sync Map Items.');
    return syncMapItems;
  } catch (error) {
    console.error('Error getting all Sync Map Items.');
    return undefined;
  }
};

const getSyncMapItem = async (syncMapClient, itemKey) => {
  console.log('Retrieving Sync Map Item', itemKey);
  try {
    const syncMapItem = await syncMapClient.syncMapItems(itemKey).fetch();
    console.log('Retrieved Sync Map Item.');
    return syncMapItem;
  } catch (error) {
    console.error('Error getting Sync Map Item.');
    return undefined;
  }
};

const createSyncMapItem = async (syncMapClient, itemKey, itemValue) => {
  console.log('Creating Sync Map Item', itemKey);
  try {
    const syncMapItem = await syncMapClient.syncMapItems.create({
      key: itemKey,
      data: itemValue
    });
    console.log('Sync Map Item created.');
    return syncMapItem;
  } catch (error) {
    console.error('Error creating Sync Map Item.');
    return undefined;
  }
};

const updateSyncMapItem = async (syncMapClient, itemKey, itemValue) => {
  console.log('Updating sync map item', itemKey);
  try {
    const syncMapItem = await syncMapClient.syncMapItems(itemKey).update({
      data: itemValue
    });
    console.log('Sync Map Item updated.');
    return syncMapItem;
  } catch (error) {
    console.error('Error updating Sync Map Item.');
    return undefined;
  }
};

const deleteSyncMapItem = async (syncMapClient, itemKey) => {
  console.log('Deleting Sync Map Item', itemKey);
  try {
    await syncMapClient.syncMapItems(itemKey).remove();
    console.log('Sync Map Item deleted');
  } catch (error) {
    console.error('Error deleting Sync Map Item.');
  }
};

const getParkedTasks = async (client, context, workerSid) => {
  const taskQueueName = context.TWILIO_PARK_TASKQUEUE_NAME;
  let parkedTasks;
  try {
    parkedTasks = await client.taskrouter
      .workspaces(context.TWILIO_WORKSPACE_SID)
      .tasks
      .list({
        taskQueueName,
        evaluateTaskAttributes: `targetWorker == "${workerSid}"`
      });
    console.log('Retrieved parked tasks');
    return parkedTasks;
  } catch (error) {
    console.error(`Error listing tasks in queue ${taskQueueName}`);
    return undefined;
  }
};

const getPendingParkedTasks = async (client, context, workerSid) => {
  const parkedTasks = await getParkedTasks(client, context, workerSid);

  const pendingParkedTasks = [];
  parkedTasks.forEach((task) => {
    const {
      assignmentStatus,
      attributes,
      dateCreated,
      sid
    } = task;
    if (assignmentStatus === AssignmentStatuses.pending) {
      const pendingTask = {
        sid,
        dateCreated,
        attributes
      };
      pendingParkedTasks.push(pendingTask);
    }
  });
  return pendingParkedTasks;
};

const clearSyncMap = async (syncMapClient) => {
  const syncMapItems = await getSyncMapItems(syncMapClient);
  const syncPromises = [];
  syncMapItems.forEach(async item => {
    syncPromises.push(deleteSyncMapItem(syncMapClient, item.key));
  });
  await Promise.all(syncPromises);
};

const pushParkedTasksToSync = async (syncMapClient, pendingParkedTasks) => {
  console.log('Pushing parked tasks to sync map');
  const syncPromises = [];
  pendingParkedTasks.forEach(task => {
    const itemKey = task.sid;
    const itemValue = {
      ...task
    };
    syncPromises.push(createSyncMapItem(syncMapClient, itemKey, itemValue));
  });
  await Promise.all(syncPromises);
};

const syncParkedTasks = async (client, context, workerSid) => {
  const syncMapName = `${workerSid}.${syncMapSuffix}`;
  const syncMapClient = getSyncMapClient(client, context, syncMapName);

  const isSyncMapCreated = !!await getSyncMap(syncMapClient, syncMapName);
  if (!isSyncMapCreated) {
    await createSyncMap(client, context, syncMapName);
  } else {
    await clearSyncMap(syncMapClient);
  }

  const pendingParkedTasks = await getPendingParkedTasks(client, context, workerSid);
  await pushParkedTasksToSync(syncMapClient, pendingParkedTasks);
};

exports.handler = TokenValidator(async function (context, event, callback) {
  const client = Twilio(context.ACCOUNT_SID, context.AUTH_TOKEN);
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS POST');
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { workerSid } = event;

  try {
    await syncParkedTasks(client, context, workerSid);
    console.log('Synced parked tasks');
  } catch (error) {
    const message = ('Error syncing parked tasks.', error);
    return errorHandler(error, message, response);
  }

  response.setBody(JSON.stringify({ success: true }));
  return callback(null, response);
});
