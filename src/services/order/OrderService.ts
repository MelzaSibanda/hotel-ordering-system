import { collection, doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../utils/firebase/config'
import { Order } from './types'

export class OrderService {
  async createOrder(orderData: Order): Promise<Order> {
    const orderDoc = {
      ...orderData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }

    await setDoc(doc(db, 'orders', orderData.id), orderDoc)

    return orderData
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    const { updateDoc } = await import('firebase/firestore')
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: Timestamp.now()
    })
  }

  async getOrder(orderId: string): Promise<Order | null> {
    const { getDoc } = await import('firebase/firestore')
    const docSnap = await getDoc(doc(db, 'orders', orderId))

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Order
    }

    return null
  }
}