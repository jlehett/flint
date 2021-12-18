import {
    getDatabase,
    set,
    ref
} from 'firebase/database';
import { exec } from 'child_process';
import util from 'util';

const promiseExec = util.promisify(exec);

/**
 * Clear the Firestore emulator of all data.
 */
export function clearFirestoreEmulatorData() {
    await promiseExec('curl -v -X DELETE "https://localhost:8080/emulator/v1/projects/unifire-testing/databases/(default)/documents"');
}

/**
 * Clear the Firebase Realtime Database emulator of all data.
 */
export function clearRealtimeDatabaseEmulatorData() {
    const db = getDatabase();
    set(ref(db), null);
}