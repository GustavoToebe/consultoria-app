import { Permitido } from '../../../ui/Permitido';
import { useSessao } from '../../../sessao/SessaoProvider';
import { EntradaEmCascata, usePrimeiraLista } from '../../../ui/EntradaEmCascata';
import { sobre } from '../../../ui/sobre';
import { router } from 'expo-router';
import { Check, ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarAlunos } from '../../../api/rotas';
import type { AlunoResumo, SituacaoFiltro } from '../../../api/tipos';
import { statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataParaTela } from '../../../dominio/formatos';
import { LIMITE_LOTE, textoDaSelecao } from '../../../dominio/loteDeAlunos';
import { alternarComLimite, marcarVisiveis } from '../../../dominio/selecaoMultipla';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, RAIO, LARGURA_LISTA } from '../../../tema/tokens';
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
  const [escopo,setEscopo]=useState<'meus'|'todos'>(perfilEquipe?.acessoTotal?'todos':'meus');
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

  return (
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
      <Texto variante="suave">Busque pelo nome e abra a ficha para ver planos, registros e atualizações.</Texto>
      <Cartao titulo="Filtros">
      <View style={estilos.filtros}>
        <View style={estilos.busca}>
          <Campo
            rotulo="Buscar"
            valor={busca}
            aoMudar={(t) => mudarFiltro(() => setBusca(t))}
            placeholder="Nome do aluno"
            autoCapitalize="none"
          />
        </View>
        {/* Os dois recortes da lista lado a lado; no celular o segundo desce. */}
        <View style={estilos.recortes}>
          <Escolha rotulo="Responsabilidade" opcoes={[{ valor: 'meus', rotulo: 'Meus alunos' }, { valor: 'todos', rotulo: 'Todos os alunos' }]} valor={escopo} aoMudar={(v) => mudarFiltro(() => setEscopo(v))} />
          <Escolha
            rotulo="Situação"
            opcoes={SITUACOES}
            valor={situacao}
            aoMudar={(s) => mudarFiltro(() => setSituacao(s))}
          />
        </View>
      </View>
      </Cartao>
      {selecionando ? (
        <Cartao titulo="Ações em lote">
          <View style={estilos.lote}>
            <Texto variante="suave" numerico>{textoDaSelecao(marcados.size)}</Texto>
            <View style={estilos.acoesDoTopo}>
              <Botao rotulo="Marcar visíveis" tipo="secundario" desabilitado={!dados || dados.itens.length === 0} aoTocar={marcarOsVisiveis} />
              <Botao rotulo="Limpar" tipo="secundario" desabilitado={marcados.size === 0} aoTocar={() => setMarcados(new Set())} />
            </View>
            <AcoesEmLote alunoIds={[...marcados]} aoConcluir={() => { sairDaSelecao(); recarregar(); }} />
          </View>
        </Cartao>
      ) : null}
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
  );
}

/** Os dois selos da linha têm a mesma largura (o maior texto, "Sem acesso", define). */
const LARGURA_SELO = 96;

function LinhaAluno({ aluno, selecionando, marcado, aoMarcar }: { aluno: AlunoResumo; selecionando: boolean; marcado: boolean; aoMarcar: () => void }) {
  const { cores } = useTema();
  const atualizacao = aluno.atualizacao ? statusAtualizacaoTreinador(aluno.atualizacao) : null;
  return (
    <Pressable
      accessibilityRole={selecionando ? 'checkbox' : 'link'}
      accessibilityLabel={selecionando ? aluno.nome : `Abrir ${aluno.nome}${atualizacao ? `. Atualização: ${atualizacao.texto}` : ''}`}
      accessibilityState={selecionando ? { checked: marcado } : undefined}
      onPress={() => (selecionando ? aoMarcar() : router.push(`/treinador/alunos/${aluno.id}`))}
      style={(estado) => [
        estilos.linha,
        { backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie2, borderColor: cores.borda },
      ]}>
      {selecionando ? (
        <View style={[estilos.caixa, { backgroundColor: marcado ? cores.texto : cores.campo, borderColor: cores.borda }]}>
          {marcado ? <Check size={18} color={cores.fundo} /> : null}
        </View>
      ) : null}
      <View style={estilos.dados}>
        <Texto variante="bloco" numberOfLines={2}>{aluno.nome}</Texto>
        <View style={estilos.selos}>
          <Selo texto={aluno.ativo ? 'Ativo' : 'Inativo'} tipo={aluno.ativo ? 'sucesso' : 'neutro'} larguraMinima={LARGURA_SELO} />
          <Selo texto={aluno.temAcesso ? 'Com acesso' : 'Sem acesso'} tipo={aluno.temAcesso ? 'sucesso' : 'neutro'} larguraMinima={LARGURA_SELO} />
          {atualizacao ? <Selo {...atualizacao} /> : null}
        </View>
        <Texto variante="suave" numberOfLines={2}>
          Treino: {aluno.planoAtivo?.titulo ?? '—'} · Último registro: {dataParaTela(aluno.ultimoRegistro) || '—'}
        </Texto>
      </View>
      {selecionando ? null : <ChevronRight size={20} color={cores.textoSuave} />}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  acoesDoTopo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  lote: { gap: espaco(1.5) },
  caixa: { width: 24, height: 24, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  filtros: { gap: espaco(1.5) },
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
