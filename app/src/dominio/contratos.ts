import type { ContratacaoResponse } from '../api/financeiroTipos';
import { LIMITES_DO_CONTRATO, type FaltaDoContrato, type SignatarioDoContrato, type SituacaoDoContrato } from '../api/contratos';
import { esc } from '../pdf/html';
import type { TipoSelo } from '../ui/Selo';
import { dataEmBrasilia } from './agendaPresencial';
import { centavosParaTela, dataCurta, dataParaTela } from './formatos';
import { rotuloDaPeriodicidade } from './financeiro';
import { textoFormatado } from './textoFormatado';

/**
 * Contrato digital no app (`docs/planos/contrato-digital-telas.md`): regras puras das telas e do comprovante. Os campos do
 * modelo são uma lista FECHADA da API (`CamposDoContrato.java`; o teste de paridade confere). O app nunca calcula o código de
 * verificação (`sha256`): mostra e imprime o que a API devolveu.
 */

export type GrupoDoCampo = 'Aluno' | 'Responsável' | 'Contratação' | 'Outros';

export interface CampoDoContrato {
  codigo: string;
  rotulo: string;
  grupo: GrupoDoCampo;
}

/** Os 12 campos, na ordem dos chips do editor (grupo por grupo). */
export const CAMPOS_DO_CONTRATO: readonly CampoDoContrato[] = [
  { codigo: 'aluno_nome', rotulo: 'Nome do aluno', grupo: 'Aluno' },
  { codigo: 'aluno_cpf', rotulo: 'CPF do aluno', grupo: 'Aluno' },
  { codigo: 'aluno_endereco', rotulo: 'Endereço do aluno', grupo: 'Aluno' },
  { codigo: 'responsavel_nome', rotulo: 'Nome do responsável', grupo: 'Responsável' },
  { codigo: 'responsavel_cpf', rotulo: 'CPF do responsável', grupo: 'Responsável' },
  { codigo: 'plano', rotulo: 'Plano', grupo: 'Contratação' },
  { codigo: 'valor_total', rotulo: 'Valor total', grupo: 'Contratação' },
  { codigo: 'parcelas', rotulo: 'Parcelas', grupo: 'Contratação' },
  { codigo: 'vigencia_inicio', rotulo: 'Início da vigência', grupo: 'Contratação' },
  { codigo: 'vigencia_fim', rotulo: 'Fim da vigência', grupo: 'Contratação' },
  { codigo: 'consultoria', rotulo: 'Consultoria', grupo: 'Outros' },
  { codigo: 'data', rotulo: 'Data de geração', grupo: 'Outros' },
];

export const GRUPOS_DOS_CAMPOS: readonly GrupoDoCampo[] = ['Aluno', 'Responsável', 'Contratação', 'Outros'];

/** O campo no texto: `{letras, números e _}`. Igual ao `TOKEN` de `CamposDoContrato.java` (o teste de paridade confere). */
export const PADRAO_DO_CAMPO = /\{([A-Za-z0-9_]+)\}/g;

const CODIGOS = new Set(CAMPOS_DO_CONTRATO.map((c) => c.codigo));

/** Os códigos que o texto usa e a lista não tem, sem repetir, na ordem em que aparecem. */
export function camposDesconhecidos(texto: string): string[] {
  const lista: string[] = [];
  for (const m of texto.matchAll(PADRAO_DO_CAMPO)) {
    if (!CODIGOS.has(m[1]) && !lista.includes(m[1])) lista.push(m[1]);
  }
  return lista;
}

/** "Campos desconhecidos: {x}, {y}. Use só os da lista." ou `null` quando está tudo certo. */
export function erroDosCamposDesconhecidos(texto: string): string | null {
  const lista = camposDesconhecidos(texto);
  return lista.length === 0 ? null : `Campos desconhecidos: ${lista.map((c) => `{${c}}`).join(', ')}. Use só os da lista.`;
}

export interface SelecaoDoTexto {
  inicio: number;
  fim: number;
}

/**
 * Põe `{codigo}` onde está o cursor (ou no lugar do trecho selecionado) e devolve o texto novo e o cursor logo depois do
 * campo. A seleção fora do texto ou invertida é ajustada.
 */
export function inserirCampo(texto: string, selecao: SelecaoDoTexto, codigo: string): { texto: string; cursor: number } {
  const limite = (n: number) => Math.min(Math.max(Number.isFinite(n) ? n : texto.length, 0), texto.length);
  const a = limite(selecao.inicio);
  const b = limite(selecao.fim);
  const campo = `{${codigo}}`;
  const inicio = Math.min(a, b);
  return { texto: texto.slice(0, inicio) + campo + texto.slice(Math.max(a, b)), cursor: inicio + campo.length };
}

