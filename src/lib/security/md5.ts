import SparkMD5 from 'spark-md5';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * 把 16 字节摘要编码为标准 Base64（RFC 4648，含 padding）。
 * 不依赖 btoa，Web 与 Hermes 均可运行。
 */
function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    output += BASE64_ALPHABET[b0 >> 2];
    output += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    output +=
      i + 1 < bytes.length
        ? BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]
        : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[b2 & 0x3f] : '=';
  }
  return output;
}

/**
 * 计算文件字节的 RFC 1864 Content-MD5：16 字节 MD5 摘要的标准 Base64。
 * 后端 presign 要求该值（固定 24 字符、以 == 结尾）。
 */
export function md5Base64(bytes: ArrayBuffer): string {
  const hex = SparkMD5.ArrayBuffer.hash(bytes);
  const digest = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    digest[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytesToBase64(digest);
}
