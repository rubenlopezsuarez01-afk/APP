/*
 * Genera artifact/planning-comidas.html: la app en un único archivo para
 * publicarla como artefacto de Claude (sin <html>/<head>/<body>, con todo
 * el CSS y JS en línea).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const index = read('index.html');
const body = index.slice(index.indexOf('<body>') + 6, index.indexOf('<script src')).trim();
const fonts = index.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/)[0];
const scripts = ['js/logic.js', 'js/catalog.js', 'js/store.js', 'js/app.js'].map(read);
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

const html = `<title>Planning de comidas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
${fonts}
<style>
${read('styles.css')}
</style>

${body}

<script>
${scripts.map(safe).join('\n')}
</script>
`;

fs.mkdirSync(path.join(root, 'artifact'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifact', 'planning-comidas.html'), html);
console.log(`artifact/planning-comidas.html (${(html.length / 1024).toFixed(1)} KB)`);
