import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Compromisso, CompromissoRequest, EscopoDaSerie, FiltroAlunosOcupados } from '../../api/agendaTipos';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import { alterarCompromisso, criarCompromisso, listarAlunosOcupados } from '../../api/rotas';
import {
  adicionarParticipante, conflitoNaLista, type ErrosDaRepeticao, type ErrosDoCompromisso, type ErrosDosLembretes, filtroDeAlunosOcupados,
  type FormularioDaRepeticao, type FormularioDoCompromisso, intervaloDoPedido, linhaDoCompletoDoCompromisso, pedidoDoFormulario,
  removerParticipante, textoDeAlunosOcupados, textoDoErroDaAgenda,
} from '../../dominio/agendaPresencial';
import { errosDosLembretesDaApi, type LinhaDeLembrete } from '../../dominio/antecedenciaDoLembrete';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { CamposDoCompromisso } from './CamposDoCompromisso';

interface Opcoes {
  /** O compromisso em edição; `null` = compromisso novo. */
  compromisso: Compromisso | null;
  /** O formulário ao abrir (e ao recomeçar a edição). */
  inicial: () => FormularioDoCompromisso;
  /** O formulário está à vista: só então o aviso de aluno ocupado pergunta à API. */
  ativo: boolean;
  hoje: string;
  responsaveis: readonly ResponsavelEquipe[];
  /** Compromissos já na tela, só para avisar de sobreposição do responsável antes de salvar (quem decide é a API). */
  carregados: readonly Compromisso[];
  /** Abre no formulário completo (a edição); o novo abre no painel rápido. */
  completoInicial: boolean;
}

/**
 * O formulário do compromisso com aluno (novo ou edição), fora da folha que o mostra: estado, erros, o aviso de aluno
 * ocupado e de horário do responsável (só avisos, D11/P5), o envio e os campos prontos. Usado pela `FolhaCompromisso`
 * (edição) e pela `FolhaCriar` (novo). A observação é dado sensível: só se edita com `ALUNO_SENSIVEL_ALTERAR`.
 */
