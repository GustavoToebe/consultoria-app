import type { TipoDeLembrete } from '../api/financeiroTipos';
import type { OpcaoSuspensa } from './escolhaSuspensa';
import type { Lembrete } from './lembretesDeCobranca';

/**
 * Regras puras da aba Lembretes do Financeiro (28/11): a linha do tempo clicável (cada ponto liga ou desliga um envio), os
 * campos "digite ou escolha" dos dias e a prévia do e-mail. O texto do e-mail é o do servidor
 * (`api/.../pagamentos/TextoDoLembrete.java`, `paragrafos` e `email`), repetido aqui só para a prévia: mudou lá, mude aqui
 * (o teste fixa as frases). O e-mail real leva a marca (logo ou nome, na cor da marca com 4,5:1 no papel branco,
 * `marcaParaTexto`) e a frase "Abra o app para ver como pagar" antes do endereço da Conta; nunca botão nem link de pagamento.
 */

export type DiasDosLembretes = Omit<Lembrete, 'ligado'>;

/** Quantos dias o ponto volta a ter ao ser religado: o último diferente de 0 (o salvo, senão 3, o padrão da API). */
export interface DiasLembrados {
  antes: number;
  depois: number;
}

export const DIAS_PADRAO = 3;

function dias(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`;
}

/** Os dias a lembrar: o valor da tela quando é maior que 0; senão o que já estava lembrado (ou o padrão). */
export function diasLembrados(d: DiasDosLembretes, anterior?: DiasLembrados): DiasLembrados {
  return {
    antes: d.diasAntes > 0 ? d.diasAntes : anterior?.antes ?? DIAS_PADRAO,
    depois: d.diasDepois > 0 ? d.diasDepois : anterior?.depois ?? DIAS_PADRAO,
  };
}

export interface PontoDaLinhaDoTempo {
  tipo: TipoDeLembrete;
  /** "3 dias antes", "No vencimento", "3 dias depois" (desligado, com os dias que ele volta a ter). */
  rotulo: string;
  ligado: boolean;
  /** Nome acessível do botão: "Lembrete 3 dias antes: ligado". */
  nome: string;
}

/** Os três pontos, sempre na ordem do eixo (antes, no vencimento, depois); desligado continua no lugar. */
export function pontosClicaveis(d: DiasDosLembretes, lembrados: DiasLembrados): PontoDaLinhaDoTempo[] {
  const ponto = (tipo: TipoDeLembrete, rotulo: string, ligado: boolean): PontoDaLinhaDoTempo => ({
    tipo, rotulo, ligado, nome: `Lembrete ${rotulo.charAt(0).toLowerCase()}${rotulo.slice(1)}: ${ligado ? 'ligado' : 'desligado'}`,
  });
  return [
    ponto('ANTES', `${dias(d.diasAntes > 0 ? d.diasAntes : lembrados.antes)} antes`, d.diasAntes > 0),
    ponto('NO_DIA', 'No vencimento', d.noDia),
    ponto('DEPOIS', `${dias(d.diasDepois > 0 ? d.diasDepois : lembrados.depois)} depois`, d.diasDepois > 0),
  ];
}

/** Tocar num ponto: ligado vai a 0 (ou desliga o dia); desligado volta aos dias lembrados. */
export function alternarPonto(d: DiasDosLembretes, tipo: TipoDeLembrete, lembrados: DiasLembrados): DiasDosLembretes {
  if (tipo === 'ANTES') return { ...d, diasAntes: d.diasAntes > 0 ? 0 : lembrados.antes };
  if (tipo === 'DEPOIS') return { ...d, diasDepois: d.diasDepois > 0 ? 0 : lembrados.depois };
  return { ...d, noDia: !d.noDia };
}

/** O envio está ligado nos dias da tela (0 dias ou o dia desligado = não sai). */
export function envioLigado(d: DiasDosLembretes, tipo: TipoDeLembrete): boolean {
  if (tipo === 'ANTES') return d.diasAntes > 0;
  if (tipo === 'DEPOIS') return d.diasDepois > 0;
  return d.noDia;
}

// ---- Dias "digite ou escolha" ----

/** "Não manda" no 0, "1 dia", "3 dias". */
export function textoDaOpcaoDeDias(n: number): string {
  return n === 0 ? 'Não manda' : dias(n);
}

/** De 0 ao máximo da API (15 antes, 30 depois). */
export function opcoesDeDias(maximo: number): OpcaoSuspensa<number>[] {
  return Array.from({ length: maximo + 1 }, (_, n) => ({ valor: n, rotulo: textoDaOpcaoDeDias(n) }));
}

/** O número digitado na busca, de 0 ao máximo (só dígitos); fora disso, `null`. O 0 vale (é "não manda"). */
export function lerDiasDigitados(texto: string, maximo: number): number | null {
  const t = texto.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n <= maximo ? n : null;
}

// ---- Prévia do e-mail (espelho de `TextoDoLembrete.java`) ----

export interface DadosDoEmail {
  nomeDoAluno: string | null;
  nomeDaConsultoria: string | null;
  valorCentavos: number;
  /** ISO `aaaa-mm-dd`. */
  vencimento: string;
  /** Vazio = sem a linha do link. */
  appUrl: string | null;
  /** Cobranças em aberto do aluno, esta inclusive; acima de 1 o texto diz quantas. */
  emAberto: number;
  /** Falso (avulsa) troca "mensalidade" por "cobrança". */
  mensalidade: boolean;
}

export interface EmailDoLembrete {
  assunto: string;
  paragrafos: string[];
  /** O endereço da Conta do aluno, último trecho do último parágrafo (vira link no HTML); `null` sem `appUrl`. */
  link: string | null;
}

/** Dados fictícios da prévia: nenhum aluno de verdade. */
export const EXEMPLO_DO_EMAIL: Omit<DadosDoEmail, 'nomeDaConsultoria' | 'appUrl'> = {
  nomeDoAluno: 'Marina Souza', valorCentavos: 25000, vencimento: '2026-12-10', emAberto: 1, mensalidade: true,
};

const vazio = (t: string | null | undefined): t is null | undefined | '' => t == null || t.trim() === '';

/** Sem quebra de linha nem controle no meio (o `umaLinha` do servidor: `[\p{Cntrl}\s]+`, ASCII). */
const umaLinha = (t: string) => t.replace(/[\u0000-\u001f\u007f ]+/g, ' ').trim();

function primeiroNome(nome: string | null): string | null {
  return vazio(nome) ? null : umaLinha(nome).split(' ')[0];
}

/** `R$ 1.234,56` com espaço comum, como o servidor (o WhatsApp mostra o inseparável diferente). */
export function valorDoEmail(centavos: number): string {
  const abs = Math.abs(centavos);
  const inteiros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${centavos < 0 ? '-' : ''}R$ ${inteiros},${String(abs % 100).padStart(2, '0')}`;
}

