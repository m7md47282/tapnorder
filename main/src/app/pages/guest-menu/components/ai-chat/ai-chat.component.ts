import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { AiAssistantService, ChatMessage, CustomOrderSuggestion } from '../../../../services/ai-assistant.service';
import { MenuItem } from '../../guest-menu.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.scss']
})
export class AiChatComponent implements OnInit, OnDestroy {
  @Input() menuItems: MenuItem[] = [];
  @Input() guestUuid: string | null = null;
  @Output() addCustomOrder = new EventEmitter<CustomOrderSuggestion>();
  @Output() addItem = new EventEmitter<MenuItem>();

  messages: ChatMessage[] = [];
  inputMessage: string = '';
  isOpen: boolean = false;
  isLoading: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(private aiService: AiAssistantService) {}

  ngOnInit(): void {
    // Send initial greeting when chat opens
    if (this.guestUuid) {
      this.sendInitialGreeting();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.messages.length === 0 && this.guestUuid) {
      this.sendInitialGreeting();
    }
  }

  closeChat(): void {
    this.isOpen = false;
  }

  sendMessage(): void {
    if (!this.inputMessage.trim() || !this.guestUuid || this.isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: this.inputMessage.trim(),
      timestamp: new Date()
    };

    this.messages.push(userMessage);
    const messageText = this.inputMessage.trim();
    this.inputMessage = '';
    this.isLoading = true;

    this.aiService.chat(messageText, this.guestUuid, this.menuItems)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.messages.push(response);
          this.isLoading = false;
          this.scrollToBottom();
        },
        error: (error) => {
          console.error('AI chat error:', error);
          this.messages.push({
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date()
          });
          this.isLoading = false;
        }
      });
  }

  sendInitialGreeting(): void {
    if (!this.guestUuid) return;

    this.aiService.chat('hello', this.guestUuid, this.menuItems)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.messages.push(response);
        },
        error: (error) => {
          console.error('Initial greeting error:', error);
        }
      });
  }

  addSuggestedItem(item: MenuItem): void {
    this.addItem.emit(item);
    this.messages.push({
      id: `action-${Date.now()}`,
      role: 'assistant',
      content: `Added ${item.name} to your cart! 🛒`,
      timestamp: new Date()
    });
  }

  addCustomOrderToCart(customOrder: CustomOrderSuggestion): void {
    this.addCustomOrder.emit(customOrder);
    this.messages.push({
      id: `action-${Date.now()}`,
      role: 'assistant',
      content: `Added your custom order to cart! 🛒`,
      timestamp: new Date()
    });
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const chatContainer = document.querySelector('.chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }
}

