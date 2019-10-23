/* eslint-disable max-classes-per-file */
import {
  ConferenceParticipant,
  Manager,
  StateHelper,
  TaskHelper
} from '@twilio/flex-ui';
import TwilioSync from 'twilio-sync';
import FlexState from './FlexState';
import { SyncClientTypes } from '../utils/enums';

const manager = Manager.getInstance();
const flexStore = manager.store;

const ACTION_INIT_STATE = 'CONFERENCE_INIT';
const ACTION_UPDATE_CONFERENCES = 'CONFERENCE_MULTIPLE_UPDATE';

const ConferenceListenerState = {
  initializing: 'initializing',
  initialized: 'initialized',
  destroying: 'destroying'
};

export class Conference {
  sid = '';

  status = '';

  conferenceSid = '';

  participants = [];

  constructor(sid) {
    this.sid = sid;
  }

  get liveParticipantCount() {
    const liveParticipants = this.participants.filter(p => p.status === 'joined');
    return liveParticipants.length;
  }

  get liveWorkers() {
    const liveParticipants = this.participants.filter(
      p => p.status === 'joined' && p.participantType === 'worker'
    );
    return liveParticipants;
  }

  get liveWorkerCount() {
    return this.liveWorkers.length;
  }
}

export class ConferenceListener {
  children = [];

  lifeCycle;

  map;

  originalSid;

  sid;

  stateUpdateTimers = [];

  syncClient;

  updateCallback;

  constructor(sid, updateCallback, syncClient, originalSid) {
    this.lifeCycle = ConferenceListenerState.initializing;
    this.sid = sid;
    this.updateCallback = updateCallback;
    this.syncClient = syncClient;
    this.originalSid = originalSid;
    this.initialize(sid, originalSid);
  }

  triggerDelayedStateUpdate = timeout => {
    this.stateUpdateTimers.push(
      setTimeout(() => {
        this.emitCallback();
      }, timeout)
    );
  }

  getSyncMap = (syncClient, syncMapName) => {
    return new Promise((resolve) => {
      const sleepTime = 250;
      let syncMap;
      setTimeout(async () => {
        try {
          syncMap = await syncClient.map({
            id: syncMapName,
            mode: 'open_existing'
          });
          console.log('Retrieved map with SID', syncMap.sid);
          resolve(syncMap);
        } catch (error) {
          resolve({ result: 'failed', error });
        }
      }, sleepTime);
    });
  }

  stop = () => {
    console.debug(`Custom ConferenceListener stop ${this.sid}`);
    if (this.lifeCycle === ConferenceListenerState.initialized) {
      this.map.removeListener('itemAdded', this.itemAdded);
      this.map.removeListener('itemUpdated', this.itemUpdated);
      this.map.removeListener('itemRemoved', this.itemRemoved);
      this.map.close();
      this.stateUpdateTimers.forEach(timer => clearTimeout(timer));
    } else {
      this.lifeCycle = ConferenceListenerState.destroying;
      console.debug('Custom ConferenceListener canceling initialization');
    }
  }

  initialize = async (sid, originalSid) => {
    const syncMapNameSid = originalSid || sid;
    console.debug(`Custom ConferenceListener initialize ${sid} started`);
    const syncMapName = `${syncMapNameSid}.CS`;
    let syncMap;
    let success = false;
    const maxRetries = 20;
    let retryCount = 0;

    while (!success && retryCount < maxRetries) {
      syncMap = await this.getSyncMap(this.syncClient, syncMapName);
      if (syncMap.sid) {
        success = true;
      } else {
        retryCount += 1;
      }
    }

    if (syncMap.sid) {
      this.map = syncMap;
    } else {
      console.error('Custom conference listener failed to initialize. Unable to retrieve sync map.', syncMap.error);
      return;
    }

    const children = await this.map.getItems();
    this.children = children.items;
    this.map.on('itemAdded', this.itemAdded);
    this.map.on('itemUpdated', this.itemUpdated);
    this.map.on('itemRemoved', this.itemRemoved);
    // while initializing we have been killed
    if (this.lifeCycle === ConferenceListenerState.destroying) {
      console.debug(`Custom ConferenceListener initialize ${sid} canceled`);
      this.lifeCycle = ConferenceListenerState.initialized;
      this.stop();
      return;
    }
    this.lifeCycle = ConferenceListenerState.initialized;
    console.debug(`Custom ConferenceListener initialize ${sid} finished`);
    this.emitCallback();
  }