export function useFormularioDoCompromisso({ compromisso: c, inicial, ativo, hoje, responsaveis, carregados, completoInicial }: Opcoes) {
  const { pode } = useSessao();
  const comObservacao = pode('ALUNO_SENSIVEL_ALTERAR');
  const nomesIniciais = () => Object.fromEntries((c?.participantes ?? []).map((p) => [p.id, p.nome ?? 'Aluno']));
  const [form, setForm] = useState<FormularioDoCompromisso>(inicial);
  const [nomes, setNomes] = useState<Record<string, string>>(nomesIniciais);
  const [erros, setErros] = useState<ErrosDoCompromisso>({});
  const [errosDaRepeticao, setErrosDaRepeticao] = useState<ErrosDaRepeticao>({});
  const [errosDosLembretes, setErrosDosLembretes] = useState<ErrosDosLembretes>({});
  const [conferir, setConferir] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const [completo, setCompleto] = useState(completoInicial);

  const limparMensagens = () => { setErro(null); setConferir(false); };
  const limparErros = () => { setErros({}); setErrosDaRepeticao({}); setErrosDosLembretes({}); limparMensagens(); };
  const mudar = <K extends keyof FormularioDoCompromisso>(campo: K, valor: FormularioDoCompromisso[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: undefined }));
    limparMensagens();
  };
  const mudarRepeticao = (r: FormularioDaRepeticao) => {
    setForm((f) => ({ ...f, repeticao: r }));
    setErrosDaRepeticao({});
    setErros((e) => ({ ...e, repeticao: undefined }));
    limparMensagens();
  };
  const mudarLembretes = (lembretes: LinhaDeLembrete[]) => {
    mudar('lembretes', lembretes);
    setErrosDosLembretes({});
  };
  /** Volta ao formulário de abrir (o "Editar" de novo), sem erro à vista. */
  const recomecar = () => { setForm(inicial()); setNomes(nomesIniciais()); limparErros(); };
  /** Troca o formulário inteiro (a troca de tipo da criação leva data, horário, local e observação). */
  const substituir = (f: FormularioDoCompromisso) => { setForm(f); limparErros(); };

  // Aviso de aluno ocupado: com alunos, data, hora e duração válidas, depois de parar de digitar.
  const filtro = ativo ? filtroDeAlunosOcupados(form, c?.id) : null;
  const chaveOcupados = filtro ? JSON.stringify(filtro) : null;
  const chaveAtrasada = useAtrasado(chaveOcupados, 400);
  const ocupados = useCarregar(chaveAtrasada,
    async (k) => ({ chave: k, itens: await listarAlunosOcupados(JSON.parse(k) as FiltroAlunosOcupados) }));
  const ocupadosAtuais = ocupados.dados?.chave === chaveOcupados ? ocupados.dados.itens : null;
  const textoOcupados = ocupadosAtuais ? textoDeAlunosOcupados(ocupadosAtuais) : null;
  const falhouOcupados = !!ocupados.erro && chaveAtrasada === chaveOcupados && chaveOcupados !== null;
  // Responsável com outro compromisso na lista desta tela (também só aviso; quem decide é a API, 409).
  const previa = ativo ? pedidoDoFormulario(form, comObservacao).pedido : null;
  const conflito = previa ? conflitoNaLista(carregados, { id: c?.id, responsavelId: previa.responsavelId, ...intervaloDoPedido(previa) }) : null;
  const avisos = textoOcupados || conflito || falhouOcupados ? <View style={estilos.avisos} accessibilityLiveRegion="polite" aria-live="polite">
    {conflito ? <Alerta tom="atencao" texto={`Atenção: este responsável já tem um compromisso das ${conflito.hora} às ${conflito.horaFim} nesse período.`} /> : null}
    {textoOcupados ? <Alerta tom="atencao" texto={`Atenção: ${textoOcupados}`} /> : null}
    {falhouOcupados ? <Alerta tom="atencao" texto="Não deu para conferir se os alunos estão livres nesse horário." /> : null}
  </View> : null;

  /** Confere o formulário e devolve o pedido, ou `null` com os erros à vista (o completo abre se o erro está nas notificações). */
  const conferirPedido = (): CompromissoRequest | null => {
    const r = pedidoDoFormulario(form, comObservacao, c ? c.versao : undefined);
    setErros(r.erros);
    setErrosDaRepeticao(r.errosDaRepeticao);
    setErrosDosLembretes(r.errosDosLembretes);
    setErro(null);
    if (r.erros.lembretes || Object.keys(r.errosDosLembretes).length) setCompleto(true);
    setConferir(!r.pedido);
    return r.pedido;
  };

  /** Cria ou altera; devolve o salvo ou `null` (o formulário fica como está, com a mensagem). */
  const enviar = async (pedido: CompromissoRequest, escopo: EscopoDaSerie): Promise<Compromisso | null> => {
    setSalvando(true);
    setErro(null);
    try {
      return c ? await alterarCompromisso(c.id, pedido, escopo) : await criarCompromisso(pedido);
    } catch (e) {
      // 422 nos lembretes (`lembretesMinutos[i]` = a linha i enviada, a ordem da tela): a mensagem vai ao campo, uma vez (D2),
      // e o formulário completo abre para ela estar à vista. Outro motivo (ou outro campo junto) fica no rodapé.
      const campos = errosPorCampo(e);
      const daApi = errosDosLembretesDaApi(campos, form.lembretes);
      const nosLembretes = Object.keys(daApi.porLinha).length > 0 || !!daApi.lista;
      if (nosLembretes) {
        setErrosDosLembretes(daApi.porLinha);
        setErros((x) => ({ ...x, lembretes: daApi.lista }));
        setCompleto(true);
        setConferir(true);
      }
      if (!nosLembretes || Object.keys(campos).some((k) => !k.startsWith('lembretesMinutos'))) setErro(e);
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const texto = erro ? textoDoErroDaAgenda(erro, hoje) ?? textoDoErro(erro) : conferir ? 'Confira os campos destacados.' : null;
  const mensagem = texto ? <MensagemErro texto={texto} erro={erro ?? undefined} /> : null;
  /** O que ficou preenchido só no completo, para o rodapé do painel rápido do compromisso novo. */
  const avisoDoCompleto = !c && !completo ? linhaDoCompletoDoCompromisso(form) : null;

  const campos = (extra: { comRepeticao: boolean; sobreASerie?: ReactNode }) => (
    <CamposDoCompromisso form={form} erros={erros} errosDaRepeticao={errosDaRepeticao} mudar={mudar} mudarRepeticao={mudarRepeticao}
      errosDosLembretes={errosDosLembretes} mudarLembretes={mudarLembretes}
      nomes={nomes} responsaveis={responsaveis} nomeDoResponsavel={c?.responsavelNome ?? null} comObservacao={comObservacao}
      comRepeticao={extra.comRepeticao} hoje={hoje} avisos={avisos} sobreASerie={extra.sobreASerie} completo={completo}
      aoMaisOpcoes={() => setCompleto(true)}
      aoAdicionarAluno={(id, nome) => { setNomes((n) => ({ ...n, [id]: nome })); mudar('alunoIds', adicionarParticipante(form.alunoIds, id)); }}
      aoRemoverAluno={(id) => mudar('alunoIds', removerParticipante(form.alunoIds, id))} />
  );

  return {
    form, comObservacao, completo, setCompleto, salvando, mensagem, avisoDoCompleto, campos,
    recomecar, substituir, limparMensagens, conferirPedido, enviar,
  };
}

const estilos = StyleSheet.create({
  avisos: { gap: espaco(0.5) },
});
