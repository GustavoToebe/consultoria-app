import { coresDoDestaque, type ValoresPdf } from '../dominio/configuracaoPdf';
import { BORDA_SUAVE, DIVISORIA_NEUTRA, FUNDO_LEVE, textoSobreCinza } from './cssDosTemas';

/**
 * CSS das opções do PDF (plano `docs/planos/documentos-pdf-motor.md`, "Nova direção", D16): as regras que se acrescentam
 * no FIM do CSS base do `.doc` (`cssDoDoc`, em `pdf/html.ts`); a prévia prefixa por conta própria (`cssDaPrevia`). Cada
 * valor de opção vira um trecho FIXO daqui: nenhuma classe, cor, CSS ou HTML vem de fora. Cor só de `coresDoDestaque`
 * (`fundo` com texto `sobreFundo`; `texto` ≥ 4,5:1 sobre o branco) ou das constantes neutras de `cssDosTemas.ts`.
 *
 * Paridade: os valores do `CLASSICO` não acrescentam nada (cada opção no valor do Clássico dá `''`), e `MINIMALISTA` e
 * `MARCANTE` com os valores do modelo saem caractere por caractere iguais ao `cssDoTema` de antes; por isso a ordem dos
 * blocos é fixa: destaque, topo (`cabecalho.estilo`), tabelas (`tabelas.estilo`), cabeçalho de tabela (deriva de
 * `cabecalho.estilo`: FAIXA = preenchido com o destaque, LINHA e CARTAO = leve), fecho da LINHA e as demais opções.
 *
 * Densidade e tamanho P/G e a listra da dieta só alcançam aqui os seletores comuns (`.doc th`, `.doc h2`...): as regras mais
 * específicas que cada gerador escreve para a sua tabela e os seus itens são corrigidas em `cssDosAjustes.ts`, que o gerador
 * acrescenta no fim do CSS dele. Texto de marca que pode cair em linha listrada ou cartão usa `textoSobreCinza` (D7).
 *
 * Classes usadas (todas já existem em `faixaDaMarca`/`cabecalhoDoPdf` e nos geradores; nenhuma nova): `.faixa-marca`
 * (`.com-logo` quando há logo), `.faixa-logo img`, `.faixa-nome`, `.topo`, `.topo-titulo`, `.doc-titulo`, `.pequeno`,
 * `.rodape`, `.bloco`, `.refeicao`, `.lista-pdf`, `section` e `table`/`th`/`td`. A faixa traz a cor da marca no atributo
 * `style`: a troca de destaque a cobre com `!important` (assim, no CARTAO, a faixa e o topo ficam da mesma cor).
 */

/** Listra das tabelas `LISTRADA`: mais clara que o `FUNDO_LEVE` do cabeçalho leve, para os dois não se confundirem. */
export const LISTRA = '#F7F8FA';

export const CORES_EXATAS = '-webkit-print-color-adjust: exact; print-color-adjust: exact;';

const FONTE: Record<ValoresPdf['texto']['fonte'], string> = {
  SEM_SERIFA: '',
  SERIFADA: `.doc { font-family: Georgia, "Times New Roman", serif; }
`,
  CONDENSADA: `.doc { font-family: "Arial Narrow", "Roboto Condensed", sans-serif; font-stretch: condensed; }
`,
};

/** M é o de hoje (`cssDoDoc`); P e G mudam também os tamanhos fixos em pt dos títulos, do cabeçalho de tabela e do rodapé. */
const TAMANHO: Record<ValoresPdf['texto']['tamanho'], string> = {
  P: `.doc { font-size: 9.5pt; }
.doc h1 { font-size: 16pt; }
.doc h2 { font-size: 11.5pt; }
.doc h3, .doc .doc-titulo { font-size: 10pt; }
.doc th, .doc .pequeno { font-size: 8pt; }
.doc .rodape { font-size: 8pt; }
`,
  M: '',
  G: `.doc { font-size: 11.5pt; }
.doc h1 { font-size: 20pt; }
.doc h2 { font-size: 14pt; }
.doc h3, .doc .doc-titulo { font-size: 12pt; }
.doc th, .doc .pequeno { font-size: 10pt; }
.doc .rodape { font-size: 9.5pt; }
`,
};

const LOGO: Record<ValoresPdf['cabecalho']['logo'], string> = {
  ESQUERDA: '',
  CENTRO: `.doc .faixa-marca { flex-direction: column; justify-content: center; text-align: center; gap: 3pt; }
`,
};

/** M é o de hoje (até 18 pt de altura e 90 pt de largura, proporção mantida e nunca ampliada). */
const TAMANHO_DA_LOGO: Record<ValoresPdf['cabecalho']['tamanhoLogo'], string> = {
  P: `.doc .faixa-logo img { max-height: 12pt; max-width: 60pt; }
`,
  M: '',
  G: `.doc .faixa-logo img { max-height: 30pt; max-width: 150pt; }
`,
};