  emitCallback() {
    if (this.updateCallback) {
      this.updateCallback(this);
    }
  }

  itemAdded = (item) => {
    console.debug(`Custom ConferenceListener itemAdded ${this.children.length}`);
    this.children.push(item.item);
    this.emitCallback();
  };

  itemUpdated = (item) => {
    console.debug(`Custom ConferenceListener itemUpdated ${this.children.length}`);
    this.emitCallback();
  };

  itemRemoved = (item) => {
    console.debug(`Custom ConferenceListener itemRemoved ${this.children.length}`);
    this.children.splice(this.children.indexOf(item.item), 1);
    this.emitCallback();
  };
}

export class ConferenceListenerManager {
  static confs;

  static requestedSids = new Map();

  static initialized = false;

  static initialize() {
    console.debug('Custom ConferenceListenerManager initialize');
    this.initialized = true;
    this.confs = new Map();
    this.requestedSids.forEach((consumer, sid) => {
      this.startListening(StateHelper.getTaskByTaskrouterTaskSid(sid), consumer);
    });
  }

  static startListening(task, consumerID, syncClientType, originalSid) {
    const { taskSid } = task;
    console.debug(`Custom ConferenceListenerManager startListening ${taskSid} ${consumerID}`);
    if (!task || !TaskHelper.isCallTask(task)) {
      console.debug('Custom: task is not a call task');
      return;
    }

    if (!this.initialized) {
      console.debug('Custom: adding task to requestedSids');
      this.requestedSids.set(taskSid, consumerID);
      return;
    }
    const wrapper = this.confs.get(taskSid);
    if (!wrapper) {
      const userToken = flexStore.getState().flex.session.ssoTokenPayload.token;
      const syncClient = syncClientType === SyncClientTypes.insights
        ? manager.insightsClient
        : new TwilioSync(userToken);
      console.debug('Custom ConferenceListenerManager new Listener');
      const listener = new ConferenceListener(
        taskSid,
        // eslint-disable-next-line no-use-before-define
        Actions.handleConferenceUpdate.bind(Actions),
        syncClient,
        originalSid
      );
      this.confs.set(taskSid, { listener, consumers: [consumerID] });
    } else if (wrapper.consumers.indexOf(consumerID) === -1) {
      console.debug('Custom ConferenceListenerManager new Consumer');
      wrapper.consumers.push(consumerID);
    }
  }

  static stopListening(taskSid, consumerID) {
    console.debug(`Custom ConferenceListenerManager stop Listening ${taskSid} ${consumerID}`);
    const wrapper = this.confs.get(taskSid);
    if (wrapper) {
      const consumerIndex = wrapper.consumers.indexOf(consumerID);
      if (consumerIndex > -1) {
        wrapper.consumers.splice(consumerIndex, 1);
      }
      if (wrapper.consumers.length === 0) {
        wrapper.listener.stop();
        this.confs.delete(taskSid);
      }
    }
  }
}

export class Actions {
  static handleConferenceUpdateThrottler;

  static handleConferenceUpdateCalls;

  static dispatchAction = (type, payload) => {
    flexStore.dispatch({ type, payload });
  }

  static assignInsights = (insightsClient) => {
    this.dispatchAction(ACTION_INIT_STATE, {
      client: insightsClient
    });
    ConferenceListenerManager.initialize();
  }

