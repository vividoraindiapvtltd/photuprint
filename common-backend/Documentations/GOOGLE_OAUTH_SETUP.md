# Google OAuth Setup Guide

## Frontend Google Sign-In Implementation

### ✅ What Was Implemented

1. **Google OAuth Library**: Installed `@react-oauth/google`
2. **Backend Support**: 
   - Updated User model to support `googleId` and `picture` fields
   - Password is now optional for Google OAuth users
   - Created `/auth/google` endpoint for Google authentication
3. **Frontend Integration**:
   - Added Google OAuth Provider to App.js
   - Added "Sign in with Google" button to Login page
   - Added "Sign up with Google" button to Register page
   - Both buttons handle Google OAuth flow automatically

---

## Setup Instructions

### Step 1: Get Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable **Google+ API** (or Google Identity Services)
4. Navigate to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth 2.0 Client ID**
6. Configure OAuth consent screen (if not done already)
7. Set Application type to **"Web application"**
8. Add **Authorized JavaScript origins**:
   - `http://localhost:3001`
   - `http://localhost:3000` (if using default port)
9. Add **Authorized redirect URIs**:
   - `http://localhost:3001`
   - `http://localhost:3000` (if using default port)
10. Copy the **Client ID**

### Step 2: Configure Frontend

1. Create `.env` file in `frontend/` directory:
```bash
cd frontend
touch .env
```

2. Add your Google Client ID:
```
REACT_APP_GOOGLE_CLIENT_ID=your-actual-client-id-here.apps.googleusercontent.com
```

3. Restart the frontend development server:
```bash
npm start
```

---

## How It Works

### User Flow

1. **User clicks "Sign in with Google" or "Sign up with Google"**
2. **Google OAuth popup opens** (handled by `@react-oauth/google`)
3. **User selects Google account and grants permissions**
4. **Frontend receives access token**
5. **Frontend fetches user info from Google API**
6. **Frontend sends user info to backend** (`/auth/google`)
7. **Backend checks if user exists**:
   - If exists: Updates Google OAuth info if needed, returns JWT token
   - If new: Creates new user with Google OAuth, returns JWT token
8. **Frontend stores user data and token** in localStorage
9. **User is redirected** to home page (ProductsList)

### Backend Endpoint

**POST** `/api/auth/google`

**Request Body:**
```json
{
  "googleId": "123456789",
  "email": "user@gmail.com",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/..."
}
```

**Response:**
```json
{
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "user@gmail.com",
    "role": "customer",
    "picture": "https://..."
  },
  "token": "jwt_token_here"
}
```

---

## User Model Updates

### New Fields:
- `googleId`: Unique Google OAuth ID (optional, for Google users)
- `picture`: Google profile picture URL (optional)

### Password Field:
- Now optional (only required if user is not a Google OAuth user)
- Validation: `required: function() { return !this.googleId }`

---

## Features

### ✅ Login Page
- Email/Password login (existing)
- "Sign in with Google" button
- Divider between traditional and Google login

### ✅ Register Page
- Registration form (existing)
- "Sign up with Google" button
- Divider between traditional and Google sign-up
- Both methods auto-login user after successful registration

### ✅ Backend
- Handles both new Google users and existing users
- Links Google account to existing email if user already registered
- Returns JWT token for authentication
- Stores Google profile picture

---

## Testing

### Test Google Sign-In:
1. Start frontend: `cd frontend && npm start`
2. Go to `/login` or `/register`
3. Click "Sign in with Google" or "Sign up with Google"
4. Select Google account
5. Should redirect to home page (ProductsList) after successful authentication

### Test Traditional Registration:
1. Fill out registration form
2. Submit
3. Should auto-login and redirect to home page

---

## Troubleshooting

### Issue: "Google sign-in failed"
- Check if Google Client ID is set in `.env` file
- Verify Client ID is correct
- Check browser console for errors
- Ensure authorized origins/redirects are configured correctly

### Issue: "User already exists"
- User with same email already registered
- Google OAuth will link to existing account
- User can use either Google sign-in or email/password

### Issue: Google popup doesn't open
- Check if `REACT_APP_GOOGLE_CLIENT_ID` is set
- Verify Google OAuth Provider is wrapping the app
- Check browser console for errors

---

## Security Notes

1. **Client ID is public** - Safe to expose in frontend code
2. **Never expose Client Secret** - Only needed for server-side OAuth
3. **JWT tokens** - Stored in localStorage (consider httpOnly cookies for production)
4. **HTTPS required** - For production, use HTTPS URLs in Google Console

---

## Summary

✅ **Google OAuth fully integrated**
✅ **Backend supports Google users**
✅ **Login and Register pages updated**
✅ **Automatic account linking**
✅ **Profile picture support**

**Users can now sign in/up with Google or traditional email/password!** 🎉