// ---- selos e ações ----

export interface SeloDoContrato {
  texto: string;
  tipo: TipoSelo;
}

const prazoCurto = (prazoAte: string) => dataCurta(dataEmBrasilia(prazoAte));

/** Selo da equipe. `vencido` é da API (o app não compara datas). */
export function seloDoContrato(c: { situacao: SituacaoDoContrato; prazoAte?: string | null; vencido?: boolean }): SeloDoContrato {
  if (c.situacao === 'ASSINADO') return { texto: 'Assinado', tipo: 'sucesso' };
  if (c.situacao === 'CANCELADO') return { texto: 'Cancelado', tipo: 'neutro' };
  if (c.vencido) return { texto: 'Prazo vencido', tipo: 'perigo' };
  return { texto: c.prazoAte ? `Pendente · até ${prazoCurto(c.prazoAte)}` : 'Pendente', tipo: 'atencao' };
}

/** Selo do aluno: o mesmo estado dito para quem assina. */
export function seloDoContratoDoAluno(c: { situacao: SituacaoDoContrato; prazoAte?: string | null; vencido?: boolean }): SeloDoContrato {
  if (c.situacao === 'ASSINADO') return { texto: 'Assinado', tipo: 'sucesso' };
  if (c.situacao === 'CANCELADO') return { texto: 'Cancelado', tipo: 'neutro' };
  if (c.vencido) return { texto: 'Prazo terminou', tipo: 'perigo' };
  return { texto: c.prazoAte ? `Assine até ${prazoCurto(c.prazoAte)}` : 'Para assinar', tipo: 'atencao' };
}

export type IdDaAcaoDoContrato = 'novoLink' | 'comprovante' | 'prorrogar' | 'cancelar';

export interface AcaoDoContrato {
  id: IdDaAcaoDoContrato;
  rotulo: string;
  perigo?: boolean;
}

/**
 * O que o ⋯ do contrato oferece a quem tem `CONTRATO_LER` e/ou `CONTRATO_ALTERAR`; vazio = sem ⋯. O link do responsável só
 * existe no contrato `RESPONSAVEL` pendente, e o código só aparece na resposta: perdido, gera-se outro (o anterior deixa de valer).
 */
export function acoesDoContrato(c: { situacao: SituacaoDoContrato; prazoAte?: string | null; signatario?: SignatarioDoContrato }, pode: (permissao: string) => boolean): AcaoDoContrato[] {
  const acoes: AcaoDoContrato[] = [];
  if (c.situacao === 'ASSINADO' && pode('CONTRATO_LER')) acoes.push({ id: 'comprovante', rotulo: 'Baixar comprovante' });
  if (c.situacao === 'PENDENTE' && pode('CONTRATO_ALTERAR')) {
    if (c.signatario === 'RESPONSAVEL') acoes.push({ id: 'novoLink', rotulo: 'Gerar novo link do responsável' });
    // O prazo só existe a partir do passo 5 do plano: sem ele não há o que prorrogar.
    if (c.prazoAte) acoes.push({ id: 'prorrogar', rotulo: 'Prorrogar prazo' });
    acoes.push({ id: 'cancelar', rotulo: 'Cancelar contrato', perigo: true });
  }
  return acoes;
}

/** "Assina: aluno" / "Assina: responsável", para as duas linhas do par de 16 a 17 anos e o contrato do responsável. */
export const rotuloDoSignatario = (s: SignatarioDoContrato): string => (s === 'RESPONSAVEL' ? 'Assina: responsável' : 'Assina: aluno');

// ---- quem assina (D1, D12, D28) ----

export type FaixaDoMenor = 'MENOR_DE_16' | 'DE_16_A_17';

/**
 * A faixa do menor pela data de nascimento (`AAAA-MM-DD`) e o dia de hoje em Brasília (`AAAA-MM-DD`), só para a nota da tela:
 * quem decide o signatário é o servidor (S2). Maior de idade, sem data ou data ilegível = `null`. Faz aniversário hoje = já
 * tem a idade nova.
 */
export function faixaDoMenor(dataNascimento: string | null | undefined, hoje: string): FaixaDoMenor | null {
  const n = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataNascimento ?? '');
  const h = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hoje);
  if (!n || !h) return null;
  const idade = Number(h[1]) - Number(n[1]) - (`${h[2]}${h[3]}` < `${n[2]}${n[3]}` ? 1 : 0);
  if (idade < 0) return null;
  if (idade < 16) return 'MENOR_DE_16';
  return idade < 18 ? 'DE_16_A_17' : null;
}

export const NOTA_DO_MENOR: Record<FaixaDoMenor, string> = {
  MENOR_DE_16: 'Menor de 16 anos: assina só o responsável.',
  DE_16_A_17: 'De 16 a 17 anos: o aluno e o responsável assinam.',
};

