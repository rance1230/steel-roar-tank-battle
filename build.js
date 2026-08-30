/* 构建脚本: 将 index.dev.html 的外置脚本依序内联为单文件 dist → index.html (双击即玩) */
const fs=require('fs'),path=require('path');
const root=__dirname;
let html=fs.readFileSync(path.join(root,'index.dev.html'),'utf8');
html=html.replace('<title>钢铁咆哮 · 坦克大战 [DEV]</title>','<title>钢铁咆哮 · 坦克大战</title>');
const out=html.replace(/<script src="(src\/[^"]+)"><\/script>/g,(m,p)=>{
  const code=fs.readFileSync(path.join(root,p),'utf8');
  return '<script>\n'+code.trim()+'\n</script>';
});
if(out===html)throw new Error('no scripts inlined');
fs.writeFileSync(path.join(root,'index.html'),out);
console.log('built index.html:',(out.length/1048576).toFixed(2),'MB');
