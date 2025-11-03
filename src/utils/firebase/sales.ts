import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "./config";

export interface Sale {
  id: string;
  cashierId: string;
  cashierName: string;
  customerName: string;
  customerEmail: string;
  shiftId: string;
  items: { name: string; price: number; quantity: number }[];
  totalPrice: number;
  timestamp: any; // Firestore Timestamp
}

export const getSalesByCashier = async (cashierId: string): Promise<Sale[]> => {
  const salesRef = collection(db, "sales");
  const q = query(
    salesRef,
    where("cashierId", "==", cashierId),
    orderBy("timestamp", "desc") // Most recent first
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Sale[];
};

export const getCashierSales = async (cashierId: string, shiftId: string): Promise<Sale[]> => {
  try {
    const salesRef = collection(db, "sales");

    // Query sales for the cashier and shift, ordered by timestamp descending
    const q = query(
      salesRef,
      where("cashierId", "==", cashierId),
      where("shiftId", "==", shiftId),
      orderBy("timestamp", "desc") // Make sure you have a composite index for this
    );

    const snapshot = await getDocs(q);
    const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return sales as Sale[];
  } catch (error) {
    console.error("Error fetching cashier sales:", error);
    return [];
  }
};