  static handleConferenceUpdateImpl = () => {
    console.debug(`Custom ConferencesState handleConferenceUpdateImpl ${this.handleConferenceUpdateCalls.size}`);
    if (this.handleConferenceUpdateCalls.size === 0) {
      return;
    }
    const conferences = new Set();
    this.handleConferenceUpdateCalls.forEach(listener => {
      // a conference has reported a change
      // parse the Sync map to our conference model
      console.debug(`Custom ConferencesState handleConferenceUpdateImpl ${listener.sid}`);
      if (listener.children.length === 0) {
        return;
      }
      const { sid } = listener;
      const newConference = new Conference(sid);
      listener.children.forEach(child => {
        if (child.key === 'conf_status') {
          const { value } = child;
          newConference.status = value.status;
          newConference.conferenceSid = value.conference_sid;
        } else {
          console.debug('conference child key:', child.key);
          console.debug('conference child value:', child.value);
          const callSid = child.key;
          const participant = child.value;
          if (callSid === FlexState.workerCallSid) {
            participant.worker_sid = FlexState.workerSid;
            participant.participantType = 'worker';
          }
          const newParticipant = new ConferenceParticipant(participant, callSid);
          console.debug('New conference participant:', newParticipant);
          if (newParticipant.participantType !== 'supervisor') {
            newConference.participants.push(newParticipant);
          }
        }
      });
      console.debug(
        `Custom ConferencesState handleConferenceUpdateImpl raw participants: ${newConference.participants.length}`
      );

      // filter out duplicates. A participant may have been added to the conversation multiple times
      const filteredParticipants = [];
      newConference.participants.forEach((participant) => {
        if (participant.status !== 'left') {
          filteredParticipants.push(participant);
        } else if (
          // add "left" participant, if we have not added one and
          // do not have any non-left participants for that sid
          !filteredParticipants.find((part) => part.uniqueId === participant.uniqueId)
            && !newConference.participants.find(
              (part) => part.uniqueId === participant.uniqueId && part.status !== 'left'
            )
        ) {
          filteredParticipants.push(participant);
        }
      });
      newConference.participants = filteredParticipants;
      console.debug(
        `Custom ConferencesState handleConferenceUpdateImpl filtered participants: ${newConference.participants.length}`
      );
      // update new conference participants taking into account previous state of participants
      const storeConferences = flexStore.getState().conferences;
      const conferencesStates = storeConferences && storeConferences.states;
      const oldConference = conferencesStates && conferencesStates.get(sid);
      if (oldConference) {
        newConference.participants = newConference.participants.map((participant, index) => {
          if (participant.status === 'left') {
            const oldParticipant = oldConference.source.participants.find((oldPart) => (
              oldPart.uniqueId === participant.uniqueId));
            const statusTimeoutMS = 5000;
            // was the old state of the participant "joined", if so, lets fake a "recently_left" state for a time interval
            if (oldParticipant && oldParticipant.status === 'joined') {
              listener.triggerDelayedStateUpdate(statusTimeoutMS);
              return new ConferenceParticipant(
                participant.source,
                participant.callSid,
                new Date().getTime()
              );
            }
            // was the old participant already in the "recently_left" state and are we still in the timeout so continue with that state?
            if (
              oldParticipant
                && oldParticipant.participantLeftTimestamp
                && new Date().getTime() - oldParticipant.participantLeftTimestamp < statusTimeoutMS
            ) {
              return oldParticipant;
            }
          }
          return participant;
        });
      }
      console.debug(
        `Custom ConferencesState handleConferenceUpdateImpl final participants: ${newConference.participants.length}`
      );

      // calculate if current worker is in this call the last live worker, this influences how the call acts when it ends
      newConference.source = listener;
      conferences.add(newConference);
    });

    this.dispatchAction(ACTION_UPDATE_CONFERENCES, { conferences });
  }

  static handleConferenceUpdate(listener) {
    console.debug(`Custom ConferencesState handleConferenceUpdate ${listener.sid}`);
    if (listener) {
      if (this.handleConferenceUpdateThrottler) {
        this.handleConferenceUpdateCalls.add(listener);
        return;
      }

      this.handleConferenceUpdateCalls = new Set();
      this.handleConferenceUpdateCalls.add(listener);
      this.handleConferenceUpdateImpl();
      this.handleConferenceUpdateCalls = new Set();
      this.handleConferenceUpdateThrottler = setTimeout(() => {
        this.handleConferenceUpdateImpl();
        clearTimeout(this.handleConferenceUpdateThrottler);
        this.handleConferenceUpdateThrottler = null;
      }, 500);
    }
  }

  static updateConferencesWithParticipant(participantSid) {
    const foundConferences = [];
    flexStore.getState().conferences.states.forEach((conferenceState, sid) => {
      if (conferenceState.source.participants.find((participant) => participant.workerSid === participantSid)) {
        foundConferences.push(conferenceState.source);
      }
    });
    if (foundConferences.length > 0) {
      this.dispatchAction(ACTION_UPDATE_CONFERENCES, { conferences: foundConferences });
    }
  }

  static shutdown() {
    this.dispatchAction(ACTION_INIT_STATE, {});
  }
}
