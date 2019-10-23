import { Actions, Manager } from '@twilio/flex-ui';

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
}

export default FlexState;
