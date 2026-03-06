# Quick Start: User Registration & Review Submission

## 🚀 Test the Complete Flow

### Step 1: Open Registration Page
```
http://localhost:3001/register
```

### Step 2: Create New Account
Fill in the form:
- **Name:** John Doe
- **Email:** john@example.com
- **Password:** password123
- **Confirm Password:** password123

Click **"Create account"**

### Step 3: Automatic Login
✅ You're automatically logged in!
✅ Redirected to home page (or review form if you were trying to access one)

### Step 4: Submit a Review
Navigate to:
```
http://localhost:3001/product/69582e10463a0a920732efa2/review
```

Or use any product ID from your database.

Fill in:
- ⭐ **Rating:** Click stars (1-5)
- 💬 **Comment:** "Great product! Highly recommend."
- 📝 **Title (optional):** "Excellent quality"

Click **"Submit Review"**

### Step 5: View Your Review in Admin Panel
1. Open: http://localhost:3000
2. Login as admin: `admin@photuprint.com` / `admin123`
3. Go to "Review Manager"
4. Your review will be there with status "pending"
5. Admin can approve/reject it

## 📱 Available Routes

### Public (No Login Required)
- **Home:** http://localhost:3001
- **Login:** http://localhost:3001/login
- **Register:** http://localhost:3001/register
- **View Product:** http://localhost:3001/product/:productId

### Protected (Login Required)
- **Submit Review:** http://localhost:3001/product/:productId/review
- **Submit Review (select product):** http://localhost:3001/review

## 🎯 Key Features

### Registration
✅ Validates email format
✅ Minimum 6 character password
✅ Password confirmation
✅ Checks for existing users
✅ Auto-login after registration
✅ Preserves redirect path

### Login
✅ Email/password authentication
✅ JWT token (7-day expiration)
✅ Redirects to original page
✅ Shows success message from registration

### Review Submission
✅ Requires authentication
✅ Auto-fills user info
✅ Product details auto-populated from URL
✅ Star rating system
✅ Image uploads (optional)
✅ Pending status for user reviews

## 🔐 User Types

### Regular Users (Registered via Frontend)
- Role: `user`
- Can submit reviews
- Reviews start as "pending"
- Need admin approval

### Admin Users
- Role: `admin`
- Email: `admin@photuprint.com`
- Password: `admin123`
- Can approve/reject reviews
- Reviews auto-approved

## 🧪 Test Scenarios

### Scenario A: Complete New User Flow
```
1. Go to: http://localhost:3001/product/69582e10463a0a920732efa2/review
2. Not logged in → Redirected to login
3. Click "Create account"
4. Fill registration form
5. Auto-login → Back to review form
6. Submit review
7. Success! ✅
```

### Scenario B: Existing User
```
1. Go to: http://localhost:3001/login
2. Login with credentials
3. Navigate to product review page
4. Submit review
5. Success! ✅
```

### Scenario C: Duplicate Email
```
1. Try to register with existing email
2. Error: "User already exists"
3. Click "Sign in" link
4. Login with existing credentials
```

## 💡 Tips

- **Check console (F12)** for detailed logs
- **Check Network tab** to see API calls
- **Check Application → Local Storage** to see user data
- **Use admin panel** to manage reviews

## 🐛 Troubleshooting

**Registration not working?**
- Check backend is running on port 8080
- Check MongoDB connection
- Check console for errors

**Auto-login fails?**
- Check backend returns token in response
- Check localStorage for "user" key

**Can't submit review?**
- Make sure you're logged in
- Check product ID is valid
- Check console for 401 errors

## 📝 Summary

1. **Register** → Creates user account
2. **Auto-login** → Gets JWT token
3. **Submit Review** → Uses token for authentication
4. **Pending Review** → Waits for admin approval
5. **Admin Approves** → Review visible on product page

That's it! Users can now register and start reviewing products! 🎉
