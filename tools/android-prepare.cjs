// Generated Android project stays outside version control; sources below are reproducible.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
const target=path.join(root,'www');fs.mkdirSync(target,{recursive:true});
for(const name of ['index.html','manifest.json','logo.png','icon-192x192.png','icon-512x512.png','src','styles','vendor'])
 fs.cpSync(path.join(root,name),path.join(target,name),{recursive:true});
const html=fs.readFileSync(path.join(target,'index.html'),'utf8').replace('<script src="src/output.js">','<script src="capacitor.js"></script>\n<script src="src/output.js">');
fs.writeFileSync(path.join(target,'index.html'),html);
const cli=path.join(root,'node_modules/@capacitor/cli/bin/capacitor');
function cap(...args){cp.execFileSync(process.execPath,[cli,...args],{stdio:'inherit'});}
if(!fs.existsSync('android'))cap('add','android');
cap('sync','android');
const java='android/app/src/main/java/io/github/yosoyelpanque/inventarios';
fs.mkdirSync(java,{recursive:true});for(const f of ['MainActivity.java','InventoryFilesPlugin.java'])fs.copyFileSync('native/android/'+f,java+'/'+f);
const manifest='android/app/src/main/AndroidManifest.xml';
let xml=fs.readFileSync(manifest,'utf8').replace('android:allowBackup="true"','android:allowBackup="false"');
if(!xml.includes('android.permission.CAMERA'))xml=xml.replace('</manifest>','<uses-permission android:name="android.permission.CAMERA" />\n<uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
fs.writeFileSync(manifest,xml);
const gradle='android/app/build.gradle';
let build=fs.readFileSync(gradle,'utf8').replace(/versionCode \d+/,'versionCode 10401').replace(/versionName "[^"]+"/,'versionName "1.4.1"');
fs.writeFileSync(gradle,build);
// Reuse the existing application icon rather than the Capacitor template icon.
for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
 const dir='android/app/src/main/res/mipmap-'+density;fs.mkdirSync(dir,{recursive:true});
 for(const name of ['ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png'])fs.copyFileSync('icon-512x512.png',dir+'/'+name);
}
console.log('Android listo: android/ (API mínima definida por Capacitor).');
