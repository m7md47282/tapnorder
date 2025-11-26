import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { AdminAiAdvisorService, BusinessInsight } from '../../../../services/admin-ai-advisor.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-ai-insights-widget',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterModule],
  templateUrl: './ai-insights-widget.component.html',
  styleUrls: ['./ai-insights-widget.component.scss']
})
export class AiInsightsWidgetComponent implements OnInit, OnDestroy {
  topInsights: BusinessInsight[] = [];
  isLoading: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(private aiAdvisor: AdminAiAdvisorService) {}

  ngOnInit(): void {
    this.loadTopInsights();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTopInsights(): void {
    this.isLoading = true;
    
    this.aiAdvisor.getBusinessInsights()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (insights) => {
          // Get top 3 high-priority insights
          this.topInsights = insights
            .filter(insight => insight.priority === 'high')
            .slice(0, 3);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading insights:', error);
          this.isLoading = false;
        }
      });
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#757575';
    }
  }

  getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'high': return 'priority_high';
      case 'medium': return 'remove';
      case 'low': return 'check_circle';
      default: return 'info';
    }
  }
}

