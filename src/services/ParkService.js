import { Actions } from '@twilio/flex-ui';
import ConferenceService from './ConferenceService';
import FlexState from '../states/FlexState';
import utils from '../utils/utils';

class ParkService {
  static _createParkTask = async (taskSid, targetWorker) => {
    const { baseUrl, userToken, workerSid } = FlexState;
    const fetchUrl = `${baseUrl}/create-park-task`;
    const fetchBody = {
      Token: userToken,
      requestingWorker: workerSid,
      taskSid,
      targetWorker,
    };

    let createParkTaskResult;
    try {
      const fetchResponse = await fetch(
        fetchUrl,
        utils.fetchOptions(fetchBody)
      );
      const fetchJson = await fetchResponse.json();
      createParkTaskResult = fetchJson && JSON.parse(fetchJson);
      console.debug('Park task created:', createParkTaskResult);
    } catch (error) {
      console.error(`Error fetching ${fetchUrl}.`, error);
      createParkTaskResult = { success: false };
    }
    return createParkTaskResult;
  }

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

  static _holdCall = (sid, task) => {
    Actions.addListener('afterHoldCall', this._hangupCall);
    Actions.invokeAction('HoldCall', { sid, task });
  }

  static parkTask = async (task, targetWorker) => {
    const { attributes, sid, taskSid } = task;
    const createParkTaskResult = await this._createParkTask(taskSid, targetWorker);
    if (!createParkTaskResult.success) {
      return createParkTaskResult;
    }
    const { conference } = attributes;
    const conferenceSid = conference && conference.sid;
    const myCallSid = FlexState.workerCallSid;
    await ConferenceService.setEndConferenceOnExit(conferenceSid, myCallSid, false);

    this._holdCall(sid, task);
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
}

export default ParkService;
