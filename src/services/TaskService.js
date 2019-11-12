import { Actions, Notifications } from '@twilio/flex-ui';
import ConferenceService from './ConferenceService';
import FlexState from '../states/FlexState';
import utils from '../utils/utils';
import {
  SegmentTypes,
  SidPrefixes,
  TransferModes,
  CustomNotifications
} from '../utils/enums';

class TaskService {
  // Private class methods
  static _createSegmentTask = async (taskSid, targetSid, segmentType, targetName) => {
    const { baseUrl, userToken, workerSid } = FlexState;
    const fetchUrl = `${baseUrl}/create-segment-task`;
    const fetchBody = {
      Token: userToken,
      requestingWorkerSid: workerSid,
      segmentType,
      targetName,
      targetSid,
      taskSid,
    };

    let createSegmentTaskResult;
    try {
      const fetchResponse = await fetch(
        fetchUrl,
        utils.fetchOptions(fetchBody)
      );
      const fetchJson = await fetchResponse.json();
      createSegmentTaskResult = fetchJson && JSON.parse(fetchJson);
      if (createSegmentTaskResult && createSegmentTaskResult.success) {
        console.debug(`${segmentType} task created:`, createSegmentTaskResult);
      } else {
        console.error(`${segmentType} task creation failed:`, createSegmentTaskResult);
      }
    } catch (error) {
      console.error(`Error fetching ${fetchUrl}.`, error);
      createSegmentTaskResult = { success: false };
    }
    return createSegmentTaskResult;
  };

  static _updateTaskAttributes = async (taskSid, attributes) => {
    const { baseUrl, userToken } = FlexState;
    const fetchUrl = `${baseUrl}/update-task`;
    const fetchBody = {
      Token: userToken,
      taskSid,
      attributes: JSON.stringify(attributes)
    };

    let updateTaskResult;
    try {
      const fetchResponse = await fetch(
        fetchUrl,
        utils.fetchOptions(fetchBody)
      );
      const fetchJson = await fetchResponse.json();
      updateTaskResult = fetchJson && JSON.parse(fetchJson);
      console.debug('Updated task attributes:', updateTaskResult);
    } catch (error) {
      console.error(`Error fetching ${fetchUrl}.`, error);
      updateTaskResult = { success: false };
    }
    return updateTaskResult;
  }

  static _hangupCall = (payload) => {
    Actions.removeListener('afterHoldCall', this._hangupCall);
    Actions.invokeAction('HangupCall', payload);
  }

  static _holdCall = (sid, task, hangup) => {
    if (hangup) {
      Actions.addListener('afterHoldCall', this._hangupCall);
    }
    Actions.invokeAction('HoldCall', { sid, task });
  }

  // Public class methods
  static parkTask = async (task, targetWorker) => {
    const { attributes, sid, taskSid } = task;
    const createParkTaskResult = await this._createSegmentTask(
      taskSid, targetWorker, SegmentTypes.park
    );
    if (!createParkTaskResult.success) {
      return createParkTaskResult;
    }
    const { conference } = attributes;
    const conferenceSid = conference && conference.sid;
    const myCallSid = FlexState.workerCallSid;
    await ConferenceService.setEndConferenceOnExit(conferenceSid, myCallSid, false);

    this._holdCall(sid, task, true);
    return createParkTaskResult;
  }

  static pickupParkedTask = async (parkedTask) => {
    const { attributes, sid } = parkedTask;
    const newAttributes = {
      ...attributes,
      holdAssignment: false
    };
    const updateTaskResult = await this._updateTaskAttributes(sid, newAttributes);
    return updateTaskResult;
  }

  static handleColdTransfer = async (task, targetSid, targetName, segmentType) => {
    const { attributes, sid, taskSid } = task;
    const { conference } = attributes;
    const conferenceSid = conference && conference.sid;

    const hangupCall = false;
    this._holdCall(sid, task, hangupCall);
    const createTaskResult = await this._createSegmentTask(
      taskSid, targetSid, segmentType, targetName
    );
    if (!createTaskResult.success) {
      const message = 'Transfer was unsuccessful. Please try again. '
        + 'If this error continues, please contact your support department for assistance.';
      Notifications.showNotification(CustomNotifications.transferFailed, { message });
      return;
    }
    await ConferenceService.setEndConferenceOnExit(
      conferenceSid, FlexState.workerCallSid, false
    );
    this._hangupCall({ task });
  }

  static handleWarmTransfer = async (task, targetSid, targetName, segmentType) => {
    const { attributes, sid, taskSid } = task;
    const { conference } = attributes;
    const conferenceSid = conference && conference.sid;

    const hangupCall = false;
    this._holdCall(sid, task, hangupCall);
    const createTaskResult = await this._createSegmentTask(
      taskSid, targetSid, segmentType, targetName
    );
    if (!createTaskResult.success) {
      const message = 'Transfer was unsuccessful. Please try again. '
        + 'If this error continues, please contact your support department for assistance.';
      Notifications.showNotification(CustomNotifications.transferFailed, { message });
      return;
    }
    await ConferenceService.setEndConferenceOnExit(
      conferenceSid, FlexState.workerCallSid, false
    );
  }

  static transferTask = async (task, targetSid, mode) => {
    console.debug(`Oh yeah, ${mode} transfer time!`);

    const sidPrefix = targetSid && targetSid.slice(0, 2);
    let targetName;
    switch (sidPrefix) {
      case SidPrefixes.queue:
        targetName = await FlexState.getInsightsQueueName(targetSid);
        break;
      case SidPrefixes.worker:
        targetName = await FlexState.getInsightsWorkerName(targetSid);
        break;
      default:
        console.debug('Unhandled transferTask targetSid prefix', sidPrefix);
    }
    console.debug('transferTask targetName', targetName);

    switch (mode && mode.toLowerCase()) {
      case TransferModes.warm: {
        await this.handleWarmTransfer(task, targetSid, targetName, SegmentTypes.transfer);
        break;
      }
      case TransferModes.cold:
      default: {
        await this.handleColdTransfer(task, targetSid, targetName, SegmentTypes.transfer);
      }
    }
  }
}

export default TaskService;