/** Sem a data de nascimento à mão, a tela só explica a regra. */
export const NOTA_DOS_MENORES = 'Para menores de idade o app pede também a assinatura do responsável.';

// ---- faltas da prévia ----

/** Os campos que dependem do Financeiro: sem `FINANCEIRO_LER` a prévia os acusa mesmo quando o dado existe. */
const CAMPOS_DO_FINANCEIRO = new Set(['responsavel_nome', 'responsavel_cpf', 'plano', 'valor_total', 'parcelas', 'vigencia_inicio', 'vigencia_fim']);

export const TEXTO_DA_NOTA_DAS_FALTAS = 'Plano, valor, parcelas, vigência e responsável precisam do Financeiro, que não está disponível para o seu perfil.';

/** A nota que vai sob as faltas quando alguma depende do Financeiro e o perfil não o lê; senão `null`. */
export const notaDasFaltas = (faltas: readonly FaltaDoContrato[], podeFinanceiro: boolean): string | null =>
  !podeFinanceiro && faltas.some((f) => CAMPOS_DO_FINANCEIRO.has(f.campo)) ? TEXTO_DA_NOTA_DAS_FALTAS : null;

/** "Completar o cadastro do aluno" só com a permissão que grava CPF e endereço e alguma dessas faltas. */
export const podeCompletarOCadastro = (faltas: readonly FaltaDoContrato[], pode: (permissao: string) => boolean): boolean =>
  pode('ALUNO_SENSIVEL_ALTERAR') && faltas.some((f) => f.campo === 'aluno_cpf' || f.campo === 'aluno_endereco');

/**
 * "Completar o cadastro do responsável": o responsável financeiro mora no cartão "Plano contratado" da ficha e só se grava com
 * `FINANCEIRO_ALTERAR` (o CPF também pede `ALUNO_SENSIVEL_LER`).
 */
export function podeCompletarOResponsavel(faltas: readonly FaltaDoContrato[], pode: (permissao: string) => boolean): boolean {
  if (!pode('FINANCEIRO_ALTERAR')) return false;
  return faltas.some((f) => f.campo === 'responsavel_nome' || (f.campo === 'responsavel_cpf' && pode('ALUNO_SENSIVEL_LER')));
}

// ---- contratação ----

/** "Plano Mensal · Mensal · R$ 300,00 · desde 05/10/2026" (contrato fechado: "Contrato" no lugar da periodicidade; pausada avisa). */
export function rotuloDaContratacao(c: ContratacaoResponse): string {
  const periodo = c.contrato ? 'Contrato' : rotuloDaPeriodicidade(c.periodicidade);
  return [c.planoNome?.trim() || 'Plano', periodo, centavosParaTela(c.valorCentavos), `desde ${dataParaTela(c.inicio)}`, ...(c.situacao === 'PAUSADA' ? ['pausada'] : [])].join(' · ');
}

/** As contratações que se pode ligar ao contrato (ATIVA e PAUSADA, as ativas primeiro) e o padrão: a única ATIVA, se for uma só. */
export function contratacoesParaEscolher(lista: readonly ContratacaoResponse[] | null | undefined): { opcoes: ContratacaoResponse[]; padraoId: string | null } {
  const ativas = (lista ?? []).filter((c) => c.situacao === 'ATIVA');
  const opcoes = [...ativas, ...(lista ?? []).filter((c) => c.situacao === 'PAUSADA')];
  return { opcoes, padraoId: ativas.length === 1 ? ativas[0].id : null };
}

// ---- evidências do aceite ----

const OFFSET_BRASILIA_MS = -3 * 3600 * 1000;

/** `2026-11-26T17:03:09.123Z` → `26/11/2026 às 14:03:09` (Brasília); instante inválido → `""`. */
export function instanteDeBrasilia(instante: string | null | undefined): string {
  const ms = Date.parse(instante ?? '');
  if (Number.isNaN(ms)) return '';
  const iso = new Date(ms + OFFSET_BRASILIA_MS).toISOString();
  return `${dataParaTela(iso.slice(0, 10))} às ${iso.slice(11, 19)}`;
}

export interface LinhaDeEvidencia {
  rotulo: string;
  valor: string;
}

const NAO_REGISTRADO = 'Não registrado';

/**
 * As linhas das "Evidências da assinatura", na ordem do comprovante. `ip`, `agente` e `geradoPorNome` só existem na versão da
 * equipe: ausente (`undefined`/`null`) some; vazio (`""`) diz "Não registrado". O código de verificação é o `sha256` que a API
 * devolveu, inteiro. A data é a de Brasília, com segundos.
 */
