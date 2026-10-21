import { Permitido } from '../../../ui/Permitido';
import { useSessao } from '../../../sessao/SessaoProvider';
import { EntradaEmCascata, usePrimeiraLista } from '../../../ui/EntradaEmCascata';
import { sobre } from '../../../ui/sobre';
import { router } from 'expo-router';
import { Check, ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { listarAlunos } from '../../../api/rotas';
import type { AlunoResumo, SituacaoFiltro } from '../../../api/tipos';
import { statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataRelativa } from '../../../dominio/datasRelativas';
import { LIMITE_LOTE, textoDaSelecao } from '../../../dominio/loteDeAlunos';
import { alternarComLimite, marcarVisiveis } from '../../../dominio/selecaoMultipla';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, RAIO, LARGURA_LISTA, LARGURA_MENU_LATERAL } from '../../../tema/tokens';
import { EscolhaResponsabilidade, type Responsabilidade } from '../../../treinador/EscolhaResponsabilidade';
import { Folha } from '../../../ui/Folha';
import { LinhaDeAcoes } from '../../../ui/LinhaDeAcoes';
import { AcoesEmLote } from '../../../treinador/AcoesEmLote';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Campo } from '../../../ui/Campo';
import { Escolha } from '../../../ui/Escolha';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { propsDeLink } from '../../../ui/propsDeLink';
import { Selo } from '../../../ui/Selo';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useAtrasado, useCarregar } from '../../../ui/useCarregar';
import { Grade } from '../../../ui/Grade';

const SITUACOES: { valor: SituacaoFiltro; rotulo: string }[] = [
  { valor: 'ATIVO', rotulo: 'Ativos' },
  { valor: 'INATIVO', rotulo: 'Inativos' },
  { valor: 'TODOS', rotulo: 'Todos' },
];

const TAMANHO_PAGINA = 30;

