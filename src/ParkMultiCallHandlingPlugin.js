/* eslint-disable no-param-reassign */
import React from 'react';
import { VERSION } from '@twilio/flex-ui';
import { FlexPlugin } from 'flex-plugin';
import ParkButton from './components/ParkButton/ParkButton';
import ParkTaskList from './components/ParkTaskList/ParkTaskList';
import { ConferenceListenerManager } from './states/ConferencesState';
import FlexState from './states/FlexState';
import { handleNewReservation } from './actions/CustomListeners';
import { CustomNotifications } from './utils/enums';

const PLUGIN_NAME = 'ParkMultiCallHandlingPlugin';

export default class ParkMultiCallHandlingPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  /**
   * This code is run when your plugin is being started
   * Use this to modify any UI components or attach to the actions framework
   *
   * @param flex { typeof import('@twilio/flex-ui') }
   * @param manager { import('@twilio/flex-ui').Manager }
   */
  init(flex, manager) {
    console.debug('Flex UI Version', VERSION);

    ConferenceListenerManager.initialize();

    FlexState.workerTasks.forEach(reservation => {
      handleNewReservation(reservation);
    });

    flex.CallCanvasActions.Content.add(
      <ParkButton
        key="park-button"
      />, { sortOrder: 2 }
    );

    flex.TaskList.Content.add(
      <ParkTaskList
        key="park-task-list"
      />, { sortOrder: 10 }
    );

    flex.NoTasksCanvas.Content.add(
      <ParkTaskList
        key="park-task-list"
      />, { sortOrder: 10 }
    );

    flex.NoTasksCanvas.Content.add(
      <div style={{ height: '20px' }} key="placeholder" />,
      { sortOrder: -1 }
    );

    manager.strings[`notification_${CustomNotifications.transferFailed}`] = '{{message}}';

    flex.Notifications.registerNotification({
      id: CustomNotifications.transferFailed,
      type: flex.NotificationType.error,
      content: `notification_${CustomNotifications.transferFailed}`
    });
  }
}
