const {spawnSync}=require('child_process'),fs=require('fs'),path=require('path');
const {root,output}=require('./runtime.cjs'),out=output('release-v1.10.0');
const rows=[];
for(const file of ['verify18.js','verify20.js','verify21.js','verify22.cjs','verify23.cjs','verify24.cjs','verify25.cjs']){
 const r=spawnSync(process.execPath,[path.join(__dirname,file)],{cwd:root,encoding:'utf8',timeout:180000});
 fs.writeFileSync(path.join(out,file+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):''));
 rows.push({suite:file,pass:r.status===0,status:r.status});console.log(r.status===0?'PASS':'FAIL',file);
}
fs.writeFileSync(path.join(out,'suite-results.json'),JSON.stringify(rows,null,2));
if(rows.some(r=>!r.pass))process.exitCode=1;
