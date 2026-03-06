# User Registration and Review Submission Flow

## Overview

Users can now register, login, and submit product reviews. The flow is:
1. Register → Auto-login → Submit reviews
2. Or Login → Submit reviews

## New Features

### 1. Registration Page (`/register`)
- Full name, email, password fields
- Password confirmation
- Email validation
- Minimum password length (6 characters)
- Auto-login after successful registration
- Redirects to original page user was trying to access

### 2. Updated Login Page
- Link to registration page
- Success message when redirected from registration
- Preserves redirect path through registration flow

### 3. Updated Home Page
- Links to both registration and login
- Clear call-to-action for new users

## User Flow

### New User Registration Flow

1. **User tries to submit a review** (not logged in)
   ```
   http://localhost:3001/product/PRODUCT_ID/review
   ```
   → Redirected to login

2. **User clicks "Create account"**
   → Goes to registration page

3. **User fills registration form:**
   - Full Name
   - Email
   - Password (min 6 characters)
   - Confirm Password

4. **After successful registration:**
   - User is automatically logged in
   - Redirected back to review form
   - Can immediately submit review

### Existing User Login Flow

1. **User tries to submit a review** (not logged in)
   → Redirected to login

2. **User logs in**
   - Email
   - Password

3. **After successful login:**
   - Redirected back to review form
   - Can submit review

## Routes

### Public Routes
- `/` - Home page
- `/login` - Login page
- `/register` - Registration page
- `/product/:productId` - Product details (view only)

### Protected Routes (require login)
- `/product/:productId/review` - Submit review
- `/review` - Submit review (with product selection)

## Testing the Registration Flow

### Step 1: Try to Submit a Review (Not Logged In)

```
http://localhost:3001/product/69582e10463a0a920732efa2/review
```

Expected: Redirected to `/login`

### Step 2: Click "Create account"

Expected: Redirected to `/register`

### Step 3: Fill Registration Form

- **Name:** Test User
- **Email:** testuser@example.com
- **Password:** password123
- **Confirm Password:** password123

Click "Create account"

### Step 4: Automatic Login and Redirect

Expected:
- User is automatically logged in
- Redirected back to `/product/69582e10463a0a920732efa2/review`
- Can now submit review

### Step 5: Submit Review

- Select rating (stars)
- Enter comment
- Click "Submit Review"

Expected:
- Success message
- Review submitted as "pending"
- Can view in admin panel

## API Endpoints Used

### Registration
```
POST /api/auth/register
Body: { name, email, password }
Response: { user: {...}, token: "..." }
```

### Login
```
POST /api/auth/login
Body: { email, password }
Response: { user: {...}, token: "..." }
```

### Submit Review
```
POST /api/reviews
Headers: { Authorization: "Bearer TOKEN" }
Body: FormData with review details
Response: { review: {...} }
```

## Validation Rules

### Registration
- ✅ All fields required
- ✅ Valid email format
- ✅ Password minimum 6 characters
- ✅ Passwords must match
- ✅ Email must be unique (checked by backend)

### Review Submission
- ✅ Must be logged in
- ✅ Product ID required
- ✅ Rating required (1-5 stars)
- ✅ Comment required
- ✅ Name and email auto-filled from user account

## User Data Storage

### LocalStorage
After login/registration, user data is stored:
```javascript
{
  user: {
    id: "user_id",
    name: "User Name",
    email: "user@example.com",
    role: "user"  // or "admin"
  },
  token: "jwt_token"
}
```

### MongoDB
User document:
```javascript
{
  _id: ObjectId,
  name: "User Name",
  email: "user@example.com",
  password: "hashed_password",
  role: "user",  // default
  createdAt: Date,
  updatedAt: Date
}
```

## Security Features

- ✅ Passwords hashed with bcrypt (backend)
- ✅ JWT tokens for authentication
- ✅ 7-day token expiration
- ✅ Protected routes require valid token
- ✅ Email uniqueness enforced

## Admin vs Regular Users

### Regular Users (role: "user")
- Can register via frontend
- Can login and submit reviews
- Reviews are "pending" by default
- Cannot access admin panel

### Admin Users (role: "admin")
- Created via seed script or backend
- Can access admin panel
- Reviews are "approved" by default
- Can manage all reviews

## Testing Different Scenarios

### Scenario 1: New User Registration
```
1. Go to: http://localhost:3001/register
2. Register with new email
3. Verify auto-login
4. Submit a review
5. Check admin panel - review should be "pending"
```

### Scenario 2: Existing User Login
```
1. Go to: http://localhost:3001/login
2. Login with existing credentials
3. Submit a review
4. Check admin panel - review should be "pending"
```

### Scenario 3: Registration with Existing Email
```
1. Try to register with email that exists
2. Should see error: "User already exists"
3. Click "Sign in" link
4. Login with existing credentials
```

### Scenario 4: Password Mismatch
```
1. Go to registration
2. Enter different passwords
3. Should see error: "Passwords do not match"
4. Cannot submit until passwords match
```

## Troubleshooting

### Registration fails
- Check backend is running
- Check MongoDB connection
- Check console for errors
- Verify email doesn't already exist

### Auto-login doesn't work
- Check backend returns token in registration response
- Check localStorage for "user" key
- Check console for errors

### Can't submit review after login
- Check user is in localStorage
- Check token is valid
- Check backend authentication middleware
- Check console for 401 errors

## Quick Test Commands

```bash
# Test registration endpoint
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Test login endpoint
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test review submission (with token)
curl -X POST http://localhost:8080/api/reviews \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "productId=PRODUCT_ID" \
  -F "categoryId=CATEGORY_ID" \
  -F "subCategoryId=SUBCATEGORY_ID" \
  -F "rating=5" \
  -F "comment=Great product!"
```
