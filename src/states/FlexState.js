import { Actions, Manager } from '@twilio/flex-ui';
import { SidPrefixes } from '../utils/enums';

class FlexState {
  static _manager = Manager.getInstance();

  static baseUrl = `https://${this._manager.serviceConfiguration.runtime_domain}`;

  static get flexState() { return this._manager.store.getState().flex; }

  static get userToken() { return this.flexState.session.ssoTokenPayload.token; }

  static workerSid = this.flexState.worker.source.sid;

  static get workerCallSid() {
    const { connection } = this.flexState.phone;
    return connection && connection.source.parameters.CallSid;
  }

  static get workerTasks() { return this.flexState.worker.tasks; }

  static setComponentState = (name, state) => {
    Actions.invokeAction('SetComponentState', { name, state });
  }

  static getInsightsQueueName = (sid) => new Promise((resolve) => {
    const sidPrefix = sid && sid.slice(0, 2);
    if (sidPrefix !== SidPrefixes.queue) {
      resolve(undefined);
      return;
    }
    this._manager.insightsClient.instantQuery('tr-queue')
      .then(query => {
        query.on('searchResult', items => {
          const queue = items[sid];
          resolve(queue && queue.queue_name);
        });
        query.search('');
      });
  })

  static getInsightsWorkerName = (sid) => new Promise((resolve) => {
    const sidPrefix = sid && sid.slice(0, 2);
    if (sidPrefix !== SidPrefixes.worker) {
      resolve(undefined);
      return;
    }
    this._manager.insightsClient.instantQuery('tr-worker')
      .then(query => {
        query.on('searchResult', items => {
          const worker = items[sid];
          resolve(worker && worker.friendly_name);
        });
        query.search('');
      });
  })
}

export default FlexState;