export default function Alunos() {
  const { pode,perfilEquipe } = useSessao();
  const { avisar } = useAviso();
  // Modo "Selecionar" (ações em lote): os marcados valem entre páginas, mas mudar busca ou filtro limpa a marcação.
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [escopo,setEscopo]=useState<Responsabilidade>(perfilEquipe?.acessoTotal?'todos':'meus');
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  // No celular os filtros ficam recolhidos (só a busca aparece): antes empurravam a lista ~300 px para baixo.
  const estreito = width < LARGURA_MENU_LATERAL;
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<SituacaoFiltro>('ATIVO');
  const [pagina, setPagina] = useState(0);
  const termo = useAtrasado(busca.trim(), 300);
  const { dados, erro, carregando, recarregar } = useCarregar(`${termo}|${situacao}|${pagina}|${escopo}`, () =>
    listarAlunos({ busca: termo, situacao, pagina,meus:escopo==='meus' }),
  );
  const animar = usePrimeiraLista(!!dados, `${termo}|${situacao}|${pagina}`);
  const mudarFiltro = (aplicar: () => void) => { aplicar(); setPagina(0); setMarcados(new Set()); };
  const sairDaSelecao = () => { setSelecionando(false); setMarcados(new Set()); };
  const alternar = (id: string) => {
    const r = alternarComLimite(marcados, id, !marcados.has(id), LIMITE_LOTE);
    if (r.recusado) avisar(`Dá para marcar até ${LIMITE_LOTE} alunos por vez.`, 'neutro');
    setMarcados(r.marcados);
  };
  const marcarOsVisiveis = () => {
    const r = marcarVisiveis((dados?.itens ?? []).map((a) => a.id), marcados, LIMITE_LOTE);
    if (r.deixados > 0) avisar(`Dá para marcar até ${LIMITE_LOTE} alunos por vez; ${r.deixados} ficaram de fora.`, 'neutro');
    setMarcados(r.marcados);
  };
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;

  const rotuloSituacao = SITUACOES.find((o) => o.valor === situacao)?.rotulo ?? '';
  const filtros = (
    <View style={estilos.recortes}>
      <EscolhaResponsabilidade valor={escopo} aoMudar={(v) => mudarFiltro(() => setEscopo(v))} />
      <Escolha rotulo="Situação" opcoes={SITUACOES} valor={situacao} aoMudar={(s) => mudarFiltro(() => setSituacao(s))} />
    </View>
  );

  return (
    <View style={estilos.raiz}>
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo="Alunos"
        mostrarMarca="celular"
        acoes={
          <View style={estilos.acoesDoTopo}>
            <Permitido codigo="ALUNO_ALTERAR">
              <Botao rotulo={selecionando ? 'Sair da seleção' : 'Selecionar'} tipo="secundario" aoTocar={() => (selecionando ? sairDaSelecao() : setSelecionando(true))} />
            </Permitido>
            <Permitido codigo="ALUNO_ALTERAR"><Botao
              rotulo="Novo aluno"
              Icone={Plus}
              aoTocar={() => router.push('/treinador/alunos/novo')}
            /></Permitido>
          </View>
        }
      />
      {/* Ordem das listas: busca → filtros. */}
      <View style={estilos.busca}>
        <Campo
          rotulo="Buscar"
          valor={busca}
          aoMudar={(t) => mudarFiltro(() => setBusca(t))}
          placeholder="Nome do aluno"
          autoCapitalize="none"
        />
      </View>
      {estreito ? (
        <Cartao titulo={`Filtros: ${escopo === 'meus' ? 'meus' : 'todos'} · ${rotuloSituacao.toLowerCase()}`} recolhivel recolhido>{filtros}</Cartao>
      ) : filtros}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? (
        <Vazio
          titulo={termo ? 'Nenhum aluno encontrado' : 'Nenhum aluno ainda'}
          texto={termo ? 'Tente buscar por outro nome.' : 'Cadastre seu primeiro aluno para montar os planos.'}
          acao={termo || !pode('ALUNO_ALTERAR') ? undefined : { rotulo: 'Cadastrar aluno', aoTocar: () => router.push('/treinador/alunos/novo') }}
        />
      ) : null}
      <View style={[estilos.lista, carregando && dados ? estilos.esmaecido : null]}>
        <Grade gap={espaco(1)}>{(dados?.itens ?? []).map((a, i) => <EntradaEmCascata key={a.id} indice={i} animar={animar} style={estilos.crescer}><LinhaAluno aluno={a} selecionando={selecionando} marcado={marcados.has(a.id)} aoMarcar={() => alternar(a.id)} /></EntradaEmCascata>)}</Grade>
      </View>
      {dados && paginas > 1 ? (
        <View style={estilos.paginacao}>
          <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
          <Texto variante="suave">
            Página {pagina + 1} de {paginas} · {dados.total} alunos
          </Texto>
          <Botao
            rotulo="Próxima"
            tipo="secundario"
            desabilitado={pagina + 1 >= paginas}
            aoTocar={() => setPagina(pagina + 1)}
          />
        </View>
      ) : null}
    </Tela>
    {/* No modo Selecionar a barra fica fixa embaixo: a contagem e as ações não somem ao rolar a lista. */}
    {selecionando ? (
      <View style={[estilos.barraLote, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <Texto numerico style={estilos.textoLote}>{textoDaSelecao(marcados.size)}</Texto>
        <LinhaDeAcoes>
          <Botao rotulo="Marcar visíveis" tipo="secundario" desabilitado={!dados || dados.itens.length === 0} aoTocar={marcarOsVisiveis} />
          <Botao rotulo="Ações" desabilitado={marcados.size === 0} motivo="Marque ao menos um aluno." aoTocar={() => setAcoesAbertas(true)} />
        </LinhaDeAcoes>
      </View>
    ) : null}
    {acoesAbertas ? (
      <Folha visivel titulo="Ações em lote" aoFechar={() => setAcoesAbertas(false)}>
        <Texto numerico variante="suave">{textoDaSelecao(marcados.size)}</Texto>
        <AcoesEmLote alunoIds={[...marcados]} aoConcluir={() => { setAcoesAbertas(false); sairDaSelecao(); recarregar(); }} />
        <Botao rotulo="Limpar marcação" tipo="fantasma" desabilitado={marcados.size === 0} aoTocar={() => { setMarcados(new Set()); setAcoesAbertas(false); }} />
      </Folha>
    ) : null}
    </View>
  );
}

/**
 * Uma linha da lista: nome, selos só para o que pede atenção (a atualização, que diz de quê, e as exceções "Inativo" e
 * "Sem acesso"; "Ativo"/"Com acesso" em toda linha não diziam nada) e uma linha com o plano ativo e o último registro.
 */
function LinhaAluno({ aluno, selecionando, marcado, aoMarcar }: { aluno: AlunoResumo; selecionando: boolean; marcado: boolean; aoMarcar: () => void }) {
  const { cores } = useTema();
  const atualizacao = aluno.atualizacao ? statusAtualizacaoTreinador(aluno.atualizacao) : null;
  const ultimo = aluno.ultimoRegistro ? `Último registro ${dataRelativa(aluno.ultimoRegistro)}` : 'Nunca registrou';
  const temSelo = !!atualizacao || !aluno.ativo || !aluno.temAcesso;
  return (
    <Pressable
      accessibilityRole={selecionando ? 'checkbox' : 'link'}
      accessibilityLabel={selecionando ? aluno.nome : `Abrir ${aluno.nome}${atualizacao ? `. ${atualizacao.texto}` : ''}`}
      accessibilityState={selecionando ? { checked: marcado } : undefined}
      {...(selecionando
        ? { onPress: aoMarcar }
        : propsDeLink(`/treinador/alunos/${aluno.id}`, () => router.push(`/treinador/alunos/${aluno.id}`)))}
      style={(estado) => [
        estilos.linha,
        { backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie2, borderColor: cores.borda },
      ]}>
      {selecionando ? (
        <View style={[estilos.caixa, { backgroundColor: marcado ? cores.texto : cores.campo, borderColor: marcado ? cores.texto : cores.bordaCampo }]}>
          {marcado ? <Check size={18} color={cores.fundo} /> : null}
        </View>
      ) : null}
      <View style={estilos.dados}>
        <Texto variante="bloco" numberOfLines={2}>{aluno.nome}</Texto>
        {temSelo ? (
          <View style={estilos.selos}>
            {atualizacao ? <Selo texto={atualizacao.texto} tipo={atualizacao.tipo} /> : null}
            {!aluno.ativo ? <Selo texto="Inativo" tipo="neutro" /> : null}
            {aluno.ativo && !aluno.temAcesso ? <Selo texto="Sem acesso" tipo="neutro" /> : null}
          </View>
        ) : null}
        <Texto variante="suave" numberOfLines={2} numerico>
          {aluno.planoAtivo?.titulo ?? 'Sem plano ativo'} · {ultimo}
        </Texto>
      </View>
      {selecionando ? null : <ChevronRight size={20} color={cores.textoSuave} />}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  barraLote: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), borderTopWidth: 1, paddingHorizontal: espaco(2), paddingVertical: espaco(1.25) },
  textoLote: { flexShrink: 1 },
  acoesDoTopo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  caixa: { width: 24, height: 24, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  busca: { maxWidth: 480 },
  recortes: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1.5) },
  lista: { gap: espaco(1) },
  crescer: { flexGrow: 1 },
  esmaecido: { opacity: 0.6 },
  linha: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(2),
    minHeight: 56,
  },
  dados: { flex: 1, gap: espaco(0.75) },
  selos: { flexDirection: 'row', gap: espaco(0.75), flexWrap: 'wrap' },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});
