# Business Logic: AI-Powered Taste Recommendation System for Restaurants & Coffee Houses

## 1. System Overview & Core Concept

### Purpose
Build a comprehensive system that learns each user's taste preferences across **all menu categories** (food, drinks, coffee, sweets, pastries) and recommends items and customizations that match their profile.

### Core Principle
- **Learn from behavior**: Analyze past orders across all categories to infer preferences
- **Learn from conversation**: Extract preferences from chat interactions
- **Match taste profiles**: Compare user preferences with item taste characteristics
- **Suggest modifications**: Recommend add-ons/modifications to adjust items to user preferences
- **Category-agnostic**: Works for beverages, food, desserts, pastries, etc.

---

## 2. User Journey & Interaction Flow

### 2.1 New User (First Visit)
1. User opens menu → System generates/retrieves `guestUuid` (stored in localStorage)
2. No preference data exists → System uses default neutral profile
3. User can:
   - Browse menu normally (all categories: food, drinks, sweets, pastries)
   - Chat with AI to describe preferences ("I like spicy food", "I prefer sweet desserts")
   - Place an order

### 2.2 User Places First Order
1. Order is created with `guestUuid`
2. System analyzes ordered items across all categories:
   - Extracts taste profiles from each item (food, drink, dessert, etc.)
   - Calculates weighted average (by quantity) across all items
   - Creates initial user taste profile
   - Tracks category preferences (e.g., prefers savory food over sweets)
3. Profile saved to database with low confidence (0.3)

### 2.3 User Chats with AI
1. User describes preferences:
   - "I like spicy food" → Updates spicy preference
   - "I prefer sweet desserts" → Updates sweet preference for dessert category
   - "I don't like bitter coffee" → Updates bitter preference for beverages
   - "I love creamy pastries" → Updates creamy preference for pastries
2. AI extracts taste characteristics from the message
3. System updates user profile:
   - Merges chat-derived preferences with existing profile
   - Can update category-specific preferences
   - Increases confidence slightly
   - Marks source as "fromChat"

### 2.4 User Places More Orders
1. Each order updates the profile:
   - Analyzes items across all categories ordered
   - Weighted average with existing profile
   - Confidence increases with more orders
   - Preferred categories/items tracked (food vs drinks vs desserts)
2. After 3+ orders, confidence reaches ~0.6-0.7

### 2.5 User Logs In
1. If user was a guest:
   - System attempts to merge guest profile with user account
   - If user has existing profile, merge both
   - If no existing profile, transfer guest profile to user account
2. If user was already logged in:
   - Continue using existing profile
   - All future orders update the same profile

---

## 3. Data Collection & Learning Strategy

### 3.1 Data Sources (Priority Order)

#### Source 1: Order History (Primary - 70% weight)
**What we collect:**
- Items ordered across all categories (food, drinks, sweets, pastries)
- Quantities
- Add-ons/modifications selected
- Frequency of orders
- Time patterns (breakfast vs lunch vs dinner preferences)
- Category distribution (does user order more food or drinks?)

**How we learn:**
- Extract taste profile from each item's `tasteProfile`
- Calculate weighted average: `(item1.taste * qty1 + item2.taste * qty2) / totalQty`
- Track which categories are ordered most
- Identify patterns (e.g., always orders spicy food, sweet desserts)
- Learn category-specific preferences (e.g., spicy for food, sweet for desserts)

#### Source 2: Chat Interactions (Secondary - 30% weight)
**What we collect:**
- Explicit taste mentions ("I like spicy", "I prefer sweet desserts")
- Category-specific preferences ("I don't like bitter coffee", "I love creamy pastries")
- Dislikes ("I don't like bitter coffee", "too spicy for me")
- Customization requests ("extra shot", "oat milk", "extra cheese", "less spicy")

**How we learn:**
- AI extracts taste characteristics from natural language
- Maps keywords to taste profile values
- Can be category-specific (e.g., "sweet desserts" vs "sweet coffee")
- Updates profile with chat-derived preferences
- Lower weight because users may experiment in chat

