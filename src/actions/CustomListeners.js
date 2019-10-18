import { Actions, Manager, TaskHelper } from '@twilio/flex-ui';
import ParkTaskState from '../states/ParkTaskState';

const manager = Manager.getInstance();

const handleReservationWrapup = async (reservation) => {
  const { task } = reservation;
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

manager.events.addListener('pluginsLoaded', () => {
  ParkTaskState.syncWorkerParkTasks();
});

manager.workerClient.on('reservationCreated', (reservation) => {
  reservation.addListener('wrapup', async (res) => {
    await handleReservationWrapup(res);
  });
  const { sid } = reservation;
  const task = TaskHelper.getTaskByTaskSid(sid);
  const { attributes } = task;
  if (attributes && attributes.autoAnswer) {
    Actions.invokeAction('AcceptTask', { task });
    Actions.invokeAction('SelectTask', { sid });
  }
});

manager.workerClient.on('reservationWrapup', (reservation) => {
  console.debug('my reservationWrapup callback', reservation);
});

Actions.addListener('afterAcceptTask', async (payload) => {
  const { task } = payload;
  const {
    age,
    attributes,
    queueName,
    sid
  } = task;
  const {
    conversations,
    direction,
    selfPark
  } = attributes;

  if (queueName === 'Park' && direction === 'outbound') {
    Actions.invokeAction('UnholdCall', { sid, task });
  }
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
});

Actions.addListener('afterHangupCall', (payload) => {
  if (payload.task.attributes.direction === 'outbound') {
    Actions.invokeAction('WrapupTask', {
      ...payload
    });
  }
});

// Actions.addListener('afterWrapupTask', (payload) => {
//   const { task } = payload;
//   if (task.attributes.autoCompleteTask) {
//     task.complete();
//   }
// });
