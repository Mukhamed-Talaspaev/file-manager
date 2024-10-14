import { createInterface } from "readline";
import { homedir } from "os";
import { join, resolve, parse } from "path";
import { createReadStream, createWriteStream } from "fs";
import { readdir, stat, rename, unlink, mkdir } from "fs/promises";
import { createBrotliCompress, createBrotliDecompress } from "zlib";
import { createHash } from "crypto";
import { cpus, EOL, userInfo, arch } from "os";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

let currentDir = homedir();
let username = "";

const operations = {
  up: async () => {
    const parentDir = resolve(currentDir, "..");
    if (parentDir !== currentDir) {
      currentDir = parentDir;
    }
    console.log(`You are currently in ${currentDir}`);
  },
  cd: async (path) => {
    const newPath = resolve(currentDir, path);
    try {
      await stat(newPath);
      currentDir = newPath;
      console.log(`You are currently in ${currentDir}`);
    } catch (err) {
      console.log("Operation failed");
    }
  },
  ls: async () => {
    try {
      const items = await readdir(currentDir, { withFileTypes: true });
      const dirs = items
        .filter((item) => item.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name));
      const files = items
        .filter((item) => item.isFile())
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log("Type\t\tName");
      dirs.forEach((dir) => console.log(`Directory\t${dir.name}`));
      files.forEach((file) => console.log(`File\t\t${file.name}`));
    } catch (err) {
      console.log("Operation failed");
    }
  },
  cat: (path) => {
    const fullPath = resolve(currentDir, path);
    const readStream = createReadStream(fullPath);
    readStream.on("error", () => console.log("Operation failed"));
    readStream.pipe(process.stdout);
  },
  add: async (filename) => {
    const fullPath = join(currentDir, filename);
    try {
      const writeStream = createWriteStream(fullPath);
      writeStream.end();
      console.log(`File ${filename} created`);
    } catch (err) {
      console.log("Operation failed");
    }
  },
  rn: async (path, newFilename) => {
    const oldPath = resolve(currentDir, path);
    const newPath = join(parse(oldPath).dir, newFilename);
    try {
      await rename(oldPath, newPath);
      console.log(`File renamed to ${newFilename}`);
    } catch (err) {
      console.log("Operation failed");
    }
  },
  cp: async (source, destination) => {
    const sourcePath = resolve(currentDir, source);
    const destPath = resolve(currentDir, destination, parse(source).base);
    try {
      await mkdir(parse(destPath).dir, { recursive: true });
      const readStream = createReadStream(sourcePath);
      const writeStream = createWriteStream(destPath);
      readStream.pipe(writeStream);
      readStream.on("end", () => console.log("File copied successfully"));
      readStream.on("error", () => console.log("Operation failed"));
    } catch (err) {
      console.log("Operation failed");
    }
  },
  mv: async (source, destination) => {
    await operations.cp(source, destination);
    await unlink(resolve(currentDir, source));
    console.log("File moved successfully");
  },
  rm: async (path) => {
    try {
      await unlink(resolve(currentDir, path));
      console.log("File deleted successfully");
    } catch (err) {
      console.log("Operation failed");
    }
  },
  os: (flag) => {
    switch (flag) {
      case "--EOL":
        console.log(JSON.stringify(EOL));
        break;
      case "--cpus":
        const cpuInfo = cpus();
        console.log(`Overall amount of CPUs: ${cpuInfo.length}`);
        cpuInfo.forEach((cpu, index) => {
          console.log(
            `CPU ${index + 1}: ${cpu.model} (${(cpu.speed / 1000).toFixed(
              2
            )} GHz)`
          );
        });
        break;
      case "--homedir":
        console.log(homedir());
        break;
      case "--username":
        console.log(userInfo().username);
        break;
      case "--architecture":
        console.log(arch());
        break;
      default:
        console.log("Invalid input");
    }
  },
  hash: async (path) => {
    const fullPath = resolve(currentDir, path);
    try {
      const hash = createHash("sha256");
      const stream = createReadStream(fullPath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => console.log(hash.digest("hex")));
      stream.on("error", () => console.log("Operation failed"));
    } catch (err) {
      console.log("Operation failed");
    }
  },
  compress: async (source, destination) => {
    const sourcePath = resolve(currentDir, source);
    const destPath = resolve(currentDir, destination);
    try {
      const readStream = createReadStream(sourcePath);
      const writeStream = createWriteStream(destPath);
      const brotli = createBrotliCompress();
      readStream.pipe(brotli).pipe(writeStream);
      writeStream.on("finish", () =>
        console.log("File compressed successfully")
      );
    } catch (err) {
      console.log("Operation failed");
    }
  },
  decompress: async (source, destination) => {
    const sourcePath = resolve(currentDir, source);
    const destPath = resolve(currentDir, destination);
    try {
      const readStream = createReadStream(sourcePath);
      const writeStream = createWriteStream(destPath);
      const brotli = createBrotliDecompress();
      readStream.pipe(brotli).pipe(writeStream);
      writeStream.on("finish", () =>
        console.log("File decompressed successfully")
      );
    } catch (err) {
      console.log("Operation failed");
    }
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const usernameArg = args.find((arg) => arg.startsWith("--username="));
  if (usernameArg) {
    username = usernameArg.split("=")[1];
  }
}

function printWorkingDirectory() {
  console.log(`You are currently in ${currentDir}`);
}

function handleUserInput(input) {
  const [command, ...args] = input.trim().split(" ");

  if (command === ".exit") {
    rl.close();
    return;
  }

  if (operations[command]) {
    operations[command](...args);
  } else {
    console.log("Invalid input");
  }

  rl.question("> ", handleUserInput);
}

parseArgs();
console.log(`Welcome to the File Manager, ${username}!`);
printWorkingDirectory();

rl.on("close", () => {
  console.log(`Thank you for using File Manager, ${username}, goodbye!`);
  process.exit(0);
});

rl.question("> ", handleUserInput);
