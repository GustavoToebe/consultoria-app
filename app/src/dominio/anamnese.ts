import type {
  AlteracaoDoCadastro, AnamneseDetalhe, AnamneseResumo, ConteudoQuestionario, DestinoNoPerfil, PerguntaAtualizacao, SituacaoAnamnese, ValorDoCadastro,
} from '../api/tipos';
import type { RascunhoAtualizacao } from '../offline/repositorioLocal';
import { enderecoParaLeitura } from './cadastroDoAluno';
import { dataParaTela, numeroParaTela, SEM_DADO } from './formatos';
import { ROTULO_DO_SEXO, sexoDoCampo } from './sexo';

/**
 * Regras de apresentação da anamnese (a decisão é sempre da API). Cor com significado: âmbar = falta alguém agir
 * (aluno responder, treinador revisar), verde = revisada, cinza = dispensada.
 */
export function seloDaAnamnese(situacao: SituacaoAnamnese, paraAluno = false): { texto: string; tipo: 'sucesso' | 'atencao' | 'neutro' } {
  switch (situacao) {
    case 'PENDENTE': return { texto: paraAluno ? 'Para responder' : 'Aguardando o aluno', tipo: 'atencao' };
    case 'ENVIADA': return paraAluno ? { texto: 'Enviada', tipo: 'sucesso' } : { texto: 'Para revisar', tipo: 'atencao' };
    case 'REVISADA': return { texto: 'Revisada', tipo: 'sucesso' };
    case 'DISPENSADA': return { texto: 'Dispensada', tipo: 'neutro' };
  }
}

/** Só uma pendente por aluno: com uma aberta, "Enviar anamnese" espera a resposta ou a dispensa. */
export const temPendente = (lista: readonly Pick<AnamneseResumo, 'situacao'>[]) => lista.some((a) => a.situacao === 'PENDENTE');

/** Linha de datas da lista na ficha: o último marco que aconteceu. */
export function linhaDaAnamnese(a: Pick<AnamneseResumo, 'situacao' | 'atribuidaEm' | 'enviadaEm' | 'revisadaEm' | 'dispensadaEm'>): string {
  const dia = (iso: string | null) => dataParaTela(iso ? iso.slice(0, 10) : null) || '—';
  switch (a.situacao) {
    case 'PENDENTE': return `Enviada ao aluno em ${dia(a.atribuidaEm)}`;
    case 'ENVIADA': return `Respondida em ${dia(a.enviadaEm)}`;
    case 'REVISADA': return `Respondida em ${dia(a.enviadaEm)} · revisada em ${dia(a.revisadaEm)}`;
    case 'DISPENSADA': return `Dispensada em ${dia(a.dispensadaEm)}`;
  }
}

/** O cartão do início do aluno só aparece com anamnese para responder. */
export const mostrarCartaoAnamnese = (a: Pick<AnamneseDetalhe, 'situacao'> | null | undefined) => a?.situacao === 'PENDENTE';

/**
 * Respostas com que o formulário abre: as do rascunho do aparelho, se forem da mesma versão (a da atribuição, que não
 * muda); senão, nada. Já enviada: as enviadas. `secao` é a página em que o aluno parou (0 sem rascunho).
 */
export function respostasIniciais(anamnese: Pick<AnamneseDetalhe, 'situacao' | 'questionarioVersaoId' | 'respostas'>, rascunho: RascunhoAtualizacao | null) {
  if (anamnese.situacao !== 'PENDENTE') return { respostas: anamnese.respostas ?? {}, locais: {} as Record<string, string[]>, secao: 0 };
  if (!rascunho || rascunho.questionarioVersaoId !== anamnese.questionarioVersaoId) return { respostas: {}, locais: {} as Record<string, string[]>, secao: 0 };
  const secao = typeof rascunho.secao === 'number' && Number.isInteger(rascunho.secao) && rascunho.secao >= 0 ? rascunho.secao : 0;
  return { respostas: rascunho.respostas, locais: rascunho.fotosLocais ?? {}, secao };
}

// ---------------------------------------------------------------- respostas que alimentam o cadastro (fase C)

/**
 * Texto para o aluno embaixo da pergunta com destino no cadastro: diz para onde a resposta vai e, no peso, **qual data**
 * vale (a da pergunta indicada pelo treinador ou, sem ela, a do envio). Sem destino, nada.
 */
