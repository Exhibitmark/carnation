const fs = require('fs');
const {decompressSync} = require('./thirdparty/cppzst/index.js');
const { readManifest, readHeader, decompressManifest } = require('./manifest.js')

if(!process.argv[2]){
    console.log("Package name missing")
    console.log("USAGE\n node main.js <package name> <path to manifest> <path to package/s> <output path>")
    process.exit()
} else if(!process.argv[3]){
    console.log("Manifest Path missing")
    console.log("USAGE\n node main.js <package name> <path to manifest> <path to package/s> <output path>")
    process.exit()
} else if(!process.argv[4]){
    console.log("Packages Path missing")
    console.log("USAGE\n node main.js <package name> <path to manifest> <path to package/s> <output path>")
    process.exit()
} else if(!process.argv[5]){
    console.log("Output Path missing")
    console.log("USAGE\n node main.js <package name> <path to manifest> <path to package/s> <output path>")
    process.exit()
}

const packageName = process.argv[2]
const manifestPath = process.argv[3]
const packagesPath = process.argv[4]
const outputPath = process.argv[5]

let manifest = fs.readFileSync(`${manifestPath}\\${packageName}`)
let package = packagesPath+`${packageName}_`
let packageFile;
let outDir = outputPath
let current = 0

decompressManifest(manifest)
.then(decompressed => {
    readHeader(decompressed)
    .then(fields => {
        readMan(decompressed, JSON.parse(JSON.stringify(fields)))
    });
});

function readMan(buffer, fields){
    let s1Size = fields.section1.elementCount
    let s2Size = fields.section2.elementCount
    let s3Size = fields.section3.elementCount
    readManifest(buffer, s1Size, s2Size, s3Size)
        .then(x => {
            let frames = x.frames
            let i = 0;
            for(let frame in frames){
                let f = frames[frame]
                if(!packageFile || (f.package_index != current)){
                    packageFile = fs.readFileSync(package+`${f.package_index}.zst`)
                    current = f.package_index
                }
                let size = f.compressed_size
                let offset = f.next_offset - size
                let outBuf = packageFile.slice(offset,offset+size)
                fs.writeFileSync(outDir+`${i}.bin`, decompressSync(outBuf))
                i++;
            }
        });
}

