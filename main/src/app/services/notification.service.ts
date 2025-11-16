import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';

export interface NotificationConfig {
  duration?: number;
  horizontalPosition?: MatSnackBarHorizontalPosition;
  verticalPosition?: MatSnackBarVerticalPosition;
  panelClass?: string | string[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly DEFAULT_DURATION = 3000;
  private readonly DEFAULT_HORIZONTAL_POSITION: MatSnackBarHorizontalPosition = 'end';
  private readonly DEFAULT_VERTICAL_POSITION: MatSnackBarVerticalPosition = 'top';

  constructor(private snackBar: MatSnackBar) {}

  /**
   * Show success notification
   */
  success(message: string, config?: NotificationConfig): void {
    const panelClass = ['success-snackbar', ...(config?.panelClass ? (Array.isArray(config.panelClass) ? config.panelClass : [config.panelClass]) : [])];
    this.show(message, {
      ...config,
      panelClass
    });
  }

  /**
   * Show error notification
   */
  error(message: string, config?: NotificationConfig): void {
    const panelClass = ['error-snackbar', ...(config?.panelClass ? (Array.isArray(config.panelClass) ? config.panelClass : [config.panelClass]) : [])];
    this.show(message, {
      duration: config?.duration ?? 5000, // Longer duration for errors
      ...config,
      panelClass
    });
  }

  /**
   * Show warning notification
   */
  warning(message: string, config?: NotificationConfig): void {
    const panelClass = ['warning-snackbar', ...(config?.panelClass ? (Array.isArray(config.panelClass) ? config.panelClass : [config.panelClass]) : [])];
    this.show(message, {
      ...config,
      panelClass
    });
  }

  /**
   * Show info notification
   */
  info(message: string, config?: NotificationConfig): void {
    const panelClass = ['info-snackbar', ...(config?.panelClass ? (Array.isArray(config.panelClass) ? config.panelClass : [config.panelClass]) : [])];
    this.show(message, {
      ...config,
      panelClass
    });
  }

  /**
   * Show custom notification
   */
  show(message: string, config?: NotificationConfig): void {
    const snackBarConfig: MatSnackBarConfig = {
      duration: config?.duration ?? this.DEFAULT_DURATION,
      horizontalPosition: config?.horizontalPosition ?? this.DEFAULT_HORIZONTAL_POSITION,
      verticalPosition: config?.verticalPosition ?? this.DEFAULT_VERTICAL_POSITION,
      panelClass: config?.panelClass
    };

    this.snackBar.open(message, 'Close', snackBarConfig);
  }

  /**
   * Dismiss current notification
   */
  dismiss(): void {
    this.snackBar.dismiss();
  }
}

