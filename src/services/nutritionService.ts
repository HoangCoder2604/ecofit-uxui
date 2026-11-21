/** Daily meal journal stored per verified Firebase user. */
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, type Unsubscribe } from "firebase/firestore";
import { auth } from "./auth";
import { db } from "./firebase";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealInput = { name: string; mealType: MealType; calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number; quantityGrams?: number };
export type MealEntry = MealInput & { id: string; dateKey: string; createdAt?: unknown };
export type MealTotals = { calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number; count: number };

import { vietnamDateKey } from "./vietnamDate";

/** Legacy name kept for App.tsx; always returns a Vietnam calendar date. */
export const localDateKey = vietnamDateKey;
function verifiedUid(): string {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) throw new Error("Bạn cần đăng nhập bằng email đã xác minh.");
  return user.uid;
}
function checkNumber(value: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`${name} không hợp lệ.`);
}
export async function addMeal(input: MealInput): Promise<string> {
  const uid = verifiedUid();
  const name = input.name.trim();
  if (!name || name.length > 120) throw new Error("Tên món ăn cần từ 1 đến 120 ký tự.");
  if (!["breakfast", "lunch", "dinner", "snack"].includes(input.mealType)) throw new Error("Loại bữa ăn không hợp lệ.");
  checkNumber(input.calories, 10000, "Năng lượng");
  checkNumber(input.proteinGrams, 1000, "Protein");
  checkNumber(input.carbsGrams, 1500, "Carb");
  checkNumber(input.fatGrams, 1000, "Chất béo");
  if (input.quantityGrams !== undefined) checkNumber(input.quantityGrams, 10000, "Khẩu phần");
  const created = await addDoc(collection(db, "users", uid, "meal_logs"), {
    name, mealType: input.mealType, calories: input.calories,
    proteinGrams: input.proteinGrams, carbsGrams: input.carbsGrams, fatGrams: input.fatGrams,
    ...(input.quantityGrams !== undefined ? { quantityGrams: input.quantityGrams } : {}),
    dateKey: localDateKey(), createdAt: serverTimestamp(),
  });
  return created.id;
}
export async function deleteMeal(id: string): Promise<void> {
  await deleteDoc(doc(db, "users", verifiedUid(), "meal_logs", id));
}
export function subscribeMeals(uid: string, dateKey: string, onData: (items: MealEntry[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (verifiedUid() !== uid) throw new Error("Không được đọc nhật ký người khác.");
  const q = query(collection(db, "users", uid, "meal_logs"), where("dateKey", "==", dateKey));
  return onSnapshot(q, snapshot => {
    const rows = snapshot.docs.map(d => ({ ...(d.data() as Omit<MealEntry, "id">), id: d.id }));
    rows.sort((a,b) => (a.createdAt as any)?.seconds - (b.createdAt as any)?.seconds || 0);
    onData(rows);
  }, onError);
}
export function mealTotals(items: MealEntry[]): MealTotals {
  return items.reduce((total, meal) => ({
    calories: total.calories + meal.calories,
    proteinGrams: total.proteinGrams + meal.proteinGrams,
    carbsGrams: total.carbsGrams + meal.carbsGrams,
    fatGrams: total.fatGrams + meal.fatGrams,
    count: total.count + 1,
  }), { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, count: 0 });
}