const DENSIDADE: Record<ValoresPdf['tabelas']['densidade'], string> = {
  COMPACTA: `.doc th, .doc td { padding: 2pt 4pt; }
`,
  NORMAL: '',
  ESPACOSA: `.doc th, .doc td { padding: 7pt 8pt; }
`,
};

/** As regras do `.doc` que se acrescentam ao CSS base, na ordem fixa descrita no topo do arquivo. */
export function cssDasOpcoes(valores: ValoresPdf, corDaMarca: string | null | undefined): string {
  const { fundo, texto, sobreFundo } = coresDoDestaque(valores.cores.destaque, corDaMarca);
  const estilo = valores.cabecalho.estilo;

  // O CSS base pinta com a marca: outro destaque troca essas cores primeiro, e os blocos de estilo abaixo ainda mandam.
  const destaque =
    fundo === coresDoDestaque('MARCA', corDaMarca).fundo
      ? ''
      : `.doc h1 { color: ${texto}; }
.doc h2 { color: ${texto}; border-bottom-color: ${fundo}; }
.doc .faixa-marca { background: ${fundo} !important; color: ${sobreFundo} !important; }
.doc .topo { border-bottom-color: ${fundo}; }
.doc th { color: ${sobreFundo}; background: ${fundo}; }
.doc a { color: ${textoSobreCinza(fundo)}; }
`;

  // A faixa traz o fundo e a cor no atributo `style` (`faixaDaMarca`): o `!important` é o que a deixa limpa sem mudar o HTML.
  const topo =
    estilo === 'LINHA'
      ? `.doc h1 { font-weight: 600; letter-spacing: 2px; color: #111; }
.doc h2 { font-weight: 600; color: #111; border-bottom: 1px solid ${fundo}; }
.doc .faixa-marca { background: transparent !important; color: ${texto} !important; padding: 0 0 3pt; margin-bottom: 6pt; }
.doc .faixa-marca.com-logo { padding: 0 0 3pt; }
.doc .topo { border-bottom: 1px solid ${fundo}; }
`
      : estilo === 'CARTAO'
        ? `.doc .faixa-marca { margin: 0; padding: 7pt 12pt 2pt; border-radius: 6pt 6pt 0 0; font-size: 8.5pt; }
.doc .faixa-marca.com-logo { padding: 7pt 12pt 2pt; }
.doc .topo { background: ${fundo}; color: ${sobreFundo}; border-bottom: 0; border-radius: 0 0 6pt 6pt; padding: 4pt 12pt 10pt; margin-bottom: 10pt; ${CORES_EXATAS} }
.doc .topo h1, .doc .topo .pequeno { color: ${sobreFundo}; }
`
        : '';

  const tabelas =
    valores.tabelas.estilo === 'CARTOES'
      ? `.doc > .bloco, .doc > section, .doc > .refeicao, .doc > .lista-pdf { border: 1px solid ${BORDA_SUAVE}; border-radius: 6pt; padding: 8pt 10pt; margin: 8pt 0; }
.doc > .bloco > h2:first-child, .doc > section > h2:first-child { margin-top: 0; }
.doc h2 { border-bottom: 1px solid ${BORDA_SUAVE}; }
`
      : valores.tabelas.estilo === 'LISTRADA'
        ? `.doc tbody tr:nth-child(even) > td { background: ${LISTRA}; ${CORES_EXATAS} }
`
        : '';

  // Cabeçalho de tabela leve: texto neutro escuro sobre transparente ou cinza leve (o preenchido do FAIXA é o do CSS base).
  const cabecalhoDeTabela =
    estilo === 'LINHA'
      ? `.doc th { background: transparent; color: #333; font-weight: 600; border-bottom: 1px solid ${DIVISORIA_NEUTRA}; }
.doc td { border-bottom: 1px solid #e6e6e6; }
.doc .rodape { border-top: 1px solid ${fundo}; }
`
      : estilo === 'CARTAO'
        ? `.doc th { background: ${FUNDO_LEVE}; color: #333; border-bottom: 1px solid ${BORDA_SUAVE}; }
`
        : '';

  // Sem logo, o nome fica mesmo com `mostrarNome` desligado: o documento nunca sai sem dizer de quem é.
  const nome = valores.cabecalho.mostrarNome === false ? `.doc .faixa-marca.com-logo .faixa-nome { display: none; }\n` : '';

  return (
    destaque +
    topo +
    tabelas +
    cabecalhoDeTabela +
    (FONTE[valores.texto.fonte] ?? '') +
    (TAMANHO[valores.texto.tamanho] ?? '') +
    (LOGO[valores.cabecalho.logo] ?? '') +
    (TAMANHO_DA_LOGO[valores.cabecalho.tamanhoLogo] ?? '') +
    nome +
    (DENSIDADE[valores.tabelas.densidade] ?? '')
  );
}
