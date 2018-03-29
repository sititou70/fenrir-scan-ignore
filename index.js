const fs = require('fs');
const path = require('path');
const yaml = require('yamljs');
const iconv = require('iconv-lite');

const scanrule_file_name = 'ScanRule.ini';
const original_scanrule_file_name = 'ScanRule.orig.ini';
const scanignore_file_name = 'scanignore.ini';
const config_file_name = 'config.yml';
const initial_config = {
  fenrirscan_dir: ""
};

//load settings
if(!fs.existsSync(config_file_name)){
  console.error('config file is not exist.');
  fs.writeFileSync(config_file_name, yaml.stringify(initial_config))
  process.exit(1);
}

const config = yaml.load(config_file_name);

//load original scanrule
const original_scanrule_file_path = path.join(config.fenrirscan_dir, original_scanrule_file_name);
if(!fs.existsSync(original_scanrule_file_path)){
  console.error(`${original_scanrule_file_name} is not exist.`);
  process.exit(1);
}

const scan_rule = fs.readFileSync(original_scanrule_file_path);
const scan_paths = iconv.decode(scan_rule, 'shift_jis')
  .toString()
  .replace(/\\/g, '/')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .filter(x => x !== '')
  .filter(x => !(/^[*-]/).test(x))
  .map(x => x.match(/(.+?),/)[1])
  .map(x => x.replace(/C:\//, '/mnt/c/'));

//load scanignore file
const scanignore_file_path = path.join(config.fenrirscan_dir, scanignore_file_name);
if(!fs.existsSync(scanignore_file_path)){
  console.error(`${scanignore_file_path} is not exist.`);
  process.exit(1);
}

const scanignore = fs.readFileSync(scanignore_file_path)
  .toString()
  .split('\n')
  .filter(x => x !== '');

//walk directory
const isIgnoreDirectory = (dir, scanignore) =>
  scanignore
    .find(x => (new RegExp(x)).test(dir)) !== undefined;

const isAccessibleDirectory = dir_path => {
  try{
    return fs.statSync(path.join(dir_path)).isDirectory();
  }catch(e){
    return false;
  }
};

const walk = (dir, scanignore) => fs.readdirSync(dir)
  .map(x => path.join(dir, x))
  .filter(x => isAccessibleDirectory(x))
  .map(x => isIgnoreDirectory(x, scanignore) ? x : walk(x, scanignore, console.log('D', x)))
  .reduce((s, x) => typeof x === 'string' ? [...s, x] : [...s, ...x], []);

//make ScanRule
const ignore_paths = scan_paths
  .map(x => walk(x, scanignore))
  .reduce((s, x) => [...s, ...x])
  .filter((x, i, self) => self.indexOf(x) === i)
  .map(x => x.replace(/\/mnt\/c\//, 'C:/'))
  .map(x => x.replace(/\//g, '\\'))
  .map(x => `-${x}`)
  .reduce((s, x) => `${s}\r\n${x}`);

const scanrule_file = Buffer.concat([scan_rule, new Buffer('\r\n'), iconv.encode(new Buffer(ignore_paths), 'shift_jis')]);

fs.writeFileSync(path.join(config.fenrirscan_dir, scanrule_file_name), scanrule_file);

