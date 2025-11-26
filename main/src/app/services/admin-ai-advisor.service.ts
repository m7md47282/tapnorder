import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { Order } from '../models/order.model';
import { Sale } from '../models/product.model';
import { IndexedDBService } from './indexeddb.service';
import { OrderService } from './order.service';

export interface BusinessInsight {
  id: string;
  type: 'revenue' | 'menu' | 'customer' | 'operations' | 'growth' | 'offer';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actionItems: string[];
  estimatedImpact?: {
    revenue?: number;
    customers?: number;
    percentage?: number;
  };
  data?: any;
}

export interface OfferSuggestion {
  id: string;
  name: string;
  type: 'discount' | 'bundle' | 'upsell' | 'seasonal' | 'loyalty';
  description: string;
  discount?: number;
  targetItems?: string[];
  conditions?: string[];
  expectedImpact: {
    revenueIncrease: number;
    customerIncrease: number;
    avgOrderValueIncrease: number;
  };
  implementation: string[];
  timing: 'immediate' | 'this-week' | 'this-month';
}

export interface BusinessMetrics {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  topSellingItems: Array<{ itemId: string; name: string; quantity: number; revenue: number }>;
  slowMovingItems: Array<{ itemId: string; name: string; quantity: number; revenue: number }>;
  peakHours: Array<{ hour: number; orders: number; revenue: number }>;
  customerTrends: {
    newCustomers: number;
    returningCustomers: number;
    avgVisitFrequency: number;
  };
  profitMargins: {
    overall: number;
    byCategory: Array<{ category: string; margin: number }>;
  };
  trends: {
    revenueGrowth: number; // percentage
    orderGrowth: number;
    avgOrderValueGrowth: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminAiAdvisorService {
  constructor(
    private indexedDB: IndexedDBService,
    private orderService: OrderService
  ) {}

  /**
   * Get comprehensive business insights
   */
  getBusinessInsights(): Observable<BusinessInsight[]> {
    // In production, this would analyze real data
    // For now, we'll generate insights based on patterns
    const insights: BusinessInsight[] = [];

    // Analyze revenue trends
    insights.push(...this.analyzeRevenueTrends());

    // Analyze menu performance
    insights.push(...this.analyzeMenuPerformance());

    // Analyze customer behavior
    insights.push(...this.analyzeCustomerBehavior());

    // Analyze operations
    insights.push(...this.analyzeOperations());

    // Growth opportunities
    insights.push(...this.identifyGrowthOpportunities());

    // Sort by priority
    return of(insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    })).pipe(delay(500));
  }

  /**
   * Get offer suggestions based on data
   */
  getOfferSuggestions(): Observable<OfferSuggestion[]> {
    const offers: OfferSuggestion[] = [];

    // Analyze slow-moving items
    offers.push(...this.suggestSlowMovingItemOffers());

    // Analyze peak hours
    offers.push(...this.suggestPeakHourOffers());

    // Analyze customer patterns
    offers.push(...this.suggestUpsellOffers());

    // Seasonal offers
    offers.push(...this.suggestSeasonalOffers());

    return of(offers).pipe(delay(500));
  }

