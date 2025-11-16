# How to Login - POS System

## Current Login Flow

1. Navigate to `/authentication/login`
2. Enter username and password
3. Optionally check "Remember this Device"
4. Click "Sign In"
5. System will call backend API at `POST /api/auth/login`
6. On success, redirects to dashboard

## Backend Requirements

### API Endpoint
```
POST http://localhost:3000/api/auth/login
```

### Request Body
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "1",
      "username": "admin",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "SUPER_ADMIN",
      "permissions": ["*"],
      "isActive": true
    },
    "expiresIn": 3600
  }
}
```

## Testing Without Backend (Mock Mode) ✅ ENABLED BY DEFAULT

**Mock authentication is enabled by default** for testing without a backend!

### How to Use Mock Login:

1. **Start the Angular app:**
   ```bash
   npm start
   ```

2. **Navigate to login page:**
   - Go to `http://localhost:4200/authentication/login`

3. **Use these test credentials:**

   | Username | Password | Role | Description |
   |----------|----------|------|-------------|
   | `admin` | `admin123` | SUPER_ADMIN | Full system access |
   | `manager` | `manager123` | RESTAURANT_MANAGER | Restaurant management |
   | `shiftmanager` | `shift123` | SHIFT_MANAGER | Shift-level management |
   | `waiter` | `waiter123` | WAITER | Front-of-house service |
   | `cashier` | `cashier123` | CASHIER | Payment processing |
   | `host` | `host123` | HOST | Table & reservation management |
   | `chef` | `chef123` | CHEF | Kitchen operations |
   | `bartender` | `bar123` | BARTENDER | Bar operations |
   | `driver` | `driver123` | DELIVERY_DRIVER | Delivery operations |
   | `inventory` | `inv123` | INVENTORY_MANAGER | Inventory control |
   | `accountant` | `acc123` | ACCOUNTANT | Financial management |
   | `storemanager` | `store123` | STORE_MANAGER | Legacy (maps to RESTAURANT_MANAGER) |

4. **Login:**
   - Enter username and password
   - Click "Sign In"
   - You'll see "Login successful! (Mock Mode)" notification
   - You'll be redirected to the dashboard

### Disable Mock Mode:

When you're ready to use a real backend, edit `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  useMockAuth: false // Change to false to use real backend
};
```

## Setup Backend

### Option 1: Node.js/Express Backend
Create a simple Express server with JWT authentication:

```javascript
// server.js
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  // Mock validation (replace with real database check)
  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign({ userId: 1, username }, 'your-secret-key', { expiresIn: '1h' });
    
    res.json({
      success: true,
      data: {
        accessToken: token,
        refreshToken: 'refresh_token',
        user: {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
          isActive: true
        },
        expiresIn: 3600
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

### Option 2: Use Mock Service (Development Only)

See the mock implementation in the codebase for testing without a real backend.

## Default Test Credentials

If using the mock service:
- **Username:** `admin`
- **Password:** `admin123`

## Troubleshooting

1. **CORS Error**: Make sure your backend allows CORS from `http://localhost:4200`
2. **404 Error**: Check that your API URL in `environment.ts` matches your backend
3. **401 Error**: Verify credentials are correct
4. **Network Error**: Ensure backend server is running

## Next Steps

1. Set up your backend API
2. Update `environment.ts` with correct API URL
3. Test login with real credentials
4. Implement proper authentication on backend

