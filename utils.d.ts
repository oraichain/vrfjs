/**
* @param {Uint8Array} pub
* @param {Uint8Array} priv
* @param {Buffer} commit
* @param {Buffer} msg
* @returns {Buffer}
*/
export function encrypt(pub: Uint8Array, priv: Uint8Array, commit: Buffer, msg: Buffer): Buffer;

/**
* @param {Uint8Array} priv
* @param {Uint8Array} pub
* @param {Buffer} commit
* @param {Buffer} encrypted
* @returns {Buffer}
*/
export function decrypt(priv: Uint8Array, pub: Uint8Array, commit: Buffer, encrypted: Buffer): Buffer;

/**
* @param {Number} timeout
* @returns {Promise<void>}
*/
export function delay(timeout: Number): Promise<void>;

export function convertOffset(offset: any): any;

export function signSignature(randomness: any, privKey: Uint8Array): any;
