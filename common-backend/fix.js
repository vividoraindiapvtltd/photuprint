const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  console.log(`Processing ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip out upstream changes and keep stashed changes
  let newContent = content.replace(/<<<<<<< Updated upstream\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> Stashed changes\r?\n/g, '$2');
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Fixed ${filePath}`);
  } else {
    console.log(`No changes needed or markers not exactly matched in ${filePath}`);
  }
}

fixFile(path.join(__dirname, 'admin-cms/package-lock.json'));
fixFile(path.join(__dirname, 'package-lock.json'));
