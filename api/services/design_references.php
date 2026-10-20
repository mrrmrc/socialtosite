<?php
require_once __DIR__ . '/website_source.php';

final class DesignReferences {
    public static function read(array $urls): array {
        if (count($urls) > 3) throw new RuntimeException('Puoi inserire al massimo tre riferimenti.');
        $results = [];
        foreach (array_unique($urls) as $value) {
            if (!is_string($value) || strlen($value) > 2000) throw new RuntimeException('Link di riferimento non valido.');
            $url = trim($value);
            if ($url === '') continue;
            try {
                // Existing downloader rejects private addresses, pins DNS and validates redirects.
                $response = WebsiteSource::download($url, 500000);
                if (!preg_match('~text/html|application/xhtml~i', $response['headers']['content-type'] ?? '')) throw new RuntimeException('Il riferimento non è una pagina HTML.');
                $results[] = ['url' => $url, 'status' => 'read', 'signals' => self::summarize($response['body'])];
            } catch (Throwable $e) {
                $results[] = ['url' => $url, 'status' => 'unavailable', 'message' => 'Pagina non leggibile: descrivi nel brief gli elementi che ti interessano.'];
            }
        }
        return $results;
    }

    public static function summarize(string $html): array {
        // Extract cues, not executable code or page instructions. External CSS is not downloaded.
        preg_match_all('/#[a-f0-9]{6}\b/i', $html, $colors);
        preg_match_all('/font-family\s*:\s*([^;}<]{1,100})/i', $html, $fonts);
        $html = preg_replace('~<(script|style|noscript)\b[^>]*>.*?</\1>~is', '', $html);
        $doc = new DOMDocument();
        @$doc->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        $xp = new DOMXPath($doc);
        $headings = [];
        foreach ($xp->query('//h1|//h2|//nav//a') as $node) {
            $text = mb_substr(trim(preg_replace('/\s+/', ' ', $node->textContent)), 0, 120);
            if ($text !== '') $headings[] = $text;
            if (count($headings) >= 18) break;
        }
        return ['title' => mb_substr($xp->evaluate('string(//title)'), 0, 180), 'headings_and_navigation' => $headings, 'colors' => array_slice(array_values(array_unique($colors[0])), 0, 12), 'fonts' => array_slice(array_values(array_unique($fonts[1])), 0, 6), 'limits' => 'HTML cues only; scripts and linked CSS were not executed or rendered.'];
    }
}
