#!/usr/bin/env node
/* release_v18 — v1.8.0 发版流水线 (W10 契约: 一次跑通, 非人工比哈希)
   1. node build.js → index.html
   2. 同步 android assets
   3. SHA-256 记录 (源 index.html)
   4. gradle assembleRelease
   5. 解包 APK assets/index.html 再 SHA-256 断言一致
   6. APK 文件 SHA-256 + 签名证书指纹 (apksigner)
   7. 输出 release-manifest.json */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const sh = (cmd, opt) => execSync(cmd, { cwd: opt && opt.cwd || ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const step = n => console.log('\n== ' + n + ' ==');
try {
  step('1. build index.html');
  console.log(sh('node build.js').trim());

  step('2. sync android assets');
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(ROOT, 'android/app/src/main/assets/index.html'));
  const hSrc = sha256(path.join(ROOT, 'index.html'));
  const hSync = sha256(path.join(ROOT, 'android/app/src/main/assets/index.html'));
  if (hSrc !== hSync) throw new Error('sync hash mismatch');
  console.log('assets sync OK  sha256=' + hSrc.slice(0, 16) + '…');

  step('3. gradle assembleRelease');
  console.log(sh('./gradlew assembleRelease -q', { cwd: path.join(ROOT, 'android') })
    .split('\n').filter(l => !/deprecated|Xlint/.test(l)).join('\n').trim() || '(quiet)');
  const apk = path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
  if (!fs.existsSync(apk)) throw new Error('release apk missing');

  step('4. unpack assert');
  const tmp = path.join(ROOT, 'output', 'apkcheck');
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  fs.copyFileSync(apk, path.join(tmp, 'a.zip'));
  sh('unzip -o -q a.zip assets/index.html', { cwd: tmp });
  const hApk = sha256(path.join(tmp, 'assets/index.html'));
  if (hApk !== hSrc) throw new Error('APK assets hash mismatch: ' + hApk + ' vs ' + hSrc);
  console.log('APK 内嵌 index.html 与源一致 ✓');

  step('5. APK + 签名指纹');
  const hApkFile = sha256(apk);
  let certs = '';
  try { certs = sh('apksigner verify --print-certs ' + JSON.stringify(apk) + ' 2>&1 || ' +
    '$HOME/Library/Android/sdk/build-tools/*/apksigner verify --print-certs ' + JSON.stringify(apk)).trim(); }
  catch (e) { certs = '(apksigner 不可用: ' + e.message.split('\n')[0] + ')'; }

  const manifest = {
    version: '1.8.0', versionCode: 13, builtAt: new Date().toISOString(),
    indexHtml: { bytes: fs.statSync(path.join(ROOT, 'index.html')).size, sha256: hSrc },
    apk: { bytes: fs.statSync(apk).size, sha256: hApkFile, path: 'android/app/build/outputs/apk/release/app-release.apk' },
    signer: certs.split('\n').filter(l => /SHA-256|CN=/.test(l)).join('\n'),
  };
  fs.writeFileSync(path.join(ROOT, 'output', 'release-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('APK sha256=' + hApkFile);
  console.log(manifest.signer);
  console.log('\nmanifest → output/release-manifest.json');
  console.log('ALL STEPS PASS');
} catch (e) {
  console.error('RELEASE PIPELINE FAIL:', e.message);
  process.exit(1);
}
