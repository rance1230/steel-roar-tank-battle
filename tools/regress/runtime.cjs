const path=require('path'),fs=require('fs');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'../..');
const executablePath=process.env.CHROME_PATH||pw.chromium.executablePath();
const gameURL=process.env.GAME_URL||require('url').pathToFileURL(path.join(root,'index.html')).href;
function output(name){const p=path.join(root,'output',name);fs.mkdirSync(p,{recursive:true});return p;}
module.exports={pw,root,executablePath,gameURL,output};
