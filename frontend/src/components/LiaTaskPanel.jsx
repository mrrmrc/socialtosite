import React from 'react';
import { LiaAvatar } from './LiaAvatar';
import { InterfaceIcon as Icon } from './InterfaceIcon';

export const LIA_TASKS = [
  { icon: 'pen', title: 'Da un’idea a un contenuto', detail: 'Mettiamo a fuoco argomento, pubblico e prima bozza.', prompt: 'Aiutami a trasformare una mia idea in un contenuto. Chiedimi prima argomento, pubblico e obiettivo.' },
  { icon: 'spark', title: 'Le parole giuste per te', detail: 'Rivediamo come racconti la tua attività.', prompt: 'Vorrei una presentazione più chiara della mia attività. Partiamo dalle informazioni del mio profilo e chiedimi quello che manca.' },
  { icon: 'globe', title: 'Un sito che ti somiglia', detail: 'Troviamo insieme cosa migliorare sul tuo sito.', prompt: 'Aiutami a migliorare il mio sito: rivediamo chiarezza, presentazione e informazioni utili per chi lo visita.' },
];

export function LiaTaskPanel({ onChoose, sources = [], posts = [], loading = false, busy = false }) {
  const published = posts.filter(post => Number(post.published) === 1).length;
  return <aside className="lia-task-panel" aria-label="Idee e strumenti con LIA"><div className="lia-task-panel-title"><Icon name="spark" size={17} /><span>UN BUON PUNTO DI PARTENZA</span></div><h2>Fai spazio alla prossima idea.</h2><p>Scegli una direzione. Prepariamo insieme la richiesta, poi decidi tu quando inviarla.</p><div className="lia-task-list">{LIA_TASKS.map(task => <button key={task.title} type="button" disabled={busy} onClick={() => onChoose(task.prompt)}><span className="lia-task-icon"><Icon name={task.icon} /></span><span><strong>{task.title}</strong><small>{task.detail}</small></span><Icon name="arrow" size={16} /></button>)}</div><div className="lia-project-snapshot"><span>IL TUO PROGETTO, A COLPO D’OCCHIO</span><dl><div><dt>Fonti collegate</dt><dd>{loading ? '…' : sources.length}</dd></div><div><dt>Contenuti pubblicati</dt><dd>{loading ? '…' : published}</dd></div><div><dt>Bozze e lavorazioni</dt><dd>{loading ? '…' : posts.length - published}</dd></div></dl></div><div className="lia-task-note"><LiaAvatar size={34} /><p>Le idee prendono forma qui.<br /><strong>L’ultima parola resta a te.</strong></p></div></aside>;
}

const adminGuides = {
  overview: ['La piattaforma, sotto controllo.', 'Parti dalla panoramica per individuare priorità, clienti e lavorazioni da verificare.', [['processes', 'Controlla le code'], ['agents', 'Configura gli agenti IA']]],
  users: ['Ogni cliente, il suo percorso.', 'Apri la Control Room del cliente per rivedere profilo, fonti e impostazioni editoriali.', [['control-room', 'Apri Control Room'], ['content-manager', 'Controlla i contenuti']]],
  'control-room': ['Dai il contesto giusto all’IA.', 'Profilo, fonti e strategia editoriale orientano le proposte. Verifica il cliente selezionato prima di salvare.', [['agents', 'Istruzioni degli agenti'], ['content-manager', 'Gestione contenuti']]],
  agents: ['Una direzione chiara per ogni agente.', 'Rivedi le istruzioni, confronta la cronologia e salva le modifiche in modo esplicito.', [['monitoring', 'Verifica i provider'], ['economics', 'Controlla i consumi']]],
};

export function LiaAdminGuide({ section, onNavigate }) {
  const [title, description, actions] = adminGuides[section] || ['Prima il contesto, poi l’azione.', 'Verifica ambito, cliente e stato dei dati prima di intervenire. Le funzioni editoriali restano nella Control Room del cliente.', [['overview', 'Torna alla panoramica'], ['control-room', 'Apri Control Room']]];
  return <details className="lia-admin-guide"><summary><LiaAvatar size={34} /><span><strong>Guida LIA</strong><small>{title}</small></span><span className="lia-guide-toggle">Strumenti e indicazioni <span aria-hidden="true">⌄</span></span></summary><div><p>{description}</p><div>{actions.map(([target, label]) => <button key={target} type="button" onClick={() => onNavigate(target)}>{label}<Icon name="arrow" size={15} /></button>)}</div><small>Guida contestuale agli strumenti. Non esegue analisi IA o modifiche automatiche.</small></div></details>;
}

export function LiaContextEntry({ section, onChoose }) {
  const context = section === 'site' ? ['Un contenuto da sbloccare?', 'Aiutami a scegliere il prossimo contenuto da preparare. Chiedimi cosa voglio comunicare e a chi.'] : section === 'publicsite' ? ['Diamo una nuova direzione al tuo sito?', LIA_TASKS[2].prompt] : section === 'profile' ? ['Raccontiamoti con più chiarezza.', LIA_TASKS[1].prompt] : ['Troviamo insieme il prossimo passo.', 'Aiutami a capire il prossimo passo per migliorare i miei contenuti e la mia presenza online.'];
  return <section className="lia-context-entry" aria-label="Assistenza LIA"><LiaAvatar size={38} /><div><strong>{context[0]}</strong><span>Prepara una richiesta con LIA, partendo da qui.</span></div><button type="button" onClick={() => onChoose(context[1])}>Lavora con LIA<Icon name="arrow" size={16} /></button></section>;
}
