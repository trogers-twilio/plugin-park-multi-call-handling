import TwilioSync from 'twilio-sync';
import FlexState from '../states/FlexState';

class SyncService {
  static _syncClient = new TwilioSync(FlexState.userToken)

  static getSyncMap = async (syncMapName) => {
    let syncMap;
    try {
      syncMap = await this._syncClient.map({
        id: syncMapName,
        mode: 'open_existing'
      });
      return syncMap;
    } catch (error) {
      console.error(`Error getting sync map ${syncMapName}`, error);
      return undefined;
    }
  }
}

export default SyncService;
