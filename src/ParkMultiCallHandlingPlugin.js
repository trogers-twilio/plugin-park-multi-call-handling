/* eslint-disable no-param-reassign */
import React from 'react';
import { VERSION } from '@twilio/flex-ui';
import { FlexPlugin } from 'flex-plugin';
import ParkButton from './components/ParkButton/ParkButton';
import ParkTaskList from './components/ParkTaskList/ParkTaskList';
import './actions/CustomListeners';

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
    flex.AgentDesktopView.defaultProps.showPanel2 = false;

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
  }
}