  /**
   * Get business metrics summary
   */
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    // In production, this would fetch from database
    // For now, return calculated metrics
    return {
      totalRevenue: 12500,
      totalOrders: 450,
      avgOrderValue: 27.78,
      topSellingItems: [
        { itemId: '1', name: 'Chicken Ouzi Box', quantity: 120, revenue: 500.40 },
        { itemId: '5', name: 'Mansaf', quantity: 85, revenue: 722.50 },
        { itemId: '14', name: 'Fresh Orange Juice', quantity: 200, revenue: 400.00 }
      ],
      slowMovingItems: [
        { itemId: '11', name: 'Fried Kibbeh', quantity: 15, revenue: 14.25 },
        { itemId: '6', name: 'Knafeh', quantity: 20, revenue: 60.00 }
      ],
      peakHours: [
        { hour: 12, orders: 45, revenue: 1250 },
        { hour: 13, orders: 52, revenue: 1444 },
        { hour: 19, orders: 38, revenue: 1055 },
        { hour: 20, orders: 35, revenue: 972 }
      ],
      customerTrends: {
        newCustomers: 120,
        returningCustomers: 330,
        avgVisitFrequency: 2.3
      },
      profitMargins: {
        overall: 0.35,
        byCategory: [
          { category: 'mains', margin: 0.42 },
          { category: 'beverages', margin: 0.55 },
          { category: 'appetizers', margin: 0.38 },
          { category: 'desserts', margin: 0.45 }
        ]
      },
      trends: {
        revenueGrowth: 12.5,
        orderGrowth: 8.3,
        avgOrderValueGrowth: 4.2
      }
    };
  }

  /**
   * Analyze revenue trends
   */
  private analyzeRevenueTrends(): BusinessInsight[] {
    const insights: BusinessInsight[] = [];

    insights.push({
      id: 'rev-1',
      type: 'revenue',
      priority: 'high',
      title: 'Revenue Growth Opportunity',
      description: 'Your revenue is growing at 12.5% month-over-month. Peak hours (12-1 PM, 7-8 PM) account for 40% of daily revenue. Consider extending peak-hour promotions to drive more traffic during slower periods.',
      impact: 'Could increase daily revenue by 15-20% by optimizing off-peak hours',
      actionItems: [
        'Launch "Happy Hour" promotion from 2-5 PM with 20% off beverages',
        'Create lunch combo deals for 12-1 PM to increase average order value',
        'Implement "Early Bird" dinner specials for 5-6 PM',
        'Add breakfast menu to capture morning traffic'
      ],
      estimatedImpact: {
        revenue: 1875, // 15% of current monthly revenue
        percentage: 15
      }
    });

    return insights;
  }

  /**
   * Analyze menu performance
   */
  private analyzeMenuPerformance(): BusinessInsight[] {
    const insights: BusinessInsight[] = [];

    insights.push({
      id: 'menu-1',
      type: 'menu',
      priority: 'high',
      title: 'Slow-Moving Items Need Attention',
      description: 'Fried Kibbeh and Knafeh are underperforming with only 15 and 20 sales respectively. These items have high profit margins (45%+) but low visibility.',
      impact: 'Could increase revenue by $200-300/month by promoting these items',
      actionItems: [
        'Create "Chef\'s Special" badge for slow-moving items',
        'Bundle slow items with top sellers (e.g., "Mansaf + Knafeh Combo")',
        'Add to "Picks for You" section with AI recommendations',
        'Train staff to upsell these items',
        'Consider temporary price reduction to drive trial'
      ],
      estimatedImpact: {
        revenue: 250,
        percentage: 2
      }
    });

    insights.push({
      id: 'menu-2',
      type: 'menu',
      priority: 'medium',
      title: 'Top Sellers Have Upsell Potential',
      description: 'Chicken Ouzi Box and Mansaf are your top sellers. Customers ordering these items have high average order values. Create premium versions or add-ons to increase revenue per customer.',
      impact: 'Could increase average order value by $3-5 per transaction',
      actionItems: [
        'Create "Premium Ouzi" with extra sides (+$2.50)',
        'Offer "Mansaf Feast" bundle with appetizer and dessert (+$5)',
        'Suggest beverage pairings at checkout',
        'Create "Family Feast" combos for groups'
      ],
      estimatedImpact: {
        revenue: 1350, // $3 avg increase × 450 orders
        percentage: 10.8
      }
    });

    return insights;
  }

  /**
   * Analyze customer behavior
   */
  private analyzeCustomerBehavior(): BusinessInsight[] {
    const insights: BusinessInsight[] = [];

    insights.push({
      id: 'cust-1',
      type: 'customer',
      priority: 'high',
      title: 'Customer Retention Opportunity',
      description: 'You have 120 new customers but only 330 returning customers (73% retention). Implementing a loyalty program could significantly increase repeat visits.',
      impact: 'Could increase customer lifetime value by 40-60%',
      actionItems: [
        'Launch "Loyalty Rewards" program: 10th visit free meal',
        'Create "VIP Club" with exclusive offers for frequent customers',
        'Send personalized offers to customers who haven\'t visited in 2+ weeks',
        'Implement referral program: "Bring a friend, get 20% off"',
        'Create birthday rewards program'
      ],
      estimatedImpact: {
        customers: 50, // Additional returning customers
        percentage: 15
      }
    });

    insights.push({
      id: 'cust-2',
      type: 'customer',
      priority: 'medium',
      title: 'Average Order Value Optimization',
      description: 'Your average order value is $27.78. Industry benchmark for similar restaurants is $32-35. There\'s room to increase through strategic upselling.',
      impact: 'Could increase revenue by $1,900/month by increasing AOV by $4.22',
      actionItems: [
        'Train staff on upselling techniques (target: +$2-3 per order)',
        'Create "Add-ons" menu with high-margin items',
        'Implement "Would you like to add..." prompts at POS',
        'Create combo deals that increase order value',
        'Display "Popular Add-ons" on menu boards'
      ],
      estimatedImpact: {
        revenue: 1900,
        percentage: 15.2
      }
    });

    return insights;
  }

  /**
   * Analyze operations
   */
  private analyzeOperations(): BusinessInsight[] {
    const insights: BusinessInsight[] = [];

    insights.push({
      id: 'ops-1',
      type: 'operations',
      priority: 'medium',
      title: 'Peak Hour Capacity Optimization',
      description: 'Peak hours (12-1 PM, 7-8 PM) are generating strong revenue but may be at capacity. Consider pre-order system or time slots to maximize throughput.',
      impact: 'Could serve 20-30% more customers during peak hours',
      actionItems: [
        'Implement online pre-ordering for lunch rush',
        'Create "Express Lane" for quick orders',
        'Offer "Skip the Line" premium service',
        'Optimize kitchen workflow during peak hours',
        'Consider adding more staff during peak times'
      ],
      estimatedImpact: {
        revenue: 2500,
        percentage: 20
      }
    });

    return insights;
  }

  /**
   * Identify growth opportunities
   */
  private identifyGrowthOpportunities(): BusinessInsight[] {
    const insights: BusinessInsight[] = [];

    insights.push({
      id: 'growth-1',
      type: 'growth',
      priority: 'high',
      title: 'Scale Revenue Without Scaling Costs',
      description: 'Your profit margins are healthy (35% overall). Beverages have the highest margin (55%). Focus on increasing beverage sales to improve profitability without major cost increases.',
      impact: 'Could increase profit margin to 38-40% by optimizing product mix',
      actionItems: [
        'Create signature drinks with higher margins',
        'Implement "Free drink with meal" promotions',
        'Add premium beverage options',
        'Train staff to always suggest beverages',
        'Create beverage-focused happy hour'
      ],
      estimatedImpact: {
        revenue: 2000,
        percentage: 16
      }
    });

    insights.push({
      id: 'growth-2',
      type: 'growth',
      priority: 'medium',
      title: 'Expand Revenue Streams',
      description: 'Consider adding catering, meal prep, or delivery services to capture additional revenue outside of dine-in hours.',
      impact: 'Could add $3,000-5,000/month in new revenue streams',
      actionItems: [
        'Launch catering menu for events',
        'Create meal prep subscription service',
        'Partner with delivery platforms',
        'Offer corporate lunch programs',
        'Create "Chef\'s Table" premium dining experience'
      ],
      estimatedImpact: {
        revenue: 4000,
        percentage: 32
      }
    });

    return insights;
  }

  /**
   * Suggest offers for slow-moving items
   */
  private suggestSlowMovingItemOffers(): OfferSuggestion[] {
    return [
      {
        id: 'offer-1',
        name: 'Knafeh Special',
        type: 'discount',
        description: '20% off Knafeh - Perfect dessert to end your meal',
        discount: 20,
        targetItems: ['6'],
        conditions: ['Order any main dish'],
        expectedImpact: {
          revenueIncrease: 120,
          customerIncrease: 15,
          avgOrderValueIncrease: 2.40
        },
        implementation: [
          'Add banner to menu',
          'Train staff to mention offer',
          'Display on POS system',
          'Create social media post'
        ],
        timing: 'immediate'
      }
    ];
  }

  /**
   * Suggest peak hour offers
   */
  private suggestPeakHourOffers(): OfferSuggestion[] {
    return [
      {
        id: 'offer-2',
        name: 'Lunch Rush Combo',
        type: 'bundle',
        description: 'Any main + Appetizer + Drink for $15 (Save $5)',
        targetItems: ['mains', 'appetizers', 'beverages'],
        expectedImpact: {
          revenueIncrease: 800,
          customerIncrease: 40,
          avgOrderValueIncrease: 3.50
        },
        implementation: [
          'Create combo menu section',
          'Display prominently during 12-1 PM',
          'Add to POS quick buttons',
          'Promote on social media'
        ],
        timing: 'this-week'
      },
      {
        id: 'offer-3',
        name: 'Happy Hour',
        type: 'discount',
        description: '20% off all beverages 2-5 PM',
        discount: 20,
        targetItems: ['beverages'],
        expectedImpact: {
          revenueIncrease: 450,
          customerIncrease: 25,
          avgOrderValueIncrease: 1.80
        },
        implementation: [
          'Update menu with Happy Hour section',
          'Create signage',
          'Train staff',
          'Promote to office workers nearby'
        ],
        timing: 'immediate'
      }
    ];
  }

  /**
   * Suggest upsell offers
   */
  private suggestUpsellOffers(): OfferSuggestion[] {
    return [
      {
        id: 'offer-4',
        name: 'Complete Your Meal',
        type: 'upsell',
        description: 'Add appetizer + dessert for just $5 more (Regularly $7.50)',
        targetItems: ['appetizers', 'desserts'],
        expectedImpact: {
          revenueIncrease: 675,
          customerIncrease: 0,
          avgOrderValueIncrease: 5.00
        },
        implementation: [
          'Add to POS as suggested add-on',
          'Train staff to offer after main order',
          'Display on menu',
          'Create visual combo display'
        ],
        timing: 'immediate'
      }
    ];
  }

  /**
   * Suggest seasonal offers
   */
  private suggestSeasonalOffers(): OfferSuggestion[] {
    const month = new Date().getMonth();
    const offers: OfferSuggestion[] = [];

    if (month >= 11 || month <= 1) {
      // Winter season
      offers.push({
        id: 'offer-5',
        name: 'Winter Warm-Up',
        type: 'seasonal',
        description: 'Hot beverages + Comfort food combo',
        targetItems: ['beverages', 'mains'],
        expectedImpact: {
          revenueIncrease: 600,
          customerIncrease: 30,
          avgOrderValueIncrease: 2.50
        },
        implementation: [
          'Create winter menu section',
          'Promote hot beverages',
          'Bundle with comfort foods',
          'Social media campaign'
        ],
        timing: 'this-month'
      });
    }

    return offers;
  }

  /**
   * Get personalized business advice
   */
  getBusinessAdvice(query: string): Observable<string> {
    // Analyze query and provide advice
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('revenue') || lowerQuery.includes('profit')) {
      return of('Focus on your high-margin items (beverages at 55% margin). Increase beverage sales by 20% and you\'ll add $2,200/month in profit without increasing costs. Train staff to always suggest beverages and create signature drinks.');
    }

    if (lowerQuery.includes('customer') || lowerQuery.includes('retention')) {
      return of('Your retention rate is 73%. Implement a loyalty program: "10th visit free meal" costs you $27 but generates $270+ in revenue. That\'s a 10x ROI. Also, reach out to customers who haven\'t visited in 2+ weeks with a personalized offer.');
    }

    if (lowerQuery.includes('menu') || lowerQuery.includes('items')) {
      return of('Your top 3 items generate 40% of revenue. Create premium versions (+$2-3) and bundles. Slow-moving items like Knafeh have high margins - promote them as "Chef\'s Special" or bundle with top sellers.');
    }

    if (lowerQuery.includes('scale') || lowerQuery.includes('grow')) {
      return of('Scale revenue without scaling costs: 1) Increase beverage sales (highest margin), 2) Add catering/meal prep (new revenue stream), 3) Optimize peak hours (pre-orders), 4) Implement loyalty program (retention). These could add $6,000-8,000/month.');
    }

    return of('Based on your data: Revenue is growing 12.5% month-over-month. Focus on: 1) Optimizing off-peak hours with promotions, 2) Increasing average order value through upselling, 3) Improving customer retention with loyalty program, 4) Promoting high-margin items. These strategies could increase monthly revenue by 25-30%.');
  }
}

