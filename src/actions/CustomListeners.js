import { Actions, Manager, TaskHelper } from '@twilio/flex-ui';
import ParkTaskState from '../states/ParkTaskState';
import FlexState from '../states/FlexState';
import { ConferenceListenerManager } from '../states/ConferencesState';
import { ReservationEvents, SyncClientTypes } from '../utils/enums';
import TaskService from '../services/TaskService';

const manager = Manager.getInstance();

// START CCIS-3794: TR SDK fires duplicate events after network connection drop
const uniqueReservationEvents = {};
const hasReservationEvent = (sid, event) => {
  return uniqueReservationEvents[sid] && !!uniqueReservationEvents[sid][event];
};
const saveReservationEvent = (sid, event) => {
  if (hasReservationEvent(sid, event)) {
    console.debug('duplicate reservation event', event, sid);
    return false;
  }

  uniqueReservationEvents[sid] = uniqueReservationEvents[sid] || {};
  uniqueReservationEvents[sid][event] = true;

  return true;
};
// END CCIS-3794

const reservationListeners = new Map();

const stopReservationListeners = (reservation) => {
  const listeners = reservationListeners.get(reservation);
  if (listeners) {
    listeners.forEach(listener => {
      reservation.removeListener(listener.event, listener.callback);
    });
    reservationListeners.delete(reservation);
  }
};

export const handleNewReservation = (reservation) => {
  console.debug('new reservation', reservation);
  initReservationListeners(reservation);
  const { sid } = reservation;
  const task = TaskHelper.getTaskByTaskSid(sid);
  const { attributes } = task;
  const { conversations, direction } = attributes;
  const originalTaskSid = conversations && conversations.conversation_id;
  const listenerTaskSid = originalTaskSid || task.taskSid;
  const syncClientType = (direction && direction === 'outbound')
    ? SyncClientTypes.sync
    : SyncClientTypes.insights;

  if (TaskHelper.isCallTask(task) && originalTaskSid) {
    console.debug('starting custom conference listener');
    ConferenceListenerManager.startListening(
      task,
      `worker${task.sid}`,
      syncClientType,
      listenerTaskSid
    );
  }
};

const handleReservationCreated = (reservation) => {
  handleNewReservation(reservation);
  const { sid } = reservation;
  const task = TaskHelper.getTaskByTaskSid(sid);
  const { attributes } = task;

  if (attributes && attributes.autoAnswer) {
    Actions.invokeAction('AcceptTask', { task });
    Actions.invokeAction('SelectTask', { sid });
  }
};

const handleReservationWrapup = async (reservation) => {
  console.debug('wrapup reservation', reservation);
  const task = reservation.task || reservation;
  const { attributes, age } = task;
  const {
    autoCompleteTask,
    conversations,
    selfPark
  } = attributes;
  console.debug('task age at wrapup', age);
  const holdTime = (conversations && conversations.hold_time) || 0;

  if (selfPark) {
    const newAttributes = {
      ...attributes,
      conversations: {
        ...conversations,
        talk_time: age - holdTime
      }
    };
    await task.setAttributes(newAttributes);
  }
  if (autoCompleteTask) {
    task.complete('Auto completed');
  }
};

const handleReservationUpdated = (event, reservation) => {
  console.debug('Event, reservation updated', event, reservation);
  if (!saveReservationEvent(reservation.sid, event)) {
    return;
  }

  switch (event) {
    case 'wrapup': {
      handleReservationWrapup(reservation);
      break;
    }
    case 'completed':
    case 'rejected':
    case 'timeout':
    case 'canceled':
    case 'rescinded': {
      stopReservationListeners(reservation);
      const taskSid = reservation.task ? reservation.task.sid : reservation.taskSid;
      ConferenceListenerManager.stopListening(taskSid, `worker${reservation.sid}`);
      delete uniqueReservationEvents[reservation.sid];
      break;
    }
    default:
      break;
  }
};

const initReservationListeners = (reservation) => {
  const trueReservation = reservation.addListener ? reservation : reservation.source;
  stopReservationListeners(trueReservation);
  const listeners = [];
  Object.values(ReservationEvents).forEach(event => {
    const callback = () => handleReservationUpdated(event, trueReservation);
    trueReservation.addListener(event, callback);
    listeners.push({ event, callback });
  });
  reservationListeners.set(trueReservation, listeners);
};

manager.events.addListener('pluginsLoaded', () => {
  ParkTaskState.syncWorkerParkTasks();
});

manager.workerClient.on('reservationCreated', (reservation) => {
  handleReservationCreated(reservation);
});

Actions.addListener('beforeAcceptTask', async (payload, abortOriginal) => {
  const { task } = payload;
  const {
    age,
    attributes,
    queueName,
    sid,
    sourceObject: reservation
  } = task;
  const {
    conversations,
    from,
    selfPark,
    isCustomTask
  } = attributes;

  if (selfPark) {
    const newAttributes = {
      ...attributes,
      conversations: {
        ...conversations,
        hold_time: age
      }
    };
    await task.setAttributes(newAttributes);
  }

  const originalConference = conversations && conversations.conversation_id;
  if (isCustomTask && originalConference) {
    const agentJoinUrl = `${FlexState.baseUrl}/agent-join-conference`
    + `?conferenceSid=${originalConference}`
    + `&endConferenceOnExit=${true}`;

    reservation.call(from, agentJoinUrl, { accept: true })
      .then(response => console.debug('reservation call response', response));
    // TODO: Change setTimeout to something more robust to detect when agent joins conference
    setTimeout(() => Actions.invokeAction('UnholdCall', { sid, task }), 1000);
    abortOriginal();
  }
});

Actions.addListener('afterHangupCall', (payload) => {
  const { task } = payload;
  const { attributes } = task;
  const { isCustomTask } = attributes;
  if (isCustomTask) {
    Actions.invokeAction('WrapupTask', {
      ...payload
    });
  }
});

Actions.addListener('beforeTransferTask', async (payload, abortOriginal) => {
  const { options, task, targetSid } = payload;
  const { mode } = options;
  const { attributes } = task;
  const { isCustomTask } = attributes;

  if (TaskHelper.isCallTask(task) && isCustomTask) {
    await TaskService.transferTask(task, targetSid, mode);
    abortOriginal();
  }
});
