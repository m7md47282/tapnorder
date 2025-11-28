// FS module stub for browser (xlsx-populate requires it but doesn't use it in browser context)
export const readFileSync = () => {
  throw new Error('fs.readFileSync is not available in browser');
};

export const writeFileSync = () => {
  throw new Error('fs.writeFileSync is not available in browser');
};

export const existsSync = () => false;

export const mkdirSync = () => {
  throw new Error('fs.mkdirSync is not available in browser');
};

export const readdirSync = () => [];

export const statSync = () => ({ isFile: () => false, isDirectory: () => false });

export const createReadStream = () => {
  throw new Error('fs.createReadStream is not available in browser');
};

export const createWriteStream = () => {
  throw new Error('fs.createWriteStream is not available in browser');
};

export const promises = {
  readFile: () => Promise.reject(new Error('fs.promises.readFile is not available in browser')),
  writeFile: () => Promise.reject(new Error('fs.promises.writeFile is not available in browser')),
};

const fs = {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  createReadStream,
  createWriteStream,
  promises,
};

export default fs;


