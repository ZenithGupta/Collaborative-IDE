const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('wandbox_compilers.json', 'utf8'));
  const wantedLangs = ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++'];
  const matches = {};
  
  data.forEach(item => {
    if (wantedLangs.includes(item.language)) {
      if (!matches[item.language]) matches[item.language] = [];
      matches[item.language].push({ name: item.name, ver: item.version });
    }
  });
  
  for (const lang in matches) {
    console.log(`\n--- ${lang} ---`);
    matches[lang].slice(0, 3).forEach(c => console.log(`${c.name} (${c.ver})`));
  }
} catch (e) {
  console.error(e);
}
