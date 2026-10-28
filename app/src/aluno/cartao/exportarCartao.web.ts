import type Svg from 'react-native-svg';

import { ErroDoCartao } from './erroDoCartao';
import { ALTURA_DO_CARTAO, LARGURA_DO_CARTAO } from '../../dominio/cartaoDoTreino';
import { ID_DO_CARTAO } from '../CartaoDoTreino';

export type ModoDeSaida = 'compartilhar' | 'baixar';

/** Web: "Baixar imagem" sempre; "Compartilhar" só onde o navegador compartilha arquivo (celular, em geral). */
export function modosDeSaida(): ModoDeSaida[] {
  try {
    const teste = new File([''], 'teste.png', { type: 'image/png' });
    return typeof navigator !== 'undefined' && navigator.canShare?.({ files: [teste] }) ? ['baixar', 'compartilhar'] : ['baixar'];
  } catch {
    return ['baixar'];
  }
}

/**
 * Web: o `<svg>` da prévia (dentro de `ID_DO_CARTAO`) é serializado e desenhado num canvas de 1080 × 1920, que vira PNG.
 * Tudo na página, sem `fetch` (a CSP só deixa `connect-src 'self'`): a imagem do SVG é um `data:` em `<img>`, que a CSP
 * permite em `img-src`. A logo já está dentro do SVG como data URI. A fonte é a do sistema (o SVG como imagem não usa
 * as fontes da página).
 */
async function gerarPng(): Promise<Blob> {
  const svg = document.getElementById(ID_DO_CARTAO)?.querySelector('svg');
  if (!svg) throw new ErroDoCartao('O cartão ainda não está pronto.');
  const copia = svg.cloneNode(true) as SVGSVGElement;
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copia.setAttribute('width', String(LARGURA_DO_CARTAO));
  copia.setAttribute('height', String(ALTURA_DO_CARTAO));
  copia.removeAttribute('style');
  const xml = new XMLSerializer().serializeToString(copia);
  const imagem = new Image();
  imagem.width = LARGURA_DO_CARTAO;
  imagem.height = ALTURA_DO_CARTAO;
  imagem.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await imagem.decode();
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA_DO_CARTAO;
  canvas.height = ALTURA_DO_CARTAO;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new ErroDoCartao('Este navegador não consegue gerar a imagem.');
  contexto.drawImage(imagem, 0, 0, LARGURA_DO_CARTAO, ALTURA_DO_CARTAO);
  return new Promise((resolver, rejeitar) =>
    canvas.toBlob((b) => (b ? resolver(b) : rejeitar(new ErroDoCartao('Este navegador não consegue gerar a imagem.'))), 'image/png'),
  );
}

export async function exportarCartao(_svg: Svg | null, nome: string, modo: ModoDeSaida): Promise<void> {
  const blob = await gerarPng();
  if (modo === 'compartilhar') {
    const arquivo = new File([blob], nome, { type: 'image/png' });
    try {
      await navigator.share({ files: [arquivo], title: 'Treino concluído' });
    } catch (erro) {
      // Fechar o compartilhar não é erro.
      if (erro instanceof DOMException && erro.name === 'AbortError') return;
      throw erro;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
