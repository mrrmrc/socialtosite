const fs = require('fs');
const file = 'frontend/src/screens/DashboardScreen.jsx';
let code = fs.readFileSync(file, 'utf8');

const target = "onClick={rebuildSeoFoundation} disabled={savingProfile}>{savingProfile ? 'Aggiorno...' : 'Rigenera pagine fondamentali'}";
const replacement = "onClick={() => { if (window.confirm('Attenzione: questa operazione ricalcolerà i testi delle tue pagine principali (Chi Siamo, Cosa Offriamo, ecc.) basandosi sui tuoi ultimi post.\\n\\nLe vecchie pagine verranno sovrascritte.\\n\\nSei sicuro di voler procedere?')) rebuildSeoFoundation(); }} disabled={savingProfile}>{savingProfile ? 'Aggiorno...' : 'Rigenera pagine fondamentali'}";

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync(file, code, 'utf8');
    console.log("Success");
} else {
    console.log("Target not found");
}
