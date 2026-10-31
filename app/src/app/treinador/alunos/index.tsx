import { Permitido } from '../../../ui/Permitido';
import { useSessao } from '../../../sessao/SessaoProvider';
import { EntradaEmCascata, usePrimeiraLista } from '../../../ui/EntradaEmCascata';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarClock, CircleAlert, CircleCheck, Pencil, Plus, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ResponsavelEquipe } from '../../../api/equipeTipos';
import { listarAlunos, responsaveisEquipe } from '../../../api/rotas';
import type { AlunoResumo } from '../../../api/tipos';
import { statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataRelativa } from '../../../dominio/datasRelativas';
import { SEM_DADO } from '../../../dominio/formatos';
import { agruparAlunos, primeiroNome, ultimoRegistroDaLinha, type TomDoGrupo } from '../../../dominio/gruposDeAlunos';
import { LIMITE_LOTE, textoDaSelecao } from '../../../dominio/loteDeAlunos';
import {
  chaveDosFiltros, chipsDosFiltros, filtrosVisiveis, lerDoEndereco, paraEndereco, pedidoDaApi, permissoesDosFiltros, SEM_FILTROS,
  CHAVES_DO_ENDERECO, semOFiltro, semOQueNaoPode, type ChaveDoFiltro, type FiltrosDeAlunos, type ParametrosDoEndereco,
} from '../../../dominio/filtrosDeAlunos';
import { alternarComLimite, marcarVisiveis } from '../../../dominio/selecaoMultipla';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { SeletoresDosFiltrosDeAlunos } from '../../../treinador/SeletoresDosFiltrosDeAlunos';
import { BarraDeFiltros } from '../../../ui/BarraDeFiltros';
import { Folha } from '../../../ui/Folha';
import { LinhaDeAcoes } from '../../../ui/LinhaDeAcoes';
import { AcoesEmLote } from '../../../treinador/AcoesEmLote';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { IniciaisDePerfil } from '../../../ui/FotoDePerfil';
import { IconeBotao } from '../../../ui/IconeBotao';
import { CabecalhoDasColunas, LinhaDaLista, ListaDeLinhas, type CelulasDaLinha, type ColunaDaLista, type SeloDaLinha } from '../../../ui/LinhaDaLista';
import { Selo, type TipoSelo } from '../../../ui/Selo';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useAtrasado, useCarregar } from '../../../ui/useCarregar';

const TAMANHO_PAGINA = 30;

/** Colunas da lista no PC (D2; larguras do protótipo `docs/prototipos/alunos.html`). */
const COLUNAS: readonly ColunaDaLista[] = [
  { chave: 'aluno', rotulo: 'Aluno', peso: 2.2, minima: 220 },
  { chave: 'plano', rotulo: 'Plano em uso', peso: 1.6 },
  { chave: 'atualizacao', rotulo: 'Atualização', peso: 1.5 },
  { chave: 'ultimo', rotulo: 'Último registro', peso: 1.1 },
  { chave: 'responsavel', rotulo: 'Responsável', peso: 1.1 },
];
/** Sem ver atualizações a API manda `atualizacao` nula: a coluna não aparece (seria "—" em toda linha). */
const COLUNAS_SEM_ATUALIZACAO = COLUNAS.filter((c) => c.chave !== 'atualizacao');

/** Ícone do selo da atualização, como os selos do editor de treino; o texto continua dizendo o estado. */
const ICONE_DO_SELO: Record<TipoSelo, LucideIcon> = { sucesso: CircleCheck, atencao: TriangleAlert, perigo: CircleAlert, neutro: CalendarClock };

