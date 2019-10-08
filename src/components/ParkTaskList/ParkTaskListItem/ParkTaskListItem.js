import React from 'react';
import { TaskListBaseItem, withTaskContext, withTheme } from '@twilio/flex-ui';

class ParkTaskListItem extends React.PureComponent {
  render() {
    const { key } = this.props;
    const itemProps = {
      icon: 'GenericTask',
      firstLine: key || 'First line text',
      secondLine: 'Second line text',
    };
    return (
      <TaskListBaseItem {...itemProps} />
    );
  }
}

export default withTaskContext(withTheme(ParkTaskListItem));
