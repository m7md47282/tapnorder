import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { AdminAiAdvisorService, BusinessInsight, OfferSuggestion, BusinessMetrics } from '../../../../services/admin-ai-advisor.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-admin-ai-advisor',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './admin-ai-advisor.component.html',
  styleUrls: ['./admin-ai-advisor.component.scss']
})
export class AdminAiAdvisorComponent implements OnInit, OnDestroy {
  insights: BusinessInsight[] = [];
  offers: OfferSuggestion[] = [];
  metrics: BusinessMetrics | null = null;
  isLoading: boolean = false;
  activeTabIndex: number = 0;

  @Input() initialTab: number = 0;
  
  // Chat
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> = [];
  chatInput: string = '';
  isChatLoading: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(private aiAdvisor: AdminAiAdvisorService) {}

  ngOnInit(): void {
    this.activeTabIndex = this.initialTab;
    this.loadData();
    this.initializeChat();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData(): Promise<void> {
    this.isLoading = true;
    
    try {
      // Load insights
      this.aiAdvisor.getBusinessInsights()
        .pipe(takeUntil(this.destroy$))
        .subscribe(insights => {
          this.insights = insights;
        });

      // Load offers
      this.aiAdvisor.getOfferSuggestions()
        .pipe(takeUntil(this.destroy$))
        .subscribe(offers => {
          this.offers = offers;
        });

      // Load metrics
      this.metrics = await this.aiAdvisor.getBusinessMetrics();
    } catch (error) {
      console.error('Error loading AI advisor data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  initializeChat(): void {
    this.chatMessages.push({
      role: 'assistant',
      content: 'Hello! I\'m your AI Business Advisor, inspired by Alex Hormozi\'s approach to scaling businesses. I analyze your restaurant data to provide actionable insights, offer suggestions, and growth strategies. How can I help you scale your business today?',
      timestamp: new Date()
    });
  }

  sendMessage(): void {
    if (!this.chatInput.trim() || this.isChatLoading) return;

    const userMessage = this.chatInput.trim();
    this.chatMessages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    this.chatInput = '';
    this.isChatLoading = true;

    this.aiAdvisor.getBusinessAdvice(userMessage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.chatMessages.push({
            role: 'assistant',
            content: response,
            timestamp: new Date()
          });
          this.isChatLoading = false;
          this.scrollChatToBottom();
        },
        error: (error) => {
          console.error('Chat error:', error);
          this.chatMessages.push({
            role: 'assistant',
            content: 'I apologize, but I encountered an error. Please try again.',
            timestamp: new Date()
          });
          this.isChatLoading = false;
        }
      });
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
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

  getOfferTypeColor(type: string): string {
    switch (type) {
      case 'discount': return '#4caf50';
      case 'bundle': return '#2196f3';
      case 'upsell': return '#ff9800';
      case 'seasonal': return '#9c27b0';
      case 'loyalty': return '#f44336';
      default: return '#757575';
    }
  }

  scrollChatToBottom(): void {
    setTimeout(() => {
      const chatContainer = document.querySelector('.chat-messages-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }
}

