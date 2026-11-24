import { type ReactNode, useState } from 'react';

import type { AgendaPessoal, AlvoDoEvento, EventoDetalhe, EventoRequest } from '../../api/agendaTipos';
import { alterarEvento, criarAgendaPessoal, criarEvento, listarAgendasPessoais } from '../../api/rotas';
import {
  agendaDoFormulario, type ErrosDaRepeticaoDoEvento, type ErrosDoEvento, type FormularioDaRepeticaoDoEvento, type FormularioDoEvento,
  garantirAgendaPadrao, linhaDoCompletoDoEvento, type OpcoesDoPedidoDoEvento, pedidoDeCruzamento, pedidoDoEvento, textoDoCruzamento, textoDoErroDoCalendario,
} from '../../dominio/agendaEvento';
import { useSessao } from '../../sessao/SessaoProvider';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { CamposDoEvento } from './CamposDoEvento';
import { useAvisoDeCruzamento } from './useAvisoDeCruzamento';

interface Opcoes {
  /** O evento em edição; `null` = evento novo. */
  evento: EventoDetalhe | null;
  /** O formulário ao abrir; a agenda vazia é resolvida aqui quando as agendas chegam. */
  inicial: () => FormularioDoEvento;
  /** As agendas pessoais (`null` = carregando ou a leitura falhou). */
  agendas: readonly AgendaPessoal[] | null;
  /** O formulário está à vista: só então o aviso de cruzamento pergunta à API. */
  ativo: boolean;
  hoje: string;
  completoInicial: boolean;
}

/**
 * O formulário do evento pessoal (novo ou edição), fora da folha que o mostra: estado, erros, a agenda efetiva (a sugerida
 * enquanto a pessoa não escolhe; sem agenda nenhuma a "Pessoal" nasce ao salvar), o aviso de outro evento no mesmo horário
 * (só aviso, P5) e o envio. Usado pela `FolhaEvento` (edição) e pela `FolhaCriar` (novo).
 */
export function useFormularioDoEvento({ evento: e, inicial, agendas, ativo, hoje, completoInicial }: Opcoes) {
  const { offline } = useSessao();
  const lista = agendas ?? [];
  const [form, setForm] = useState<FormularioDoEvento>(inicial);
  const [erros, setErros] = useState<ErrosDoEvento>({});
  const [errosDaRepeticao, setErrosDaRepeticao] = useState<ErrosDaRepeticaoDoEvento>({});
  const [conferir, setConferir] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const [completo, setCompleto] = useState(completoInicial);

  const limparMensagens = () => { setErro(null); setConferir(false); };
  const mudar = <K extends keyof FormularioDoEvento>(campo: K, valor: FormularioDoEvento[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((x) => ({ ...x, [campo]: undefined }));
    limparMensagens();
  };
  const mudarRepeticao = (r: FormularioDaRepeticaoDoEvento) => {
    setForm((f) => ({ ...f, repeticao: r }));
    setErrosDaRepeticao({});
    setErros((x) => ({ ...x, repeticao: undefined }));
    limparMensagens();
  };
  /** Troca o formulário inteiro (o "Editar" e a troca de tipo da criação), sem erro à vista. */
  const substituir = (f: FormularioDoEvento) => {
    setForm(f);
    setErros({});
    setErrosDaRepeticao({});
    limparMensagens();
  };

  // A agenda do formulário: a escolhida ou, se as agendas chegaram depois de abrir, a sugerida (sem efeito nem setState).
  // Sem agenda nenhuma, a "Pessoal" nasce ao salvar: o formulário confere o resto com um id provisório.
  const semAgendas = agendas !== null && lista.length === 0;
  const agendaEfetiva = form.agendaId || agendaDoFormulario(lista)?.id || '';
  const formComAgenda = agendaEfetiva === form.agendaId ? form : { ...form, agendaId: agendaEfetiva };
  const formParaConferir = semAgendas && !agendaEfetiva ? { ...form, agendaId: 'pessoal' } : formComAgenda;

  // Aviso de outro evento no mesmo horário (só aviso, P5): a API confere a repetição por um ano. Na edição o próprio evento
  // não conta. Sem internet ou com falha, nenhum aviso (e nada trava o salvar).
  const cruzamento = useAvisoDeCruzamento(ativo && agendas !== null ? pedidoDeCruzamento(form, e?.id ?? null) : null, offline);
  const textoDoAviso = textoDoCruzamento(cruzamento, hoje);

  /** Confere o formulário e devolve o pedido, ou `null` com os erros à vista. */
  const conferirPedido = (opcoes: OpcoesDoPedidoDoEvento): EventoRequest | null => {
    const r = pedidoDoEvento(formParaConferir, opcoes);
    setErros(r.erros);
    setErrosDaRepeticao(r.errosDaRepeticao);
    setErro(null);
    setConferir(!r.pedido);
    return r.pedido;
  };

  /**
   * Cria (ou altera, com o alvo da série) depois de conferir; sem agenda, cria a "Pessoal" antes. `ok` falso = o formulário
   * fica, com os erros ou com `erro` (quem chama decide a mensagem: a edição trata o 409 de versão). `criouAgenda` vale também
   * quando o evento falhou depois de criar a agenda (a tela relê a lista).
   */
  const enviar = async (opcoes: OpcoesDoPedidoDoEvento, alvo?: AlvoDoEvento):
    Promise<{ ok: boolean; criouAgenda: boolean; erro: unknown }> => {
    const pedido0 = conferirPedido(opcoes);
    if (!pedido0) return { ok: false, criouAgenda: false, erro: null };
    setSalvando(true);
    let criouAgenda = false;
    try {
      let pedido: EventoRequest = pedido0;
      if (semAgendas && !agendaEfetiva) {
        const pessoal = await garantirAgendaPadrao({ criar: criarAgendaPessoal, listar: listarAgendasPessoais });
        criouAgenda = true;
        pedido = { ...pedido, agendaId: pessoal.id };
      }
      if (e && alvo) await alterarEvento(e.id, pedido, alvo);
      else await criarEvento(pedido);
      return { ok: true, criouAgenda, erro: null };
    } catch (x) {
      return { ok: false, criouAgenda, erro: x };
    } finally {
      setSalvando(false);
    }
  };

  const texto = erro ? textoDoErroDoCalendario(erro, 'evento') ?? textoDoErro(erro) : conferir ? 'Confira os campos destacados.' : null;
  const mensagem = texto ? <MensagemErro texto={texto} erro={erro ?? undefined} /> : null;
  /** O que ficou preenchido só no completo, para o rodapé do painel rápido do evento novo. */
  const avisoDoCompleto = !e && !completo && agendas !== null ? linhaDoCompletoDoEvento(formComAgenda) : null;

  const campos = (extra: { comRepeticao: boolean; sobreASerie?: ReactNode }) => (
    <CamposDoEvento form={formComAgenda} erros={erros} errosDaRepeticao={errosDaRepeticao} mudar={mudar} mudarRepeticao={mudarRepeticao}
      agendas={lista} comRepeticao={extra.comRepeticao} hoje={hoje} sobreASerie={extra.sobreASerie} aviso={textoDoAviso}
      completo={completo} aoMaisOpcoes={() => setCompleto(true)} />
  );

  return {
    form: formComAgenda, completo, setCompleto, salvando, mensagem, avisoDoCompleto, campos,
    substituir, limparMensagens, mostrarErro: setErro, conferirPedido, enviar,
  };
}
