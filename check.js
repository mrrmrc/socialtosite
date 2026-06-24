const fs = require('fs');

const html = fs.readFileSync('temp_live.html', 'utf8');
const scriptMatch = html.match(/<script type=.text\/babel.>\s*([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.log('No script found'); process.exit(1); }

let code = scriptMatch[1];
const lines = code.split('\n');

// A very dumb but useful JSX tag balance checker
let tags = [];
let lineNum = 1;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  // Remove string literals to avoid matching < in strings
  line = line.replace(/`[^`]*`/g, '');
  line = line.replace(/'[^']*'/g, '');
  line = line.replace(/"[^"]*"/g, '');
  // Remove comments
  line = line.replace(/\/\/.*/g, '');
  line = line.replace(/\{?\/\*.*?\*\/?\}/g, ''); // basic block comment

  // Match tags like <div, </div>, <>, </>, <SocialIcon, etc.
  const tagRegex = /<\/?([a-zA-Z0-9]+|)[^>]*?(\/?)>/g;
  let match;
  while ((match = tagRegex.exec(line)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1] || '<>';
    const isClosing = fullMatch.startsWith('</');
    const isSelfClosing = match[2] === '/';

    // ignore some things
    if (fullMatch.includes('=')) {
      // It might be like `x <= y` or `x => <div`
      // We assume valid JSX tags don't have '=' before the tag name, but attributes do.
      // We captured tagName as first letters.
    }
    
    if (tagName === '' || ['br', 'hr', 'input', 'img', 'meta', 'link'].includes(tagName)) {
      // self closing html tags
      continue;
    }

    if (!isClosing && !isSelfClosing) {
      tags.push({ tag: tagName, line: i + 1, full: fullMatch });
    } else if (isClosing) {
      if (tags.length === 0) {
         console.log(`ERROR: Closing tag </${tagName}> at line ${i+1} has no open tag!`);
      } else {
         const last = tags.pop();
         if (last.tag !== tagName) {
            console.log(`ERROR: Tag mismatch at line ${i+1}. Closed </${tagName}> but expected </${last.tag}> (opened at ${last.line})`);
            console.log(`Line: ${lines[i]}`);
         }
      }
    }
  }
}

if (tags.length > 0) {
  console.log("UNCLOSED TAGS:", tags.map(t => `${t.tag} (line ${t.line})`));
} else {
  console.log("All tags seem balanced.");
}
