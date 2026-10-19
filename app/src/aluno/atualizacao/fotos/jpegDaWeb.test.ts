import { blobDeBase64 } from './jpegDaWeb';

// Começo de um JPEG (FF D8 FF E0) em base64.
const JPEG = '/9j/4A==';

describe('blobDeBase64', () => {
  it('monta o arquivo com os bytes e o tipo, sem rede', async () => {
    const blob = blobDeBase64(JPEG);
    expect(blob.size).toBe(4);
    expect(blob.type).toBe('image/jpeg');
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });

  it('aceita o base64 com o prefixo data:', () => {
    expect(blobDeBase64(`data:image/jpeg;base64,${JPEG}`).size).toBe(4);
  });
});
