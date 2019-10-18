import * as React from 'react';
import {
  IconButton,
  TaskHelper,
  withTheme
} from '@twilio/flex-ui';
import ParkService from '../../services/ParkService';

class ParkButton extends React.Component {
  handleClick = async () => {
    const { task } = this.props;
    const { workerSid } = task;
    console.log('Park button clicked');

    await ParkService.parkTask(task, workerSid);
  }

  render() {
    const { task, theme } = this.props;
    const isLiveCall = TaskHelper.isLiveCall(task);

    return (
      <React.Fragment>
        <IconButton
          icon="Loading"
          disabled={!isLiveCall}
          onClick={this.handleClick}
          themeOverride={theme.CallCanvas.Button}
          title="Park Call"
        />
      </React.Fragment>
    );
  }
}

export default withTheme(ParkButton);
