<?php
require_once __DIR__ . '/../api/services/design_references.php';
$result = DesignReferences::summarize('<html><head><title>Example</title><style>body{color:#123456;font-family:Georgia}</style></head><body><nav><a>Home</a></nav><h1>Visual example</h1><script><h2>Ignore this</h2></script></body></html>');
if ($result['title'] !== 'Example' || $result['headings_and_navigation'] !== ['Home', 'Visual example'] || $result['colors'] !== ['#123456'] || $result['fonts'] !== ['Georgia']) throw new RuntimeException('Reference extraction failed');
echo "Design reference extraction OK\n";
