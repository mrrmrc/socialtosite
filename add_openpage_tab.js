const fs = require('fs');

let code = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

// Add import for EditorLayout at the top
if (!code.includes('EditorLayout')) {
  code = code.replace(
    "import { BrandMark } from './LandingScreen';",
    "import { BrandMark } from './LandingScreen';\nimport { EditorLayout } from '../openpage/editor/EditorLayout';"
  );
}

// Add the tab to navigation
const targetNav = "{ id: 'site', section: 'site', label: 'Articoli', icon: <svg";
const newTabStr = `
          { id: 'openpage', label: 'Costruttore Sito', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
          ${targetNav}`;
code = code.replace(targetNav, newTabStr);

// Add the tab rendering body
const targetRender = "{tab === 'site' && (() => {";
const renderStr = `
        {tab === 'openpage' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 100 }}>
            <EditorLayout />
          </div>
        )}
        ${targetRender}`;
code = code.replace(targetRender, renderStr);

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', code, 'utf8');
console.log('Added openpage to DashboardScreen');
