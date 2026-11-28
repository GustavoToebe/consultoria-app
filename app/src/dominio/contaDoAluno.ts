import type { ContratoDoAlunoResumo } from '../api/contratos';
import type { PeriodoDoPlano, SituacaoDaContratacao } from '../api/financeiroTipos';
import { dataEmBrasilia } from './agendaPresencial';
import { apelidoParaEnviar } from './comunidade';
import { linkParaFalarComOTreinador } from './contatoDaConsultoria';
import { rotuloDaPeriodicidade } from './financeiro';
import { dataCurta, dataParaTela } from './formatos';
import { corpoDoPerfil, perfilMudou, type CorpoDoPerfil, type EdicaoDoPerfil, type PreferenciasLidas } from './perfilDaComunidade';
import { redesPreenchidas, type LinkDeRede } from './redesSociais';

// Conta do aluno reorganizada (23/11, `docs/planos/conta-do-aluno.md`): só apresentação. As regras de cada dado continuam
// nos domínios dele (meusDados, perfilDaComunidade, financeiro); aqui ficam a ordem das seções, os resumos das linhas, a
// máscara de leitura do CPF e o que o "Salvar" do Meu perfil manda.

export type ChaveDaSecao = 'perfil' | 'consultoria' | 'app' | 'plano' | 'contratos' | 'convite' | 'dados' | 'privacidade' | 'seguranca';

/**
 * Os cartões da Conta na ordem de leitura (28/11): a do DOM, a do celular e a das colunas empilhadas da web. `coluna` prende
 * o cartão a uma coluna nas colunas empilhadas (`aluno/inicio/ColunasMedidas`): o Perfil no topo da primeira e "Sua
 * consultoria", logo depois dele, no topo da segunda (com 2 ou 3 colunas). O título é o do cartão (o Perfil não mostra o
 * dele: a foto e o nome já são o topo).
 */
export const SECOES_DA_CONTA: readonly { chave: ChaveDaSecao; titulo: string; coluna?: number }[] = [
  { chave: 'perfil', titulo: 'Perfil', coluna: 0 },
  { chave: 'consultoria', titulo: 'Sua consultoria', coluna: 1 },
  { chave: 'app', titulo: 'App' },
  { chave: 'plano', titulo: 'Meu plano' },
  { chave: 'contratos', titulo: 'Meus contratos' },
  { chave: 'convite', titulo: 'Convidar um amigo' },
  { chave: 'dados', titulo: 'Meus dados' },
  { chave: 'privacidade', titulo: 'Privacidade' },
  { chave: 'seguranca', titulo: 'Segurança' },
];

/**
 * Os cartões que existem agora, na ordem (a tela usa a mesma lista). Os que dependem do que a tela já sabe seguem as regras
 * de sempre: o plano só com o financeiro ligado (sem internet ele diz que espera a conexão); dados e convite só com internet
 * ou com o dado já lido (o convite também some com o 404 da consultoria sem link); contratos e "Sua consultoria" só quando
 * marcados (ausente = não existe). Perfil, App, Privacidade e Segurança sempre têm linha (Trocar foto, Aparência, Termos, Sair).
 */
export function secoesVisiveis(existe: { plano: boolean; dados: boolean; convite: boolean; contratos?: boolean; consultoria?: boolean }) {
  const visivel: Record<string, boolean> = { contratos: false, consultoria: false, ...existe };
  return SECOES_DA_CONTA.filter((s) => (s.chave in visivel ? visivel[s.chave] : true));
}

/**
 * "Sua consultoria" (28/11): o link do "Falar com o treinador" (WhatsApp) e as redes da consultoria em modo leitura (só as
 * https seguras). Sem nenhum dos dois, `null`: o cartão não existe (nem vazio).
 */
export function contatoDaConsultoriaNaConta(whatsapp: string | null | undefined, redes: Parameters<typeof redesPreenchidas>[0]): { whatsapp: string | null; redes: LinkDeRede[] } | null {
  const link = linkParaFalarComOTreinador(whatsapp);
  const lidas = redesPreenchidas(redes);
  return link || lidas.length ? { whatsapp: link, redes: lidas } : null;
}

/** "Meus contratos" existe com a chave ligada, internet e ao menos um contrato (pendente ou assinado); nada fica no aparelho. */
export const existeContratosNaConta = (habilitado: boolean, online: boolean, lista: readonly unknown[] | null | undefined): boolean =>
  habilitado && online && (lista?.length ?? 0) > 0;

