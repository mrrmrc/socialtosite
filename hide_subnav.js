const fs = require('fs');
const file = 'frontend/src/screens/DashboardScreen.jsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /\{visibilitySection !== 'ideas' && <div className="visibility-subnav">[\s\S]*?<\/div>\}/;
const replacement = `{visibilitySection !== 'ideas' && isAdmin && <div className="visibility-subnav">
              {[
                ['overview', 'Panoramica Prestazioni'],
                ['network', 'Rete e Presenza'],
                ['lab', 'Laboratorio']
              ].map(([section, label]) => <button key={section} className={visibilitySection === section ? 'is-active' : ''} onClick={() => setVisibilitySection(section)}>{label}</button>)}
            </div>}`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync(file, code, 'utf8');
    console.log("Success");
} else {
    console.log("Target not found");
}
