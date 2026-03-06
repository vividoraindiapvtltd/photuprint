import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Environment Variables Diagnostic');
console.log('=====================================');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
console.log('📂 Looking for .env at:', envPath);
console.log('📄 .env file exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const stats = fs.statSync(envPath);
  console.log('📏 .env file size:', stats.size, 'bytes');
  
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('📝 .env file content length:', content.length);
    console.log('📝 .env file lines:', content.split('\n').length);
    
    // Show first few characters to check for hidden characters
    console.log('🔤 First 50 characters:', JSON.stringify(content.substring(0, 50)));
    
    // Check for specific variables
    const lines = content.split('\n').filter(line => line.trim());
    console.log('📋 Valid lines:', lines.length);
    
    lines.forEach((line, index) => {
      if (line.includes('=')) {
        const [key] = line.split('=');
        console.log(`   ${index + 1}. ${key.trim()}`);
      } else if (line.trim()) {
        console.log(`   ${index + 1}. [INVALID] ${line.trim()}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error reading .env file:', error.message);
  }
}

// Configure dotenv
console.log('\n🔧 Configuring dotenv...');
const result = dotenv.config({
  path: envPath
});

if (result.error) {
  console.error('❌ dotenv config error:', result.error);
} else {
  console.log('✅ dotenv config success');
  console.log('📊 Loaded variables:', Object.keys(result.parsed || {}).length);
  
  if (result.parsed) {
    Object.keys(result.parsed).forEach(key => {
      console.log(`   ✓ ${key}`);
    });
  }
}

// Check specific environment variables
console.log('\n🧪 Testing Environment Variables:');
const testVars = ['MONGODB_URI', 'JWT_SECRET', 'PORT', 'NODE_ENV'];

testVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`   ${varName}: ${value ? '✅ SET' : '❌ NOT SET'}`);
  if (value) {
    console.log(`      Length: ${value.length}`);
    if (varName === 'MONGODB_URI') {
      console.log(`      Starts with: ${value.substring(0, 20)}...`);
    }
  }
});

console.log('\n🎯 Summary:');
if (process.env.MONGODB_URI) {
  console.log('✅ Ready to connect to MongoDB');
} else {
  console.log('❌ MONGODB_URI not found - this will cause connection failure');
}