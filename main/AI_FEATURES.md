# AI Assistant Features for Guest Menu

## Overview
The guest menu now includes a built-in AI assistant that helps users discover menu items, create custom orders, and provides personalized recommendations based on their order history.

## Features Implemented

### 1. AI Chat Assistant
- **Location**: Floating button in bottom-right corner (above cart button)
- **Icon**: Smart toy icon (🤖)
- **Functionality**:
  - Chat-based interface for natural language queries
  - Understands taste preferences (thick, creamy, bitter, sweet, spicy, etc.)
  - Creates custom orders based on user descriptions
  - Provides recommendations based on user preferences

### 2. Custom Order Creation
Users can describe their preferences in natural language, and the AI will:
- Understand taste preferences (e.g., "I like my Spanish latte thick but not too bitter")
- Suggest appropriate add-ons and modifications
- Create a custom order with:
  - Base item
  - Modifications (e.g., "Extra creamy", "Less bitter")
  - Add-ons (e.g., Oat Milk, Vanilla Syrup, Whipped Cream)
  - Total price calculation
- Add the custom order directly to cart with one click

### 3. AI-Driven "Picks for You" Section
The "Picks for you" category now uses AI to:
- Learn from user's order history
- Analyze preferences (categories, items, taste preferences)
- Score items based on:
  - User's previous orders (strong preference boost)
  - Preferred categories
  - Price range preferences
  - Item ratings
- Display personalized recommendations instead of generic top-rated items

### 4. Learning System
The AI learns from user behavior:
- **Order History Tracking**: Stores all orders for each guest UUID
- **Preference Learning**: 
  - Tracks preferred categories
  - Tracks preferred items
  - Learns taste preferences over time
- **Proactive Suggestions**: As users order more, recommendations become more accurate

## How It Works

### Chat Examples

**Example 1: Taste Preference**
```
User: "I like my latte thick but not too bitter"
AI: "I recommend Spanish Latte with oat milk and whipped cream for a thick, creamy texture without being too bitter."
[Custom Order Card with Add to Cart button]
```

**Example 2: Custom Order**
```
User: "I want something sweet and creamy"
AI: Creates custom order with base beverage + vanilla syrup + whipped cream
```

**Example 3: Recommendations**
```
User: "What do you recommend?"
AI: Shows top 3 personalized recommendations based on order history
```

### Recommendation Algorithm

The AI uses a scoring system:
1. **Base Score**: Item rating × 10
2. **Top Rated Boost**: +20 points
3. **Previous Order Boost**: +30 points (if user ordered before)
4. **Category Preference**: +15 points (if matches preferred categories)
5. **Price Range Match**: +10 points
6. **Variety Factor**: +0-5 random points

Items are sorted by score and top 6 are displayed in "Picks for you".

## Technical Implementation

### Services

1. **AiAssistantService** (`services/ai-assistant.service.ts`)
   - Handles chat message processing
   - Analyzes user intent
   - Generates recommendations
   - Manages user preferences
   - Stores order history

2. **AiChatComponent** (`pages/guest-menu/components/ai-chat/`)
   - Chat UI component
   - Message display
   - Custom order cards
   - Suggestion buttons

### Data Storage

- **User Preferences**: Stored in localStorage with key `ai_preferences_{guestUuid}`
- **Order History**: Stored in localStorage with key `orders_{guestUuid}`
- **Preferences Include**:
  - Preferred categories
  - Preferred items (IDs)
  - Dietary preferences
  - Taste preferences (spicy, sweet, bitter, salty, creamy - 0-5 scale)
  - Price range
  - Order history

### Integration Points

1. **Guest Menu Component**:
   - Integrates AI chat component
   - Updates "Picks for you" to use AI recommendations
   - Updates preferences after order placement

2. **Cart Service**:
   - Handles custom orders with notes
   - Adds base items with modification notes
   - Adds add-ons as separate items

## Available Add-ons

The AI can suggest these add-ons:
- Extra Shot (+0.75 JOD)
- Oat Milk (+0.50 JOD)
- Almond Milk (+0.50 JOD)
- Vanilla Syrup (+0.50 JOD)
- Caramel Syrup (+0.50 JOD)
- Hazelnut Syrup (+0.50 JOD)
- Whipped Cream (+0.75 JOD)
- Extra Cheese (+1.00 JOD)
- Extra Spice (+0.25 JOD)
- No Onions (free)

## Future Enhancements

Potential improvements:
1. **Backend Integration**: Connect to actual AI/ML service for better understanding
2. **Advanced NLP**: Better natural language understanding
3. **Dietary Restrictions**: Handle allergies and dietary restrictions
4. **Time-based Recommendations**: Suggest breakfast items in morning, dinner items in evening
5. **Social Learning**: Learn from similar users' preferences
6. **Voice Input**: Support voice commands
7. **Multi-language Support**: Support multiple languages

## Usage Tips

### For Users:
- Be specific about taste preferences
- Describe what you like/dislike
- Order regularly to improve recommendations
- Use the chat for custom orders

### For Developers:
- Customize add-ons in `AiAssistantService.ADDONS`
- Adjust recommendation scoring weights
- Add more intent patterns in `analyzeIntent()`
- Enhance preference tracking

## Notes

- The AI currently works offline using pattern matching and local storage
- For production, consider integrating with a real AI/ML service
- Order history is limited to last 50 orders per guest
- Preferences reset if localStorage is cleared