export default function Alunos() {
  const { pode, perfilEquipe, usuario } = useSessao();
  const { avisar } = useAviso();
  // Modo "Selecionar" (ações em lote): os marcados valem entre páginas, mas mudar busca ou filtro limpa a marcação.
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const { cores } = useTema();
  // Sem as duas permissões a API manda a atualização nula: um grupo só ("Alunos") e sem a coluna Atualização.
  const veAtualizacao = pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
  const podeEditar = pode('ALUNO_ALTERAR');
  // Nome do responsável (primeiro nome) pela rota que já existe; se falhar, a coluna fica "—" e a lista segue.
  const responsaveis = useCarregar('responsaveis-da-lista', () => responsaveisEquipe().catch((): ResponsavelEquipe[] => [])).dados ?? [];
  const nomeDoResponsavel = (id: string | null | undefined) => {
    const r = id ? responsaveis.find((x) => x.id === id) : undefined;
    return r ? primeiroNome(r.nome) : null;
  };
  // Filtros avançados no endereço (`dominio/filtrosDeAlunos`): o Início abre a lista já filtrada e o voltar sai da tela.
  // Quem não tem acesso total começa nos próprios alunos, como antes; filtro sem a permissão é ignorado.
  const comecaEmMeus = !perfilEquipe?.acessoTotal;
  const permissoes = permissoesDosFiltros(pode);
  const visiveis = filtrosVisiveis(permissoes);
  const parametros = useLocalSearchParams<Record<keyof ParametrosDoEndereco, string | string[]>>();
  const filtros = semOQueNaoPode(lerDoEndereco(parametros, comecaEmMeus), permissoes);
  const chaveFiltros = chaveDosFiltros(filtros);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const termo = useAtrasado(busca.trim(), 300);
  const { dados, erro, carregando, recarregar } = useCarregar(`${termo}|${chaveFiltros}|${pagina}`, () =>
    listarAlunos({ busca: termo, pagina, filtros: pedidoDaApi(filtros, usuario?.id) }),
  );
  const animar = usePrimeiraLista(!!dados, `${termo}|${chaveFiltros}|${pagina}`);
  const limparSelecao = () => { setPagina(0); setMarcados(new Set()); };
  const mudarBusca = (texto: string) => { setBusca(texto); limparSelecao(); };
  // Trocar um filtro troca o endereço sem empilhar histórico (o voltar sai da tela) e volta à página 1. `setParams`, não
  // `router.replace`: o replace troca a rota inteira e a tela perderia a busca digitada e o painel aberto. Chave que sai
  // vai como `undefined` (o setParams junta com os parâmetros de antes).
  const aplicar = (novos: FiltrosDeAlunos) => {
    limparSelecao();
    const params = paraEndereco(novos, comecaEmMeus);
    router.setParams(Object.fromEntries(CHAVES_DO_ENDERECO.map((k) => [k, params[k]])));
  };
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
  // Grupos da página que veio (D1): Para revisar, Atrasados, Em dia e Sem pasta com período; grupo vazio não aparece.
  const grupos = agruparAlunos(dados?.itens ?? [], veAtualizacao);
  const colunas = veAtualizacao ? COLUNAS : COLUNAS_SEM_ATUALIZACAO;
  // A entrada em cascata segue a ordem da tela, de um grupo para o outro.
  const inicios = grupos.map((_, i) => grupos.slice(0, i).reduce((n, g) => n + g.itens.length, 0));
  const nomeCompleto = (id: string) => responsaveis.find((r) => r.id === id)?.nome ?? null;
  const chips = chipsDosFiltros(filtros, nomeCompleto);
  const filtrado = chips.length > 0;

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
      {/* Ordem das listas: busca → filtros (botão "Filtros" com o painel e o "Filtrado por"). */}
      <BarraDeFiltros
        busca={{ valor: busca, aoMudar: mudarBusca, placeholder: 'Nome do aluno' }}
        valor={filtros}
        aoAplicar={aplicar}
        limpo={SEM_FILTROS}
        chips={chips}
        aoTirar={(chave) => aplicar(semOFiltro(filtros, chave as ChaveDoFiltro))}
        rotuloDoResultado="Ver alunos"
        seletores={(atuais, mudar) => (
          <SeletoresDosFiltrosDeAlunos visiveis={visiveis} filtros={atuais} aoMudar={mudar} responsaveis={responsaveis} usuarioId={usuario?.id} />
        )}
      />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? (
        <Vazio
          titulo={termo || filtrado ? 'Nenhum aluno encontrado' : 'Nenhum aluno ainda'}
          texto={termo ? 'Tente buscar por outro nome.' : filtrado ? 'Nenhum aluno passa nesses filtros. Tire algum ou limpe os filtros.' : 'Cadastre seu primeiro aluno para montar os planos.'}
          acao={filtrado ? { rotulo: 'Limpar filtros', aoTocar: () => aplicar(SEM_FILTROS) }
            : termo || !pode('ALUNO_ALTERAR') ? undefined : { rotulo: 'Cadastrar aluno', aoTocar: () => router.push('/treinador/alunos/novo') }}
        />
      ) : null}
      <View style={[estilos.lista, carregando && dados ? estilos.esmaecido : null]}>
        {grupos.map((g, gi) => (
          <Cartao key={g.chave} titulo={g.titulo} descricao={g.resumo} marcador={g.tom ? <Bolinha tom={g.tom} /> : undefined}>
            <CabecalhoDasColunas colunas={colunas} marcar={selecionando} aoLado={!selecionando && podeEditar} />
            <ListaDeLinhas emColunas>
              {g.itens.map((a, i) => (
                <EntradaEmCascata key={a.id} indice={inicios[gi] + i} animar={animar}>
                  <LinhaAluno aluno={a} colunas={colunas} responsavel={nomeDoResponsavel(a.responsavelId)} podeEditar={podeEditar}
                    selecionando={selecionando} marcado={marcados.has(a.id)} aoMarcar={() => alternar(a.id)} />
                </EntradaEmCascata>
              ))}
            </ListaDeLinhas>
          </Cartao>
        ))}
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

