import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeIosPdf } from '../src/core/ios-document-decoders.mjs';

function pdfEngine(texts) {
  let destroyed = false;
  return {
    getDocument({ data, isEvalSupported, disableFontFace }) {
      assert.ok(data instanceof Uint8Array);
      assert.equal(isEvalSupported, false);
      assert.equal(disableFontFace, true);
      return {
        promise: Promise.resolve({
          numPages: texts.length,
          getMetadata: async () => ({ info: { Title: 'Documento de prueba' } }),
          getPage: async page => ({
            getTextContent: async () => ({
              items: texts[page - 1].map(str => ({ str, hasEOL: true }))
            }),
            cleanup() {}
          }),
          async destroy() { destroyed = true; }
        }),
        async destroy() { destroyed = true; }
      };
    },
    wasDestroyed() { return destroyed; }
  };
}
test('PDF locally extracts text in the original page order', async () => {
  const engine = pdfEngine([['Página 1', 'Primera línea'], ['Página 2']]);
  const decoded = await decodeIosPdf(new Blob(['%PDF-1.7\nfixture']), { pdfEngine: engine });
  assert.equal(decoded.pdf.pageCount, 2);
  assert.equal(decoded.pdf.pages[0].number, 1);
  assert.match(decoded.pdf.pages[0].text, /Primera línea/);
  assert.equal(decoded.pdf.pages[1].number, 2);
  assert.equal(decoded.pdfNoText, false);
  assert.equal(engine.wasDestroyed(), true);
});
test('scanned PDF exposes every page for on-device OCR', async () => {
  const decoded = await decodeIosPdf(new Blob(['%PDF-1.7\nfixture']),
    { pdfEngine: pdfEngine([[], [], []]) });
  assert.equal(decoded.pdfNoText, true);
  assert.equal(decoded.pageCount, 3);
});
test('malformed PDF is never imported as a successful readable book', async () => {
  await assert.rejects(decodeIosPdf(new Blob(['not a PDF']),
    { pdfEngine: pdfEngine([[]]) }), /invalid-pdf/);
});
test('password-protected PDF requests a password without exposing contents', async () => {
  const engine = {
    getDocument: () => ({
      promise: Promise.reject(Object.assign(Error('password'), { name: 'PasswordException', code: 1 })),
      destroy: async () => {}
    })
  };
  const decoded = await decodeIosPdf(new Blob(['%PDF-1.7\nlocked']), { pdfEngine: engine });
  assert.equal(decoded.passwordRequired, true);
});
