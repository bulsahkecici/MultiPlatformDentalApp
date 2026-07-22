const fs = require('fs/promises');
const path = require('path');

const testStorage = `tmp/encrypted-doc-test-${process.pid}`;
process.env.DOCUMENT_STORAGE_DIR = testStorage;

const {
  storeEncryptedDocument,
  readEncryptedDocument,
} = require('../src/services/encryptedDocumentStorage');

describe('Şifreli klinik belge deposu', () => {
  afterAll(async () => {
    await fs.rm(path.resolve(testStorage), { recursive: true, force: true });
  });

  it('belgeyi düz metin olmadan saklar ve bütünlük kontrolüyle okur', async () => {
    const plaintext = Buffer.from('hasta-ozel-rontgen-verisi');
    const stored = await storeEncryptedDocument(plaintext);
    const disk = await fs.readFile(
      path.resolve(testStorage, stored.storageKey),
    );
    expect(disk.includes(plaintext)).toBe(false);
    await expect(
      readEncryptedDocument(stored.storageKey, stored.sha256),
    ).resolves.toEqual(plaintext);
    await expect(
      readEncryptedDocument(stored.storageKey, '0'.repeat(64)),
    ).rejects.toThrow('integrity');
  });
});