#### Source 3: Implicit Feedback (Tertiary - 10% weight)
**What we collect:**
- Items viewed but not ordered
- Items added to cart but removed
- Time spent viewing items

**How we learn:**
- Negative signals (viewed but didn't order) may indicate dislike
- Future enhancement - not in initial implementation

### 3.2 Confidence Scoring System

Confidence indicates how reliable the taste profile is:

- **0.0 - 0.3**: New user, default profile, low confidence
- **0.3 - 0.5**: 1-2 orders, some chat interactions, moderate confidence
- **0.5 - 0.7**: 3-5 orders, regular interactions, good confidence
- **0.7 - 0.9**: 5+ orders, consistent patterns, high confidence
- **0.9 - 1.0**: 10+ orders, very consistent, very high confidence

**Formula:**
```
confidence = 0.3 + (fromOrders * 0.05) + (fromChat * 0.03)
capped at 1.0
```

---

## 4. Taste Profile System

### 4.1 User Taste Profile Structure

Each user has a taste profile with values **0-5** for each characteristic:

**Universal Taste Characteristics:**
- **Sweet**: 0 = not sweet, 5 = very sweet
- **Bitter**: 0 = not bitter, 5 = very bitter
- **Creamy**: 0 = not creamy, 5 = very creamy
- **Strong**: 0 = mild, 5 = very strong
- **Spicy**: 0 = not spicy, 5 = very spicy
- **Mild**: 0 = not mild, 5 = very mild
- **Salty**: 0 = not salty, 5 = very salty

**Optional Category-Specific Profiles:**
- **Beverages**: Can have different sweet/bitter preferences than food
- **Food**: Can have different spicy/salty preferences than desserts
- **Desserts/Pastries**: Can have different sweet/creamy preferences

**Example:**
- User might like: spicy food (spicy=4 for food), sweet desserts (sweet=5 for desserts), mild coffee (bitter=1, strong=2 for beverages)

### 4.2 Item Taste Profile

Each menu item has a taste profile indicating its characteristics:

**Profile Structure:**
- Same characteristics as user profile (sweet, bitter, creamy, strong, spicy, mild, salty)
- Category context: The profile reflects the item's category (food, beverage, dessert, pastry)

**Source Options:**
1. **Manual**: Admin sets values for each item
2. **AI-generated**: AI analyzes description/ingredients
3. **Ingredient-based**: Calculated from recipe ingredients

**Examples:**
- **Espresso (Beverage)**: sweet=1, bitter=4, creamy=1, strong=5, mild=1, spicy=0, salty=0
- **Spanish Latte (Beverage)**: sweet=4, bitter=2, creamy=5, strong=3, mild=2, spicy=0, salty=0
- **Spicy Chicken Wrap (Food)**: sweet=1, bitter=0, creamy=2, strong=2, mild=1, spicy=4, salty=3
- **Chocolate Croissant (Pastry)**: sweet=5, bitter=2, creamy=4, strong=1, mild=3, spicy=0, salty=1
- **Tiramisu (Dessert)**: sweet=4, bitter=3, creamy=5, strong=2, mild=2, spicy=0, salty=0

### 4.3 Profile Merging Logic

When updating from new data:

```
newProfile = (existingProfile * existingConfidence) + (newData * (1 - existingConfidence))
```

**Category-Aware Merging:**
- If new data is from a specific category (e.g., dessert), it can update category-specific preferences
- If user has category-specific profile, merge within that category
- Otherwise, merge into general profile

**Example:**
- Existing general: sweet=3, confidence=0.5
- New dessert order suggests: sweet=5
- If category-specific enabled: dessert.sweet = (3 * 0.5) + (5 * 0.5) = 4
- If general only: general.sweet = (3 * 0.5) + (5 * 0.5) = 4

---

## 5. Recommendation & Matching Algorithm

### 5.1 Matching Process

**Step 1: Calculate compatibility score for each menu item**

```
For each item:
  compatibility = 0
  
  // Get appropriate user profile (category-specific or general)
  userProfile = getProfileForCategory(item.category)
  
  For each taste characteristic:
    difference = |userTaste - itemTaste|
    similarity = 5 - difference  // Max 5 points per characteristic
    compatibility += similarity
  
  compatibility = compatibility / number_of_characteristics
  // Normalize to 0-1 scale
```

**Step 2: Apply additional factors**

```
finalScore = compatibility * 0.6 + 
             categoryPreference * 0.2 + 
             itemPreference * 0.15 + 
             ratingBoost * 0.05
```

Where:
- `compatibility`: Taste match (0-1)
- `categoryPreference`: 1.0 if user orders this category often, 0.5 otherwise
- `itemPreference`: 1.0 if user ordered this item before, 0.5 otherwise
- `ratingBoost`: Item rating / 5.0

**Step 3: Category Diversity**
- Ensure recommendations include variety across categories
- If user orders mostly food, still suggest some drinks/desserts
- Top 6 recommendations should have at least 2 different categories

**Step 4: Sort and filter**
- Sort items by finalScore (descending)
- Filter out unavailable items
- Return top 6 recommendations (diverse across categories)

### 5.2 Custom Order Suggestions

When user requests customization:

1. **Identify base item** (from user message or best match)
   - Can be food, drink, dessert, or pastry

2. **Calculate taste gap:**
   ```
   gap = userTaste - baseItemTaste
   ```

3. **Suggest modifications/add-ons to close the gap:**

   **For Beverages:**
   - If gap.sweet > 1: suggest vanilla/caramel/hazelnut syrup
   - If gap.creamy > 1: suggest oat milk, almond milk, whipped cream
   - If gap.bitter > 1: suggest sweet syrups, milk alternatives
   - If gap.strong < -1: suggest extra shot
   - If gap.strong > 1: suggest decaf, less shots

   **For Food:**
   - If gap.spicy > 1: suggest extra spice, chili sauce
   - If gap.spicy < -1: suggest mild version, remove spice
   - If gap.creamy > 1: suggest extra cheese, sauce
   - If gap.salty > 1: suggest extra salt, salty toppings
   - If gap.salty < -1: suggest less salt, no salt option

   **For Desserts/Pastries:**
   - If gap.sweet > 1: suggest extra syrup, honey, sweet toppings
   - If gap.sweet < -1: suggest less sweet version, no sugar option
   - If gap.creamy > 1: suggest whipped cream, custard, cream filling
   - If gap.strong > 1: suggest stronger flavor (e.g., dark chocolate)

4. **Calculate total price and present custom order**

### 5.3 Category-Specific Recommendations

**Breakfast/Morning:**
- Prioritize pastries, breakfast items, morning beverages
- Lower weight on spicy food, higher on sweet/mild

**Lunch:**
- Balance food and drinks
- Consider savory preferences

**Dinner:**
- Focus on main courses, dinner beverages
- Consider stronger flavors

**Dessert Time:**
- Prioritize desserts, pastries, sweet beverages
- Higher weight on sweet/creamy preferences

---

## 6. Data Persistence Strategy

### 6.1 Guest Users (Not Logged In)

**Storage location:** Firestore collection `userTastePreferences`

**Document structure:**
```json
{
  "guestUuid": "uuid-123",
  "userId": null,
  "placeId": "place-123",
  
  // General taste profile
  "tasteProfile": { 
    "sweet": 4, 
    "bitter": 2, 
    "creamy": 3,
    "strong": 2,
    "spicy": 3,
    "mild": 2,
    "salty": 3
  },
  
  // Optional: Category-specific profiles
  "categoryProfiles": {
    "beverages": { "sweet": 3, "bitter": 2, "creamy": 4, ... },
    "food": { "spicy": 4, "salty": 3, "sweet": 1, ... },
    "desserts": { "sweet": 5, "creamy": 4, ... },
    "pastries": { "sweet": 4, "creamy": 3, ... }
  },
  
  "confidence": 0.6,
  "sources": { "fromOrders": 3, "fromChat": 2 },
  "preferredCategories": ["food", "beverages", "desserts"],
  "preferredItems": ["item-1", "item-2"],
  "dietaryRestrictions": [],
  "priceRange": { "min": 0, "max": 50 },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Query key:** `guestUuid + placeId`

### 6.2 Logged-In Users

**Storage location:** Same collection, but with `userId`

**Document structure:** Same as guest, but with `userId` instead of `guestUuid`

**Query key:** `userId + placeId`

### 6.3 Profile Merging on Login

When guest user logs in:

1. Check if guest profile exists for this `placeId`
2. Check if user profile exists for this `placeId`
3. **Merge logic:**
   - If both exist: weighted merge based on confidence
   - If only guest exists: transfer to user account
   - If only user exists: keep user profile
   - If neither exists: create default profile

**Merge formula:**
```
mergedProfile = (guestProfile * guestConfidence + userProfile * userConfidence) / (guestConfidence + userConfidence)
mergedConfidence = min(1.0, guestConfidence + userConfidence)
```

---

## 7. Chat Interaction Logic

### 7.1 Chat Flow

1. User sends message
2. AI analyzes intent:
   - Taste preference query ("I like spicy food")
   - Category-specific preference ("I prefer sweet desserts")
   - Custom order request ("I want a spicy wrap with extra cheese")
   - General recommendation request ("What do you recommend?")
   - Greeting/help
3. AI extracts taste characteristics from message
   - Can be general or category-specific
4. System updates user profile (if taste mentioned)
   - Updates general profile or category-specific profile
5. AI generates recommendations based on updated profile
   - Considers all categories (food, drinks, desserts, pastries)
6. Response includes:
   - Natural language explanation
   - Recommended items across categories (if applicable)
   - Custom order suggestion (if applicable)

### 7.2 Taste Extraction from Chat

**Keywords mapping (category-agnostic):**

- **Sweet:** "sweet", "sugar", "honey", "syrup", "candy", "dessert" → sweet += 1
- **Bitter:** "bitter", "strong", "dark", "intense" → bitter += 1
- **Creamy:** "creamy", "smooth", "milky", "foamy", "rich" → creamy += 1
- **Strong:** "strong", "bold", "intense", "extra shot", "powerful" → strong += 1
- **Mild:** "mild", "light", "soft", "gentle" → mild += 1, strong -= 1
- **Spicy:** "spicy", "hot", "chili", "pepper", "heat" → spicy += 1
- **Salty:** "salty", "savory", "salted" → salty += 1

**Category-specific keywords:**
- "spicy food" → updates spicy for food category
- "sweet dessert" → updates sweet for dessert category
- "bitter coffee" → updates bitter for beverage category
- "creamy pastry" → updates creamy for pastry category

**Negation handling:**
- "not too bitter" → bitter -= 1
- "less sweet" → sweet -= 1
- "not spicy" → spicy -= 1

**Context awareness:**
- "I like spicy food but sweet desserts" → updates both categories separately
- "I prefer mild coffee" → updates beverage category specifically

---

## 8. Business Rules & Constraints

### 8.1 Profile Update Rules

1. **Minimum update interval:** 5 minutes (prevent spam updates)
2. **Maximum profile change per update:** ±2 points (prevent wild swings)
3. **Confidence decay:** If no activity for 90 days, reduce confidence by 0.1
4. **Profile reset:** User can manually reset (sets to default, confidence to 0.3)
5. **Category weighting:** Orders from different categories contribute equally to general profile, but can update category-specific profiles

### 8.2 Recommendation Rules

1. **Always show at least 3 recommendations** (even if low confidence)
2. **Category diversity:** Include items from at least 2 different categories
3. **Include at least 1 item user hasn't tried** (exploration)
4. **Don't recommend unavailable items**
5. **Respect dietary restrictions** (if user has "vegan", don't suggest dairy/meat items)
6. **Time-aware recommendations:** Consider time of day (breakfast items in morning, desserts in evening)
7. **Balance familiarity and exploration:** 70% items user might like, 30% new items to try

### 8.3 Privacy & Data Rules

1. **Guest profiles:** Can be deleted after 1 year of inactivity
2. **User profiles:** Persist indefinitely (unless user requests deletion)
3. **Data sharing:** Profiles are place-specific (not shared across places)
4. **Anonymization:** Guest UUIDs are not linked to personal info
5. **Category data:** Category-specific preferences are stored but can be anonymized

---

## 9. Success Metrics

### 9.1 Learning Effectiveness

- **Profile confidence growth rate**
- **Recommendation acceptance rate** (user orders recommended items)
- **Chat interaction quality** (user satisfaction with suggestions)
- **Category coverage** (does system learn preferences across all categories?)

### 9.2 Business Impact

- **Average order value increase** (better recommendations = more add-ons/modifications)
- **Cross-category sales** (recommending desserts when user orders food)
- **Customer retention** (personalized experience = repeat visits)
- **Upsell success rate** (custom order suggestions = higher ticket)
- **Category balance** (ensuring all categories get recommended)

---

## 10. Integration Points

### 10.1 Order Placement Flow

```
User places order (food, drinks, desserts, pastries)
  ↓
Order created with guestUuid/userId
  ↓
Trigger: updatePreferencesFromOrder
  ↓
Extract item taste profiles from all ordered items
  ↓
Calculate weighted average (by quantity) across all items
  ↓
Update user taste profile in database
  - Update general profile
  - Update category-specific profiles (if enabled)
  ↓
Increase confidence
  ↓
Track preferred categories and items
```

### 10.2 Chat Flow

```
User sends chat message
  ↓
Call AI service with:
  - User message
  - Current user taste profile (general + category-specific)
  - Menu items with taste profiles (all categories)
  - Order history (all categories)
  ↓
AI extracts taste preferences
  - Can be general or category-specific
  ↓
Update user profile (if new preferences detected)
  - Update general or category-specific profile
  ↓
AI generates recommendations
  - Considers all categories
  - Ensures category diversity
  ↓
Return response with recommendations
```

### 10.3 Login Flow

```
User logs in
  ↓
Check for guest profile (by guestUuid from localStorage)
  ↓
Check for user profile (by userId)
  ↓
If both exist: Merge profiles (general + category-specific)
If only guest: Transfer to user account
If only user: Keep user profile
If neither: Create default
  ↓
Save merged profile to user account
  ↓
Clear guest profile (optional)
```

---

## 11. Category-Specific Considerations

### 11.1 Beverages (Coffee, Tea, Drinks)

**Taste Profile Focus:**
- Sweet, Bitter, Creamy, Strong, Mild

**Common Modifications:**
- Milk alternatives (oat, almond, soy)
- Syrups (vanilla, caramel, hazelnut)
- Extra shots
- Decaf options
- Ice/hot preferences

**Recommendation Strategy:**
- Time-aware (hot in morning, iced in afternoon)
- Temperature preferences
- Caffeine sensitivity

### 11.2 Food (Main Courses, Appetizers, Sides)

**Taste Profile Focus:**
- Spicy, Salty, Sweet, Creamy, Strong

**Common Modifications:**
- Spice level adjustments
- Extra toppings (cheese, sauce)
- Dietary modifications (vegan, gluten-free)
- Portion size

**Recommendation Strategy:**
- Meal time awareness (breakfast vs lunch vs dinner)
- Pairing suggestions (food + drink)
- Dietary restriction compliance

### 11.3 Desserts

**Taste Profile Focus:**
- Sweet, Creamy, Mild, Strong (flavor intensity)

**Common Modifications:**
- Extra toppings (whipped cream, syrup)
- Less sweet options
- Flavor intensity

**Recommendation Strategy:**
- Time-aware (after meals)
- Pairing with beverages
- Portion size preferences

### 11.4 Pastries

**Taste Profile Focus:**
- Sweet, Creamy, Mild, Salty (for savory pastries)

**Common Modifications:**
- Filling preferences
- Topping preferences
- Freshness preferences

**Recommendation Strategy:**
- Time-aware (morning pastries)
- Pairing with beverages
- Freshness indicators

---

## 12. Implementation Phases

### Phase 1: Core System (MVP)
- Basic taste profile system (general only, no category-specific)
- Order-based learning
- Simple matching algorithm
- Database storage for preferences
- Basic chat integration

### Phase 2: Enhanced Learning
- Chat-based preference extraction
- Category-specific profiles
- Improved matching algorithm
- Profile merging on login

### Phase 3: Advanced Features
- Time-aware recommendations
- Dietary restriction handling
- Implicit feedback learning
- Advanced AI chat capabilities

---

## 13. Data Models Summary

### User Taste Preferences
```typescript
{
  userId?: string;
  guestUuid?: string;
  placeId: string;
  tasteProfile: TasteProfile;
  categoryProfiles?: {
    beverages?: TasteProfile;
    food?: TasteProfile;
    desserts?: TasteProfile;
    pastries?: TasteProfile;
  };
  confidence: number;
  sources: {
    fromOrders: number;
    fromChat: number;
    lastOrderDate?: string;
    lastChatDate?: string;
  };
  preferredCategories: string[];
  preferredItems: string[];
  dietaryRestrictions: string[];
  priceRange: { min: number; max: number };
  createdAt: string;
  updatedAt: string;
}
```

### Item Taste Profile
```typescript
{
  itemId: string;
  placeId: string;
  tasteProfile: TasteProfile;
  source: 'manual' | 'ai_generated' | 'ingredient_based';
  contributingIngredients?: string[];
  tasteDescription?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Taste Profile
```typescript
{
  sweet: number;      // 0-5
  bitter: number;    // 0-5
  creamy: number;    // 0-5
  strong: number;    // 0-5
  spicy: number;     // 0-5
  mild: number;      // 0-5
  salty: number;     // 0-5
  fruity?: number;   // 0-5 (optional)
  nutty?: number;    // 0-5 (optional)
}
```

---

## 14. Key Decisions & Rationale

### Why 0-5 Scale?
- Simple and intuitive
- Easy to calculate averages
- Clear for users to understand
- Works well with AI extraction

### Why Weighted Average for Merging?
- Prevents new data from completely overwriting existing profile
- Confidence-based weighting ensures stable learning
- Gradual adaptation to user preferences

### Why Category-Specific Profiles?
- Users may have different preferences for different categories
- Example: spicy food but sweet desserts
- More accurate recommendations per category

### Why Store in Database vs LocalStorage?
- Persists across devices
- Can merge guest and user profiles
- Better for analytics
- Supports logged-in users

### Why Multiple Data Sources?
- Orders are most reliable (actual behavior)
- Chat provides explicit preferences
- Combined gives comprehensive understanding

---

## 15. Future Enhancements

### Potential Additions:
1. **Seasonal Preferences**: Learn time-of-year preferences
2. **Weather-based Recommendations**: Suggest hot drinks in cold weather
3. **Social Learning**: Learn from similar users' preferences
4. **Nutritional Preferences**: Consider health goals
5. **Allergy Management**: Proactive allergy avoidance
6. **Group Ordering**: Handle preferences for multiple people
7. **Voice Input**: Support voice commands for chat
8. **Multi-language Support**: Support multiple languages in chat
9. **Visual Recommendations**: Show images of recommended items
10. **Gamification**: Reward users for trying new items

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Status:** Ready for Implementation