/** Bolinha na cor do estado na faixa do grupo; decorativa, porque o título já diz o estado. */
function Bolinha({ tom }: { tom: TomDoGrupo }) {
  const { cores } = useTema();
  return <View accessible={false} aria-hidden style={[estilos.bolinha, { backgroundColor: cores[tom] }]} />;
}

interface PropsDaLinhaAluno {
  aluno: AlunoResumo;
  colunas: readonly ColunaDaLista[];
  /** Primeiro nome do responsável; nulo = "—". */
  responsavel: string | null;
  podeEditar: boolean;
  selecionando: boolean;
  marcado: boolean;
  aoMarcar: () => void;
}

/**
 * Uma linha da lista (D2 e D3): no PC, colunas Aluno (iniciais, nome e só os selos de exceção, "Inativo" e "Sem
 * acesso"), Plano em uso, Atualização, Último registro e Responsável; no celular, o aluno em cima e uma linha com o plano
 * e o último registro, mais o selo da atualização. A linha é o link para a ficha e o lápis (editar cadastro) fica antes
 * da seta, fora do link. No PC a linha é linha de tabela (divisória e realce, sem caixa). No Selecionar a linha inteira
 * vira a caixa de marcar (sem link, sem lápis).
 */
function LinhaAluno({ aluno, colunas, responsavel, podeEditar, selecionando, marcado, aoMarcar }: PropsDaLinhaAluno) {
  const atualizacao = aluno.atualizacao ? statusAtualizacaoTreinador(aluno.atualizacao) : null;
  const ultimo = ultimoRegistroDaLinha(aluno.ultimoRegistro);
  const plano = aluno.planoAtivo?.titulo ?? null;
  const excecoes: SeloDaLinha[] = [
    ...(!aluno.ativo ? [{ texto: 'Inativo', tipo: 'neutro' as const }] : []),
    ...(aluno.ativo && !aluno.temAcesso ? [{ texto: 'Sem acesso', tipo: 'neutro' as const }] : []),
  ];
  const seloDaAtualizacao: SeloDaLinha | null = atualizacao
    ? { texto: atualizacao.texto, tipo: atualizacao.tipo, Icone: ICONE_DO_SELO[atualizacao.tipo] }
    : null;
  const celulas: CelulasDaLinha = {
    aluno: (
      <View style={estilos.celulaAluno}>
        <IniciaisDePerfil nome={aluno.nome} tamanho={36} />
        <View style={estilos.nomeESelos}>
          <Texto variante="bloco" numberOfLines={2}>{aluno.nome}</Texto>
          {excecoes.length ? <View style={estilos.selos}>{excecoes.map((s) => <Selo key={s.texto} texto={s.texto} tipo={s.tipo} />)}</View> : null}
        </View>
      </View>
    ),
    plano: plano ? <Texto numberOfLines={2}>{plano}</Texto> : <Texto variante="suave">Sem plano ativo</Texto>,
    // Na coluna o cabeçalho já diz "Atualização": vale o `curto` ("Para revisar"), que cabe numa linha; empilhado
    // (celular), o selo da linha leva o `texto`. A linha em volta alinha o selo à esquerda, como o rótulo da coluna.
    atualizacao: atualizacao && seloDaAtualizacao
      ? <View style={estilos.inicioDaCelula}><Selo texto={atualizacao.curto} tipo={seloDaAtualizacao.tipo} Icone={seloDaAtualizacao.Icone} /></View>
      : <Texto variante="suave">{SEM_DADO}</Texto>,
    ultimo: <Texto numerico cor={ultimo.suave ? 'suave' : undefined} numberOfLines={1}>{ultimo.texto}</Texto>,
    responsavel: <Texto numberOfLines={1} cor={responsavel ? undefined : 'suave'}>{responsavel ?? SEM_DADO}</Texto>,
  };
  // Celular: o que as colunas mostram vira uma linha de metadados e o selo da atualização embaixo do nome.
  const metadados = `${plano ?? 'Sem plano ativo'} · ${aluno.ultimoRegistro ? `Último registro ${dataRelativa(aluno.ultimoRegistro)}` : 'Nunca registrou'}`;
  const selos = seloDaAtualizacao ? [seloDaAtualizacao] : [];
  const comColunas = { definicao: colunas, celulas };
  if (selecionando) {
    return <LinhaDaLista titulo={aluno.nome} metadados={metadados} selos={selos} colunas={comColunas} rotulo={aluno.nome} marcar={{ marcado, aoMudar: aoMarcar }} />;
  }
  const ficha = `/treinador/alunos/${aluno.id}` as const;
  // O nome acessível começa por "Abrir <nome>" e diz o que as colunas mostram (o leitor de tela lê o rótulo do link).
  const rotulo = [
    `Abrir ${aluno.nome}`,
    atualizacao?.texto,
    ...excecoes.map((s) => s.texto),
    plano ?? 'Sem plano ativo',
    aluno.ultimoRegistro ? `Último registro: ${ultimo.texto.toLowerCase()}` : ultimo.texto,
    responsavel ? `Responsável: ${responsavel}` : null,
  ].filter(Boolean).join('. ');
  return (
    <LinhaDaLista
      titulo={aluno.nome}
      metadados={metadados}
      selos={selos}
      colunas={comColunas}
      href={ficha}
      aoAbrir={() => router.push(ficha)}
      rotulo={rotulo}
      aoLado={podeEditar ? (
        <IconeBotao moldura Icone={Pencil} rotulo={`Editar cadastro de ${aluno.nome}`}
          aoTocar={() => router.push({ pathname: '/treinador/alunos/[id]', params: { id: aluno.id, editar: '1' } })} />
      ) : undefined}
    />
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  barraLote: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), borderTopWidth: 1, paddingHorizontal: espaco(2), paddingVertical: espaco(1.25) },
  textoLote: { flexShrink: 1 },
  acoesDoTopo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  // 24 px entre os blocos dos grupos.
  lista: { gap: espaco(3) },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  celulaAluno: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minWidth: 0 },
  nomeESelos: { flexShrink: 1, gap: espaco(0.5) },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  inicioDaCelula: { flexDirection: 'row' },
  esmaecido: { opacity: 0.6 },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});
