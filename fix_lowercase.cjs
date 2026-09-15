const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let newContent = content.replace(/(\w+)\.toLowerCase\(\)/g, '$1?.toLowerCase()');
  newContent = newContent.replace(/\]\.toLowerCase\(\)/g, ']?.toLowerCase()');
  if (content !== newContent) {
    fs.writeFileSync(f, newContent);
    console.log('Fixed:', f);
  }
});
