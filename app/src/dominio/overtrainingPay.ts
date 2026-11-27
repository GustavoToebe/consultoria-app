import { cnpjValido, cpfValido, emailValido, formatarCnpj, formatarCpf, formatarTelefone, telefoneValido } from '@plataforma/web';

import type {
  OvertrainingPayConfigRequest,
  OvertrainingPayConfigResponse,
  SituacaoCobrancaTeste,
  SituacaoHomologacao,
  TipoContaRepasse,
  TipoPessoaTitular,
} from '../api/financeiroOvertrainingPay';
import type { TomDoSelo } from './financeiro';

/**
 * Regras puras do Overtraining Pay (homologação, conta de repasse, cobrança teste e prévia do aluno).
 * Sem React nem storage local: documentos e dados bancários completos vivem apenas enquanto o usuário digita.
 */

export const CODIGO_OUTRO_BANCO = 'OUTRO' as const;

export interface BancoBrasileiro {
  codigo: string;
  nome: string;
  rotulo: string;
}

/** Principais bancos brasileiros (código COMPE + nome). */
export const BANCOS_BRASILEIROS: readonly BancoBrasileiro[] = [
  { codigo: '260', nome: 'Nubank', rotulo: '260 - Nubank' },
  { codigo: '341', nome: 'Itaú', rotulo: '341 - Itaú' },
  { codigo: '077', nome: 'Inter', rotulo: '077 - Inter' },
  { codigo: '001', nome: 'Banco do Brasil', rotulo: '001 - Banco do Brasil' },
  { codigo: '237', nome: 'Bradesco', rotulo: '237 - Bradesco' },
  { codigo: '033', nome: 'Santander', rotulo: '033 - Santander' },
  { codigo: '748', nome: 'Sicredi', rotulo: '748 - Sicredi' },
  { codigo: '756', nome: 'Sicoob', rotulo: '756 - Sicoob' },
  { codigo: '336', nome: 'C6 Bank', rotulo: '336 - C6 Bank' },
  { codigo: '208', nome: 'BTG Pactual', rotulo: '208 - BTG Pactual' },
];

export const OPCOES_DE_BANCO: readonly { valor: string; rotulo: string }[] = [
  ...BANCOS_BRASILEIROS.map((b) => ({ valor: b.codigo, rotulo: b.rotulo })),
  { valor: CODIGO_OUTRO_BANCO, rotulo: 'Outro banco (informar código)' },
];

export const OPCOES_TIPO_PESSOA: readonly { valor: TipoPessoaTitular; rotulo: string }[] = [
  { valor: 'PF', rotulo: 'Pessoa física (CPF)' },
  { valor: 'PJ', rotulo: 'Pessoa jurídica (CNPJ)' },
];

export const OPCOES_TIPO_CONTA: readonly { valor: TipoContaRepasse; rotulo: string }[] = [
  { valor: 'CORRENTE', rotulo: 'Conta corrente' },
  { valor: 'POUPANCA', rotulo: 'Poupança' },
  { valor: 'PAGAMENTO', rotulo: 'Conta de pagamento' },
];

export interface SeloHomologacao {
  texto: string;
  tipo: TomDoSelo;
}

const SELOS_DA_SITUACAO: Readonly<Record<SituacaoHomologacao, SeloHomologacao>> = {
  NAO_CONFIGURADA: { texto: 'Não configurado', tipo: 'neutro' },
  DOCUMENTOS_PENDENTES: { texto: 'Documentos pendentes', tipo: 'atencao' },
  PRONTA_PARA_TESTE: { texto: 'Pronto para teste', tipo: 'atencao' },
  ATIVA: { texto: 'Ativo e homologado', tipo: 'sucesso' },
  REJEITADA: { texto: 'Rejeitada', tipo: 'perigo' },
};

