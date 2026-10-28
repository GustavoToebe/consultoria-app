import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { urlDaApi } from '../api/cliente';
import type { Marca } from '../api/tipos';
import { apagarTemporaria } from '../aluno/atualizacao/fotos/fotosLocais';
import { reducaoDaLogo } from '../dominio/logoDoPdf';
import { logoEmMemoria } from './logoEmMemoria';

function lerComoDataUri(blob: Blob): Promise<string | null> {
  return new Promise((resolver) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(typeof leitor.result === 'string' ? leitor.result : null);
    leitor.onerror = () => resolver(null);
    leitor.readAsDataURL(blob);
  });
}

/**
 * Reduz a logo para `LADO_MAXIMO_DA_LOGO` e devolve o data URI do PNG (mantém a transparência). `null` quando não há o
 * que reduzir (já cabe) ou quando a redução não ficou menor que o original. O PNG sai em base64 do `saveAsync`, como a
 * foto de atualização: na web a CSP (`connect-src 'self'`) não deixa dar `fetch` em `blob:`/`data:`.
 */
async function reduzir(original: string): Promise<string | null> {
  const imagem = await ImageManipulator.manipulate(original).renderAsync();
  const acao = reducaoDaLogo(imagem.width, imagem.height);
  if (!acao) return null;
  const reduzida = await ImageManipulator.manipulate(imagem).resize(acao).renderAsync();
  const salvo = await reduzida.saveAsync({ format: SaveFormat.PNG, base64: true });
  await apagarTemporaria(salvo.uri);
  if (!salvo.base64) return null;
  const dataUri = `data:image/png;base64,${salvo.base64}`;
  return dataUri.length < original.length ? dataUri : null;
}

async function baixarEReduzir(logoUrl: string): Promise<string | null> {
  try {
    const resposta = await fetch(urlDaApi(logoUrl), { credentials: 'omit' });
    if (!resposta.ok) return null;
    const original = await lerComoDataUri(await resposta.blob());
    if (!original) return null;
    try {
      return (await reduzir(original)) ?? original;
    } catch {
      // Formato que o redutor não lê (por exemplo SVG): vale o original.
      return original;
    }
  } catch {
    return null;
  }
}

/**
 * Logo da marca como data URI, para ir dentro do PDF (o arquivo do celular não busca imagem na rede). A rota da logo
 * é pública e sem credencial. Vem reduzida (800 px no maior lado) e fica na memória até o "Sair" (`logoEmMemoria`), então
 * o segundo PDF da sessão não baixa de novo e, no aluno, sai com logo mesmo sem internet. Falhou (sem internet) → `null`
 * e o PDF usa o nome da consultoria.
 */
export async function logoComoDataUri(marca: Marca | null): Promise<string | null> {
  if (!marca?.logoUrl) return null;
  return logoEmMemoria(marca.logoUrl, baixarEReduzir);
}
