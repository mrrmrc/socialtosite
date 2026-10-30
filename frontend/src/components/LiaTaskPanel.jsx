import React, { useState } from 'react';
import { LiaAvatar } from './LiaAvatar';
import { InterfaceIcon as Icon } from './InterfaceIcon';

export const LIA_TASKS = [
  { icon: 'pen', title: 'Da un’idea a un contenuto', detail: 'Ricevi 3 idee concrete basate sulla tua attività.', prompt: 'Proponimi tre idee concrete di contenuto per la mia attività. Usa il profilo e i contenuti già presenti, evita di ripetere gli stessi argomenti. Per ciascuna dammi un titolo, un taglio utile e il motivo per cui può interessare al mio pubblico.' },
  { icon: 'spark', title: 'Le parole giuste per te', detail: 'Rivediamo come racconti la tua attività.', prompt: 'Vorrei una presentazione più chiara della mia attività. Partiamo dalle informazioni del mio profilo e chiedimi quello che manca.' },
  { icon: 'globe', title: 'Il prossimo passo utile', detail: 'Una priorità motivata, con qualcosa da fare adesso.', prompt: 'In base al mio profilo e allo stato dei miei contenuti, scegli una sola azione utile da fare adesso. Spiega perché la consigli e aiutami a svolgerla. Non ripetere il riepilogo e non inventare risultati o dati mancanti.' },
];

export function LiaTaskShortcuts({ onChoose, disabled }) {
  return <nav className="lw-quick-tools" aria-label="Attività con LIA">{LIA_TASKS.map(task => <button key={task.title} type="button" disabled={disabled} onClick={() => onChoose(task.prompt)}><span className="lw-tool-icon"><Icon name={task.icon} size={21} /></span><span><strong>{task.title}</strong><small>{task.detail}</small></span><Icon name="arrow" size={17} /></button>)}</nav>;
}

export function LiaTaskPanel({ onChoose, onPostEdit, sources = [], posts = [], loading = false, busy = false }) {
  const [chosenId, setChosenId] = useState('');
  const candidates = [...posts].sort((a,b) => Number(a.published) - Number(b.published));
  const chosen = candidates.find(post => String(post.id) === chosenId) || candidates[0];
  const title = post => post.edited_title || post.generated_title || `Contenuto ${post.platform || ''} #${post.id}`;
  return <aside className="lia-task-panel lw-agent-panel" aria-label="Idee e strumenti con LIA">
    <div className="lia-task-panel-title"><Icon name="spark" size={17} /><span>INIZIAMO A LAVORARE</span></div><h2>Un aiuto concreto, adesso.</h2><p>Scegli un’attività: LIA usa quello che conosce del tuo progetto e ti risponde qui.</p>
    <section className="lw-content-coach" aria-label="Migliora un tuo contenuto"><span className="lw-eyebrow">DAL TUO ARCHIVIO</span><h3>Miglioriamo un contenuto.</h3>{chosen ? <>
      <label htmlFor="lia-content-choice">Su quale lavoriamo?</label><select id="lia-content-choice" value={String(chosen.id)} disabled={busy || loading} onChange={event => setChosenId(event.target.value)}>{candidates.map(post => <option key={post.id} value={post.id}>{title(post)}</option>)}</select>
      <p>{Number(chosen.published) === 1 ? 'Un articolo già online: possiamo renderlo più chiaro o sviluppare un nuovo approfondimento.' : 'Una bozza da sviluppare: troviamo cosa manca e prepariamo una versione migliore.'}</p>
      <button type="button" className="lw-primary" disabled={busy || loading} onClick={() => onChoose('Analizza il contenuto selezionato: indicami due miglioramenti specifici a titolo, chiarezza o utilità per il lettore. Proponi poi una bozza rivista mantenendo i fatti e senza pubblicare o modificare l’originale.', Number(chosen.id), 'article')}>Analizza e migliora</button>
      {onPostEdit && <button type="button" className="lw-text-button" disabled={busy} onClick={() => onPostEdit(chosen)}>Apri il contenuto nell’editor</button>}
    </> : <><p>Non hai ancora contenuti su cui lavorare. Partiamo da un’idea adatta alla tua attività.</p><button type="button" className="lw-secondary" disabled={busy || loading} onClick={() => onChoose(LIA_TASKS[0].prompt)}>Trova il primo argomento</button></>}</section>
    <div className="lia-task-note"><LiaAvatar size={34} /><p>{loading ? 'Aggiorno il contesto…' : `${posts.length} contenuti · ${sources.length} canali`}<br /><strong>Le tue idee, pronte a fare un passo avanti.</strong></p></div>
  </aside>;
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
