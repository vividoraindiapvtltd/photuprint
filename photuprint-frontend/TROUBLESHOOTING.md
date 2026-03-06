# Troubleshooting Next.js Migration

## Error: webpack-dev-server not found

This error occurs when the browser is trying to load the old Create React App setup instead of Next.js.

### Solution Steps:

1. **Stop ALL running servers:**
   ```bash
   # Kill any processes on port 3001
   lsof -ti:3001 | xargs kill -9
   
   # Or manually stop any running npm/node processes
   ```

2. **Clear browser cache:**
   - Open browser DevTools (F12)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"
   - Or use: Chrome: Ctrl+Shift+Delete, Firefox: Ctrl+Shift+Delete

3. **Clean build artifacts:**
   ```bash
   cd frontend
   rm -rf .next build node_modules/.cache
   ```

4. **Restart Next.js dev server:**
   ```bash
   npm run dev
   ```

5. **Access the correct URL:**
   - Make sure you're accessing: `http://localhost:3001`
   - Next.js will show a different page structure than Create React App

### Important Notes:

- **DO NOT** use `npm start` - that's for production builds
- **USE** `npm run dev` - this starts the Next.js development server
- The old `src/index.js` and `src/App.js` are no longer used by Next.js
- Next.js uses the `app/` directory for routing

### If the error persists:

1. Check if you have multiple terminal windows running different servers
2. Make sure you're in the `frontend` directory when running `npm run dev`
3. Verify Next.js is installed: `npm list next`
4. Try a fresh install: `rm -rf node_modules && npm install`
