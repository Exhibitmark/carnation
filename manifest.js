const struct = require('struct');
const {decompressSync} = require('./thirdparty/cppzst/index.js');


const header_chunk = struct()
    .word64Ule('sectionSize')
    .chars('unk1', 16)
    .word64Ule('elementSize')
    .word64Ule('count')
    .word64Ule('elementCount')
    
const manifest_header = struct()
    .word32Ule('packageCount')
    .word32Ule('unk')
    .word64Ule('unk1')
    .struct('section1', header_chunk)
    .chars('pad', 16)
    .struct('section2', header_chunk)
    .chars('pad', 16)
    .struct('section3', header_chunk)

const frame = struct()
    .word32Ule('compressed_size')
    .word32Ule('uncompressed_size')
    .word32Ule('package_index')
    .word32Ule('next_offset')

const frame_contents = struct()
    .chars('t',8,'hex')
    .chars('a',8,'hex')
    .word32Ule('file_index')
    .word32Ule('offset')
    .word32Ule('size')
    .word32Ule('someAlignment?')

const some_structure1 = struct()
    .chars('t',8,'hex')
    .chars('f',8,'hex')
    .chars('uniq2',8,'hex')
    .chars('uniq3',8,'hex')
    .chars('assetType',4,'hex')
    .word32Ule('unk')

const compressedHeader = struct()
    .chars('magic',4)
    .word32Ule('headerSize')
    .word64Ule('uncompressedSize')
    .word64Ule('compressedSize')

function ObjToArray(obj){
    let arr = []
    Object.keys(obj).forEach(function(e){
        arr.push(obj[e])
    });
    return arr
}

async function readHeader(buffer) {
    manifest_header._setBuff(buffer)
    return manifest_header.fields
}

async function readManifest(buffer, size1, size2, size3) {
    const mainstruct = struct()
        .struct('header', manifest_header)
        .array('frame_contents', size1, 'struct', frame_contents)
        .array('unk2', size2, 'struct', some_structure1)
        .chars('unk0',8)
        .array('frames',size3-1,'struct', frame)
    
    mainstruct._setBuff(buffer)
    let manifest = JSON.parse(JSON.stringify(mainstruct.fields))
    manifest.frame_contents = ObjToArray(manifest.frame_contents)
    manifest.frames = ObjToArray(manifest.frames)
    manifest.unk2 = ObjToArray(manifest.unk2)
    return manifest
}

async function decompressManifest(buffer){
    let size = getBufferLength(compressedHeader)
    compressedHeader._setBuff(buffer)
    let cmpBuffer = buffer.slice(size, size+compressedHeader.fields.compressedSize)
    return decompressSync(cmpBuffer);

}

function getBufferLength(s){
    return s.allocate().buffer().length
}


module.exports = {
    readManifest,
    readHeader,
    decompressManifest
}