export function notaDoCadastro(p: Pick<PerguntaAtualizacao, 'tipo' | 'destino' | 'destinoData'>, modelo: Pick<ConteudoQuestionario, 'secoes'>): string | null {
  if (p.destino === 'OBJETIVO' && p.tipo === 'TEXTO') return 'Esta resposta vai para o objetivo do seu cadastro.';
  if (p.destino === 'CPF' && p.tipo === 'TEXTO') return 'Esta resposta vai para o CPF do seu cadastro.';
  if (p.destino === 'TELEFONE' && p.tipo === 'TELEFONE') return 'Esta resposta vai para o telefone do seu cadastro.';
  if (p.destino === 'ENDERECO' && p.tipo === 'ENDERECO') return 'Esta resposta vai para o endereço do seu cadastro.';
  if (p.destino === 'SEXO' && p.tipo === 'ESCOLHA_UNICA') return 'Esta resposta vai para o sexo do seu cadastro.';
  if (p.destino !== 'PESO' || p.tipo !== 'PESO') return null;
  const data = p.destinoData ? modelo.secoes.flatMap((s) => s.perguntas).find((x) => x.id === p.destinoData && x.tipo === 'DATA') : undefined;
  return data
    ? `Este peso vai para o seu histórico com a data respondida em “${data.rotulo.trim()}” (sem ela, a data do envio).`
    : 'Este peso vai para o seu histórico com a data do envio.';
}

/** Nome do campo do cadastro, para a equipe. */
export const ROTULO_DO_DESTINO: Record<DestinoNoPerfil, string> = { PESO: 'Peso', OBJETIVO: 'Objetivo', CPF: 'CPF', TELEFONE: 'Telefone', ENDERECO: 'Endereço', SEXO: 'Sexo' };

/**
 * Permissão que aplica ou descarta a alteração do destino (igual a `DestinoNoPerfil.permissao()` na API): o telefone é
 * contato do aluno (`ALUNO_ALTERAR`); peso, objetivo, CPF e endereço são dado sensível.
 */
export const permissaoDeLeituraDoDestino = (d: DestinoNoPerfil): 'ALUNO_LER' | 'ALUNO_SENSIVEL_LER' => (d === 'TELEFONE' || d === 'SEXO' ? 'ALUNO_LER' : 'ALUNO_SENSIVEL_LER');
export const permissaoDoDestino = (d: DestinoNoPerfil): 'ALUNO_ALTERAR' | 'ALUNO_SENSIVEL_ALTERAR' => (d === 'TELEFONE' || d === 'SEXO' ? 'ALUNO_ALTERAR' : 'ALUNO_SENSIVEL_ALTERAR');

/** Valor do cadastro em texto: "80,5 kg em 10/01/2026" ou o objetivo; ausente, "—". */
export function textoDoValor(destino: DestinoNoPerfil, v: ValorDoCadastro | null | undefined): string {
  if (!v) return SEM_DADO;
  if (destino === 'OBJETIVO' || destino === 'CPF' || destino === 'TELEFONE') return v.texto?.trim() || SEM_DADO;
  if (destino === 'SEXO') {
    const sexo = sexoDoCampo(v.texto);
    return sexo ? ROTULO_DO_SEXO[sexo] : SEM_DADO;
  }
  if (destino === 'ENDERECO') return enderecoParaLeitura(v.endereco)?.replace('\n', ' · ') || SEM_DADO;
  if (v.pesoKg == null) return SEM_DADO;
  const data = dataParaTela(v.data ?? null);
  return `${numeroParaTela(v.pesoKg, 1)} kg${data ? ` em ${data}` : ''}`;
}

/** Selo de cada alteração: âmbar = falta a equipe decidir, verde = aplicada, cinza = descartada. */
export function seloDaAlteracao(a: Pick<AlteracaoDoCadastro, 'situacao' | 'automatica'>): { texto: string; tipo: 'sucesso' | 'atencao' | 'neutro' } {
  switch (a.situacao) {
    case 'PENDENTE': return { texto: 'Para revisar', tipo: 'atencao' };
    case 'APLICADA': return { texto: a.automatica ? 'Preenchido no envio' : 'Aplicada', tipo: 'sucesso' };
    case 'DESCARTADA': return { texto: 'Descartada', tipo: 'neutro' };
  }
}

/** "1 alteração para revisar" / "N alterações para revisar"; zero, nada. */
export function textoParaRevisar(n: number | null | undefined): string | null {
  if (!n) return null;
  return n === 1 ? '1 alteração do cadastro para revisar' : `${n} alterações do cadastro para revisar`;
}
