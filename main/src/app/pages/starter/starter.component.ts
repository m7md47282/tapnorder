import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { AppSalesOverviewComponent } from 'src/app/components/sales-overview/sales-overview.component';
import { AppYearlyBreakupComponent } from 'src/app/components/yearly-breakup/yearly-breakup.component';
import { AppMonthlyEarningsComponent } from 'src/app/components/monthly-earnings/monthly-earnings.component';
import { AppRecentTransactionsComponent } from 'src/app/components/recent-transactions/recent-transactions.component';
import { AppProductPerformanceComponent } from 'src/app/components/product-performance/product-performance.component';
import { AppBlogCardsComponent } from 'src/app/components/blog-card/blog-card.component';
import { AiInsightsWidgetComponent } from '../dashboard/components/ai-insights-widget/ai-insights-widget.component';


@Component({
  selector: 'app-starter',
  imports: [
    CommonModule,
    MaterialModule,
    AppSalesOverviewComponent,
    AppYearlyBreakupComponent,
    AppMonthlyEarningsComponent,
    AppRecentTransactionsComponent,
    AppProductPerformanceComponent,
    AppBlogCardsComponent,
    AiInsightsWidgetComponent
  ],
  templateUrl: './starter.component.html',
  styleUrls: ['./starter.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class StarterComponent implements OnInit {
  // Mock metrics data - in production, this would come from a service
  metrics = {
    totalRevenue: 12500,
    totalOrders: 450,
    avgOrderValue: 27.78,
    profitMargin: 35,
    revenueChange: 12.5,
    ordersChange: 8.3,
    avgOrderValueChange: 4.2,
    profitMarginChange: 2.1
  };

  ngOnInit(): void {
    // Load metrics from service in production
  }
}