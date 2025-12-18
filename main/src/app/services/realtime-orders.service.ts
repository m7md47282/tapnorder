import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { LocalStorageService } from './local-storage.service';
import { OrderService } from './order.service';
import { Order, RealtimeOrderResponse } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class RealtimeOrdersService {
  private baseUrl: string;
  private eventSources: Map<string, EventSource> = new Map();
  private orderUpdates$ = new Subject<Order[]>();
  private orderUpdate$ = new Subject<Order>();
  private connectionStatus$ = new Subject<{ connected: boolean; error?: string }>();

  constructor(
    private localStorage: LocalStorageService,
    private orderService: OrderService
  ) {
    this.baseUrl = environment?.apiUrl || 'http://localhost:3000/api';
  }

  connectRealtimeOrders(
    placeId: string,
    statuses?: string[],
    branchId?: string | null,
    hoursBack?: number
  ): Observable<Order[]> {
    const statusParam = statuses && statuses.length > 0 
      ? statuses.join(',') 
      : 'pending';
    
    const token = this.localStorage.getToken();
    let url = `${this.baseUrl}/ordersRealtime?placeId=${encodeURIComponent(placeId)}&status=${statusParam}`;
    
    if (branchId) {
      url += `&branchId=${encodeURIComponent(branchId)}`;
    }
    
    const hoursBackValue = hoursBack !== undefined ? hoursBack : 6;
    url += `&hoursBack=${hoursBackValue}`;
    
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    const connectionKey = branchId ? `orders-${placeId}-${branchId}-${statusParam}` : `orders-${placeId}-${statusParam}`;
    this.disconnect(connectionKey);

    return new Observable<Order[]>(observer => {
      try {
        const eventSource = new EventSource(url, {
          withCredentials: true
        });

        this.eventSources.set(connectionKey, eventSource);

        eventSource.onopen = () => {
          this.connectionStatus$.next({ connected: true });
        };

        eventSource.onmessage = (event) => {
          try {
            const parsedData = JSON.parse(event.data);
            
            if (parsedData.success !== undefined && Array.isArray(parsedData.data)) {
              const orders = parsedData.data.length > 0
                ? (parsedData.data as any[]).map(dto => 
                    this.orderService.mapOrderDtoToOrder(dto)
                  )
                : [];
              observer.next(orders);
              this.orderUpdates$.next(orders);
              return;
            }
            
            const data = parsedData as RealtimeOrderResponse;
            
            if (data.type === 'orders_update' && data.data) {
              const orders = (data.data as any[]).map(dto => 
                this.orderService.mapOrderDtoToOrder(dto)
              );
              observer.next(orders);
              this.orderUpdates$.next(orders);
            } else if (data.type === 'order_update' && data.orderId) {
              this.orderService.getOrderById(data.orderId, { includeAuth: true })
                .subscribe((order: Order | null) => {
                  if (order) {
                    this.orderUpdate$.next(order);
                  }
                });
            } else if (data.type === 'connection') {
              if (data.data && Array.isArray(data.data)) {
                const orders = data.data.length > 0
                  ? (data.data as any[]).map(dto => 
                      this.orderService.mapOrderDtoToOrder(dto)
                    )
                  : [];
                observer.next(orders);
                this.orderUpdates$.next(orders);
              }
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          this.connectionStatus$.next({ 
            connected: false, 
            error: 'Connection error' 
          });
          
          if (eventSource.readyState === EventSource.CLOSED) {
            setTimeout(() => {
              this.connectRealtimeOrders(placeId, statuses, branchId, hoursBackValue).subscribe(observer);
            }, 3000);
          }
        };

        return () => {
          this.disconnect(connectionKey);
        };
      } catch (error) {
        observer.error(error);
        return () => {
          this.disconnect(connectionKey);
        };
      }
    });
  }

  connectRealtimeOrderSingle(orderId: string): Observable<Order> {
    const token = this.localStorage.getToken();
    const url = `https://us-central1-tab-n-order.cloudfunctions.net/orderRealtimeSingle/${orderId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    
    const connectionKey = `order-single-${orderId}`;
    this.disconnect(connectionKey);

    return new Observable<Order>(observer => {
      try {
        const eventSource = new EventSource(url, {
          withCredentials: true
        });

        this.eventSources.set(connectionKey, eventSource);

        eventSource.onopen = () => {
          this.connectionStatus$.next({ connected: true });
        };

        eventSource.onmessage = (event) => {
          try {
            const parsedData = JSON.parse(event.data);
            
            const data = parsedData as RealtimeOrderResponse;
            
            if (data.type === 'connection' && data.data && Array.isArray(data.data) && data.data.length > 0) {
              const orderDto = data.data[0];
              const order = this.orderService.mapOrderDtoToOrder(orderDto);
              observer.next(order);
              this.orderUpdate$.next(order);
            } else if (data.type === 'order_update') {
              // Handle order_update - data.data can be a single object or an array
              if (data.data) {
                let orderDto: any;
                
                // Check if data.data is an array
                if (Array.isArray(data.data) && data.data.length > 0) {
                  orderDto = data.data[0];
                } 
                // Check if data.data is a single order object (type assertion needed due to interface definition)
                else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data) && (data.data as any).id) {
                  orderDto = data.data as any;
                }
                
                if (orderDto) {
                  const order = this.orderService.mapOrderDtoToOrder(orderDto);
                  observer.next(order);
                  this.orderUpdate$.next(order);
                }
              } 
              // Fallback: if we have orderId but no data, fetch the order
              else if (data.orderId) {
                this.orderService.getOrderById(data.orderId, { includeAuth: true })
                  .subscribe((order: Order | null) => {
                    if (order) {
                      observer.next(order);
                      this.orderUpdate$.next(order);
                    }
                  });
              }
            } else if (parsedData.id && parsedData.status) {
              const order = this.orderService.mapOrderDtoToOrder(parsedData);
              observer.next(order);
              this.orderUpdate$.next(order);
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          this.connectionStatus$.next({ 
            connected: false, 
            error: 'Connection error' 
          });
          
          if (eventSource.readyState === EventSource.CLOSED) {
            setTimeout(() => {
              this.connectRealtimeOrderSingle(orderId).subscribe(observer);
            }, 3000);
          }
        };

        return () => {
          this.disconnect(connectionKey);
        };
      } catch (error) {
        observer.error(error);
        return () => {
          this.disconnect(connectionKey);
        };
      }
    });
  }

  getConnectionStatus$(): Observable<{ connected: boolean; error?: string }> {
    return this.connectionStatus$.asObservable();
  }

  getOrderUpdate$(): Observable<Order> {
    return this.orderUpdate$.asObservable();
  }

  disconnect(connectionKey: string): void {
    const eventSource = this.eventSources.get(connectionKey);
    if (eventSource) {
      eventSource.close();
      this.eventSources.delete(connectionKey);
    }
  }

  disconnectAll(): void {
    this.eventSources.forEach((eventSource, key) => {
      eventSource.close();
      this.eventSources.delete(key);
    });
  }
}

