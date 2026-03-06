# Debugging Login Redirect Issue

## Test Steps:
1. Open browser console (F12)
2. Navigate to: http://localhost:3001/product/SOME_PRODUCT_ID/review
3. You should be redirected to /login
4. Check console - should see location.state
5. Login with admin@photuprint.com / admin123
6. Check if redirected back to review page

## Debug Points:
- Check localStorage for "user" after login
- Check if location.state.from exists in Login component
- Verify navigate(from) is called with correct path
