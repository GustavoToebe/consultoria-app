import { Campo } from '../../ui/Campo';
import { codigoApi } from '../../ui/erros';
import { centavosDaTela } from '../../dominio/formatos';

/** 409 `CONFLITO_EDICAO`: outra pessoa (ou outra aba) mexeu no registro; a tela avisa e recarrega, como nas outras telas. */
export const ehConflito = (erro: unknown): boolean => codigoApi(erro) === 'CONFLITO_EDICAO';

/** `A cobrança foi alterada` → o aviso padrão do conflito. */
export const avisoDeConflito = (sujeito: string): string => `${sujeito} em outro lugar. Recarregamos para você conferir.`;

/**
 * Valor em reais digitado como texto ("150", "150,50", "1.234,50"). O texto fica com a tela; quem usa converte com
 * `centavosDaTela` (nulo = vazio ou inválido). Nunca é um valor de cobrança: só plano, contratação e lançamento.
 */
export function CampoMoeda({ rotulo, texto, aoMudar, erro, ajuda }: {
  rotulo: string;
  texto: string;
  aoMudar: (texto: string) => void;
  erro?: string | null;
  ajuda?: string;
}) {
  const invalido = texto.trim() !== '' && centavosDaTela(texto) === null;
  return (
    <Campo numerico rotulo={rotulo} valor={texto} aoMudar={aoMudar} placeholder="0,00" keyboardType="decimal-pad" inputMode="decimal"
      ajuda={ajuda} erro={erro ?? (invalido ? 'Valor inválido. Use reais, por exemplo 150,00.' : null)} />
  );
}