export function linhasDeEvidencia(e: {
  nome: string;
  assinadoEm: string;
  sha256: string;
  ip?: string | null;
  agente?: string | null;
  geradoPorNome?: string | null;
  /** Quem assinou pelo link declarou ser o responsável legal do aluno (D28). */
  responsavelLegal?: boolean;
}): LinhaDeEvidencia[] {
  const opcional = (rotulo: string, valor: string | null | undefined): LinhaDeEvidencia[] =>
    (valor === undefined || valor === null ? [] : [{ rotulo, valor: valor.trim() === '' ? NAO_REGISTRADO : valor }]);
  const data = instanteDeBrasilia(e.assinadoEm);
  return [
    { rotulo: 'Assinado por', valor: e.nome },
    ...(e.responsavelLegal ? [{ rotulo: 'Declaração', valor: 'Declarou ser o responsável legal do aluno.' }] : []),
    { rotulo: 'Data e hora', valor: data ? `${data} (horário de Brasília)` : NAO_REGISTRADO },
    ...opcional('IP', e.ip),
    ...opcional('Aparelho', e.agente),
    ...opcional('Gerado por', e.geradoPorNome),
    { rotulo: 'Código de verificação (SHA-256)', valor: e.sha256 },
  ];
}

// ---- texto do contrato em HTML (comprovante) ----

/** `**negrito**` e `__sublinhado__` como `<strong>` e `<u>`, parágrafos em `<p>` e linhas com `<br>`; todo texto passa por `esc()`. */
export function htmlDoTextoFormatado(texto: string | null | undefined): string {
  return textoFormatado(texto)
    .map((paragrafo) => `<p>${paragrafo
      .map((linha) => linha
        .map((t) => {
          let html = esc(t.texto);
          if (t.sublinhado) html = `<u>${html}</u>`;
          if (t.negrito) html = `<strong>${html}</strong>`;
          return html;
        })
        .join(''))
      .join('<br>')}</p>`)
    .join('');
}

// ---- texto de exemplo do modelo (D27) ----

/**
 * O texto com que nasce o "Novo modelo": um esqueleto curto e a cláusula de aceite eletrônico (D27), que todo modelo leva. Só
 * campos que todo aluno tem (`{aluno_nome}`, `{consultoria}`, `{data}`): campo usado e sem valor impede gerar (D9), então CPF,
 * endereço, responsável e os do Financeiro ficam para o treinador inserir quando quiser.
 */
export const CLAUSULA_DE_ACEITE_ELETRONICO = 'As partes concordam que o aceite deste contrato é feito pelo aplicativo, com a digitação do nome '
  + 'completo e a confirmação de que leram e concordam, e que o aceite fica registrado com data, hora, endereço de IP, aparelho e código '
  + 'de verificação do documento. As partes reconhecem esse registro como forma válida de assinatura, nos termos do art. 10, § 2º, da '
  + 'Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020.';

export const TEXTO_DE_EXEMPLO_DO_MODELO = [
  '**CONTRATO DE PRESTAÇÃO DE SERVIÇO DE CONSULTORIA**',
  '**Contratada:** {consultoria}.\n**Contratante:** {aluno_nome}.',
  '**1. Objeto.** A contratada presta ao contratante o serviço de consultoria de treino e/ou dieta pelo aplicativo, conforme o plano escolhido.',
  '**2. Obrigações.** Escreva aqui as obrigações das partes, a forma de pagamento e as regras de cancelamento.',
  `**3. Aceite eletrônico.** ${CLAUSULA_DE_ACEITE_ELETRONICO}`,
  'Gerado em {data}.',
].join('\n\n');

// ---- PDF próprio (passo 3) ----

export const ERRO_PDF_NAO_E_PDF = 'Envie um arquivo PDF.';
export const ERRO_PDF_GRANDE = 'O PDF passa de 900 KB.';

/**
 * Confere o PDF escolhido antes do envio, com as mesmas frases da API (que confere de novo). `inicio` = os primeiros bytes
 * do arquivo; nulo quando a tela não os leu (aí só o tipo e o tamanho valem). `tamanho` desconhecido não trava: a API decide.
 */
export function erroDoPdfEscolhido(a: { nome: string; tipo?: string | null; tamanho?: number | null; inicio?: Uint8Array | null }): string | null {
  const pareceSerPdf = a.tipo === 'application/pdf' || /\.pdf$/i.test(a.nome);
  const assinatura = a.inicio ? String.fromCharCode(...a.inicio.subarray(0, 5)) === '%PDF-' : true;
  if (!pareceSerPdf || !assinatura || a.tamanho === 0) return ERRO_PDF_NAO_E_PDF;
  if (a.tamanho != null && a.tamanho > LIMITES_DO_CONTRATO.arquivoPdf) return ERRO_PDF_GRANDE;
  return null;
}