export function seloDaHomologacao(situacao: SituacaoHomologacao | null | undefined): SeloHomologacao {
  return situacao && SELOS_DA_SITUACAO[situacao] ? SELOS_DA_SITUACAO[situacao] : SELOS_DA_SITUACAO.NAO_CONFIGURADA;
}

export type EstadoDaEtapa = 'concluida' | 'atual' | 'pendente' | 'erro';

export interface EtapaDaHomologacao {
  id: 'titular' | 'contaRepasse' | 'documentos' | 'cobrancaTeste';
  numero: 1 | 2 | 3 | 4;
  titulo: string;
  estado: EstadoDaEtapa;
}

/**
 * Trilha de 4 passos da homologação:
 * 1. Titular -> 2. Conta de repasse -> 3. Documentos -> 4. Cobrança teste.
 */
export function etapasDaHomologacao(
  situacao: SituacaoHomologacao | null | undefined,
  etapasApi?: OvertrainingPayConfigResponse['etapas'],
): EtapaDaHomologacao[] {
  const s = situacao ?? 'NAO_CONFIGURADA';
  const titularOk = (etapasApi?.titular ?? etapasApi?.dadosCadastrados) === true;
  const contaOk = (etapasApi?.contaRepasse ?? etapasApi?.dadosCadastrados) === true;
  const docsOk = (etapasApi?.documentos ?? etapasApi?.documentosAprovados) === true;
  const testeOk = (etapasApi?.cobrancaTeste ?? etapasApi?.testeHomologado ?? etapasApi?.ativa) === true;

  if (s === 'ATIVA' || etapasApi?.ativa === true) {
    return [
      { id: 'titular', numero: 1, titulo: 'Titular', estado: 'concluida' },
      { id: 'contaRepasse', numero: 2, titulo: 'Conta de repasse', estado: 'concluida' },
      { id: 'documentos', numero: 3, titulo: 'Documentos', estado: 'concluida' },
      { id: 'cobrancaTeste', numero: 4, titulo: 'Cobrança teste', estado: 'concluida' },
    ];
  }
  if (s === 'PRONTA_PARA_TESTE') {
    return [
      { id: 'titular', numero: 1, titulo: 'Titular', estado: 'concluida' },
      { id: 'contaRepasse', numero: 2, titulo: 'Conta de repasse', estado: 'concluida' },
      { id: 'documentos', numero: 3, titulo: 'Documentos', estado: 'concluida' },
      { id: 'cobrancaTeste', numero: 4, titulo: 'Cobrança teste', estado: 'atual' },
    ];
  }
  if (s === 'DOCUMENTOS_PENDENTES') {
    return [
      { id: 'titular', numero: 1, titulo: 'Titular', estado: 'concluida' },
      { id: 'contaRepasse', numero: 2, titulo: 'Conta de repasse', estado: 'concluida' },
      { id: 'documentos', numero: 3, titulo: 'Documentos', estado: 'atual' },
      { id: 'cobrancaTeste', numero: 4, titulo: 'Cobrança teste', estado: 'pendente' },
    ];
  }
  if (s === 'REJEITADA') {
    return [
      { id: 'titular', numero: 1, titulo: 'Titular', estado: titularOk ? 'concluida' : 'erro' },
      { id: 'contaRepasse', numero: 2, titulo: 'Conta de repasse', estado: contaOk ? 'concluida' : 'erro' },
      { id: 'documentos', numero: 3, titulo: 'Documentos', estado: docsOk ? 'concluida' : 'erro' },
      { id: 'cobrancaTeste', numero: 4, titulo: 'Cobrança teste', estado: testeOk ? 'concluida' : 'pendente' },
    ];
  }
  // NAO_CONFIGURADA
  return [
    { id: 'titular', numero: 1, titulo: 'Titular', estado: titularOk ? 'concluida' : 'atual' },
    { id: 'contaRepasse', numero: 2, titulo: 'Conta de repasse', estado: contaOk ? 'concluida' : titularOk ? 'atual' : 'pendente' },
    { id: 'documentos', numero: 3, titulo: 'Documentos', estado: docsOk ? 'concluida' : contaOk ? 'atual' : 'pendente' },
    { id: 'cobrancaTeste', numero: 4, titulo: 'Cobrança teste', estado: testeOk ? 'concluida' : docsOk ? 'atual' : 'pendente' },
  ];
}

