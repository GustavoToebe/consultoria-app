import type { Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Compromisso, SituacaoCompromisso } from '../../api/agendaTipos';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import { alterarCompromisso, alterarSituacaoCompromisso, criarCompromisso, listarAlunos } from '../../api/rotas';
import {
  acoesDeSituacao, conflitoNaLista, DURACOES_SUGERIDAS, type ErrosDoCompromisso, type FormularioDoCompromisso, formularioDoCompromisso,
  formularioNovo, intervaloDoPedido, LIMITES_COMPROMISSO, mascaraHora, pedidoDoFormulario, seloDaSituacao, textoDaDuracao, textoDoHorario,
  type AcaoDeSituacao,
} from '../../dominio/agendaPresencial';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import { rotuloDoDia } from '../../dominio/agenda';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';

/** Alunos por página de `GET /alunos` (igual à API). */
const TAMANHO_PAGINA = 30;

interface Props {
  /** `'novo'` abre o formulário vazio; um compromisso abre o detalhe; `null` fecha. */
  aberto: Compromisso | 'novo' | null;
  /** Dia sugerido no compromisso novo (AAAA-MM-DD, Brasília). */
  dataSugerida: string;
  hoje: string;
  responsaveis: readonly ResponsavelEquipe[];
  /** Compromissos já na tela, só para avisar de sobreposição antes de salvar (quem decide é a API). */
  carregados: readonly Compromisso[];
  aoFechar: () => void;
  /** Depois de salvar ou mudar a situação: a tela recarrega a lista. */
  aoMudar: (c: Compromisso) => void;
}

/**
 * Folha do compromisso da agenda presencial: detalhe (com editar, realizado/falta, cancelar e reativar) ou formulário
 * (novo e editar). Só a equipe marca. A observação é dado sensível: só aparece com `ALUNO_SENSIVEL_LER` e só se edita
 * com `ALUNO_SENSIVEL_ALTERAR` (a API também ignora sem a permissão).
 */
export function FolhaCompromisso({ aberto, dataSugerida, hoje, responsaveis, carregados, aoFechar, aoMudar }: Props) {
  const [editando, setEditando] = useState(false);
  const fechar = () => { setEditando(false); aoFechar(); };
  const novo = aberto === 'novo';
  const titulo = novo ? 'Novo compromisso' : editando ? 'Editar compromisso' : 'Compromisso';
  return (
    <Folha visivel={aberto !== null} titulo={titulo} aoFechar={fechar}>
      {aberto === null ? null : novo || editando ? (
        <Formulario key={novo ? 'novo' : `${aberto.id}:${aberto.versao}`} compromisso={novo ? null : aberto} dataSugerida={dataSugerida}
          responsaveis={responsaveis} carregados={carregados}
          aoCancelar={novo ? fechar : () => setEditando(false)}
          aoSalvo={(c) => { setEditando(false); aoMudar(c); if (novo) fechar(); }} />
      ) : (
        <Detalhe key={`${aberto.id}:${aberto.versao}`} compromisso={aberto} hoje={hoje} aoEditar={() => setEditando(true)} aoMudar={aoMudar} />
      )}
    </Folha>
  );
}

