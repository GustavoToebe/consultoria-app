import { ChevronDown, ChevronUp, Download } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { catalogoAlimentos, catalogoExercicios, gruposDoCatalogo, importarDoCatalogo, type TipoBiblioteca } from '../../api/rotas';
import type { CatalogoAlimento, CatalogoExercicio } from '../../api/tipos';
import {
  chipsDoCatalogoDeAlimentos, chipsDoCatalogoDeExercicios, CREDITOS_CATALOGO, equipamentoDoCatalogo, naBibliotecaParaApi, OPCOES_NA_BIBLIOTECA,
  passosDasInstrucoes, SEM_FILTROS_DO_CATALOGO_DE_ALIMENTOS, SEM_FILTROS_DO_CATALOGO_DE_EXERCICIOS, semOFiltroDoCatalogoDeAlimentos,
  semOFiltroDoCatalogoDeExercicios, temTracoNaLinha, textoMostrando, type FiltroNaBiblioteca, type FiltrosDoCatalogoDeAlimentos,
  type FiltrosDoCatalogoDeExercicios, UNIDADES_DO_CATALOGO,
} from '../../dominio/catalogo';
import { midiaParaApi, modalidadesExistentes, OPCOES_DE_MODALIDADE, ORDEM_DAS_MODALIDADES } from '../../dominio/exerciciosDaBiblioteca';
import { plural } from '../../dominio/formatos';
import { marcadosExistentes } from '../../dominio/selecaoMultiplaSuspensa';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { CaixaDaLinha, LinhaDaLista } from '../../ui/LinhaDaLista';
import { Permitido } from '../../ui/Permitido';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { ListaEmColunas } from '../ListaEmColunas';
import { UmaOpcao } from '../SeletoresDeFiltro';
import { descricaoDoAlimento, LegendaDosAlimentos, ValoresDoAlimento } from './AbaAlimentos';
import { DetalheDoExercicio, LegendaDasModalidades, SeletoresDeExercicios } from './ModalidadeDoExercicio';

type PaginaDoCatalogo =
  | { tipo: 'exercicios'; itens: CatalogoExercicio[]; total: number }
  | { tipo: 'alimentos'; itens: CatalogoAlimento[]; total: number };

const DICA_JA_NA_BIBLIOTECA = 'Já está na sua biblioteca (mesmo nome). A importação o ignoraria.';

/**
 * Catálogo público (só leitura): marcar vários e importar para a biblioteca da consultoria. A linha, a legenda e os filtros
 * são os das abas Exercícios e Alimentos; todos os filtros vão à API (a lista vem cortada no limite), inclusive o "Na
 * biblioteca", que compara o nome como a importação.
 */
