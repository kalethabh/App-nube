import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync('npm',['ci','--prefix','app','--no-audit','--no-fund'],{stdio:'inherit'});
execFileSync('npm',['ci','--prefix','remotion','--no-audit','--no-fund'],{stdio:'inherit'});
execFileSync('npm',['run','build','--prefix','app'],{stdio:'inherit'});
const f='app/dist/index.html';fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('<head>','<head><meta name="kads-nube" content="1"><script src="/kads-nube.js"></script>'));
