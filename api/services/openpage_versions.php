<?php
// Version metadata lives in the existing configuration column; public HTML is untouched.
class OpenPageVersions {
    public static function append(array $document, array $config, string $label, array $settings = []): array {
        if (!is_array($config['blocks'] ?? null)) throw new RuntimeException('Versione non valida.');
        unset($config['_versions']);
        $settings = array_intersect_key($settings, array_flip(['siteName','siteDescription','faviconUrl','language','seoTitle','seoDescription','ogImageUrl','customDomain','gaId','posthogKey']));
        $versions = is_array($document['_versions'] ?? null) ? $document['_versions'] : [];
        $versions[] = ['id'=>bin2hex(random_bytes(12)), 'label'=>mb_substr(trim($label) ?: 'Versione salvata',0,120), 'createdAt'=>gmdate('c'), 'config'=>$config, 'settings'=>$settings];
        $document['_versions'] = $versions;
        if (strlen(json_encode($document)) > 25000000) throw new RuntimeException('Archivio versioni pieno. Esporta le versioni prima di continuare.');
        return $document;
    }
}
