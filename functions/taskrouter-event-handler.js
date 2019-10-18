const workerParkSyncMapSuffix = 'ParkedTasks';

const successHandler = (callback, props) => {
  const response = {
    ...props,
    status: 200
  };
  return callback(null, response);
};

const getSyncMapClient = (context, syncMapName) => {
  const client = context.getTwilioClient();
  const syncClient = client.sync.services(context.TWILIO_SYNC_SERVICES_SID);
  const syncMapClient = syncClient.syncMaps(syncMapName);
  return syncMapClient;
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
    throw error;
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

const handleNewParkTask = async (context, event, callback) => {
  const { TaskAttributes, TaskDateCreated, TaskSid } = event;
  const dateCreated = new Date(TaskDateCreated * 1000);
  console.log('dateCreated:', dateCreated);

  const attributes = TaskAttributes && JSON.parse(TaskAttributes);
  const workerSid = attributes && attributes.targetWorker;

  const syncMapName = `${workerSid}.${workerParkSyncMapSuffix}`;
  const syncMapClient = getSyncMapClient(context, syncMapName);
  const itemKey = TaskSid;
  const itemValue = {
    sid: TaskSid,
    attributes,
    dateCreated
  };
  await createSyncMapItem(syncMapClient, itemKey, itemValue);
  return successHandler(callback);
};

const removeParkedTask = async (context, event, callback) => {
  const { TaskAttributes, TaskSid } = event;
  const attributes = TaskAttributes && JSON.parse(TaskAttributes);
  const workerSid = attributes && attributes.targetWorker;

  const syncMapName = `${workerSid}.${workerParkSyncMapSuffix}`;
  const syncMapClient = getSyncMapClient(context, syncMapName);
  const itemKey = TaskSid;

  await deleteSyncMapItem(syncMapClient, itemKey);
  return successHandler(callback);
};

const handleTaskCreated = (context, event, callback) => {
  const { TaskQueueName } = event;

  switch (TaskQueueName) {
    case context.TWILIO_PARK_TASKQUEUE_NAME:
      return handleNewParkTask(context, event, callback);
    default:
      // nothing to do here
  }

  return successHandler(callback);
};

const handleTaskCanceled = (context, event, callback) => {
  const { TaskQueueName } = event;

  switch (TaskQueueName) {
    case context.TWILIO_PARK_TASKQUEUE_NAME:
      return removeParkedTask(context, event, callback);
    default:
      // nothing to do here
  }

  return successHandler(callback);
};

const handleReservationCreated = (context, event, callback) => {
  const { TaskQueueName } = event;

  switch (TaskQueueName) {
    case context.TWILIO_PARK_TASKQUEUE_NAME:
      return removeParkedTask(context, event, callback);
    default:
      // nothing to do here
  }

  return successHandler(callback);
};

exports.handler = async function(context, event, callback) {
  const { EventType, TaskQueueName } = event;
  console.log('EventType:', EventType);
  console.log('TaskQueueName:', TaskQueueName);

  switch (EventType) {
    case 'task.created':
      return handleTaskCreated(context, event, callback);
    case 'reservation.created':
      return handleReservationCreated(context, event, callback);
    case 'task.canceled':
      return handleTaskCanceled(context, event, callback);
    default:
      // nothing to do here
  }

  return successHandler(callback);
};