export function AbaCatalogo() {
  const { cores, bordas } = useTema();
  // Mesmo corte da `LinhaDaLista`: abaixo dele a linha empilha e o bloco usa a largura toda.
  const largo = useWindowDimensions().width >= LARGURA_MENU_LATERAL;
  const { avisar } = useAviso();
  const [tipo, setTipo] = useState<TipoBiblioteca>('exercicios');
  const [busca, setBusca] = useState('');
  const [filtrosEx, setFiltrosEx] = useState<FiltrosDoCatalogoDeExercicios>(SEM_FILTROS_DO_CATALOGO_DE_EXERCICIOS);
  const [filtrosAl, setFiltrosAl] = useState<FiltrosDoCatalogoDeAlimentos>(SEM_FILTROS_DO_CATALOGO_DE_ALIMENTOS);
  const [aberto, setAberto] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  // "Marque ao menos um" só depois de tocar em Importar sem nada marcado; marcar algo apaga.
  const [pediuSemMarcar, setPediuSemMarcar] = useState(false);
  const termo = useAtrasado(busca.trim(), 300);
  const grupos = useCarregar(`catalogo-grupos:${tipo}`, () => gruposDoCatalogo(tipo));
  const opcoesDeGrupo = (grupos.dados ?? []).map((g) => ({ valor: g, rotulo: g }));
  const exercicios = tipo === 'exercicios';
  // Só vale o grupo que a lista do tipo atual ainda tem (senão "Todos" na tela e 0 no servidor).
  const gruposDoFiltro = [...marcadosExistentes(opcoesDeGrupo, exercicios ? filtrosEx.grupos : filtrosAl.grupos)].sort();
  const aplicadosEx = { ...filtrosEx, grupos: new Set(gruposDoFiltro) };
  const aplicadosAl = { ...filtrosAl, grupos: new Set(gruposDoFiltro) };
  const chips = exercicios ? chipsDoCatalogoDeExercicios(aplicadosEx, opcoesDeGrupo) : chipsDoCatalogoDeAlimentos(aplicadosAl, opcoesDeGrupo);
  const modalidades = ORDEM_DAS_MODALIDADES.filter((m) => filtrosEx.modalidades.has(m));
  const imagem = midiaParaApi(filtrosEx.imagem);
  const unidades = UNIDADES_DO_CATALOGO.map((u) => u.valor).filter((u) => filtrosAl.unidades.has(u));
  const naBiblioteca = naBibliotecaParaApi(exercicios ? filtrosEx.naBiblioteca : filtrosAl.naBiblioteca);
  const chave = JSON.stringify(exercicios ? ['catalogo', tipo, termo, gruposDoFiltro, modalidades, imagem, naBiblioteca] : ['catalogo', tipo, termo, gruposDoFiltro, unidades, naBiblioteca]);
  const { dados, erro, carregando, recarregar } = useCarregar(chave, async (): Promise<PaginaDoCatalogo> => exercicios
    ? { tipo: 'exercicios', ...(await catalogoExercicios({ texto: termo, grupos: gruposDoFiltro, modalidades, imagem, naBiblioteca })) }
    : { tipo: 'alimentos', ...(await catalogoAlimentos({ texto: termo, grupos: gruposDoFiltro, unidades, naBiblioteca })) });

  const alternar = (id: string) => {
    setPediuSemMarcar(false);
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };
  const limparFiltros = () => (exercicios ? setFiltrosEx(SEM_FILTROS_DO_CATALOGO_DE_EXERCICIOS) : setFiltrosAl(SEM_FILTROS_DO_CATALOGO_DE_ALIMENTOS));

  const importar = () => {
    if (marcados.size === 0) {
      setPediuSemMarcar(true);
      return;
    }
    setImportando(true);
    importarDoCatalogo(tipo, [...marcados]).then(
      (r) => {
        setImportando(false);
        setMarcados(new Set());
        // O selo "Já na biblioteca" vem da API: a lista volta com os importados marcados.
        recarregar();
        avisar(`${plural(r.importados, 'importado', 'importados')}${r.ignorados ? `, ${plural(r.ignorados, 'já estava', 'já estavam')} na biblioteca` : ''}.`, 'sucesso');
      },
      (e: unknown) => {
        setImportando(false);
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  /** Começo da linha (caixa e, nos exercícios, a foto) e o toque nos textos: o que já está na biblioteca não se escolhe. */
  const marcacao = (id: string, nome: string, jaTem: boolean, foto: ReactNode) => ({
    selos: jaTem ? [{ texto: 'Já na biblioteca', tipo: 'neutro' as const }] : undefined,
    marcado: !jaTem && marcados.has(id),
    // A foto é irmã (não filha) da caixa e do toque que marca: tocar nela só amplia.
    inicio: (
      <View style={estilos.inicio}>
        {jaTem ? <CaixaJaNaBiblioteca nome={nome} /> : <CaixaDaLinha rotulo={nome} marcado={marcados.has(id)} aoMudar={() => alternar(id)} />}
        {foto}
      </View>
    ),
    aoTocarTextos: jaTem ? undefined : () => alternar(id),
  });

  const linhaDoExercicio = (e: CatalogoExercicio) => {
    const passos = passosDasInstrucoes(e.instrucoes);
    const expandido = aberto === e.id;
    return (
      <LinhaDaLista key={e.id} titulo={e.nome}
        valores={<DetalheDoExercicio exercicio={{ modalidade: e.modalidade, grupoMuscular: e.grupoMuscular, equipamento: equipamentoDoCatalogo(e.modalidade, e.equipamento), videoUrl: null, imagemPropriaEm: null, imagens: e.imagens }} />}
        // Exercício sem foto reserva a caixa (ícone), para o título alinhar com os que têm.
        {...marcacao(e.id, e.nome, !!e.naBiblioteca, <DemonstracaoDoExercicio exercicioId={null} nome={e.nome} imagens={e.imagens} papel="EQUIPE" largura={LADO_DA_MINIATURA} altura={LADO_DA_MINIATURA} preencher ampliavel reservarEspaco />)}
        // Um controle só, sempre no mesmo lugar: recolher não tira o foco da pessoa (um segundo "Recolher" dentro do
        // bloco sumiria com o foco ao fechar).
        acoes={passos.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: expandido }}
            aria-expanded={expandido}
            accessibilityLabel={`${expandido ? 'Recolher' : 'Ver'} instruções de ${e.nome}`}
            {...(Platform.OS === 'web' && expandido ? ({ 'aria-controls': `instrucoes-${e.id}` } as object) : {})}
            onPress={() => setAberto(expandido ? null : e.id)}
            // Hover em `superficie2`: a linha aberta já está em `superficie3` e o realce sumiria nela.
            style={(estado) => [estilos.verInstrucoes, { backgroundColor: sobre(estado) ? cores.superficie2 : 'transparent' }]}>
            <Texto style={estilos.rotuloDoControle}>{expandido ? 'Recolher instruções' : 'Ver instruções'}</Texto>
            {expandido ? <ChevronUp size={18} color={cores.texto} /> : <ChevronDown size={18} color={cores.texto} />}
          </Pressable>
        ) : undefined}>
        {expandido ? (
          <View nativeID={`instrucoes-${e.id}`} role="region" aria-label={`Instruções de execução de ${e.nome}`}
            style={[estilos.instrucoes, { marginLeft: largo ? RECUO_DO_TITULO : RECUO_DA_LINHA, backgroundColor: cores.superficie2, borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
            <Texto variante="subtitulo">Instruções de execução</Texto>
            <View role="list" style={estilos.passos}>
              {passos.map((p, i) => (
                <View key={i} role="listitem" style={estilos.passo}>
                  {/* A fonte não numera os passos (um por linha): o número é a ordem e fica na coluna própria. */}
                  <Texto variante="pequeno" numerico style={estilos.numero}>{`${i + 1}.`}</Texto>
                  <Texto style={estilos.textoDoPasso}>{p}</Texto>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </LinhaDaLista>
    );
  };

  // A linha da aba Alimentos: valores (com "Tr" onde a TACO marca traço) e, embaixo, grupo e fatores.
  const linhaDoAlimento = (a: CatalogoAlimento) => (
    <LinhaDaLista key={a.id} titulo={a.nome} valores={<ValoresDoAlimento alimento={a} tracos={a.tracos} />} descricao={descricaoDoAlimento(a) ?? undefined}
      {...marcacao(a.id, a.nome, !!a.naBiblioteca, null)} />
  );

  const filtroNaBiblioteca = (valor: FiltroNaBiblioteca, mudar: (v: FiltroNaBiblioteca) => void) =>
    <UmaOpcao rotulo="Na biblioteca" valor={valor} opcoes={OPCOES_NA_BIBLIOTECA} aoMudar={mudar} />;
  const buscaDaBarra = { rotulo: 'Buscar no catálogo', placeholder: exercicios ? 'Nome do exercício' : 'Nome do alimento', valor: busca, aoMudar: setBusca };
  const painel = { titulo: 'Filtros do catálogo' };
  const itens = dados?.itens ?? [];

  return (
    <Cartao
      titulo="Catálogo público"
      descricao="Só leitura. Marque o que quer e importe para a sua biblioteca; o que já está nela (mesmo nome) aparece marcado como “Já na biblioteca”."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR">
        <View style={estilos.acaoDoImportar}>
          <Botao rotulo={`Importar selecionados (${marcados.size})`} Icone={Download} carregando={importando} aoTocar={importar} />
          {/* Sempre montado (vazio quando não há o que dizer): o leitor de tela anuncia quando o texto aparece. */}
          <Texto variante="pequeno" accessibilityLiveRegion="polite" style={estilos.avisoDoImportar}>
            {pediuSemMarcar && marcados.size === 0 ? 'Marque ao menos um item para importar.' : ''}
          </Texto>
        </View>
      </Permitido>}>
      <Escolha
        descricao="Catálogo"
        opcoes={[
          { valor: 'exercicios', rotulo: 'Exercícios' },
          { valor: 'alimentos', rotulo: 'Alimentos' },
        ]}
        valor={tipo}
        aoMudar={(t) => {
          setTipo(t);
          setAberto(null);
          setMarcados(new Set());
          setPediuSemMarcar(false);
        }}
      />
      {exercicios ? (
        <BarraDeFiltros busca={buscaDaBarra} valor={aplicadosEx} aoAplicar={setFiltrosEx} limpo={SEM_FILTROS_DO_CATALOGO_DE_EXERCICIOS} chips={chips}
          aoTirar={(c) => setFiltrosEx(semOFiltroDoCatalogoDeExercicios(aplicadosEx, c))} painelLateral={painel}
          seletores={(atual, mudar) => (
            <>
              {/* Sem o Vídeo: o catálogo não tem vídeo (o filtro nunca acharia nada). */}
              <SeletoresDeExercicios atual={atual} mudar={mudar} opcoesDeGrupo={opcoesDeGrupo} opcoesDeModalidades={OPCOES_DE_MODALIDADE} comVideo={false} />
              {filtroNaBiblioteca(atual.naBiblioteca, (v) => mudar({ ...atual, naBiblioteca: v }))}
            </>
          )} />
      ) : (
        <BarraDeFiltros busca={buscaDaBarra} valor={aplicadosAl} aoAplicar={setFiltrosAl} limpo={SEM_FILTROS_DO_CATALOGO_DE_ALIMENTOS} chips={chips}
          aoTirar={(c) => setFiltrosAl(semOFiltroDoCatalogoDeAlimentos(aplicadosAl, c))} painelLateral={painel}
          seletores={(atual, mudar) => (
            <>
              {opcoesDeGrupo.length > 0 ? (
                <SelecaoMultiplaSuspensa rotulo="Grupo" rotuloDeTodos="Todos os grupos" rotuloDaBusca="Buscar grupo" opcoes={opcoesDeGrupo} marcados={atual.grupos}
                  aoMudar={(m) => mudar({ ...atual, grupos: m })} style={estilos.cheio} />
              ) : null}
              <SelecaoMultiplaSuspensa rotulo="Unidade" rotuloDeTodos="Todas as unidades" opcoes={UNIDADES_DO_CATALOGO} marcados={atual.unidades}
                aoMudar={(m) => mudar({ ...atual, unidades: m })} style={estilos.cheio} />
              {filtroNaBiblioteca(atual.naBiblioteca, (v) => mudar({ ...atual, naBiblioteca: v }))}
            </>
          )} />
      )}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && itens.length === 0 ? <Vazio titulo="Nenhum resultado no catálogo" texto="Tente outro nome ou ajuste os filtros."
        acao={chips.length ? { rotulo: 'Limpar filtros', aoTocar: limparFiltros } : busca ? { rotulo: 'Limpar busca', aoTocar: () => setBusca('') } : undefined} /> : null}
      {dados?.tipo === 'exercicios' && dados.itens.length ? (
        <>
          <LegendaDasModalidades modalidades={modalidadesExistentes(dados.itens)} />
          <ListaEmColunas divisorias>{dados.itens.map(linhaDoExercicio)}</ListaEmColunas>
        </>
      ) : null}
      {dados?.tipo === 'alimentos' && dados.itens.length ? (
        <>
          <LegendaDosAlimentos comTraco={dados.itens.some(temTracoNaLinha)} />
          <ListaEmColunas divisorias>{dados.itens.map(linhaDoAlimento)}</ListaEmColunas>
        </>
      ) : null}
      {dados && textoMostrando(itens.length, dados.total) ? (
        <Texto variante="pequeno" accessibilityLiveRegion="polite">{textoMostrando(itens.length, dados.total)}</Texto>
      ) : null}
      <View style={estilos.creditos}>
        <Texto variante="suave">{exercicios ? CREDITOS_CATALOGO.exercicios : CREDITOS_CATALOGO.alimentos}</Texto>
      </View>
    </Cartao>
  );
}

/**
 * A caixa de quem já está na biblioteca: desabilitada (apagada, só ela: o texto da linha segue legível), com o motivo no
 * nome acessível e, na web, na dica do navegador (`title`, que o react-native-web não repassa: vai pelo nó).
 */
function CaixaJaNaBiblioteca({ nome }: { nome: string }) {
  const no = useRef<View>(null);
  useEffect(() => {
    const el: unknown = no.current;
    if (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement) el.title = DICA_JA_NA_BIBLIOTECA;
  }, []);
  return (
    <View ref={no} style={estilos.caixaDesabilitada}>
      <CaixaDaLinha rotulo={`${nome}, já na biblioteca`} marcado={false} aoMudar={() => undefined} desabilitado />
    </View>
  );
}

const LADO_DA_MINIATURA = 56;
/** Recuo interno da `LinhaDaLista` (padding da linha). */
const RECUO_DA_LINHA = espaco(1.5);
/** Onde começa o nome do exercício: padding, caixa, espaço, miniatura e o espaço até os textos (`LinhaDaLista`). */
const RECUO_DO_TITULO = RECUO_DA_LINHA + ALVO_TOQUE + espaco(1) + LADO_DA_MINIATURA + espaco(1.5);
/** Cerca de 70 caracteres em 15 px: a linha longa cansa a leitura no PC. */
const LARGURA_DE_LEITURA = 640;

const estilos = StyleSheet.create({
  inicio: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  verInstrucoes: { minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingHorizontal: espaco(1.5), borderRadius: RAIO_CONTROLE },
  rotuloDoControle: { fontFamily: fontes.semi },
  // Controle desabilitado: a caixa apagada diz "não dá para marcar" (o selo ao lado diz o porquê).
  caixaDesabilitada: { opacity: 0.4 },
  // O aviso colado sob o botão, alinhado à mesma borda (P5).
  acaoDoImportar: { alignItems: 'flex-end', gap: espaco(0.5) },
  avisoDoImportar: { textAlign: 'right' },
  cheio: { alignSelf: 'stretch' },
  instrucoes: { marginRight: RECUO_DA_LINHA, marginBottom: RECUO_DA_LINHA, padding: espaco(2), gap: espaco(1.5), borderRadius: RAIO },
  passos: { gap: espaco(1.25), maxWidth: LARGURA_DE_LEITURA },
  passo: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(1) },
  // Coluna fixa, número à direita: "9." e "10." terminam no mesmo ponto e o texto começa sempre na mesma linha.
  // `minWidth`: com o texto ampliado nas preferências o número cresce em vez de cortar.
  numero: { minWidth: espaco(3), flexShrink: 0, textAlign: 'right' },
  textoDoPasso: { flex: 1 },
  creditos: { marginTop: espaco(2) },
});