/** A linha de cada contrato em "Meus contratos": "Assinado em 26/11/2026", "Para assinar · até 29/11" ou "Para assinar". */
export function resumoDoContratoNaConta(c: Pick<ContratoDoAlunoResumo, 'situacao' | 'assinadoEm' | 'prazoAte' | 'vencido'>): string {
  if (c.situacao === 'ASSINADO') return `Assinado em ${dataParaTela(c.assinadoEm ? dataEmBrasilia(c.assinadoEm) : null) || '—'}`;
  if (c.situacao === 'CANCELADO') return 'Cancelado';
  if (c.vencido) return 'Prazo terminou';
  return c.prazoAte ? `Para assinar · até ${dataCurta(dataEmBrasilia(c.prazoAte))}` : 'Para assinar';
}

/** Leitura do CPF (o cadastro guarda `123.456.789-09`): só os 6 dígitos do meio, como `***.456.789-**`. */
export function cpfMascarado(cpf: string | null | undefined): string | null {
  const digitos = (cpf ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.length !== 11) return '*'.repeat(digitos.length);
  return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
}

const SITUACAO_DO_PLANO: Record<SituacaoDaContratacao, { texto: string; tom: 'sucesso' | 'atencao' | 'neutro' }> = {
  ATIVA: { texto: 'Ativo', tom: 'sucesso' },
  PAUSADA: { texto: 'Pausado', tom: 'atencao' },
  ENCERRADA: { texto: 'Encerrado', tom: 'neutro' },
};

/** Selo do cabeçalho ("Trimestral · Ativo", no tom da situação do plano); sem plano contratado, nada. */
export function seloDoPlano(plano: { periodicidade: PeriodoDoPlano; situacao: SituacaoDaContratacao; contratoFechado?: boolean } | null | undefined) {
  if (!plano) return null;
  const situacao = SITUACAO_DO_PLANO[plano.situacao] ?? { texto: '—', tom: 'neutro' as const };
  // No contrato fechado a periodicidade não se aplica: o selo diz que é um contrato.
  return { texto: `${plano.contratoFechado ? 'Contrato' : rotuloDaPeriodicidade(plano.periodicidade)} · ${situacao.texto}`, tom: situacao.tom };
}

/** Resumo da linha "Perfil na comunidade": o apelido, ou "Sem apelido". */
export const resumoDoApelido = (apelido: string | null | undefined) => apelido?.trim() || 'Sem apelido';

/** Resumo da linha "Meus dados": nome e telefone. */
export const resumoDosDados = (nome: string, telefone: string | null | undefined) => `${nome} · ${telefone?.trim() || 'Sem telefone'}`;

/** O que o aluno mexeu no detalhe "Meu perfil": apelido (`null` = o campo mostra o salvo) e as escolhas do perfil. */
export interface EdicaoDoMeuPerfil {
  apelido: string | null;
  perfil: EdicaoDoPerfil;
}

export const SEM_EDICAO_DO_PERFIL: EdicaoDoMeuPerfil = { apelido: null, perfil: {} };

/**
 * O "Salvar" único do detalhe junta duas rotas: o apelido (`PUT /aluno/comunidade/apelido`) e o perfil (`PUT
 * /aluno/comunidade/perfil`). Só manda o que mudou; `apelido` ausente = não manda, `null` = apaga. O apelido vai primeiro
 * (o nome da prévia depende dele) e cada parte é gravada quando a sua rota responde: falha parcial mantém só o que falhou.
 */
export function envioDoMeuPerfil(salvo: string | null, lido: PreferenciasLidas, edicao: EdicaoDoMeuPerfil): { apelido?: string | null; perfil?: CorpoDoPerfil } {
  const envio: { apelido?: string | null; perfil?: CorpoDoPerfil } = {};
  if (edicao.apelido !== null) {
    const novo = apelidoParaEnviar(edicao.apelido);
    if (novo !== (salvo ?? null)) envio.apelido = novo;
  }
  if (perfilMudou(lido, edicao.perfil)) envio.perfil = corpoDoPerfil(lido, edicao.perfil);
  return envio;
}

export const meuPerfilMudou = (salvo: string | null, lido: PreferenciasLidas, edicao: EdicaoDoMeuPerfil) =>
  Object.keys(envioDoMeuPerfil(salvo, lido, edicao)).length > 0;
