import FlexState from './FlexState';
import SyncService from '../services/SyncService';
import utils from '../utils/utils';

const componentStateName = 'ParkTaskState';
const syncMapSuffix = 'ParkedTasks';

class ParkTaskState {
  static _syncMapName = `${FlexState.workerSid}.${syncMapSuffix}`;

  static _syncMap;

  static _syncMapItems;

  static _initialized;

  static _syncWorkerParkTasksLock;

  static _stateUpdateTimer;

  static _stateUpdateDelayMs = 100;

  static _updateSyncingState = (syncing) => {
    FlexState.setComponentState(componentStateName, { syncing });
  }

  static updateParkTaskState = () => {
    if (this._stateUpdateTimer) {
      clearTimeout(this._stateUpdateTimer);
    }
    this._stateUpdateTimer = setTimeout(() => {
      FlexState.setComponentState(
        componentStateName,
        {
          parkedTasks: this._syncMapItems,
          syncing: false
        }
      );
      this._stateUpdateTimer = undefined;
    }, this._stateUpdateDelayMs);
  }

  static _prepItemForMap = (item) => {
    const { key, value } = item;
    const { attributes } = value;
    if (typeof attributes === 'string') {
      value.attributes = attributes && JSON.parse(attributes);
    }
    return { key, value };
  }

  static _syncMapItemAdded = (i) => {
    console.debug('ParkTaskState itemAdded');
    const item = this._prepItemForMap(i.item);
    this._syncMapItems.set(item.key, item.value);
    console.debug('syncMapItems', this._syncMapItems);
    this.updateParkTaskState();
  }

  static _syncMapItemUpdated = () => {
    console.debug('ParkTaskState itemUpdated');
  }

  static _syncMapItemRemoved = (item) => {
    console.debug('ParkTaskState itemRemoved', item.key);
    this._syncMapItems.delete(item.key);
    this.updateParkTaskState();
  }

  static initialize = async () => {
    console.debug('ParkTaskState initialize started');
    const syncMap = await SyncService.getSyncMap(this._syncMapName);
    if (syncMap.sid) {
      this._syncMap = syncMap;
    } else {
      console.error('ParkTaskState failed to initialize. Unable to retrieve sync map.', syncMap.error);
      return;
    }
    const syncMapItems = await this._syncMap.getItems();
    this._syncMapItems = new Map(syncMapItems.items.map(i => {
      const item = this._prepItemForMap(i);
      return [item.key, item.value];
    }));
    this._syncMap.on('itemAdded', this._syncMapItemAdded);
    this._syncMap.on('itemUpdated', this._syncMapItemUpdated);
    this._syncMap.on('itemRemoved', this._syncMapItemRemoved);
    this._initialized = true;
    console.debug('ParkTaskState initialize finished');
  }

  static syncWorkerParkTasks = async () => {
    const { baseUrl, userToken, workerSid } = FlexState;
    const fetchUrl = `${baseUrl}/sync-worker-park-tasks`;
    const fetchBody = {
      Token: userToken,
      workerSid
    };
    if (this._syncWorkerParkTasksLock) {
      console.log('syncWorkerParkTasks already running');
      return;
    }
    this._updateSyncingState(true);
    this._syncWorkerParkTasksLock = true;
    try {
      const fetchResponse = await fetch(
        fetchUrl,
        utils.fetchOptions(fetchBody)
      );
      const fetchJson = await fetchResponse.json();
      console.log('Worker park tasks synced.', fetchJson);
    } catch (error) {
      console.error('Error syncing worker park tasks.', error);
    }
    this._syncWorkerParkTasksLock = undefined;
    if (!this._initialized) {
      await this.initialize();
      this.updateParkTaskState();
    }
  };
}

export default ParkTaskState;
