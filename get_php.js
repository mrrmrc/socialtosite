const https = require('https');
https.get('https://windows.php.net/download/', res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const regex = /href="(\/downloads\/releases\/php-8\.[23]\.[0-9]+-nts-Win32-[^"]+-x64\.zip)"/g;
        let m;
        while ((m = regex.exec(data)) !== null) {
            console.log("https://windows.php.net" + m[1]);
        }
    });
});
