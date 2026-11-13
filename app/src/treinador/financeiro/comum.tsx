import { Campo } from '../../ui/Campo';
import { codigoApi } from '../../ui/erros';
import { centavosDaTela, centavosParaTela, mascaraDeMoeda } from '../../dominio/formatos';

/** 409 `CONFLITO_EDICAO`: outra pessoa (ou outra aba) mexeu no registro; a tela avisa e recarrega, como nas outras telas. */
export const ehConflito = (erro: unknown): boolean => codigoApi(erro) === 'CONFLITO_EDICAO';

/** `A cobrança foi alterada` → o aviso padrão do conflito. */
export const avisoDeConflito = (sujeito: string): string => `${sujeito} em outro lugar. Recarregamos para você conferir.`;

/**
 * Valor em reais digitado como texto ("150", "150,50", "1.234,50"). O texto fica com a tela; quem usa converte com
 * `centavosDaTela` (nulo = vazio ou inválido). Nunca é um valor de cobrança: só plano, contratação e lançamento.
 * `mascara`: formata enquanto digita (`mascaraDeMoeda`, "R$ 1.000,00"), e o rótulo não repete o "R$". Sem ela, o
 * texto fica como a pessoa digitou.
 */
export function CampoMoeda({ rotulo, texto, aoMudar, erro, ajuda, mascara, corDoTexto }: {
  /** Cor do número digitado (lançamento: azul de entrada, vermelho de saída). */
  corDoTexto?: string;
  rotulo: string;
  texto: string;
  aoMudar: (texto: string) => void;
  erro?: string | null;
  ajuda?: string;
  mascara?: boolean;
}) {
  const invalido = texto.trim() !== '' && centavosDaTela(texto) === null;
  if (mascara) {
    // O texto de quem chama pode vir de `centavosParaCampo` ("123,45"): a tela mostra já no formato da máscara.
    const centavos = centavosDaTela(texto);
    const exibido = centavos === null ? '' : centavosParaTela(centavos);
    // shortcut: a máscara reescreve o texto inteiro e o cursor vai para o fim (editar no meio não é preservado); trocar por seleção controlada se pedirem.
    return (
      <Campo numerico rotulo={rotulo} valor={exibido} aoMudar={(novo) => aoMudar(mascaraDeMoeda(exibido, novo))}
        placeholder="R$ 0,00" keyboardType="number-pad" inputMode="numeric" ajuda={ajuda} erro={erro ?? null} corDoTexto={corDoTexto} />
    );
  }
  return (
    <Campo numerico rotulo={rotulo} valor={texto} aoMudar={aoMudar} placeholder="0,00" keyboardType="decimal-pad" inputMode="decimal"
      ajuda={ajuda} erro={erro ?? (invalido ? 'Valor inválido. Use reais, por exemplo 150,00.' : null)} corDoTexto={corDoTexto} />
  );
}

