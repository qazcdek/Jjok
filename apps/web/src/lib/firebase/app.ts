import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { EMULATOR_HOSTS, env } from "../env";

export const firebaseApp = initializeApp(env.firebase);

export const auth = getAuth(firebaseApp);

// 오프라인 캐시 (N-07). 여러 탭이 같은 캐시를 공유한다.
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (env.useEmulators) {
  connectAuthEmulator(auth, EMULATOR_HOSTS.auth, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOSTS.firestore.host, EMULATOR_HOSTS.firestore.port);
}
