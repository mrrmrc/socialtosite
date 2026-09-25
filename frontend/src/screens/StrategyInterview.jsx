import React, { useState, useEffect, useRef } from 'react';

export default function StrategyInterview({ declaredStrategy, onUpdateStrategy, apiFetch, token }) {
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Ciao! Sono il tuo Consulente Strategico AI. 👋 Ho dato un\'occhiata ai tuoi canali social per capire meglio il tuo business. Mi aiuti a completare il tuo profilo editoriale? Iniziamo: come descriveresti la tua attività principale?' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef(null);

    // Auto-scroll alla fine della chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const userMsg = { role: 'user', text: inputText };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            const res = await apiFetch('/api/index.php?action=interview-chat', {
                method: 'POST',
                body: JSON.stringify({ messages: newMessages })
            }, token);

            if (res.ok) {
                setMessages([...newMessages, { role: 'ai', text: res.reply }]);
                if (res.updates && Object.keys(res.updates).length > 0 && onUpdateStrategy) {
                    onUpdateStrategy(res.updates);
                }
            } else {
                setMessages([...newMessages, { role: 'ai', text: 'Scusa, ho avuto un momento di confusione. Puoi ripetere?' }]);
            }
        } catch (err) {
            setMessages([...newMessages, { role: 'ai', text: 'Errore di connessione. Riprova tra poco.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const strategyFields = [
        { key: 'activity_type', label: 'Cosa fai', icon: '💼' },
        { key: 'primary_goal', label: 'Obiettivo', icon: '🎯' },
        { key: 'primary_audience', label: 'Pubblico', icon: '👥' },
        { key: 'tone_of_voice', label: 'Tono', icon: '🎭' },
        { key: 'differentiators', label: 'Unicità', icon: '✨' }
    ];

    return (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            
            {/* Chat Interface */}
            <div className="card" style={{ flex: '1 1 500px', minWidth: 0, padding: '0', display: 'flex', flexDirection: 'column', height: '600px', overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '24px' }}>
                <div style={{ padding: '20px', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: '18px' }}>
                    🤖 Intervista Strategica
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#fcfcfc' }}>
                    {messages.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: m.role === 'ai' ? 'flex-start' : 'flex-end' }}>
                            <div style={{ 
                                maxWidth: '85%', 
                                padding: '14px 18px', 
                                borderRadius: '18px',
                                borderBottomLeftRadius: m.role === 'ai' ? '4px' : '18px',
                                borderBottomRightRadius: m.role === 'user' ? '4px' : '18px',
                                background: m.role === 'ai' ? 'var(--surface)' : 'var(--primary)',
                                color: m.role === 'ai' ? 'var(--text)' : 'white',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                fontSize: '15px',
                                lineHeight: '1.5'
                            }}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div style={{ padding: '14px 18px', borderRadius: '18px', background: 'var(--surface)', color: 'var(--text-muted)' }}>
                                L'AI sta digitando...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSend} style={{ display: 'flex', padding: '16px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                    <input 
                        type="text" 
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder="Scrivi qui la tua risposta..."
                        style={{ flex: 1, padding: '14px 20px', border: '1px solid var(--border)', borderRadius: '100px', fontSize: '15px', outline: 'none' }}
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !inputText.trim()} style={{ marginLeft: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50px', padding: '0 24px', fontWeight: 700, cursor: 'pointer' }}>
                        Invia
                    </button>
                </form>
            </div>

            {/* Strategy Live Preview */}
            <div className="card" style={{ flex: '1 1 300px', minWidth: 0, padding: '24px', background: 'var(--surface)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px', color: 'var(--text)' }}>
                    La tua Strategia 🪄
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                    Rispondi alle domande dell'AI. Questa scheda si compilerà da sola!
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {strategyFields.map(f => {
                        const val = declaredStrategy?.[f.key];
                        return (
                            <div key={f.key} style={{ padding: '16px', background: val ? 'var(--teal-light)' : 'rgba(0,0,0,0.03)', borderRadius: '14px', border: val ? '1px solid var(--teal)' : '1px dashed var(--border)' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: val ? 'var(--teal)' : 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {f.icon} {f.label}
                                </div>
                                <div style={{ fontSize: '15px', color: val ? 'var(--text)' : 'rgba(0,0,0,0.3)', fontWeight: val ? 600 : 400 }}>
                                    {val || 'In attesa...'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}