/** Pode gerar cobrança teste? Somente quando documentos foram aprovados (`PRONTA_PARA_TESTE`) ou já `ATIVA`. */
export function podeGerarCobrancaTeste(situacao: SituacaoHomologacao | null | undefined): boolean {
  return situacao === 'PRONTA_PARA_TESTE' || situacao === 'ATIVA';
}

export function motivoBloqueioCobrancaTeste(situacao: SituacaoHomologacao | null | undefined): string | undefined {
  switch (situacao) {
    case 'PRONTA_PARA_TESTE':
    case 'ATIVA':
      return undefined;
    case 'DOCUMENTOS_PENDENTES':
      return 'Conclua o envio e a aprovação dos documentos do titular primeiro.';
    case 'REJEITADA':
      return 'Corrija os dados do titular e salve a homologação novamente.';
    default:
      return 'Salve os dados do titular e da conta de repasse primeiro.';
  }
}

export interface ItemChecklistTeste {
  id: 'criada' | 'identificado' | 'webhook' | 'ativa';
  rotulo: string;
  concluido: boolean;
}

/** Checklist de 4 itens da Folha de Cobrança Teste (Prancha 3). */
export function checklistCobrancaTeste(situacao: SituacaoCobrancaTeste | null | undefined): ItemChecklistTeste[] {
  const paga = situacao === 'PAGA' || situacao === 'HOMOLOGADA';
  const homologada = situacao === 'HOMOLOGADA';
  return [
    { id: 'criada', rotulo: 'Cobrança Pix criada', concluido: situacao === 'CRIADA' || paga },
    { id: 'identificado', rotulo: 'Pagamento identificado', concluido: paga },
    { id: 'webhook', rotulo: 'Webhook validado', concluido: paga },
    { id: 'ativa', rotulo: 'Conta homologada e ativa', concluido: homologada },
  ];
}

export function bancoPorCodigo(codigo: string | null | undefined): BancoBrasileiro | null {
  if (!codigo) return null;
  const limpo = codigo.replace(/\D/g, '').padStart(3, '0');
  return BANCOS_BRASILEIROS.find((b) => b.codigo === limpo) ?? null;
}

