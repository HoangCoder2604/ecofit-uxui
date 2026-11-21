/** Hydration journal, persisted to Firestore by account and day. */
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, type Unsubscribe } from "firebase/firestore";
import { auth } from "./auth";
import { db } from "./firebase";
import { vietnamDateKey } from "./vietnamDate";
export type WaterEntry = { id: string; amountMl: number; dateKey: string; createdAt?: unknown };
function verifiedUid() {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) throw new Error("Bạn cần đăng nhập bằng email đã xác minh.");
  return user.uid;
}
export async function addWater(amountMl: number): Promise<string> {
  const uid = verifiedUid();
  if (!Number.isInteger(amountMl) || amountMl < 1 || amountMl > 5000) throw new Error("Lượng nước mỗi lần cần từ 1 đến 5000 ml.");
  const result = await addDoc(collection(db, "users", uid, "water_logs"), {
    amountMl, dateKey: vietnamDateKey(), createdAt: serverTimestamp(),
  });
  return result.id;
}
export async function deleteWater(id: string) {
  await deleteDoc(doc(db, "users", verifiedUid(), "water_logs", id));
}
export function subscribeWater(uid: string, dateKey: string, onData: (items: WaterEntry[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (verifiedUid() !== uid) throw new Error("Không được đọc nhật ký người khác.");
  return onSnapshot(query(collection(db, "users", uid, "water_logs"), where("dateKey", "==", dateKey)), snapshot => {
    const rows = snapshot.docs.map(d => ({ ...(d.data() as Omit<WaterEntry, "id">), id:d.id }));
    onData(rows);
  }, onError);
}
export function totalWater(items: WaterEntry[]) {
  return items.reduce((sum,item) => sum + item.amountMl, 0);
}
