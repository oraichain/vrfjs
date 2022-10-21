const hkdf = require('futoin-hkdf');
const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');
const secp256k1 = require('secp256k1');
const sha3 = require('js-sha3');

const AES_IV_LENGTH = 16;
const AES_TAG_LENGTH = 16;
const AES_IV_PLUS_TAG_LENGTH = AES_IV_LENGTH + AES_TAG_LENGTH;

const multiply = (pub, priv) => {
  const ret = Buffer.from(secp256k1.publicKeyTweakMul(pub, priv, false));
  return ret;
};

// create a unique share key for each verification vector, to prevent leak of share key
const encapsulate = (priv, pub, commit) => {
  const master = Buffer.concat([commit, multiply(pub, priv)]);
  return hkdf(master, 32, {
    hash: 'SHA-256'
  });
};

const aesEncrypt = (key, plainText) => {
  const nonce = randomBytes(AES_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plainText), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, encrypted]);
};

const aesDecrypt = (key, cipherText) => {
  const nonce = cipherText.slice(0, AES_IV_LENGTH);
  const tag = cipherText.slice(AES_IV_LENGTH, AES_IV_PLUS_TAG_LENGTH);
  const ciphered = cipherText.slice(AES_IV_PLUS_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphered), decipher.final()]);
};

exports.encrypt = (pub, priv, commit, msg) => {
  const aesKey = encapsulate(priv, pub, commit);
  return aesEncrypt(aesKey, msg);
};

exports.decrypt = (priv, pub, commit, encrypted) => {
  const aesKey = encapsulate(priv, pub, commit);
  return aesDecrypt(aesKey, encrypted);
};

exports.delay = (timeout) =>
  new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });

exports.convertOffset = (offset) => {
  // return [...Buffer.from(offset)];
  return offset;
};

exports.signSignature = function (randomness, privKey) {
  const randomnessBytes = Uint8Array.from(Buffer.from(randomness, 'base64'));
  const signature = secp256k1.ecdsaSign(randomnessBytes, privKey).signature;
  return signature;
}