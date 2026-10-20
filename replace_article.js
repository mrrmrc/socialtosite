const fs = require('fs');
let c = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

const oldArticle = `<article>
                      <span
                        className="project-command-icon is-ai"
                        aria-hidden="true"
                      >
                        ✦
                      </span>
                      <div>
                        <small>Aspetto del sito</small>
                        <strong>
                          {visualAgentConfigured
                            ? "Personalizzata"
                            : "Pronta da configurare"}
                        </strong>
                        <p>{visualDirection}</p>
                      </div>
                      <b
                        className={
                          visualAgentConfigured ? "is-ready" : "is-pending"
                        }
                      >
                        {visualAgentConfigured ? "Attiva" : "Setup"}
                      </b>
                    </article>`;

const newArticle = `<article onClick={() => window.open('/builder/', '_blank')} style={{cursor: 'pointer'}}>
                      <span
                        className="project-command-icon is-ai"
                        aria-hidden="true"
                      >
                        🎨
                      </span>
                      <div>
                        <small>Costruttore Sito</small>
                        <strong>OpenPage Builder</strong>
                        <p>Disegna e crea le pagine del tuo sito</p>
                      </div>
                      <b className="is-ready">Apri</b>
                    </article>`;

c = c.replace(oldArticle, newArticle);

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', c, 'utf8');
console.log('Replaced Aspetto del sito with Costruttore Sito');
