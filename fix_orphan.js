const fs = require('fs');
const content = fs.readFileSync('api/services/ai.php', 'utf8');
const lines = content.split('\n');

// Find all lines with "catch (Exception" and check if they have a matching try within 15 lines above
let orphans = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('} catch (Exception')) {
        let hasTry = false;
        for (let j = Math.max(0, i - 15); j < i; j++) {
            if (lines[j].includes('try {')) {
                hasTry = true;
                break;
            }
        }
        if (!hasTry) {
            orphans.push(i);
            console.log('Orphan catch at line', i+1, ':', JSON.stringify(lines[i]));
        }
    }
}

if (orphans.length === 0) {
    console.log('No orphan catches found.');
} else {
    // Remove orphan catch blocks (3 lines each: } catch..., return '';, })
    for (let i = orphans.length - 1; i >= 0; i--) {
        const idx = orphans[i];
        console.log('Removing lines', idx+1, 'to', idx+3);
        lines.splice(idx, 3);
    }
    fs.writeFileSync('api/services/ai.php', lines.join('\n'));
    console.log('Done!');
}