function Detalhe({ compromisso: c, hoje, aoEditar, aoMudar }: { compromisso: Compromisso; hoje: string; aoEditar: () => void; aoMudar: (c: Compromisso) => void }) {
  const { pode } = useSessao();
  const podeAlterar = pode('AGENDA_ALTERAR');
  const [confirmar, setConfirmar] = useState<AcaoDeSituacao | null>(null);
  const [enviando, setEnviando] = useState<SituacaoCompromisso | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const selo = seloDaSituacao(c.situacao);

  const mudar = async (situacao: SituacaoCompromisso) => {
    setEnviando(situacao);
    setErro(null);
    try {
      aoMudar(await alterarSituacaoCompromisso(c.id, situacao, c.versao));
      setConfirmar(null);
    } catch (e) {
      setErro(e);
      setConfirmar(null);
    } finally {
      setEnviando(null);
    }
  };

  return (
    <View style={estilos.coluna}>
      <View style={estilos.linhaSelo}>
        <Texto variante="bloco">{c.alunoNome ?? 'Aluno'}</Texto>
        <Selo texto={selo.texto} tipo={selo.tipo} />
      </View>
      <CampoLeitura rotulo="Quando" valor={`${rotuloDoDia(c.data, hoje)}, ${dataSemAnoCorrente(c.data, hoje)} · ${textoDoHorario(c)}`} />
      <CampoLeitura rotulo="Duração" valor={textoDaDuracao(c.duracaoMinutos)} />
      <CampoLeitura rotulo="Local" valor={c.local} />
      <CampoLeitura rotulo="Responsável" valor={c.responsavelNome ?? (c.responsavelId ? 'Membro inativo' : null)} />
      {pode('ALUNO_SENSIVEL_LER') ? <CampoLeitura rotulo="Observação" valor={c.observacao} /> : null}
      {pode('ALUNO_LER') ? <LinkTexto texto="Abrir ficha do aluno" href={`/treinador/alunos/${c.alunoId}` as Href} /> : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      {podeAlterar ? (
        <LinhaDeAcoes>
          <Botao rotulo="Editar" tipo="secundario" aoTocar={aoEditar} />
          {acoesDeSituacao(c).map((a) => (
            <Botao key={a.situacao} rotulo={a.rotulo} tipo={a.perigo ? 'perigoTexto' : 'secundario'} desabilitado={!!a.motivo || enviando !== null}
              motivo={a.motivo ?? (enviando !== null ? 'Salvando.' : undefined)} carregando={enviando === a.situacao}
              aoTocar={() => (a.confirmar ? setConfirmar(a) : void mudar(a.situacao))} />
          ))}
        </LinhaDeAcoes>
      ) : null}
      <PainelConfirmacao visivel={confirmar !== null} titulo="Cancelar este compromisso?" perigo
        mensagem="O horário fica livre para outro compromisso. Dá para reativar depois, se o horário continuar livre."
        rotuloConfirmar="Cancelar compromisso" rotuloCancelar="Voltar" carregando={enviando !== null}
        aoConfirmar={() => confirmar && void mudar(confirmar.situacao)} aoCancelar={() => setConfirmar(null)} />
    </View>
  );
}

function Formulario({ compromisso, dataSugerida, responsaveis, carregados, aoCancelar, aoSalvo }: {
  compromisso: Compromisso | null; dataSugerida: string; responsaveis: readonly ResponsavelEquipe[]; carregados: readonly Compromisso[];
  aoCancelar: () => void; aoSalvo: (c: Compromisso) => void;
}) {
  const { pode, usuario } = useSessao();
  const comObservacao = pode('ALUNO_SENSIVEL_ALTERAR');
  const [form, setForm] = useState<FormularioDoCompromisso>(() => compromisso ? formularioDoCompromisso(compromisso)
    : formularioNovo(responsaveis.some((r) => r.id === usuario?.id) ? usuario?.id ?? '' : '', dataSugerida));
  const [erros, setErros] = useState<ErrosDoCompromisso>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudar = <K extends keyof FormularioDoCompromisso>(campo: K, valor: FormularioDoCompromisso[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: undefined }));
    setErroGeral(null);
  };

  // Alunos ativos, com busca na API e páginas (o nome do escolhido fica guardado: a lista muda com a busca).
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const [pagina, setPagina] = useState(0);
  const [nomeDoAluno, setNomeDoAluno] = useState<string | null>(compromisso?.alunoNome ?? null);
  const alunos = useCarregar(`agenda-alunos:${buscaAtrasada}:${pagina}`, () => listarAlunos({ busca: buscaAtrasada, pagina, situacao: 'ATIVO' }));
  const itens = alunos.dados?.itens ?? [];
  const temMais = !!alunos.dados && pagina * TAMANHO_PAGINA + itens.length < alunos.dados.total;

  // Aviso (não bloqueia): o responsável já tem, na lista desta tela, outro compromisso nesse horário.
  const previa = pedidoDoFormulario(form, comObservacao).pedido;
  const conflito = previa ? conflitoNaLista(carregados, { id: compromisso?.id, responsavelId: previa.responsavelId, ...intervaloDoPedido(previa) }) : null;
  const opcoesResponsavel = responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }));
  const duracaoSugerida = DURACOES_SUGERIDAS.find((d) => String(d) === form.duracao.trim()) ?? null;

  const salvar = async () => {
    const { erros: novos, pedido } = pedidoDoFormulario(form, comObservacao, compromisso ? compromisso.versao : undefined);
    setErros(novos);
    if (!pedido) {
      setErroGeral('Confira os campos destacados.');
      return;
    }
    setSalvando(true);
    setErroGeral(null);
    try {
      aoSalvo(compromisso ? await alterarCompromisso(compromisso.id, pedido) : await criarCompromisso(pedido));
    } catch (e) {
      // 409 HORARIO_OCUPADO, CONFLITO_EDICAO, ALUNO_INATIVO...: a mensagem da API, sem dado do outro compromisso.
      setErroGeral(codigoApi(e) === 'CONFLITO_EDICAO'
        ? 'Outra pessoa alterou este compromisso. Feche e abra de novo para ver a versão atual.' : textoDoErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={estilos.coluna}>
      <EscolhaEmFolha rotulo="Aluno" titulo="Escolher aluno" valor={form.alunoId} rotuloDoValor={nomeDoAluno ?? 'Escolher'}
        opcoes={itens.map((a) => ({ valor: a.id, rotulo: a.nome }))}
        aoMudar={(id) => { mudar('alunoId', id); setNomeDoAluno(itens.find((a) => a.id === id)?.nome ?? null); }}
        busca={{ valor: busca, rotulo: 'Buscar aluno', aoMudar: (v) => { setBusca(v); setPagina(0); } }}
        textoVazio="Nenhum aluno ativo encontrado." carregando={alunos.carregando}
        rodape={<>
          {pagina > 0 || temMais ? <LinhaDeAcoes>
            {pagina > 0 ? <Botao rotulo="Alunos anteriores" tipo="secundario" aoTocar={() => setPagina(pagina - 1)} /> : null}
            {temMais ? <Botao rotulo="Próximos alunos" tipo="secundario" aoTocar={() => setPagina(pagina + 1)} /> : null}
          </LinhaDeAcoes> : null}
          {alunos.erro ? <MensagemErro texto={textoDoErro(alunos.erro)} tentarDeNovo={alunos.recarregar} /> : null}
        </>} />
      {erros.alunoId ? <ErroDoCampo texto={erros.alunoId} /> : null}
      <EscolhaEmFolha rotulo="Responsável" titulo="Escolher responsável" valor={form.responsavelId} opcoes={opcoesResponsavel}
        rotuloDoValor={compromisso?.responsavelNome ?? 'Escolher'} aoMudar={(id) => mudar('responsavelId', id)}
        textoVazio="Nenhum membro ativo na equipe." />
      {erros.responsavelId ? <ErroDoCampo texto={erros.responsavelId} /> : null}
      <CampoData rotulo="Data" valor={form.data} aoMudar={(t) => mudar('data', t)} erro={erros.data} />
      <Campo rotulo="Hora (Brasília)" valor={form.hora} aoMudar={(t) => mudar('hora', mascaraHora(t))} erro={erros.hora}
        placeholder="HH:MM" keyboardType="number-pad" inputMode="numeric" maxLength={5} numerico />
      <Escolha rotulo="Duração" valor={duracaoSugerida} opcoes={DURACOES_SUGERIDAS.map((d) => ({ valor: d, rotulo: textoDaDuracao(d) }))}
        aoMudar={(d) => { if (d !== null) mudar('duracao', String(d)); }} />
      <Campo rotulo="Duração em minutos" valor={form.duracao} aoMudar={(t) => mudar('duracao', t.replace(/\D/g, '').slice(0, 3))}
        erro={erros.duracao} ajuda={`De ${LIMITES_COMPROMISSO.duracaoMinima} a ${LIMITES_COMPROMISSO.duracaoMaxima} minutos.`}
        keyboardType="number-pad" inputMode="numeric" numerico />
      <Campo rotulo="Local (opcional)" valor={form.local} aoMudar={(t) => mudar('local', t)} erro={erros.local}
        maxLength={LIMITES_COMPROMISSO.local} placeholder="Ex.: Sala 2, academia, online" />
      {comObservacao ? <Campo rotulo="Observação (opcional)" valor={form.observacao} aoMudar={(t) => mudar('observacao', t)}
        erro={erros.observacao} linhas={3} maxLength={LIMITES_COMPROMISSO.observacao}
        ajuda="Só a equipe vê. O aluno não vê a observação." /> : null}
      {conflito ? <Texto variante="suave">
        {`Atenção: este responsável já tem um compromisso das ${conflito.hora} às ${conflito.horaFim} nesse período.`}
      </Texto> : null}
      {erroGeral ? <MensagemErro texto={erroGeral} /> : null}
      <LinhaDeAcoes>
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} />
        <Botao rotulo={compromisso ? 'Salvar alterações' : 'Marcar compromisso'} aoTocar={() => void salvar()} carregando={salvando}
          desabilitado={salvando} motivo="Salvando." />
      </LinhaDeAcoes>
    </View>
  );
}

function ErroDoCampo({ texto }: { texto: string }) {
  const { cores } = useTema();
  return <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{texto}</Texto>;
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  linhaSelo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
});
