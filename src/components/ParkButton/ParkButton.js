import * as React from 'react';
import {
  Actions,
  IconButton,
  TaskHelper,
  withTheme
} from '@twilio/flex-ui';

class ParkButton extends React.Component {
  handleClick = () => {
    console.log('Park button clicked');
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
