const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/generated/prisma');
const dest = path.join(__dirname, '../dist/src/generated/prisma');

try {
  // Check if source directory exists
  if (!fs.existsSync(src)) {
    console.error('❌ Error: Prisma client not found at', src);
    console.error('   Run "npx prisma generate" first');
    process.exit(1);
  }

  // Create destination directory if it doesn't exist
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Copy the directory
  fs.cpSync(src, dest, { recursive: true });
  
  console.log('✓ Successfully copied Prisma client to dist/src/generated/prisma');
} catch (error) {
  console.error('❌ Error copying Prisma client:', error.message);
  process.exit(1);
}
