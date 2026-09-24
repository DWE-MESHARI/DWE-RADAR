// firebase-db.js
// Thin adapter around the Firebase v10 modular SDK that exposes the small
// collection().doc()/add()/orderBy().limit().onSnapshot() surface app.js expects.
// If js/firebase-config.js has no real project config yet, getFirebaseDb()
// resolves to null and the app falls back to local-only mode (no persistence,
// no "قسم الملاحظات" saving) so the rest of the dashboard still works.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection as fsCollection,
  doc as fsDoc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy as fsOrderBy,
  limit as fsLimit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";

import { firebaseConfig } from "./firebase-config.js";

let dbInstance = null;
let initPromise = null;

function isConfigured(cfg){
  return !!(cfg && cfg.apiKey && cfg.projectId && cfg.apiKey.indexOf("YOUR_") !== 0);
}

function wrapDocRef(ref){
  return {
    id: ref.id,
    async get(){
      const snap = await getDoc(ref);
      return { exists: snap.exists(), id: ref.id, data: () => snap.data() };
    },
    async set(data){ return setDoc(ref, data); },
    async update(data){ return updateDoc(ref, data); },
    async delete(){ return deleteDoc(ref); }
  };
}

function wrapCollection(firestore, name){
  const colRef = fsCollection(firestore, name);
  return {
    doc(id){ return wrapDocRef(fsDoc(firestore, name, id)); },
    async add(data){
      const ref = await addDoc(colRef, data);
      return { id: ref.id };
    },
    orderBy(field, direction){
      const q1 = query(colRef, fsOrderBy(field, direction || "asc"));
      return {
        limit(n){
          const q2 = query(q1, fsLimit(n));
          return {
            onSnapshot(onNext, onError){
              return onSnapshot(
                q2,
                snap => onNext({ docs: snap.docs.map(d => ({ id: d.id, data: () => d.data() })) }),
                onError
              );
            }
          };
        }
      };
    }
  };
}

// Resolves to { collection(name) } backed by real Firestore, or null if
// js/firebase-config.js still has placeholder values.
export async function getFirebaseDb(){
  if (!isConfigured(firebaseConfig)) return null;
  if (!initPromise){
    initPromise = (async () => {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      dbInstance = { collection: name => wrapCollection(firestore, name) };

      // Analytics is optional and must not block or break Firestore if it fails
      // (e.g. blocked by an ad/privacy blocker, or unsupported environment).
      if (firebaseConfig.measurementId){
        try {
          if (await analyticsIsSupported()) getAnalytics(app);
        } catch(e){ console.warn("Firebase Analytics not initialized:", e); }
      }

      return dbInstance;
    })().catch(err => { console.warn("Firebase init failed:", err); return null; });
  }
  return initPromise;
}
