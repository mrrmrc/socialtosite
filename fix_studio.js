const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/components/ProSiteBuilder.jsx');
let content = fs.readFileSync(file, 'utf8');

// Container
content = content.replace(/background: '#060d1a',/g, "background: 'var(--bg)',");
content = content.replace(/color: '#fff',/g, "color: 'var(--text)',");

// Header
content = content.replace(/background: 'rgba\(8,15,30,\.95\)',/g, "background: 'var(--surface)',");
content = content.replace(/borderBottom: '1px solid rgba\(255,255,255,\.08\)',/g, "borderBottom: '2px solid var(--border-strong)',");

// Sidebar
content = content.replace(/background: 'rgba\(4,9,20,\.9\)',/g, "background: 'var(--surface)',");
content = content.replace(/borderRight: '1px solid rgba\(255,255,255,\.07\)',/g, "borderRight: '2px solid var(--border-strong)',");

// Detail Panel
content = content.replace(/background: 'rgba\(7,14,28,\.96\)',/g, "background: 'var(--surface)',");

// ToolIcon
content = content.replace(/color: active \? '#93c5fd' : 'rgba\(255,255,255,\.48\)',/g, "color: active ? 'var(--primary)' : 'var(--text-muted)',");
content = content.replace(/border: active \? '1\.5px solid rgba\(96,165,250,\.6\)' : '1\.5px solid transparent',/g, "border: active ? '2px solid var(--primary)' : '2px solid transparent',");
content = content.replace(/background: active\s*\n\s*\? 'linear-gradient\(135deg, rgba\(37,99,235,\.35\), rgba\(37,99,235,\.15\)\)'\s*\n\s*\: 'transparent',/g, "background: active ? 'var(--primary-light)' : 'transparent',");
content = content.replace(/boxShadow: active \? '0 0 0 3px rgba\(37,99,235,\.12\), inset 0 1px 0 rgba\(255,255,255,\.06\)' : 'none',/g, "boxShadow: 'none',");

// ChoiceCard
content = content.replace(/border: active \? '1\.5px solid rgba\(96,165,250,\.7\)' : '1px solid rgba\(255,255,255,\.1\)',/g, "border: active ? '2px solid var(--primary)' : '2px solid var(--border)',");
content = content.replace(/background: active\s*\n\s*\? 'linear-gradient\(135deg, rgba\(37,99,235,\.28\), rgba\(37,99,235,\.1\)\)'\s*\n\s*\: 'rgba\(255,255,255,\.03\)',/g, "background: active ? 'var(--primary-light)' : 'var(--surface)',");
content = content.replace(/boxShadow: active \? '0 0 0 3px rgba\(37,99,235,\.1\)' : 'none',/g, "boxShadow: 'none',");
content = content.replace(/color: '#fff',/g, "color: 'var(--text)',");
content = content.replace(/background: active \? 'rgba\(37,99,235,\.25\)' : 'rgba\(255,255,255,\.07\)',/g, "background: active ? 'var(--primary)' : 'var(--gray-light)',");
content = content.replace(/color: active \? '#93c5fd' : '#fff',/g, "color: active ? '#fff' : 'var(--text)',");
content = content.replace(/color: active \? '#dbeafe' : '#fff'/g, "color: active ? 'var(--primary-dark)' : 'var(--text)'");

// SectionHeader
content = content.replace(/color: '#f1f5f9'/g, "color: 'var(--text)'");

// Form inputs / borders
content = content.replace(/border: '1px solid rgba\(255,255,255,\.1\)'/g, "border: '2px solid var(--border)'");
content = content.replace(/background: 'rgba\(255,255,255,\.05\)'/g, "background: 'var(--bg)'");
content = content.replace(/color: 'rgba\(255,255,255,\.7\)'/g, "color: 'var(--text)'");
content = content.replace(/color: 'rgba\(255,255,255,\.5\)'/g, "color: 'var(--text-muted)'");
content = content.replace(/color: 'rgba\(255,255,255,\.75\)'/g, "color: 'var(--text)'");

// Buttons (close, apri, salva)
content = content.replace(/border: '1px solid rgba\(255,255,255,\.12\)'/g, "border: '2px solid var(--border-strong)'");
content = content.replace(/border: '1px solid rgba\(255,255,255,\.08\)'/g, "border: '2px solid var(--border-strong)'");
content = content.replace(/background: 'rgba\(255,255,255,\.06\)'/g, "background: 'var(--surface)'");
content = content.replace(/background: panelVisible \? 'rgba\(255,255,255,\.06\)' : 'transparent'/g, "background: panelVisible ? 'var(--surface)' : 'transparent'");
content = content.replace(/color: 'rgba\(255,255,255,\.4\)'/g, "color: 'var(--text-muted)'");
content = content.replace(/color: dirty \? '#fff' : 'rgba\(255,255,255,\.35\)'/g, "color: dirty ? '#fff' : 'var(--text-muted)'");
content = content.replace(/background: dirty\s*\n\s*\? 'linear-gradient\(135deg, #2563eb, #1d4ed8\)'\s*\n\s*\: 'rgba\(255,255,255,\.08\)',/g, "background: dirty ? 'var(--primary)' : 'var(--gray-light)',");

// Typography
content = content.replace(/color: '#bfdbfe'/g, "color: 'var(--primary-dark)'");
content = content.replace(/color: '#e2e8f0'/g, "color: 'var(--text)'");
content = content.replace(/color: '#cbd5e1'/g, "color: 'var(--text)'");

// Hover styles
content = content.replace(/rgba\(255,255,255,\.06\)/g, "var(--gray-light)");
content = content.replace(/rgba\(255,255,255,\.07\)/g, "var(--gray-light)");
content = content.replace(/rgba\(255,255,255,\.04\)/g, "var(--gray-light)");
content = content.replace(/rgba\(255,255,255,\.18\)/g, "var(--primary)");

fs.writeFileSync(file, content);
console.log('Fixed Studio theme.');