/** A frase fixa antes do endereço da Conta (`TextoDoLembrete.FRASE_DO_APP`, decisão de 28/11). */
export const FRASE_DO_APP = 'Abra o app para ver como pagar';

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function emailDoLembrete(tipo: TipoDeLembrete, d: DadosDoEmail): EmailDoLembrete {
  const nome = primeiroNome(d.nomeDoAluno);
  const consultoria = vazio(d.nomeDaConsultoria) ? 'sua consultoria' : umaLinha(d.nomeDaConsultoria);
  const data = diaMes(d.vencimento);
  const inicio = `${d.mensalidade ? 'A mensalidade de ' : 'A cobrança de '}${consultoria} no valor de ${valorDoEmail(d.valorCentavos)}`;
  const paragrafos = [nome === null ? 'Olá.' : `Olá, ${nome}.`];
  paragrafos.push(tipo === 'ANTES' ? `${inicio} vence em ${data}.`
    : tipo === 'NO_DIA' ? `${inicio} vence hoje (${data}).`
      : `${inicio} venceu em ${data} e ainda está em aberto. Se você já pagou, desconsidere esta mensagem.`);
  if (d.emAberto > 1) paragrafos.push(`Você tem ${d.emAberto} cobranças em aberto no total.`);
  const link = vazio(d.appUrl) ? null : `${d.appUrl.trim().replace(/\/+$/, '')}/aluno/conta`;
  if (link) paragrafos.push(`${FRASE_DO_APP}: ${link}`);
  const assunto = (d.mensalidade ? 'Lembrete de mensalidade' : 'Lembrete de cobrança') + (vazio(d.nomeDaConsultoria) ? '' : ` - ${umaLinha(d.nomeDaConsultoria)}`);
  return { assunto, paragrafos, link };
}

/**
 * Quem aparece como remetente (`RemetenteDaConsultoria.de` + o envio da biblioteca, `"<nome> via <app>"`): o nome escolhido
 * em Contato ou, sem ele, o nome da consultoria; sem nenhum, só o nome do app.
 * shortcut: não repete o saneamento do nome da consultoria (`sanear`, caracteres que a biblioteca recusa e teto de tamanho);
 * trocar se a prévia precisar mostrar o nome cortado igual ao envio.
 */
export function remetenteDoEmail(nomeEscolhido: string | null | undefined, nomeDaConsultoria: string | null | undefined, nomeDoApp: string): string {
  const nome = !vazio(nomeEscolhido) ? nomeEscolhido.trim() : !vazio(nomeDaConsultoria) ? nomeDaConsultoria.trim() : null;
  return nome ? `${nome} via ${nomeDoApp}` : nomeDoApp;
}
