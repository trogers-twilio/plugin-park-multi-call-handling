import React from 'react';
import Tooltip from '@material-ui/core/Tooltip';
import {
  TaskHelper,
  withTaskContext,
  withTheme
} from '@twilio/flex-ui';
import {
  Container,
  Content,
  FirstLineContainer,
  IconAreaContainer,
  SecondLineContainer,
  TaskListIcon,
  UpperArea
} from './ParkTaskListItem.Components';
import TaskService from '../../../services/TaskService';
import utils from '../../../utils/utils';
import FlexState from '../../../states/FlexState';

class ParkTaskListItem extends React.PureComponent {
  refreshTimer;

  componentWillMount() {
    this.refreshTimer = setInterval(() => this.forceUpdate(), 1000);
  }

  componentWillUnmount() {
    if (this.refreshTimer !== undefined) {
      clearInterval(this.refreshTimer);
    }
  }

  handleContainerClick = () => {
    const { parkedTask } = this.props;
    console.debug('Container clicked for parked task', parkedTask.sid);
  }

  handleContainerDoubleClick = async () => {
    const { parkedTask } = this.props;
    const { workerSid, workerTasks } = FlexState;
    console.debug('Container double clicked for parked task', parkedTask.sid);
    const pickupResult = await TaskService.pickupParkedTask(parkedTask);
    if (!pickupResult || !pickupResult.success) {
      return;
    }
    const activeVoiceTask = Array.from(workerTasks.values())
      .find(t => TaskHelper.isCallTask(t));
    if (activeVoiceTask && activeVoiceTask.status === 'wrapping') {
      activeVoiceTask.complete();
    } else if (activeVoiceTask && activeVoiceTask.status === 'accepted') {
      await activeVoiceTask.setAttributes({
        ...activeVoiceTask.attributes,
        autoCompleteTask: true
      });
      await TaskService.parkTask(activeVoiceTask, workerSid);
    }
  }

  getTaskDuration = (dateCreated) => {
    const duration = Date.now() - Date.parse(dateCreated);
    return utils.msToTime(duration);
  }

  render() {
    const { parkedTask, theme } = this.props;
    const { attributes, dateCreated } = parkedTask;
    const { name } = attributes;
    const duration = this.getTaskDuration(dateCreated);
    const itemProps = {
      icon: 'CallBold',
      iconColor: theme.colors.holdColor,
      firstLine: name || 'First line text',
      secondLine: `Parked | ${duration}`,
      extraInfo: 'none'
    };
    return (
      // <div>{parkTask.sid}</div>
      <Container
        className="Twilio-TaskListBaseItem"
        iconColor={itemProps.iconColor}
        onClick={this.handleContainerClick}
        onDoubleClick={this.handleContainerDoubleClick}
      >
        <Tooltip title="Double-click to pickup" enterDelay={500}>
          <UpperArea className="Twilio-TaskListBaseItem-UpperArea">
            <IconAreaContainer className="Twilio-TaskListBaseItem-IconAreaContainer">
              <TaskListIcon
                className="Twilio-TaskListBaseItem-IconArea"
                icon={itemProps.icon}
              />
            </IconAreaContainer>
            <Content className="Twilio-TaskListBaseItem-Content">
              <FirstLineContainer className="Twilio-TaskListBaseItem-FirstLine">
                {itemProps.firstLine}
              </FirstLineContainer>
              <SecondLineContainer className="Twilio-TaskListBaseItem-SecondLine">
                {itemProps.secondLine}
              </SecondLineContainer>
            </Content>
          </UpperArea>
        </Tooltip>
      </Container>
    );
  }
}

export default withTaskContext(withTheme(ParkTaskListItem));