export function formatarCep(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatarDocumentoTitular(tipo: TipoPessoaTitular, texto: string): string {
  return tipo === 'PJ' ? formatarCnpj(texto).toUpperCase() : formatarCpf(texto);
}

export function formatarTelefoneTitular(texto: string): string {
  return formatarTelefone(texto);
}

/** URL de onboarding segura: apenas `https://`. */
export function urlOnboardingSegura(url: string | null | undefined): string | null {
  if (!url) return null;
  const t = url.trim();
  return /^https:\/\/[^\s]+$/i.test(t) ? t : null;
}

// ---- Estado e validação do formulário ----

export interface EstadoFormularioOvertrainingPay {
  tipoPessoa: TipoPessoaTitular;
  documento: string;
  documentoJaSalvo: boolean;
  nomeTitular: string;
  emailFinanceiro: string;
  telefone: string;
  cep: string;
  enderecoResumo: string;
  rendaMensalCentavos: number | null;
  bancoSelecionado: string;
  bancoCodigoCustom: string;
  bancoNomeCustom: string;
  tipoConta: TipoContaRepasse;
  agencia: string;
  agenciaJaSalva: boolean;
  conta: string;
  contaJaSalva: boolean;
  repasseAutomatico: boolean;
  versao: number | null;
}

export type CampoOvertrainingPay =
  | 'documento'
  | 'nomeTitular'
  | 'emailFinanceiro'
  | 'telefone'
  | 'cep'
  | 'enderecoResumo'
  | 'rendaMensalCentavos'
  | 'bancoCodigo'
  | 'bancoNome'
  | 'agencia'
  | 'conta';

export type ErrosOvertrainingPay = Partial<Record<CampoOvertrainingPay, string>>;

export function estadoInicialOvertrainingPay(dados: OvertrainingPayConfigResponse | null | undefined): EstadoFormularioOvertrainingPay {
  const banco = bancoPorCodigo(dados?.bancoCodigo);
  const temBancoSalvo = !!dados?.bancoCodigo;
  return {
    tipoPessoa: dados?.tipoPessoa ?? 'PF',
    documento: '',
    documentoJaSalvo: !!dados?.documentoMascarado,
    nomeTitular: dados?.nomeTitular ?? '',
    emailFinanceiro: dados?.emailFinanceiro ?? '',
    telefone: '',
    cep: dados?.cep ? formatarCep(dados.cep) : '',
    enderecoResumo: dados?.enderecoResumo ?? '',
    rendaMensalCentavos: dados?.rendaMensalCentavos ?? null,
    bancoSelecionado: banco ? banco.codigo : temBancoSalvo ? CODIGO_OUTRO_BANCO : '260',
    bancoCodigoCustom: !banco && dados?.bancoCodigo ? dados.bancoCodigo : '',
    bancoNomeCustom: !banco && dados?.bancoNome ? dados.bancoNome : '',
    tipoConta: dados?.tipoConta ?? 'CORRENTE',
    agencia: '',
    agenciaJaSalva: !!dados?.agenciaMascarada,
    conta: '',
    contaJaSalva: !!dados?.contaMascarada,
    repasseAutomatico: dados?.repasseAutomatico ?? true,
    versao: dados?.versao ?? null,
  };
}

export type ResultadoValidacaoOvertrainingPay =
  | { ok: true; corpo: OvertrainingPayConfigRequest }
  | { ok: false; erros: ErrosOvertrainingPay };

export function validarFormularioOvertrainingPay(e: EstadoFormularioOvertrainingPay): ResultadoValidacaoOvertrainingPay {
  const erros: ErrosOvertrainingPay = {};

  // 1. Documento (CPF ou CNPJ) — write-only quando já salvo e campo em branco
  const docLimpo = e.documento.trim();
  let documentoNormalizado: string | undefined;
  if (docLimpo) {
    if (e.tipoPessoa === 'PF') {
      if (!cpfValido(docLimpo)) erros.documento = 'Informe um CPF válido.';
      else documentoNormalizado = docLimpo.replace(/\D/g, '');
    } else {
      if (!cnpjValido(docLimpo)) erros.documento = 'Informe um CNPJ válido.';
      else documentoNormalizado = docLimpo.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    }
  } else if (!e.documentoJaSalvo) {
    erros.documento = e.tipoPessoa === 'PF' ? 'Informe o CPF do titular.' : 'Informe o CNPJ da consultoria.';
  }

  // 2. Nome do titular
  const nomeTitular = e.nomeTitular.trim();
  if (nomeTitular.length < 3) erros.nomeTitular = 'Informe o nome completo ou razão social do titular.';
  else if (nomeTitular.length > 120) erros.nomeTitular = 'O nome pode ter até 120 caracteres.';

  // 3. E-mail financeiro
  const emailFinanceiro = e.emailFinanceiro.trim().toLowerCase();
  if (!emailFinanceiro) erros.emailFinanceiro = 'Informe o e-mail financeiro.';
  else if (!emailValido(emailFinanceiro)) erros.emailFinanceiro = 'Informe um e-mail válido.';

  // 4. Telefone (opcional se já salvo ou em branco, mas se preenchido deve ser válido)
  const telLimpo = e.telefone.trim();
  let telefoneNormalizado: string | null | undefined;
  if (telLimpo) {
    if (!telefoneValido(telLimpo)) erros.telefone = 'Informe um telefone com DDD, como (45) 99999-8888.';
    else telefoneNormalizado = telLimpo.replace(/\D/g, '');
  }

  // 5. CEP
  const cepDigitos = e.cep.replace(/\D/g, '');
  if (cepDigitos.length !== 8) erros.cep = 'Informe um CEP válido com 8 dígitos.';

  // 6. Endereço
  const enderecoResumo = e.enderecoResumo.trim();
  if (enderecoResumo.length < 3) erros.enderecoResumo = 'Informe o endereço do titular.';
  else if (enderecoResumo.length > 200) erros.enderecoResumo = 'O endereço pode ter até 200 caracteres.';

  // 7. Renda ou faturamento mensal
  if (e.rendaMensalCentavos === null || !Number.isFinite(e.rendaMensalCentavos) || e.rendaMensalCentavos <= 0) {
    erros.rendaMensalCentavos = e.tipoPessoa === 'PF'
      ? 'Informe a renda mensal aproximada.'
      : 'Informe o faturamento mensal aproximado.';
  }

  // 8. Banco
  let bancoCodigo = '';
  let bancoNome = '';
  if (e.bancoSelecionado === CODIGO_OUTRO_BANCO) {
    const cod = e.bancoCodigoCustom.replace(/\D/g, '');
    if (cod.length !== 3) erros.bancoCodigo = 'Informe o código do banco com 3 dígitos.';
    else bancoCodigo = cod;
    const nome = e.bancoNomeCustom.trim();
    if (nome.length < 2) erros.bancoNome = 'Informe o nome do banco.';
    else if (nome.length > 80) erros.bancoNome = 'O nome do banco pode ter até 80 caracteres.';
    else bancoNome = nome;
  } else {
    const b = bancoPorCodigo(e.bancoSelecionado);
    if (!b) erros.bancoCodigo = 'Escolha o banco da conta de repasse.';
    else {
      bancoCodigo = b.codigo;
      bancoNome = b.nome;
    }
  }

  // 9. Agência e conta (write-only quando já salvas)
  const agenciaLimpa = e.agencia.replace(/\D/g, '');
  let agenciaFinal: string | undefined;
  if (agenciaLimpa) {
    if (agenciaLimpa.length < 3 || agenciaLimpa.length > 6) erros.agencia = 'Informe a agência com 3 a 6 dígitos.';
    else agenciaFinal = agenciaLimpa;
  } else if (!e.agenciaJaSalva) {
    erros.agencia = 'Informe o número da agência.';
  }

  const contaLimpa = e.conta.replace(/[^0-9A-Za-z-]/g, '').trim();
  const contaDigitos = contaLimpa.replace(/\D/g, '');
  let contaFinal: string | undefined;
  if (contaLimpa) {
    if (contaDigitos.length < 4 || contaLimpa.length > 16) erros.conta = 'Informe a conta com dígito verificador.';
    else contaFinal = contaLimpa;
  } else if (!e.contaJaSalva) {
    erros.conta = 'Informe o número da conta com dígito.';
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };

  const corpo: OvertrainingPayConfigRequest = {
    tipoPessoa: e.tipoPessoa,
    ...(documentoNormalizado ? { documento: documentoNormalizado } : {}),
    nomeTitular,
    emailFinanceiro,
    ...(telefoneNormalizado ? { telefone: telefoneNormalizado } : {}),
    cep: formatarCep(cepDigitos),
    enderecoResumo,
    rendaMensalCentavos: e.rendaMensalCentavos!,
    bancoCodigo,
    bancoNome,
    tipoConta: e.tipoConta,
    ...(agenciaFinal ? { agencia: agenciaFinal } : {}),
    ...(contaFinal ? { conta: contaFinal } : {}),
    repasseAutomatico: e.repasseAutomatico,
    versao: e.versao,
  };
  return { ok: true, corpo };
}
