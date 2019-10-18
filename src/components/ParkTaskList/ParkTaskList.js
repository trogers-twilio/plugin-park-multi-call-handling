import React from 'react';
import { connect } from 'react-redux';
import { withTaskContext, withTheme } from '@twilio/flex-ui';
import {
  Container,
  NoTasksContainer,
  ParkTaskListHeader,
  ParkTaskListHeaderContent
} from './ParkTaskList.Components';
import ParkTaskListItem from './ParkTaskListItem/ParkTaskListItem';

class ParkTaskList extends React.PureComponent {
  render() {
    const { parkedTasks, syncing } = this.props;
    return (
      <Container>
        <ParkTaskListHeader>
          <ParkTaskListHeaderContent>PARKED TASKS</ParkTaskListHeaderContent>
        </ParkTaskListHeader>
        {
          parkedTasks && parkedTasks.length > 0
            ? parkedTasks.map(task => <ParkTaskListItem key={task.sid} parkedTask={task} />)
            : (
              <NoTasksContainer>
                <span>{syncing ? 'Loading...' : 'No parked tasks'}</span>
              </NoTasksContainer>
            )
        }
      </Container>
    );
  }
}

const mapStateToProps = (state) => {
  const { componentViewStates } = state.flex.view;
  const parkTaskState = (componentViewStates && componentViewStates.ParkTaskState) || {};
  const { syncing } = parkTaskState;
  const parkedTasks = (parkTaskState && parkTaskState.parkedTasks) || new Map();
  return {
    parkedTasks: Array.from(parkedTasks.values()),
    syncing
  };
};

export default connect(mapStateToProps)(withTaskContext(withTheme(ParkTaskList)));
