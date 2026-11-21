const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const screens = require('../src/design/screens.json');
const overlays = require('../src/design/overlays.json');
const assets = require('../src/design/asset-manifest.json');
assert.equal(screens.length, 100, 'Exactly 100 source screens');
assert.equal(new Set(screens.map(s=>s.id)).size,100,'Unique source frame IDs');
assert.deepEqual(screens.map(s=>s.number),Array.from({length:100},(_,i)=>i+1));
let slots=0;
const used=new Set();
for(const asset of Object.values(require('../src/design/motion-assets.json')))used.add(asset);
function visit(node){
  if(typeof node==='string')return;
  if(node.asset){assert(assets[node.asset], 'Known design asset');used.add(node.asset);slots++;}
  for(const child of node.children)visit(child);
}
for(const screen of [...screens,...overlays]){
  assert(screen.width>0&&screen.height>0,'Non-empty design dimensions');visit(screen.tree);
  assert(!JSON.stringify(screen).includes('www.figma.com/api/mcp/asset/'),'No temporary asset URLs');
}
for(const [key,item] of Object.entries(assets)){
  const file=path.join(root,item.file);assert(fs.existsSync(file),file);assert(fs.statSync(file).size>0,file);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0,20),key,'Unchanged asset bytes');
  assert(item.width>0&&item.height>0, 'Valid root asset geometry '+key);
}
console.log(JSON.stringify({screens:screens.length,dialogs:overlays.length,localAssets:Object.keys(assets).length,usedAssets:used.size,assetSlots:slots}));
