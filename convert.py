import codecs
with codecs.open('api/index.php', 'r', 'utf-16le') as f: content = f.read()
with codecs.open('api/index.php', 'w', 'utf-8') as f: f.write(content)
