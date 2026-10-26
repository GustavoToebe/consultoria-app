/**
 * Apoio dos testes de envio de arquivo no celular (nunca importado pelo app). O Jest roda no Node, cujo `Blob` aceita
 * `ArrayBuffer`; o do React Native não (`BlobManager.createFromParts`), e foi assim que o envio de foto quebrou no
 * aparelho sem teste nenhum perceber. Aqui o `Blob` imita o do aparelho e o corpo multipart sai do mesmo conversor que
 * o `fetch` do Expo usa de verdade (`convertFormDataAsync`), com o mesmo remendo de `FormData` (`installFormDataPatch`).
 */
type Conversor = (dados: FormData) => Promise<{ body: Uint8Array; boundary: string }>;

const MENSAGEM_DO_RN = "Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported";

class BlobDoRn {
  readonly size: number;
  readonly type: string;
  constructor(partes: unknown[] = [], opcoes: { type?: string } = {}) {
    let tamanho = 0;
    for (const parte of partes) {
      if (parte instanceof ArrayBuffer || ArrayBuffer.isView(parte)) throw new Error(MENSAGEM_DO_RN);
      tamanho += typeof parte === 'string' ? parte.length : ((parte as BlobDoRn).size ?? 0);
    }
    this.size = tamanho;
    this.type = opcoes.type ?? '';
  }
}

/**
 * Troca o `Blob` e o `FormData` globais pelos do React Native (com o remendo do Expo, que dá ao FormData `get` e
 * `entries`); o `FormData` do Node recusaria o que o aparelho aceita. Devolve a função que restaura os originais.
 */
export function instalarAmbienteDoRn(): () => void {
  const blob = globalThis.Blob;
  const formData = globalThis.FormData;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FormDataDoRn = require('react-native/Libraries/Network/FormData') as { default?: typeof FormData } & typeof FormData;
  const classe = FormDataDoRn.default ?? FormDataDoRn;
  const { installFormDataPatch } = jest.requireActual<{ installFormDataPatch: (f: unknown) => unknown }>('expo/src/winter/FormData');
  installFormDataPatch(classe);
  globalThis.Blob = BlobDoRn as unknown as typeof Blob;
  globalThis.FormData = classe;
  return () => {
    globalThis.Blob = blob;
    globalThis.FormData = formData;
  };
}

/** Corpo multipart que o `fetch` do Expo montaria para este `FormData`; lança o que ele lançaria. */
export async function multipartDe(dados: FormData): Promise<{ texto: string; bytes: number[] }> {
  const { convertFormDataAsync } = jest.requireActual<{ convertFormDataAsync: Conversor }>('expo/src/winter/fetch/convertFormData');
  const { body } = await convertFormDataAsync(dados);
  return { texto: Buffer.from(body).toString('latin1'), bytes: Array.from(body) };
}
