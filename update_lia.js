const fs = require('fs');
let code = fs.readFileSync('frontend/src/screens/StrategyInterview.jsx', 'utf8');

code = code.replace(
    `text: 'Ciao! Sono Lia, il tuo Consulente Strategico AI. 👋 Ho dato un\\'occhiata ai tuoi canali social per capire meglio il tuo business. Mi aiuti a completare il tuo profilo editoriale? Iniziamo: come descriveresti la tua attività principale?'`,
    `text: 'Ciao! Sono Lia, il tuo Consulente Strategico AI. 👋 Ti farò qualche domanda per costruire il tuo **Stile Editoriale**. È fondamentale per permettermi di scrivere contenuti perfetti per te. Partiamo dalle basi: come descriveresti la tua attività in poche parole?'`
);

fs.writeFileSync('frontend/src/screens/StrategyInterview.jsx', code);
