import type { PresentationAnalysis } from './pptx';

const DB_NAME = 'waraq-analysis';
const STORE = 'presentations';

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('التخزين المحلي غير متاح في هذا المتصفح.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAnalyses(): Promise<PresentationAnalysis[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).getAll();
    let result: PresentationAnalysis[] = [];
    request.onsuccess = () => { result = request.result as PresentationAnalysis[]; };
    transaction.oncomplete = () => {
      db.close();
      resolve(result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    transaction.onerror = () => { db.close(); reject(transaction.error || request.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('تم إيقاف قراءة التحليلات.')); };
  });
}

export async function saveAnalysis(analysis: PresentationAnalysis): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(analysis);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('تعذر حفظ التغييرات.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('تم إيقاف عملية الحفظ.')); };
  });
}

export async function removeAnalysis(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('تعذر حذف التحليل.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('تم إيقاف عملية الحذف.')); };
  });
}
