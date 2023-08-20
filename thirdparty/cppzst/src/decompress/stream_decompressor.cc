#include "stream_decompressor.h"
#include "stream_decompress_worker.h"

namespace ZSTD_NODE {

  using Nan::SetPrototypeMethod;
  using Nan::GetCurrentContext;
  using Nan::AsyncQueueWorker;
  using Nan::GetFunction;
  using Nan::HandleScope;
  using Nan::ObjectWrap;
  using Nan::NewBuffer;
  using Nan::Callback;
  using Nan::Has;
  using Nan::Get;
  using Nan::Set;

  using node::Buffer::Length;
  using node::Buffer::Data;

  using v8::FunctionTemplate;
  using v8::Number;
  using v8::String;
  using v8::Local;
  using v8::Value;

  NAN_MODULE_INIT(StreamDecompressor::Init) {
    Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>(New);
    tpl->SetClassName(Nan::New("StreamDecompressor").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    SetPrototypeMethod(tpl, "getBlockSize", GetBlockSize);
    SetPrototypeMethod(tpl, "copy", Copy);
    SetPrototypeMethod(tpl, "decompress", Decompress);

    constructor().Reset(GetFunction(tpl).ToLocalChecked());
    Set(target, Nan::New("StreamDecompressor").ToLocalChecked(),
        GetFunction(tpl).ToLocalChecked());
  }

  StreamDecompressor::StreamDecompressor(Local<Object> userParams) : zds(NULL), dict(NULL) {
    HandleScope scope;

    size_t dictSize = 0;

    Local<String> key;
    key = Nan::New<String>("dict").ToLocalChecked();
    if (Has(userParams, key).FromJust()) {
      Local<Object> dictBuf = Get(userParams, key).ToLocalChecked()->ToObject(Nan::GetCurrentContext()).ToLocalChecked();
      dictSize = Length(dictBuf);
      dict = alloc.Alloc(dictSize);
      memcpy(dict, Data(dictBuf), dictSize);
    }

    inputSize = ZSTD_DStreamInSize();
    input = alloc.Alloc(inputSize);
    inPos = 0;

    dstSize = ZSTD_DStreamOutSize();
    dst = alloc.Alloc(dstSize);
    dstPos = 0;

    ZSTD_customMem zcm = {Allocator::Alloc, Allocator::Free, &alloc};
    zds = ZSTD_createDStream_advanced(zcm);

    if (dict != NULL && dictSize > 0) {
      ZSTD_initDStream_usingDict(zds, dict, dictSize);
    } else {
      ZSTD_initDStream(zds);
    }
  }

  StreamDecompressor::~StreamDecompressor() {
    if (dict != NULL) {
      alloc.Free(dict);
    }
    if (input != NULL) {
      alloc.Free(input);
    }
    if (dst != NULL) {
      alloc.Free(dst);
    }
    ZSTD_freeDStream(zds);
  }

  NAN_METHOD(StreamDecompressor::New) {
    if (!info.IsConstructCall()) {
      return Nan::ThrowError("StreamDecompressor() must be called as a constructor");
    }
    StreamDecompressor *sd = new StreamDecompressor(info[0]->ToObject(Nan::GetCurrentContext()).ToLocalChecked());
    sd->Wrap(info.This());
    info.GetReturnValue().Set(info.This());
  }

  NAN_METHOD(StreamDecompressor::GetBlockSize) {
    info.GetReturnValue().Set(Nan::New<Number>(ZSTD_DStreamInSize()));
  }

  NAN_METHOD(StreamDecompressor::Copy) {
    StreamDecompressor* sd = ObjectWrap::Unwrap<StreamDecompressor>(info.Holder());
    Local<Object> chunkBuf = info[0]->ToObject(Nan::GetCurrentContext()).ToLocalChecked();
    char *chunk = Data(chunkBuf);
    size_t chunkSize = Length(chunkBuf);
    if (chunkSize != 0) {
      if (sd->inPos == sd->inputSize) {
        sd->inPos = 0;
      }
      char *pos = static_cast<char*>(sd->input) + sd->inPos;
      memcpy(pos, chunk, chunkSize);
      sd->inPos += chunkSize;
    }
  }

  NAN_METHOD(StreamDecompressor::Decompress) {
    StreamDecompressor* sd = ObjectWrap::Unwrap<StreamDecompressor>(info.Holder());

    Callback *callback = new Callback(info[0].As<Function>());
    StreamDecompressWorker *worker = new StreamDecompressWorker(callback, sd);

    if (Nan::To<bool>(info[1]).FromJust()) {
      AsyncQueueWorker(worker);
    } else {
      worker->Execute();
      worker->WorkComplete();
    }
  }

  inline Persistent<Function>& StreamDecompressor::constructor() {
    static Persistent<Function> ctor;
    return ctor;
  }

}
