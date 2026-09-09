<?php

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../middleware/jwt.php';
require_once __DIR__ . '/provider_config.php';

final class AdminConsole
{
    public static function ensureSchema(): void
    {
        ProviderConfig::ensureSchema();
        $userColumns = [];
        foreach (DB::fetchAll('SHOW COLUMNS FROM users') as $column) $userColumns[$column['Field']] = true;
        if (!isset($userColumns['role'])) DB::execute("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'");
        if (!isset($userColumns['token_version'])) DB::execute("ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0");
        DB::execute("CREATE TABLE IF NOT EXISTS agent_prompts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            agent_name VARCHAR(50) UNIQUE NOT NULL,
            label VARCHAR(100) NOT NULL DEFAULT '',
            description TEXT NULL,
            instructions LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        
        $agentColumns = [];
        foreach (DB::fetchAll('SHOW COLUMNS FROM agent_prompts') as $column) $agentColumns[$column['Field']] = true;
        if (!isset($agentColumns['label'])) DB::execute("ALTER TABLE agent_prompts ADD COLUMN label VARCHAR(100) NOT NULL DEFAULT '' AFTER agent_name");
        if (!isset($agentColumns['description'])) DB::execute("ALTER TABLE agent_prompts ADD COLUMN description TEXT NULL AFTER label");
        DB::execute("CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        DB::execute("INSERT IGNORE INTO agent_prompts (agent_name,label,description,instructions) VALUES
            ('content_editor','Supervisore editoriale','Trasforma il materiale social in un articolo utile, fedele e appetibile per Google',
             'Agisci come supervisore editoriale senior. Usa {sourceContext} e il contenuto completo {content}. Trova un intento di ricerca realistico, conserva tutti i fatti verificabili, non inventare dettagli e crea un articolo autonomo, leggibile e concreto.'),
            ('seo_reviewer','Revisore SEO','Controlla intento, titolo, struttura e metadati',
             'Controlla che il testo risponda a un intento reale, abbia un titolo specifico, sottotitoli utili, meta description naturale e nessuna ripetizione o keyword stuffing.'),
            ('chief_editor','Caporedattore','Coordina coerenza, priorita e continuita del piano editoriale',
             'Valuta il corpus, evita duplicati, individua cluster e lacune e assegna priorita in base a utilita, prove disponibili e coerenza con il profilo.')");

        // Bootstrap versionato: garantisce le credenziali richieste al primo
        // deploy, ma non reimposta la password a ogni richiesta successiva.
        $bootstrap = DB::fetch("SELECT setting_value FROM app_settings WHERE setting_key='admin_bootstrap_v1'");
        if (!$bootstrap) {
            $admin = DB::fetch("SELECT id FROM users WHERE slug='admin' OR email='admin' LIMIT 1");
            if ($admin) {
                DB::execute("UPDATE users SET email='admin',slug='admin',name='Amministratore',role='admin',plan='agency',password=?,token_version=token_version+1 WHERE id=?", ['$sha256$59d4a35f9651730199b05e1984ef0042a5db61201410c3889d612a38dd32f99d',(int)$admin['id']]);
            } else {
                DB::insert('INSERT INTO users (email,password,name,slug,role,plan) VALUES (?,?,?,?,?,?)', [
                    'admin', '$sha256$59d4a35f9651730199b05e1984ef0042a5db61201410c3889d612a38dd32f99d', 'Amministratore', 'admin', 'admin', 'agency'
                ]);
            }
            DB::query("INSERT INTO app_settings (setting_key,setting_value) VALUES ('admin_bootstrap_v1','completed')");
        }
    }

    public static function requireAdmin(array $user): void
    {
        if (($user['role'] ?? 'user') !== 'admin') jsonError('Accesso riservato agli amministratori', 403);
    }

    public static function overview(): array
    {
        $users = DB::fetchAll("SELECT u.id,u.email,u.name,u.slug,u.role,u.plan,u.created_at,
            COUNT(DISTINCT s.id) source_count, COUNT(DISTINCT c.id) content_count
            FROM users u LEFT JOIN content_sources s ON s.user_id=u.id
            LEFT JOIN raw_contents c ON c.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC");
        $agents = DB::fetchAll('SELECT id,agent_name,label,description,instructions FROM agent_prompts ORDER BY id');
        $providers = DB::fetchAll("SELECT p.provider,p.label,p.model,p.monthly_credit,p.enabled,p.updated_at,
            CASE WHEN p.secret_ciphertext IS NULL OR p.secret_ciphertext='' THEN 0 ELSE 1 END credential_configured,
            COALESCE(SUM(CASE WHEN l.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN l.tokens_used ELSE 0 END),0) month_tokens,
            COUNT(CASE WHEN l.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN l.id END) month_requests,
            COALESCE(SUM(CASE WHEN l.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN l.estimated_cost ELSE 0 END),0) month_cost
            FROM ai_provider_connections p LEFT JOIN api_usage_logs l ON l.provider=p.provider GROUP BY p.id ORDER BY p.id");
        foreach ($providers as &$provider) {
            $envName = $provider['provider'] === 'gemini' ? 'GEMINI_API_KEY' : 'REFETCHER_API_KEY';
            $runtimeName = 'SOCIALTOSITE_RUNTIME_' . $envName;
            $externalSecret = trim((string)(getenv($envName) ?: '')) !== '' || (defined($runtimeName) && trim((string)constant($runtimeName)) !== '') || (defined($envName) && trim((string)constant($envName)) !== '');
            if ($externalSecret) $provider['credential_configured'] = 1;
        }
        unset($provider);
        $recentUsage = DB::fetchAll("SELECT l.provider,l.action,l.tokens_used,l.estimated_cost,l.created_at,u.email
            FROM api_usage_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 50");
        return ['users'=>$users, 'agents'=>$agents, 'providers'=>$providers, 'usage'=>$recentUsage];
    }

    public static function createUser(array $payload): array
    {
        $email = trim((string)($payload['email'] ?? ''));
        $password = (string)($payload['password'] ?? '');
        $name = trim((string)($payload['name'] ?? ''));
        $role = ($payload['role'] ?? '') === 'admin' ? 'admin' : 'user';
        if ($email === '' || strlen($password) < 10) throw new InvalidArgumentException('Inserisci username/email e una password di almeno 10 caratteri.');
        $slug = preg_replace('/[^a-z0-9-]+/', '-', strtolower($email));
        $id = DB::insert('INSERT INTO users (email,password,name,slug,role,plan) VALUES (?,?,?,?,?,?)', [$email,password_hash($password,PASSWORD_DEFAULT),$name ?: $email,trim($slug,'-'),$role,$role === 'admin' ? 'agency' : ($payload['plan'] ?? 'base')]);
        return DB::fetch('SELECT id,email,name,slug,role,plan,created_at FROM users WHERE id=?', [$id]);
    }

    public static function updateUser(array $payload, int $currentAdminId): array
    {
        $id = (int)($payload['id'] ?? 0);
        $target = DB::fetch('SELECT * FROM users WHERE id=?', [$id]);
        if (!$target) throw new RuntimeException('Utente non trovato.');
        $role = ($payload['role'] ?? $target['role']) === 'admin' ? 'admin' : 'user';
        if ($id === $currentAdminId && $role !== 'admin') throw new InvalidArgumentException('Non puoi rimuovere il tuo ruolo amministratore.');
        $name = trim((string)($payload['name'] ?? $target['name']));
        $plan = trim((string)($payload['plan'] ?? $target['plan'])) ?: 'base';
        DB::execute('UPDATE users SET name=?,role=?,plan=? WHERE id=?', [$name,$role,$plan,$id]);
        if (!empty($payload['password'])) {
            if (strlen((string)$payload['password']) < 10) throw new InvalidArgumentException('La password deve avere almeno 10 caratteri.');
            DB::execute('UPDATE users SET password=?,token_version=token_version+1 WHERE id=?', [password_hash((string)$payload['password'],PASSWORD_DEFAULT),$id]);
        }
        return DB::fetch('SELECT id,email,name,slug,role,plan,created_at FROM users WHERE id=?', [$id]);
    }

    public static function impersonate(int $adminId, int $targetId): array
    {
        $target = DB::fetch('SELECT id,email,name,slug,role,plan,token_version FROM users WHERE id=?', [$targetId]);
        if (!$target) throw new RuntimeException('Utente non trovato.');
        $token = JWT::encode(['id'=>$target['id'],'email'=>$target['email'],'slug'=>$target['slug'],'role'=>$target['role'],'tv'=>(int)$target['token_version'],'impersonated_by'=>$adminId], 1);
        unset($target['token_version']);
        return ['token'=>$token,'user'=>$target];
    }

    public static function updateAgent(array $payload): array
    {
        $name = trim((string)($payload['agent_name'] ?? ''));
        $instructions = trim((string)($payload['instructions'] ?? ''));
        if ($name === '' || $instructions === '') throw new InvalidArgumentException('Nome agente e istruzioni sono obbligatori.');
        DB::query("INSERT INTO agent_prompts (agent_name,label,description,instructions) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE label=VALUES(label),description=VALUES(description),instructions=VALUES(instructions)", [$name,trim((string)($payload['label'] ?? $name)),trim((string)($payload['description'] ?? '')),$instructions]);
        return DB::fetch('SELECT id,agent_name,label,description,instructions FROM agent_prompts WHERE agent_name=?', [$name]);
    }

    public static function updateProvider(array $payload): array
    {
        $provider = strtolower(trim((string)($payload['provider'] ?? '')));
        if (!in_array($provider, ['gemini','refetcher'], true)) throw new InvalidArgumentException('Provider non supportato.');
        $current = DB::fetch('SELECT * FROM ai_provider_connections WHERE provider=?', [$provider]);
        $ciphertext = $current['secret_ciphertext'] ?? null;
        if (array_key_exists('credential', $payload) && trim((string)$payload['credential']) !== '') $ciphertext = ProviderConfig::encrypt(trim((string)$payload['credential']));
        if (!empty($payload['clear_credential'])) $ciphertext = null;
        DB::execute('UPDATE ai_provider_connections SET model=?,monthly_credit=?,enabled=?,secret_ciphertext=? WHERE provider=?', [
            trim((string)($payload['model'] ?? ($current['model'] ?? ''))) ?: null,
            ($payload['monthly_credit'] ?? '') === '' ? null : max(0,(float)$payload['monthly_credit']),
            !empty($payload['enabled']) ? 1 : 0,$ciphertext,$provider
        ]);
        return DB::fetch("SELECT provider,label,model,monthly_credit,enabled,updated_at,CASE WHEN secret_ciphertext IS NULL OR secret_ciphertext='' THEN 0 ELSE 1 END credential_configured FROM ai_provider_connections WHERE provider=?", [$provider]);
    }
}
