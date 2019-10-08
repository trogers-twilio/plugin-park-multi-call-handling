import React from 'react';
import { withTaskContext, withTheme } from '@twilio/flex-ui';
import ParkTaskListItem from './ParkTaskListItem/ParkTaskListItem';

const items = [
  {
    key: '12345'
  }, {
    key: '56789'
  }
];

class ParkTaskList extends React.PureComponent {
  render() {
    return (
      <React.Fragment>
        {items.map(item => <ParkTaskListItem key={item.key} />)}
      </React.Fragment>
    );
  }
}

export default withTaskContext(withTheme(ParkTaskList));
