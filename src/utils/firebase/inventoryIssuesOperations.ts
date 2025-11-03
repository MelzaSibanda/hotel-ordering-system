import { db } from "./config";
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";

export const submitInventoryIssue = async (issueData: any) => {
  try {
    await addDoc(collection(db, "inventory_issues"), {
      ...issueData,
      status: "pending",
      timestamp: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error submitting issue:", error);
    throw error;
  }
};

export const getInventoryIssues = async () => {
  try {
    const q = query(collection(db, "inventory_issues"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Handle both timestamp formats
        timestamp: data.timestamp || data.createdAt,
        // Ensure all fields are properly mapped
        itemId: data.itemId || data.inventoryId,
        itemName: data.itemName || 'Unknown Item',
        issueType: data.issueType || 'other',
        description: data.description || '',
        reportedBy: data.reportedBy || '',
        reportedByName: data.reportedByName || 'Unknown',
        kitchenId: data.kitchenId || '',
        status: data.status || 'pending'
      };
    });
  } catch (error) {
    console.error("Error fetching inventory issues:", error);
    throw error;
  }
};

export const updateInventoryIssueStatus = async (issueId: string, status: string, updatedBy?: string, notes?: string) => {
  try {
    const updateData: any = {
      status,
      updatedAt: Timestamp.now()
    };

    if (updatedBy) updateData.updatedBy = updatedBy;
    if (notes) updateData.resolutionNotes = notes;

    await updateDoc(doc(db, "inventory_issues", issueId), updateData);
    return true;
  } catch (error) {
    console.error("Error updating inventory issue:", error);
    throw error;
  }
};
