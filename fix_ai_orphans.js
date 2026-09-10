const fs = require('fs');
let c = fs.readFileSync('api/services/ai.php', 'utf8');

const target1 = `        ]));\r
    } catch (Exception $e) {\r
            return '';\r
        }\r
    }`;

const replacement1 = `        ]));\r
    }`;

const target2 = `        ]));\n    } catch (Exception $e) {\n            return '';\n        }\n    }`;
const replacement2 = `        ]));\n    }`;

c = c.split(target1).join(replacement1).split(target2).join(replacement2);
fs.writeFileSync('api/services/ai.php', c);
console.log('Replaced orphans');
