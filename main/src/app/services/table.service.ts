import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService, ApiResponse } from './api.service';
import { Table, TableStatus } from '../models/product.model';

export interface CreateTableCommand {
  tableNumber: string;
  capacity: number;
  placeId: string;
  branchId?: string | null;
  status?: TableStatus;
  location?: string;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateTableCommand {
  id: string;
  tableNumber?: string;
  capacity?: number;
  status?: TableStatus;
  location?: string;
  notes?: string;
  isActive?: boolean;
  serverId?: string;
  serverName?: string;
}

export interface TableQuery {
  placeId: string;
  branchId?: string;
  status?: TableStatus;
  location?: string;
  isActive?: boolean;
  search?: string;
}

/**
 * Table Service
 * Manages table CRUD operations and status updates
 */
@Injectable({
  providedIn: 'root'
})
export class TableService {
  private tablesSubject = new BehaviorSubject<Table[]>([]);
  public tables$ = this.tablesSubject.asObservable();

  constructor(private api: ApiService) {}

  /**
   * Get tables with optional filters
   */
  getTables(query: TableQuery): Observable<Table[]> {
    const params: any = {
      placeId: query.placeId
    };

    if (query.branchId) {
      params.branchId = query.branchId;
    }
    if (query.status) {
      params.status = query.status;
    }
    if (query.location) {
      params.location = query.location;
    }
    if (query.isActive !== undefined) {
      params.isActive = query.isActive;
    }
    if (query.search) {
      params.search = query.search;
    }

    return this.api.get<ApiResponse<Table[]> | Table[]>('/tables', params).pipe(
      map(response => {
        let tables: Table[] = [];
        if (response && typeof response === 'object') {
          if ('success' in response && 'data' in response) {
            const apiResponse = response as ApiResponse<Table[]>;
            if (apiResponse.success && apiResponse.data) {
              tables = Array.isArray(apiResponse.data) ? apiResponse.data : [apiResponse.data];
            }
          } else if (Array.isArray(response)) {
            tables = response as Table[];
          } else if ('id' in response && 'tableNumber' in response) {
            tables = [response as unknown as Table];
          }
        }
        this.tablesSubject.next(tables);
        return tables;
      }),
      catchError(error => {
        console.error('Error fetching tables:', error);
        return [];
      })
    );
  }

  /**
   * Get table by ID
   */
  getTableById(id: string): Observable<Table | null> {
    return this.api.get<ApiResponse<Table> | Table>(`/tables/${id}`).pipe(
      map(response => {
        if (response && typeof response === 'object') {
          if ('success' in response && 'data' in response) {
            const apiResponse = response as ApiResponse<Table>;
            if (apiResponse.success && apiResponse.data) {
              return apiResponse.data;
            }
          } else if ('id' in response) {
            return response as Table;
          }
        }
        return null;
      }),
      catchError(error => {
        console.error('Error fetching table:', error);
        return of(null);
      })
    );
  }

  /**
   * Create a new table
   */
  createTable(command: CreateTableCommand): Observable<Table> {
    return this.api.post<ApiResponse<Table> | Table>('/tables', command).pipe(
      map(response => {
        // Handle both wrapped ApiResponse and direct table object
        let newTable: Table | null = null;
        if (response && typeof response === 'object') {
          if ('success' in response && 'data' in response) {
            // Wrapped ApiResponse format
            const apiResponse = response as ApiResponse<Table>;
            if (apiResponse.success && apiResponse.data) {
              newTable = apiResponse.data;
            } else {
              throw new Error(apiResponse.message || 'Failed to create table');
            }
          } else if ('id' in response) {
            // Direct table object (API returns table directly)
            newTable = response as Table;
          }
        }
        
        if (!newTable) {
          throw new Error('Failed to create table: Invalid response format');
        }
        
        const currentTables = this.tablesSubject.value;
        this.tablesSubject.next([...currentTables, newTable]);
        return newTable;
      }),
      catchError(error => {
        console.error('Error creating table:', error);
        throw error;
      })
    );
  }

  /**
   * Update an existing table
   */
  updateTable(command: UpdateTableCommand): Observable<Table> {
    const { id, ...updateData } = command;
    return this.api.put<ApiResponse<Table> | Table>(`/tables?table_id=${id}`, command).pipe(
      map(response => {
        // Handle both wrapped ApiResponse and direct table object
        let updatedTable: Table | null = null;
        if (response && typeof response === 'object') {
          if ('success' in response && 'data' in response) {
            // Wrapped ApiResponse format
            const apiResponse = response as ApiResponse<Table>;
            if (apiResponse.success && apiResponse.data) {
              updatedTable = apiResponse.data;
            } else {
              throw new Error(apiResponse.message || 'Failed to update table');
            }
          } else if ('id' in response) {
            // Direct table object (API returns table directly)
            updatedTable = response as Table;
          }
        }
        
        if (!updatedTable) {
          throw new Error('Failed to update table: Invalid response format');
        }
        
        const currentTables = this.tablesSubject.value;
        const index = currentTables.findIndex(t => t.id === id);
        if (index !== -1) {
          currentTables[index] = updatedTable;
          this.tablesSubject.next([...currentTables]);
        } else {
          this.tablesSubject.next([...currentTables, updatedTable]);
        }
        return updatedTable;
      }),
      catchError(error => {
        console.error('Error updating table:', error);
        throw error;
      })
    );
  }

  /**
   * Delete a table
   */
  deleteTable(id: string): Observable<boolean> {
    return this.api.delete<ApiResponse | any>(`/tables?table_id=${id}`).pipe(
      map(response => {
        // Handle both wrapped ApiResponse and direct responses
        let success = false;
        if (response && typeof response === 'object') {
          if ('success' in response) {
            // Wrapped ApiResponse format
            const apiResponse = response as ApiResponse;
            success = apiResponse.success;
            if (!success) {
              throw new Error(apiResponse.message || 'Failed to delete table');
            }
          } else {
            // Direct response (assume success if no error)
            success = true;
          }
        } else {
          // Simple response (assume success)
          success = true;
        }
        
        if (success) {
          const currentTables = this.tablesSubject.value;
          this.tablesSubject.next(currentTables.filter(t => t.id !== id));
        }
        return success;
      }),
      catchError(error => {
        console.error('Error deleting table:', error);
        throw error;
      })
    );
  }

  /**
   * Update table status
   */
  updateTableStatus(id: string, status: TableStatus): Observable<Table> {
    return this.updateTable({ id, status });
  }

  /**
   * Assign server to table
   */
  assignServer(id: string, serverId: string, serverName: string): Observable<Table> {
    return this.updateTable({ id, serverId, serverName });
  }

  /**
   * Clear server assignment from table
   */
  clearServer(id: string): Observable<Table> {
    return this.updateTable({ id, serverId: undefined, serverName: undefined });
  }
}