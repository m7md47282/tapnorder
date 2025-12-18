import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../material.module';
import { Order, OrderStatus } from '../../../../models/order.model';
import { OrderTrackingService } from '../../../../services/order-tracking.service';
import { OrderService } from '../../../../services/order.service';
import { NotificationService } from '../../../../services/notification.service';
import { Subject, takeUntil, timer } from 'rxjs';

@Component({
  selector: 'app-order-status',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './order-status.component.html',
  styleUrls: ['./order-status.component.scss']
})
export class OrderStatusComponent implements OnInit, OnDestroy {
  @Input() order!: Order;
  @Output() hideOrder = new EventEmitter<Order>();

  currentStatus: OrderStatus = OrderStatus.PENDING;
  OrderStatus = OrderStatus;
  showItems: boolean = false;
  private destroy$ = new Subject<void>();
  constructor(
    private orderTracking: OrderTrackingService,
    private orderService: OrderService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.order) {
      this.currentStatus = this.order.status;

      // Subscribe to status changes from the tracking service
      // The tracking service polls the API for status updates
      this.orderTracking.getOrderStatus$(this.order.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(status => {
          this.currentStatus = status;
          // Update the order object to keep it in sync
          this.order.status = status;
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getStatusLabel(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.PENDING:
        return 'Pending';
      case OrderStatus.CONFIRMED:
        return 'Confirmed';
      case OrderStatus.PREPARING:
        return 'Preparing';
      case OrderStatus.READY:
        return 'Ready';
      case OrderStatus.SERVED:
        return 'Served';
      case OrderStatus.CANCELLED:
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }

  getStatusIcon(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.PENDING:
        return 'schedule';
      case OrderStatus.CONFIRMED:
        return 'check_circle_outline';
      case OrderStatus.PREPARING:
        return 'restaurant';
      case OrderStatus.READY:
        return 'done_all';
      case OrderStatus.SERVED:
        return 'check_circle';
      case OrderStatus.CANCELLED:
        return 'cancel';
      default:
        return 'help_outline';
    }
  }

  getStatusColor(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.PENDING:
        return 'warning';
      case OrderStatus.CONFIRMED:
        return 'primary';
      case OrderStatus.PREPARING:
        return 'accent';
      case OrderStatus.READY:
        return 'primary';
      case OrderStatus.SERVED:
        return 'primary';
      case OrderStatus.CANCELLED:
        return 'warn';
      default:
        return '';
    }
  }

  getProgressPercentage(): number {
    switch (this.currentStatus) {
      case OrderStatus.PENDING:
        return 10;
      case OrderStatus.CONFIRMED:
        return 30;
      case OrderStatus.PREPARING:
        return 60;
      case OrderStatus.READY:
        return 90;
      case OrderStatus.SERVED:
        return 100;
      case OrderStatus.CANCELLED:
        return 0;
      default:
        return 0;
    }
  }

  isCompleted(): boolean {
    return this.currentStatus === OrderStatus.SERVED || this.currentStatus === OrderStatus.CANCELLED;
  }

  toggleItems(): void {
    this.showItems = !this.showItems;
  }

  onHideOrder(): void {
    this.hideOrder.emit(this.order);
  }
}

