import { Permitido } from '../../ui/Permitido';
import { Check, ChevronDown, ChevronUp, Download } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { catalogoAlimentos, catalogoExercicios, gruposDoCatalogo, importarDoCatalogo, listarAlimentos, listarExercicios, type TipoBiblioteca } from '../../api/rotas';
import { CREDITOS_CATALOGO, passosDasInstrucoes, resumoNutrientes, textoMostrando } from '../../dominio/catalogo';
import { textoDosFatores } from '../../dominio/fatoresDoAlimento';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { CaixaDaLinha, LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { MODALIDADES } from '../../dominio/modalidades';
import { normalizar } from '../treino/FolhaBiblioteca';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { marcadosExistentes } from '../../dominio/selecaoMultiplaSuspensa';
import { BarraDaBiblioteca } from './BarraDaBiblioteca';

interface ItemCatalogo {
  id: string;
  nome: string;
  detalhe: string;
  /** Passos de execução (só exercícios; a fonte já vem em português). */
  passos: string[];
  /** Fotos do catálogo (`<id>/0.jpg`); vazio nos alimentos. */
  imagens: string[];
  /** "FC 1,75" quando o catálogo de alimentos traz fator; vazio nos exercícios. */
  fatores: string | null;
}

interface ListaCatalogo {
  itens: ItemCatalogo[];
  total: number;
}

/** Catálogo público (só leitura): marcar vários e importar para a biblioteca da consultoria. */
export function AbaCatalogo() {
  const { cores, bordas } = useTema();
  // Mesmo corte da `LinhaDaLista`: abaixo dele a linha empilha e o bloco usa a largura toda.
  const largo = useWindowDimensions().width >= LARGURA_MENU_LATERAL;
  const { avisar } = useAviso();
  const [tipo, setTipo] = useState<TipoBiblioteca>('exercicios');
  const [busca, setBusca] = useState('');
  const [gruposMarcados, setGruposMarcados] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const termo = useAtrasado(busca.trim(), 300);
  const grupos = useCarregar(`catalogo-grupos:${tipo}`, () => gruposDoCatalogo(tipo));
  const opcoesDeGrupo = (grupos.dados ?? []).map((g) => ({ valor: g, rotulo: g }));
  // Só vale o que a lista de grupos do tipo atual ainda tem (trocar Exercícios/Alimentos não deixa filtro escondido).
  const gruposDoFiltro = [...marcadosExistentes(opcoesDeGrupo, gruposMarcados)].sort();
  const { dados, erro, carregando, recarregar } = useCarregar(
    `catalogo:${tipo}:${gruposDoFiltro.join('|')}:${termo}`,
    async (): Promise<ListaCatalogo> => {
      if (tipo === 'exercicios') {
        const r = await catalogoExercicios(termo, gruposDoFiltro);
        return {
          total: r.total,
          itens: r.itens.map((e) => ({
            id: e.id,
            nome: e.nome,
            // Sem repetir ("Peso corporal · Abdômen · Peso corporal": modalidade e equipamento iguais).
            detalhe: [...new Set([MODALIDADES[e.modalidade] ?? e.modalidade, e.grupoMuscular, e.equipamento].filter(Boolean))].join(' · '),
            passos: passosDasInstrucoes(e.instrucoes),
            imagens: e.imagens,
            fatores: null,
          })),
        };
      }
      const r = await catalogoAlimentos(termo, gruposDoFiltro);
      return {
        total: r.total,
        itens: r.itens.map((a) => ({
          id: a.id,
          nome: a.nome,
          detalhe: [a.grupo, resumoNutrientes(a)].filter(Boolean).join(' · '),
          passos: [],
          imagens: [],
          fatores: textoDosFatores(a),
        })),
      };
    },
  );

  // O que já está na biblioteca (mesmo nome, como a importação compara) aparece marcado e não se escolhe de novo.
  const daBiblioteca = useCarregar(tipo === 'exercicios' ? 'biblioteca-exercicios' : 'biblioteca-alimentos', (): Promise<{ nome: string }[]> => tipo === 'exercicios' ? listarExercicios() : listarAlimentos());
  const nomesNaBiblioteca = new Set((daBiblioteca.dados ?? []).map((x) => normalizar(x.nome.trim())));
  const alternar = (id: string) =>
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const importar = () => {
    setImportando(true);
    importarDoCatalogo(tipo, [...marcados]).then(
      (r) => {
        setImportando(false);
        setMarcados(new Set());
        daBiblioteca.recarregar();
        avisar(`${r.importados} importado(s)${r.ignorados ? `, ${r.ignorados} já estava(m) na biblioteca` : ''}.`, 'sucesso');
      },
      (e: unknown) => {
        setImportando(false);
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  return (
    <Cartao
      titulo="Catálogo público"
      descricao="Só leitura. Marque o que quer e importe para a sua biblioteca; os que já estão nela (mesmo nome) são ignorados."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><Botao
        rotulo={`Importar selecionados (${marcados.size})`}
        Icone={Download}
        carregando={importando}
        desabilitado={marcados.size === 0}
        motivo="Marque ao menos um item para importar."
        aoTocar={importar}
      /></Permitido>}>
      <Escolha
        descricao="Catálogo"
        opcoes={[
          { valor: 'exercicios', rotulo: 'Exercícios' },
          { valor: 'alimentos', rotulo: 'Alimentos' },
        ]}
        valor={tipo}
        aoMudar={(t) => {
          setTipo(t);
          setGruposMarcados(new Set());
          setAberto(null);
          setMarcados(new Set());
        }}
      />
      <BarraDaBiblioteca rotulo="Buscar no catálogo" placeholder={tipo === 'exercicios' ? 'Nome do exercício' : 'Nome do alimento'} valor={busca} aoMudar={setBusca}
        filtro={opcoesDeGrupo.length ? { tipo: 'varias', rotulo: 'Grupo', rotuloDeTodos: 'Todos', opcoes: opcoesDeGrupo, marcados: new Set(gruposDoFiltro), aoMudar: setGruposMarcados } : null} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? <Vazio titulo="Nenhum resultado no catálogo" texto="Tente outro nome ou ajuste o filtro de grupo." /> : null}
      {dados && dados.itens.length > 0 ? <ListaDeLinhas divisorias>{dados.itens.map((item) => {
        const sel = marcados.has(item.id);
        const expandido = aberto === item.id;
        const jaTem = nomesNaBiblioteca.has(normalizar(item.nome.trim()));
        const fatores = item.fatores ?? '';
        return (
          <LinhaDaLista key={item.id} titulo={item.nome} metadados={item.detalhe} descricao={fatores || undefined}
            selos={jaTem ? [{ texto: 'Já na biblioteca', tipo: 'neutro' }] : undefined}
            marcado={sel}
            // A foto é irmã (não filha) da caixa e do toque que marca: tocar nela só amplia.
            inicio={<View style={estilos.inicio}>
              {/* Já importado não se escolhe: no lugar da caixa, o ✓ neutro do que já foi feito (sem opacidade, o texto
                  segue legível); o selo "Já na biblioteca" diz o porquê. */}
              {jaTem ? <View style={estilos.jaNaBiblioteca} aria-hidden><Check size={18} color={cores.textoSuave} strokeWidth={2.5} /></View>
                : <CaixaDaLinha rotulo={item.nome} marcado={sel} aoMudar={() => alternar(item.id)} />}
              {/* Exercício sem foto reserva a caixa (ícone), para o título alinhar com os que têm; alimento não tem miniatura. */}
              {tipo === 'exercicios' ? <DemonstracaoDoExercicio exercicioId={null} nome={item.nome} imagens={item.imagens} papel="EQUIPE" largura={LADO_DA_MINIATURA} altura={LADO_DA_MINIATURA} preencher ampliavel reservarEspaco /> : null}
            </View>}
            aoTocarTextos={jaTem ? undefined : () => alternar(item.id)}
            // Um controle só, sempre no mesmo lugar: recolher não tira o foco da pessoa (um segundo "Recolher" dentro do
            // bloco sumiria com o foco ao fechar).
            acoes={item.passos.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: expandido }}
                aria-expanded={expandido}
                accessibilityLabel={`${expandido ? 'Recolher' : 'Ver'} instruções de ${item.nome}`}
                {...(Platform.OS === 'web' && expandido ? ({ 'aria-controls': `instrucoes-${item.id}` } as object) : {})}
                onPress={() => setAberto(expandido ? null : item.id)}
                // Hover em `superficie2`: a linha aberta já está em `superficie3` e o realce sumiria nela.
                style={(estado) => [estilos.verInstrucoes, { backgroundColor: sobre(estado) ? cores.superficie2 : 'transparent' }]}>
                <Texto style={estilos.rotuloDoControle}>{expandido ? 'Recolher instruções' : 'Ver instruções'}</Texto>
                {expandido ? <ChevronUp size={18} color={cores.texto} /> : <ChevronDown size={18} color={cores.texto} />}
              </Pressable>
            ) : undefined}>
            {expandido ? (
              <View nativeID={`instrucoes-${item.id}`} role="region" aria-label={`Instruções de execução de ${item.nome}`}
                style={[estilos.instrucoes, { marginLeft: largo ? RECUO_DO_TITULO : RECUO_DA_LINHA, backgroundColor: cores.superficie2, borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
                <Texto variante="subtitulo">Instruções de execução</Texto>
                <View role="list" style={estilos.passos}>
                  {item.passos.map((p, i) => (
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
      })}</ListaDeLinhas> : null}
      {dados && textoMostrando(dados.itens.length, dados.total) ? (
        <Texto variante="pequeno" accessibilityLiveRegion="polite">{textoMostrando(dados.itens.length, dados.total)}</Texto>
      ) : null}
      <View style={estilos.creditos}>
        <Texto variante="suave">{tipo === 'alimentos' ? CREDITOS_CATALOGO.alimentos : CREDITOS_CATALOGO.exercicios}</Texto>
      </View>
    </Cartao>
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
  jaNaBiblioteca: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
  instrucoes: { marginRight: RECUO_DA_LINHA, marginBottom: RECUO_DA_LINHA, padding: espaco(2), gap: espaco(1.5), borderRadius: RAIO },
  passos: { gap: espaco(1.25), maxWidth: LARGURA_DE_LEITURA },
  passo: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(1) },
  // Coluna fixa, número à direita: "9." e "10." terminam no mesmo ponto e o texto começa sempre na mesma linha.
  // `minWidth`: com o texto ampliado nas preferências o número cresce em vez de cortar.
  numero: { minWidth: espaco(3), flexShrink: 0, textAlign: 'right' },
  textoDoPasso: { flex: 1 },
  creditos: { marginTop: espaco(2) },
  /** O seletor nasce com alignSelf flex-start; na barra (alinhada pela base) ele subia e ficava fora do lugar. */
});
