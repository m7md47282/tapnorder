import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, interval, Subscription } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';
import { Order, OrderStatus } from '../models/order.model';
import { OrderService } from './order.service';
import { NotificationService } from './notification.service';

/**
 * Order Tracking Service
 * Tracks order status and provides real-time updates
 */
@Injectable({
  providedIn: 'root'
})
export class OrderTrackingService {
  private trackingSubscriptions = new Map<string, Subscription>();
  private orderStatusSubjects = new Map<string, BehaviorSubject<OrderStatus>>();
  
  // Polling interval in milliseconds (30 seconds)
  private readonly POLLING_INTERVAL = 30000;

  constructor(
    private orderService: OrderService,
    private notification: NotificationService
  ) {
    // Request notification permission on service initialization
    this.requestNotificationPermission();
  }

  /**
   * Request browser notification permission
   */
  private async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('Notification permission request failed:', error);
      }
    }
  }

  /**
   * Start tracking an order
   */
  startTracking(orderId: string, guestUuid?: string): void {
    // Stop existing tracking if any
    this.stopTracking(orderId);

    // Create status subject if it doesn't exist
    if (!this.orderStatusSubjects.has(orderId)) {
      this.orderStatusSubjects.set(orderId, new BehaviorSubject<OrderStatus>(OrderStatus.PENDING));
    }

    // Start polling for order status updates
    const subscription = interval(this.POLLING_INTERVAL).pipe(
      switchMap(() => this.orderService.getOrderById(orderId, { guestUuid })),
      map(order => order?.status || OrderStatus.PENDING),
      takeWhile(status => {
        // Stop tracking when order is SERVED or CANCELLED
        return status !== OrderStatus.SERVED && status !== OrderStatus.CANCELLED;
      }, true) // Include the final value
    ).subscribe({
      next: (status) => {
        const subject = this.orderStatusSubjects.get(orderId);
        if (subject) {
          const previousStatus = subject.value;
          subject.next(status);

          // Check for status changes and notify
          if (previousStatus !== status) {
            this.handleStatusChange(orderId, previousStatus, status);
          }
        }
      },
      error: (error) => {
        console.error(`Error tracking order ${orderId}:`, error);
      },
      complete: () => {
        // Order tracking completed (order is SERVED or CANCELLED)
        this.stopTracking(orderId);
      }
    });

    this.trackingSubscriptions.set(orderId, subscription);

    // Immediately check status once
    this.orderService.getOrderById(orderId, { guestUuid }).subscribe(order => {
      if (order) {
        const subject = this.orderStatusSubjects.get(orderId);
        if (subject) {
          subject.next(order.status);
        }
      }
    });
  }

  /**
   * Stop tracking an order
   */
  stopTracking(orderId: string): void {
    const subscription = this.trackingSubscriptions.get(orderId);
    if (subscription) {
      subscription.unsubscribe();
      this.trackingSubscriptions.delete(orderId);
    }
  }

  /**
   * Get order status observable
   */
  getOrderStatus$(orderId: string): Observable<OrderStatus> {
    if (!this.orderStatusSubjects.has(orderId)) {
      this.orderStatusSubjects.set(orderId, new BehaviorSubject<OrderStatus>(OrderStatus.PENDING));
    }
    return this.orderStatusSubjects.get(orderId)!.asObservable();
  }

  /**
   * Update order status directly (for local UI updates only)
   * Note: This should only be used for immediate UI feedback after API calls.
   * The actual status updates should come from the API via polling.
   */
  updateOrderStatusDirectly(orderId: string, status: OrderStatus): void {
    if (!this.orderStatusSubjects.has(orderId)) {
      this.orderStatusSubjects.set(orderId, new BehaviorSubject<OrderStatus>(status));
    } else {
      const subject = this.orderStatusSubjects.get(orderId);
      if (subject) {
        const previousStatus = subject.value;
        subject.next(status);
        
        // Trigger status change handler
        if (previousStatus !== status) {
          this.handleStatusChange(orderId, previousStatus, status);
        }
      }
    }
  }

  /**
   * Handle status change
   */
  private handleStatusChange(orderId: string, previousStatus: OrderStatus, newStatus: OrderStatus): void {
    console.log(`Order ${orderId} status changed: ${previousStatus} -> ${newStatus}`);

    // Show in-app notification
    switch (newStatus) {
      case OrderStatus.CONFIRMED:
        this.notification.info('Your order has been confirmed!');
        break;
      case OrderStatus.PREPARING:
        this.notification.info('Your order is being prepared...');
        break;
      case OrderStatus.READY:
        this.notification.success('Your order is ready!');
        this.showBrowserNotification('Order Ready!', 'Your order is ready to be served.');
        break;
      case OrderStatus.SERVED:
        this.notification.success('Order served. Thank you!');
        break;
      case OrderStatus.CANCELLED:
        this.notification.warning('Your order has been cancelled.');
        break;
    }
  }

  /**
   * Show browser notification
   */
  private showBrowserNotification(title: string, body: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'order-ready',
          requireInteraction: false
        });

        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);

        // Handle click
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.warn('Failed to show browser notification:', error);
      }
    }
  }

  /**
   * Stop all tracking
   */
  stopAllTracking(): void {
    this.trackingSubscriptions.forEach((subscription, orderId) => {
      subscription.unsubscribe();
    });
    this.trackingSubscriptions.clear();
  }
}

