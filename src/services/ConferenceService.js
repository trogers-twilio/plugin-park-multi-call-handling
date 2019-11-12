import { ConferenceParticipant, Manager } from '@twilio/flex-ui';
import FlexState from '../states/FlexState';

class ConferenceService {
  // Private functions
  static _toggleParticipantHold = (conference, participantSid, hold) => {
    return new Promise((resolve, reject) => {
      return fetch(`${FlexState.baseUrl}/hold-conference-participant`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'POST',
        body: (
          `token=${FlexState.userToken}`
          + `&conference=${conference}`
          + `&participant=${participantSid}`
          + `&hold=${hold}`
        )
      })
        .then(() => {
          console.log(`${hold ? 'Hold' : 'Unhold'} successful for participant`, participantSid);
          resolve();
        })
        .catch(error => {
          console.error(`Error ${hold ? 'holding' : 'unholding'} participant ${participantSid}\r\n`, error);
          reject(error);
        });
    });
  }

  // Public functions
  static setEndConferenceOnExit = (conferenceSid, participantSid, endConferenceOnExit) => {
    return new Promise((resolve, reject) => {
      fetch(`${FlexState.baseUrl}/update-conference-participant`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'POST',
        body: (
          `token=${FlexState.userToken}`
          + `&conference=${conferenceSid}`
          + `&participant=${participantSid}`
          + `&endConferenceOnExit=${endConferenceOnExit}`
        )
      })
        .then(response => response.json())
        .then(json => {
          if (json && json.status === 200) {
            console.log(`Participant ${participantSid} updated:\r\n`, json);
            resolve();
          }
        })
        .catch(error => {
          console.error(`Error updating participant ${participantSid}\r\n`, error);
          reject(error);
        });
    });
  }

  static addParticipant = (taskSid, from, to) => {
    return new Promise((resolve, reject) => {
      fetch(`${FlexState.baseUrl}/add-conference-participant`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'POST',
        body: `token=${FlexState.userToken}&taskSid=${taskSid}&from=${from}&to=${to}`
      })
        .then(response => response.json())
        .then(json => {
          if (json.status === 200) {
            console.log('Participant added:\r\n  ', json);
            resolve(json && json.callSid);
          }
        })
        .catch(error => {
          console.error(`Error adding participant ${to}\r\n`, error);
          reject(error);
        });
    });
  }

  static addConnectingParticipant = (conferenceSid, callSid, participantType) => {
    const flexState = Manager.getInstance().store.getState().flex;
    const { dispatch } = Manager.getInstance().store;
    const conferenceStates = flexState.conferences.states;
    const conferences = new Set();

    console.log('Populating conferences set');
    conferenceStates.forEach(conference => {
      const currentConference = conference.source;
      console.log('Checking conference SID:', currentConference.conferenceSid);
      if (currentConference.conferenceSid !== conferenceSid) {
        console.log('Not the desired conference');
        conferences.add(currentConference);
      } else {
        const { participants } = currentConference;
        const fakeSource = {
          connecting: true,
          participant_type: participantType,
          status: 'joined'
        };
        const fakeParticipant = new ConferenceParticipant(fakeSource, callSid);
        console.log('Adding fake participant:', fakeParticipant);
        participants.push(fakeParticipant);
        conferences.add(conference.source);
      }
    });
    console.log('Updating conferences:', conferences);
    dispatch({ type: 'CONFERENCE_MULTIPLE_UPDATE', payload: { conferences } });
  }

  static holdParticipant = (conference, participantSid) => {
    return this._toggleParticipantHold(conference, participantSid, true);
  }

  static unholdParticipant = (conference, participantSid) => {
    return this._toggleParticipantHold(conference, participantSid, false);
  }

  static removeParticipant = (conference, participantSid) => {
    return new Promise((resolve, reject) => {
      fetch(`${FlexState.baseUrl}/remove-conference-participant`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'POST',
        body: (
          `token=${FlexState.userToken}`
          + `&conference=${conference}`
          + `&participant=${participantSid}`
        )
      })
        .then(() => {
          console.log(`Participant ${participantSid} removed from conference`);
          resolve();
        })
        .catch(error => {
          console.error(`Error removing participant ${participantSid} from conference\r\n`, error);
          reject(error);
        });
    });
  }
}

export default ConferenceService;
