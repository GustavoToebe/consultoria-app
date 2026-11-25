import { Permitido } from '../../ui/Permitido';
import { Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useId, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { alterarAlimento, criarAlimento, gruposDoCatalogo, inativarAlimento, listarAlimentos } from '../../api/rotas';
import type { Alimento, AlimentoRequest, UnidadeAlimento } from '../../api/tipos';
import {
  AJUDA_FC,
  AJUDA_FCC,
  descricaoDosFatores,
  erroDoFatorCoccao,
  erroDoFatorCorrecao,
  estimarFatoresDoAlimento,
  PERFIS_FC,
  PERFIS_FCC,
  perfilFcDoValor,
  perfilFccDoValor,
  previaDeConversao,
} from '../../dominio/fatoresDoAlimento';
import { erroDaFibra, type Totais } from '../../dominio/dieta';
import { LEGENDA_DO_TRACO } from '../../dominio/catalogo';
import { mascaraDeNumero, numeroParaTela, SEM_DADO } from '../../dominio/formatos';
import { kcalDoAlimento, kcalDosMacros } from '../../dominio/kcalDosMacros';
import { chipDeVarias } from '../../dominio/filtrosDaBiblioteca';
import { grupoDoTexto, gruposDoCampo } from '../../dominio/gruposDaLista';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_FOLHA_LARGA, LARGURA_MENU_LATERAL, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { LinhaDaLista } from '../../ui/LinhaDaLista';
import { ListaEmColunas } from '../ListaEmColunas';
import { CampoDoMacro, FIBRA, gramasNaTela, kcalNaTela, LegendaDosMacros, MACROS, macroPorExtenso, MarcaDoMacro, ValoresDaDieta } from '../../ui/ValoresDaDieta';
import { normalizar } from '../treino/FolhaBiblioteca';
import { colunasDaGrade, larguraDaCelula, VAO_DA_GRADE, type ColunasDaGrade } from './gradeDoAlimento';

export const UNIDADES: { valor: UnidadeAlimento; rotulo: string }[] = [
  { valor: 'g', rotulo: 'g' },
  { valor: 'ml', rotulo: 'ml' },
  { valor: 'un', rotulo: 'un' },
];

const OPCOES_UNIDADE: { valor: UnidadeAlimento; rotulo: string }[] = [
  { valor: 'g', rotulo: 'Gramas (g)' },
  { valor: 'ml', rotulo: 'Mililitros (ml)' },
  { valor: 'un', rotulo: 'Unidade (un)' },
];

export const GRUPOS_PADRAO_ALIMENTOS: readonly string[] = [
  'Carnes e derivados',
  'Cereais e derivados',
  'Frutas e derivados',
  'Leite e derivados',
  'Leguminosas e derivados',
  'Gorduras e óleos',
  'Outros / Sem grupo',
];

interface FiltrosDeAlimentos {
  grupos: ReadonlySet<string>;
  unidades: ReadonlySet<string>;
  fontes: ReadonlySet<string>;
  coccao: ReadonlySet<string>;
}
const SEM_FILTROS: FiltrosDeAlimentos = { grupos: new Set(), unidades: new Set(), fontes: new Set(), coccao: new Set() };

const OPCOES_PREPARO = [
  { valor: 'DIRETO', rotulo: 'Direto / Cru (FCc = 1)' },
  { valor: 'HIDRATA', rotulo: 'Hidrata no cozimento (FCc > 1)' },
  { valor: 'REDUZ', rotulo: 'Reduz no preparo (FCc < 1)' },
];

/** O que a linha de valores do alimento lê: o da biblioteca e o do catálogo (este com `baseUnidade` em texto). */
interface ValoresDaLinha {
  baseQuantidade: number | null; baseUnidade: string | null; kcal: number | null; proteina: number | null; carboidrato: number | null;
  gordura: number | null; fibra?: number | null; porcao?: string | null;
}

/**
 * "Por 100 g" e os valores dessa quantidade pela peça do aluno (`ValoresDaDieta`: kcal e P, C e G com a marca da cor, guia
 * de 13/11 pág. 10). Sem kcal (suplemento sem tabela), a porção ou "—", como antes: nunca "— kcal" inventado. A fibra vem
 * depois dos macros, "Fibra —" quando o alimento não a tem (V089). A mesma linha na aba Alimentos, na folha de alimentos
 * da dieta e no catálogo; `tracos` (só o catálogo, da TACO) troca o número desses nutrientes por "Tr", nunca 0.
 */
export function ValoresDoAlimento({ alimento: a, tracos = [] }: { alimento: ValoresDaLinha; tracos?: readonly string[] }) {
  if (a.kcal == null) return <Texto variante="pequeno">{a.porcao?.trim() || '—'}</Texto>;
  const totais = { kcal: a.kcal, proteina: a.proteina, carboidrato: a.carboidrato, gordura: a.gordura, fibra: a.fibra ?? null };
  return (
    <View style={estilos.valoresDoAlimento}>
      <Texto variante="pequeno" numerico>{`Por ${numeroParaTela(a.baseQuantidade)} ${a.baseUnidade}`}</Texto>
      {tracos.length ? <ValoresComTraco totais={totais} tracos={tracos} /> : <ValoresDaDieta totais={totais} inicio />}
    </View>
  );
}

/**
 * Os valores com algum "Tr": o mesmo desenho da `ValoresDaDieta` (variante pequena, à esquerda), que só aceita número.
 * shortcut: espelha o desenho da peça de `ui/` só para o traço; trocar por uma prop `tracos` na `ValoresDaDieta` quando o
 * design system a aceitar (sugestão registrada na entrega de 24/11).
 */
function ValoresComTraco({ totais: t, tracos }: { totais: Totais & { fibra: number | null }; tracos: readonly string[] }) {
  const tela = (chave: string, v: number | null) => (tracos.includes(chave) ? 'Tr' : gramasNaTela(v));
  const porExtenso = (nome: string, chave: string, v: number | null) => (tracos.includes(chave) ? `${nome} traço` : macroPorExtenso(nome, v));
  return (
    <View style={estilos.linhaDosValores}>
      <Texto variante="pequeno" numerico>{`${kcalNaTela(t.kcal)} kcal`}</Texto>
      <View style={estilos.linhaDosValores}>
        {MACROS.map((m) => (
          <View key={m.chave} style={estilos.macro}>
            <MarcaDoMacro cor={m.cor} />
            <Texto variante="pequeno" numerico numberOfLines={1} aria-hidden>{`${m.curto} ${tela(m.chave, t[m.chave])}`}</Texto>
            <Texto style={estilos.soParaLeitor}>{porExtenso(m.nome, m.chave, t[m.chave])}</Texto>
          </View>
        ))}
      </View>
      <View style={estilos.macro}>
        <MarcaDoMacro cor={FIBRA.cor} />
        <Texto variante="pequeno" numerico numberOfLines={1} aria-hidden>{`Fibra ${tela(FIBRA.chave, t.fibra)}`}</Texto>
        <Texto style={estilos.soParaLeitor}>{porExtenso('fibra', FIBRA.chave, t.fibra)}</Texto>
      </View>
    </View>
  );
}

/** Legenda da lista de alimentos (aba Alimentos e catálogo): a dos macros com "■ Fibra" e, com algum "Tr" à vista, o que ele quer dizer. */
export function LegendaDosAlimentos({ comTraco = false }: { comTraco?: boolean }) {
  return (
    <View style={estilos.linhaDosValores}>
      <LegendaDosMacros />
      {comTraco ? <Texto variante="pequeno">{LEGENDA_DO_TRACO}</Texto> : null}
    </View>
  );
}

/** Tamanho do grupo do alimento (`GrupoDoAlimento.MAXIMO` na API). */
export const LIMITE_GRUPO_DO_ALIMENTO = 60;
/** Teto de cada macro, o mesmo do DTO da API (`@DecimalMax("99999")`). */
const MACRO_MAXIMO = 99999;

/** Grupo e a conversão de 100 g, ou "Peso direto" quando FC e FCc são 1. */
export function descricaoDoAlimento(a: Pick<Alimento, 'grupo' | 'fatorCorrecao' | 'fatorCoccao'>): string | null {
  return descricaoDosFatores(a);
}

/** Alimentos da consultoria com os valores por quantidade-base (digitados pelo treinador ou importados). */
export function AbaAlimentos() {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar('biblioteca-alimentos', () => listarAlimentos());
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<FiltrosDeAlimentos>(SEM_FILTROS);
  const [editando, setEditando] = useState<Alimento | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Alimento | null>(null);

  // Lista de grupos: padrão + grupos presentes na base da consultoria
  const gruposDosDados = (dados ?? [])
    .map((a) => a.grupo?.trim())
    .filter((g): g is string => !!g && g !== 'Outros itens' && g !== 'Outros / Sem grupo');
  const todosOsGrupos = Array.from(new Set([...GRUPOS_PADRAO_ALIMENTOS.filter((g) => g !== 'Outros / Sem grupo'), ...gruposDosDados]))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  todosOsGrupos.push('Outros / Sem grupo');
  const opcoesGrupos = todosOsGrupos.map((g) => ({ valor: g, rotulo: g }));

  // Lista de fontes presentes nos alimentos
  const temSemFonte = (dados ?? []).some((a) => !a.fonte || !a.fonte.trim());
  const fontesDosDados = Array.from(
    new Set((dados ?? []).map((a) => a.fonte?.trim()).filter((f): f is string => !!f))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const opcoesFontes = [
    ...fontesDosDados.map((f) => ({ valor: f, rotulo: f })),
    ...(temSemFonte || fontesDosDados.length === 0 ? [{ valor: '__SEM_FONTE__', rotulo: 'Sem fonte' }] : []),
  ];

  const classificarCoccao = (fcc: number | null | undefined): 'DIRETO' | 'HIDRATA' | 'REDUZ' => {
    const v = fcc ?? 1;
    if (Math.abs(v - 1) < 0.001) return 'DIRETO';
    return v > 1 ? 'HIDRATA' : 'REDUZ';
  };

  const termo = normalizar(busca.trim());
  const { grupos: gruposMarcados, unidades: unidadesMarcadas, fontes: fontesMarcadas, coccao: coccaoMarcadas } = filtros;
  const comFiltros = gruposMarcados.size + unidadesMarcadas.size + fontesMarcadas.size + coccaoMarcadas.size > 0;
  // Um chip por filtro, com a chave do filtro (o ✕ tira só aquele).
  const chips = [
    ...chipDeVarias('Grupo', gruposMarcados, opcoesGrupos).map((c) => ({ ...c, chave: 'grupos' })),
    ...chipDeVarias('Unidade', unidadesMarcadas, OPCOES_UNIDADE).map((c) => ({ ...c, chave: 'unidades' })),
    ...chipDeVarias('Fonte', fontesMarcadas, opcoesFontes).map((c) => ({ ...c, chave: 'fontes' })),
    ...chipDeVarias('Preparo', coccaoMarcadas, OPCOES_PREPARO).map((c) => ({ ...c, chave: 'coccao' })),
  ];

  const lista = (dados ?? []).filter((a) => {
    if (termo && !normalizar(a.nome).includes(termo)) return false;
    if (gruposMarcados.size > 0) {
      const g = a.grupo?.trim();
      const semGrupo = !g || g === 'Outros itens' || g === 'Outros / Sem grupo';
      if (semGrupo ? !gruposMarcados.has('Outros / Sem grupo') : !gruposMarcados.has(g)) return false;
    }
    if (unidadesMarcadas.size > 0 && (!a.baseUnidade || !unidadesMarcadas.has(a.baseUnidade))) return false;
    if (fontesMarcadas.size > 0) {
      const f = a.fonte?.trim();
      if (!f ? !fontesMarcadas.has('__SEM_FONTE__') : !fontesMarcadas.has(f)) return false;
    }
    if (coccaoMarcadas.size > 0 && !coccaoMarcadas.has(classificarCoccao(a.fatorCoccao))) return false;
    return true;
  });

  const confirmarInativar = () => {
    const alvo = inativar;
    setInativar(null);
    if (!alvo) return;
    inativarAlimento(alvo.id).then(
      () => {
        avisar(`“${alvo.nome}” saiu da biblioteca.`, 'sucesso');
        recarregar();
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  return (
    <Cartao
      titulo="Alimentos da biblioteca"
      descricao="Os alimentos que você escolhe ao montar a dieta, com os valores por quantidade-base."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><Botao rotulo="Novo alimento" Icone={Plus} aoTocar={() => setEditando('novo')} /></Permitido>}>
      <BarraDeFiltros busca={{ rotulo: 'Buscar alimento', placeholder: 'Nome do alimento', valor: busca, aoMudar: setBusca }}
        valor={filtros} aoAplicar={setFiltros} limpo={SEM_FILTROS} chips={chips}
        aoTirar={(chave) => setFiltros((f) => ({ ...f, [chave]: new Set<string>() }))} painelLateral={{ titulo: 'Filtros de alimentos' }}
        seletores={(atual, mudar) => (
          <>
            <SelecaoMultiplaSuspensa rotulo="Grupo" rotuloDeTodos="Todos os grupos" opcoes={opcoesGrupos} marcados={atual.grupos}
              aoMudar={(m) => mudar({ ...atual, grupos: m })} style={estilos.cheio} />
            <SelecaoMultiplaSuspensa rotulo="Unidade" rotuloDeTodos="Todas as unidades" opcoes={OPCOES_UNIDADE} marcados={atual.unidades}
              aoMudar={(m) => mudar({ ...atual, unidades: m })} style={estilos.cheio} />
            <SelecaoMultiplaSuspensa rotulo="Fonte" rotuloDeTodos="Todas as fontes" opcoes={opcoesFontes} marcados={atual.fontes}
              aoMudar={(m) => mudar({ ...atual, fontes: m })} style={estilos.cheio} />
            <SelecaoMultiplaSuspensa rotulo="Preparo" rotuloDeTodos="Todos os preparos" opcoes={OPCOES_PREPARO} marcados={atual.coccao}
              aoMudar={(m) => mudar({ ...atual, coccao: m })} style={estilos.cheio} />
          </>
        )} />
      {dados && lista.length && lista.length !== dados.length ? (
        <Texto variante="suave" numerico>{`${lista.length} de ${dados.length} alimentos`}</Texto>
      ) : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && lista.length === 0 ? (
        <Vazio
          titulo={dados.length ? 'Nenhum alimento encontrado' : 'Biblioteca de alimentos vazia'}
          texto={dados.length ? 'Tente outros termos de busca ou filtros.' : pode('BIBLIOTECA_ALTERAR') ? 'Importe do catálogo ou cadastre um alimento.' : 'Ainda não há itens cadastrados.'}
          acao={comFiltros ? { rotulo: 'Limpar filtros', aoTocar: () => setFiltros(SEM_FILTROS) } : dados.length ? { rotulo: 'Limpar busca', aoTocar: () => setBusca('') } : pode('BIBLIOTECA_ALTERAR') ? { rotulo: 'Cadastrar alimento', aoTocar: () => setEditando('novo') } : undefined}
        />
      ) : null}
      {lista.length ? <LegendaDosAlimentos /> : null}
      {lista.length ? <ListaEmColunas divisorias>{lista.map((a) => (
        <LinhaDaLista key={a.id} titulo={a.nome} valores={<ValoresDoAlimento alimento={a} />} descricao={descricaoDoAlimento(a) ?? undefined}
          acoesAoLado
          acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><IconeBotao Icone={Pencil} moldura rotulo={`Editar ${a.nome}`} aoTocar={() => setEditando(a)} /></Permitido>} />
      ))}</ListaEmColunas> : null}
      {editando ? (
        <FolhaAlimento
          inicial={editando === 'novo' ? null : editando}
          gruposDaConsultoria={(dados ?? []).map((a) => a.grupo)}
          aoTirar={editando === 'novo' ? undefined : () => { const alvo = editando; setEditando(null); setInativar(alvo); }}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
            avisar('Alimento salvo.', 'sucesso');
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={inativar !== null}
        titulo={`Tirar “${inativar?.nome ?? ''}” da biblioteca?`}
        mensagem="As dietas que já usam este alimento continuam com os valores gravados."
        rotuloConfirmar="Tirar da biblioteca"
        perigo
        aoConfirmar={confirmarInativar}
        aoCancelar={() => setInativar(null)}
      />
    </Cartao>
  );
}

/** Ajuda da fibra, numa linha só abaixo da grade dos macros; o campo de fibras aponta para ela. */
const NOTA_DA_FIBRA = 'Fibras são opcionais e não entram na kcal.';

interface Grade { largura: number; colunas: ColunasDaGrade }

/** Célula da grade do formulário: a largura de `ocupa` colunas; o que não cabe na linha desce, na mesma grade. */
function Celula({ grade, ocupa, style, children }: { grade: Grade; ocupa: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={[{ width: larguraDaCelula(grade.largura, grade.colunas, ocupa) }, style]}>{children}</View>;
}

function FolhaAlimento({ inicial, gruposDaConsultoria, aoFechar, aoSalvar, aoTirar }: {
  aoTirar?: () => void;
  inicial: Alimento | null;
  /** Grupos já usados na biblioteca, para as opções do campo Grupo. */
  gruposDaConsultoria: (string | null)[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { cores } = useTema();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [base, setBase] = useState<number | null>(inicial?.baseQuantidade ?? 100);
  const [unidade, setUnidade] = useState<UnidadeAlimento>(inicial?.baseUnidade ?? 'g');
  const [proteina, setProteina] = useState<number | null>(inicial?.proteina ?? null);
  const [carboidrato, setCarboidrato] = useState<number | null>(inicial?.carboidrato ?? null);
  const [gordura, setGordura] = useState<number | null>(inicial?.gordura ?? null);
  // Fibra (V089): opcional, vazia = nula ("—"), nunca zero; não entra na kcal.
  const [fibra, setFibra] = useState<number | null>(inicial?.fibra ?? null);
  const [gramas, setGramas] = useState<number | null>(inicial?.gramasPorUnidade ?? null);
  const [fonte, setFonte] = useState(inicial?.fonte ?? '');
  const [fc, setFc] = useState<number | null>(inicial?.fatorCorrecao ?? null);
  const [fcc, setFcc] = useState<number | null>(inicial?.fatorCoccao ?? null);
  const [grupo, setGrupo] = useState(inicial?.grupo ?? '');
  // No alimento novo a sugestão acompanha o nome. Na edição, só depois de "Sugerir pelo nome", até a pessoa escolher um perfil ou digitar o número.
  const [tocouFatores, setTocouFatores] = useState(inicial !== null);
  // "Personalizado" escolhido com um número igual ao de um perfil: o campo do número continua aberto até escolher um perfil.
  const [fcLivre, setFcLivre] = useState(false);
  const [fccLivre, setFccLivre] = useState(false);
  // Grupos do catálogo público como opção; sem eles (erro ou sem rede), só os da consultoria (e o digitado).
  const doCatalogo = useCarregar('grupos-catalogo-alimentos', () => gruposDoCatalogo('alimentos'));
  const grupos = gruposDoCampo(gruposDaConsultoria, doCatalogo.dados ?? [], grupo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);
  // C48/D15: a kcal não é digitada. Com os três macros é a conta deles; com um, dois ou nenhum (alimento só com caloria,
  // como o do Batel Grill) fica a da fonte, só para leitura, ou "—" se não havia. Macros são opcionais; só as faixas travam.
  const kcalDosMacrosDigitados = kcalDosMacros(proteina, carboidrato, gordura);
  const kcal = kcalDoAlimento(proteina, carboidrato, gordura, inicial?.kcal ?? null);
  const kcalDaFonte = kcalDosMacrosDigitados === null && kcal !== null;
  const rotuloDaKcal = kcalDaFonte ? 'Kcal (da fonte)' : 'Kcal (calculada)';
  const textoDaKcal = kcal === null ? SEM_DADO : numeroParaTela(kcal);
  const idDaNotaDaFibra = useId();
  // Grade pela largura do conteúdo do cartão. Antes da primeira medida, a estimativa pela janela (folha de até 800 no PC,
  // folha de baixo no celular, menos as margens) evita o salto de layout ao abrir.
  const { width: janela } = useWindowDimensions();
  const [larguraMedida, setLarguraMedida] = useState<number | null>(null);
  const largura = larguraMedida ?? (janela >= LARGURA_MENU_LATERAL ? Math.min(janela - espaco(4), LARGURA_FOLHA_LARGA) - 76 : janela - 68);
  const grade: Grade = { largura, colunas: colunasDaGrade(largura) };
  const g5 = grade.colunas === 5;
  const sugerido = estimarFatoresDoAlimento(nome, grupo, kcal, base, unidade);
  const fcMostrado = tocouFatores ? fc : sugerido.fatorCorrecao;
  const fccMostrado = tocouFatores ? fcc : sugerido.fatorCoccao;
  const erroFc = erroDoFatorCorrecao(fcMostrado);
  const erroFcc = erroDoFatorCoccao(fccMostrado);
  const macroForaDaFaixa = [proteina, carboidrato, gordura].some((m) => m !== null && (m < 0 || m > MACRO_MAXIMO));
  const erroFibra = erroDaFibra(fibra);
  const pendencia = !nome.trim() ? 'Informe o nome do alimento.'
    : !base ? 'Informe a quantidade-base.'
      : macroForaDaFaixa ? 'Confira os macros: de 0 a 99.999 g.'
        : erroFibra ? 'Confira as fibras: de 0 a 99.999 g.'
          : erroFc || erroFcc ? 'Confira os fatores do alimento.' : null;

  const sugerirPeloNome = () => { setTocouFatores(false); setFcLivre(false); setFccLivre(false); };
  const perfilFc = fcLivre ? 'PERSONALIZADO' : perfilFcDoValor(fcMostrado);
  const perfilFcc = fccLivre ? 'PERSONALIZADO' : perfilFccDoValor(fccMostrado);
  const travarFatores = () => { setFc(fcMostrado); setFcc(fccMostrado); setTocouFatores(true); };
  const escolherFc = (valor: number) => { setFc(valor); setFcc(fccMostrado); setTocouFatores(true); };
  const escolherFcc = (valor: number) => { setFc(fcMostrado); setFcc(valor); setTocouFatores(true); };
  // O número só aparece no "Personalizado" (ou com erro da API nele); nos perfis, o fator já está no nome.
  const numeroDoFc = perfilFc === 'PERSONALIZADO' || !!campos.fatorCorrecao;
  const numeroDoFcc = perfilFcc === 'PERSONALIZADO' || !!campos.fatorCoccao;
  const personalizado = (escolhido: boolean, valor: number | null) =>
    ({ valor: 'PERSONALIZADO', rotulo: escolhido && valor !== null ? `Personalizado (${numeroParaTela(valor)})` : 'Personalizado', detalhe: 'Digite o fator' });

  const salvar = () => {
    if (pendencia || !base) return;
    const dados: AlimentoRequest = {
      nome: nome.trim(),
      baseQuantidade: base,
      baseUnidade: unidade,
      kcal: null, // o servidor deriva dos macros (C48/D15); enviar o valor só faria a validação do DTO falhar sem campo na tela
      proteina,
      carboidrato,
      gordura,
      fibra, // sempre no corpo (nula quando vazia): sem a chave, editar apagaria a fibra gravada
      gramasPorUnidade: gramas,
      fonte: fonte.trim() || null,
      fatorCorrecao: fcMostrado,
      fatorCoccao: fccMostrado,
      grupo: grupo.replace(/\s+/g, ' ').trim() || null,
    };
    setSalvando(true);
    setErro(null);
    (inicial ? alterarAlimento(inicial.id, dados) : criarAlimento(dados)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      largura={LARGURA_FOLHA_LARGA}
      titulo={inicial ? 'Editar alimento' : 'Novo alimento'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!!pendencia} motivo={pendencia ?? undefined} />
        </>
      }>
      {/* Cada parte é um cartão com faixa de título (padrão da Folha da inscrição): onde começa e onde termina, sem
          depender da cor. 24 px entre os blocos. As escolhas vão direto, sem `FaixaDeChips`: a `Escolha` já quebra
          linha, e dentro da faixa ela ficava numa fileira só, cortada na borda da folha. */}
      <View style={estilos.partes}>
        <Cartao titulo="Identificação" nivel={3}>
          {/* Esta linha mede a largura do conteúdo do cartão; todos os cartões da folha têm a mesma, então a grade é uma só. */}
          <View style={estilos.linhaDaGrade} onLayout={(e) => setLarguraMedida(e.nativeEvent.layout.width)}>
            <Celula grade={grade} ocupa={g5 ? 3 : 2}>
              <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={160} />
            </Celula>
            <Celula grade={grade} ocupa={2}>
              <Campo rotulo="Fonte dos valores (opcional)" valor={fonte} aoMudar={setFonte} maxLength={200} placeholder="ex.: TACO, rótulo" />
            </Celula>
          </View>
          <View style={estilos.grupo}>
            {/* Um campo só: busca nos grupos da consultoria e do catálogo, aceita um grupo próprio ("Usar “…”") e
                "Sem grupo" limpa (vazio fica em "Outros itens"). */}
            <EscolhaSuspensa<string> rotulo="Grupo (opcional)" titulo="Grupo do alimento" valor={grupo} aoMudar={setGrupo}
              rotuloDaBusca="Buscar ou digitar um grupo" textoVazio="Nenhum grupo encontrado."
              opcoes={[{ valor: '', rotulo: 'Sem grupo', detalhe: 'Fica em “Outros itens” na lista de compras' }, ...grupos.map((g) => ({ valor: g, rotulo: g }))]}
              digitado={{
                maxLength: LIMITE_GRUPO_DO_ALIMENTO,
                opcao: (t) => { const g = grupoDoTexto(t, grupos); return g === null ? null : { valor: g, rotulo: `Usar “${g}”`, detalhe: 'Grupo novo' }; },
              }} />
            {campos.grupo ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{campos.grupo}</Texto> : null}
            <Texto variante="pequeno">Agrupa a lista de compras do aluno. Vazio fica em “Outros itens”.</Texto>
          </View>
        </Cartao>

        <Cartao titulo="Porção e macronutrientes" descricao="Como no rótulo ou na tabela nutricional." nivel={3}>
          {/* Uma linha só no modal largo (1 + 2 + 2 colunas, a Unidade começa onde começa a Proteína); no estreito, as
              Gramas descem. A Unidade tem duas colunas no largo: as três opções não cabem numa. */}
          <View style={estilos.linhaDaGrade}>
            <Celula grade={grade} ocupa={1}>
              <CampoNumerico rotulo="Quantidade-base" valor={base} aoMudar={setBase} erro={campos.baseQuantidade} />
            </Celula>
            <Celula grade={grade} ocupa={grade.colunas === 2 ? 1 : 2}>
              <Escolha rotulo="Unidade" opcoes={UNIDADES} valor={unidade} aoMudar={setUnidade} />
            </Celula>
            <Celula grade={grade} ocupa={2}>
              <CampoNumerico
                rotulo="Gramas por unidade (opcional)"
                valor={gramas}
                aoMudar={setGramas}
                ajuda={'Para usar em unidades (1 fatia = 25 g).'}
                erro={campos.gramasPorUnidade}
              />
            </Celula>
          </View>
          {/* Os macros dizem a que quantidade se referem: a ligação com a quantidade-base fica escrita. Sem `numerico` no
              sobretítulo: a fonte de números, na caixa alta de 12 px, cortava o pé das letras. */}
          <View style={[estilos.macros, { borderTopColor: cores.borda }]}>
            <View style={estilos.tituloDosValores}>
              <Texto variante="secao" style={estilos.textoDoTitulo}>{base ? `Valores por ${numeroParaTela(base)} ${unidade}` : 'Valores pela quantidade-base'}</Texto>
              {g5 ? null : (
                <View style={estilos.kcalNoTitulo} accessibilityLabel={`${rotuloDaKcal}: ${textoDaKcal}`}>
                  <Texto numerico style={estilos.forte}>{`${textoDaKcal} kcal`}</Texto>
                  <Texto variante="pequeno">{kcalDaFonte ? 'da fonte' : 'calculada'}</Texto>
                </View>
              )}
            </View>
            {/* Marca da cor só no rótulo (a mesma das listas e do aluno); a caixa e o número seguem neutros. A fibra tem a
                marca dela e o erro da API (422 no campo `fibra`) vence o local. */}
            <View style={estilos.linhaDaGrade}>
              {g5 ? (
                <Celula grade={grade} ocupa={1}>
                  {/* Só leitura e sem cara de campo: poço em `superficie2`, sem contorno, na altura da caixa ao lado. */}
                  <View style={estilos.kcalLida} accessibilityLabel={`${rotuloDaKcal}: ${textoDaKcal}`}>
                    <Texto variante="rotulo" cor={cores.texto} numberOfLines={1}>{rotuloDaKcal}</Texto>
                    <View style={[estilos.pocoDaKcal, { backgroundColor: cores.superficie2 }]}><Texto numerico>{textoDaKcal}</Texto></View>
                  </View>
                </Celula>
              ) : null}
              <Celula grade={grade} ocupa={1}>
                <CampoDoMacro macro={MACROS[0]} rotulo="Proteína (g)" valor={proteina} aoMudar={setProteina} erro={campos.proteina} />
              </Celula>
              <Celula grade={grade} ocupa={1}>
                <CampoDoMacro macro={MACROS[1]} rotulo="Carboidrato (g)" valor={carboidrato} aoMudar={setCarboidrato} erro={campos.carboidrato} />
              </Celula>
              <Celula grade={grade} ocupa={1}>
                <CampoDoMacro macro={MACROS[2]} rotulo="Gordura (g)" valor={gordura} aoMudar={setGordura} erro={campos.gordura} />
              </Celula>
              <Celula grade={grade} ocupa={1}>
                <CampoDoMacro macro={FIBRA} rotulo="Fibras (g)" valor={fibra} aoMudar={setFibra} mascara={(t) => mascaraDeNumero(t, 2)}
                  erro={campos.fibra ?? erroFibra} ajudaForaDoCampo={{ id: idDaNotaDaFibra, texto: NOTA_DA_FIBRA }} />
              </Celula>
            </View>
            {/* As duas notas da grade juntas, mais perto uma da outra do que da grade. */}
            <View style={estilos.notas}>
              {kcalDosMacrosDigitados === null ? <Texto variante="pequeno">Preencha os três para o app calcular a kcal.</Texto> : null}
              <Texto variante="pequeno" nativeID={idDaNotaDaFibra}>{NOTA_DA_FIBRA}</Texto>
            </View>
          </View>
        </Cartao>

        <Cartao titulo="Lista de compras" descricao="O nome sugere os fatores. Escolha um perfil, ou “Personalizado” para digitar o número." nivel={3}
          acoes={inicial ? <Botao rotulo="Sugerir pelo nome" tipo="secundario" aoTocar={sugerirPeloNome} /> : null}>
          {/* O fator está no nome do perfil; o "Personalizado" abre o número logo abaixo, já com o valor de agora. FC são
              cinco opções (sem busca); FCc, dez (com busca). FC e FCc um por linha, na largura toda (Gustavo, 24/11: lado a
              lado ficavam com alturas diferentes); no PC o valor cabe numa linha, e o limite de duas só vale no celular, para
              o nome longo do perfil não esconder o fator do fim. */}
          <View style={estilos.fatores}>
            <View style={estilos.fator}>
              <EscolhaSuspensa<string> rotulo="Descarte e limpeza antes do preparo (FC)" titulo="Descarte e limpeza (FC)" valor={perfilFc} semBusca linhasDoValor={2}
                opcoes={[...PERFIS_FC.map((p) => ({ valor: p.codigo as string, rotulo: p.rotulo })), personalizado(perfilFc === 'PERSONALIZADO', fcMostrado)]}
                aoMudar={(c) => { const perfil = PERFIS_FC.find((p) => p.codigo === c); setFcLivre(!perfil); if (perfil) escolherFc(perfil.valor); else travarFatores(); }} />
              {numeroDoFc ? (
                <CampoNumerico rotulo="Fator de correção (FC)" valor={fcMostrado} aoMudar={(v) => { setFc(v); setFcc(fccMostrado); setTocouFatores(true); }} ajuda={AJUDA_FC} erro={campos.fatorCorrecao ?? erroFc} />
              ) : null}
            </View>
            <View style={estilos.fator}>
              <EscolhaSuspensa<string> rotulo="Estado na dieta e cocção (FCc)" valor={perfilFcc} linhasDoValor={2}
                rotuloDaBusca="Buscar perfil" textoVazio="Nenhum perfil encontrado."
                opcoes={[...PERFIS_FCC.map((p) => ({ valor: p.codigo as string, rotulo: p.rotulo })), personalizado(perfilFcc === 'PERSONALIZADO', fccMostrado)]}
                aoMudar={(c) => { const perfil = PERFIS_FCC.find((p) => p.codigo === c); setFccLivre(!perfil); if (perfil) escolherFcc(perfil.valor); else travarFatores(); }} />
              {numeroDoFcc ? (
                <CampoNumerico rotulo="Fator de cocção (FCc)" valor={fccMostrado} aoMudar={(v) => { setFc(fcMostrado); setFcc(v); setTocouFatores(true); }} ajuda={AJUDA_FCC} erro={campos.fatorCoccao ?? erroFcc} />
              ) : null}
            </View>
          </View>
          {fcMostrado !== null && fccMostrado !== null && fccMostrado !== 0 ? (
            <View style={[estilos.exemplo, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
              <View style={estilos.iconeDoExemplo} aria-hidden><ShoppingCart size={18} color={cores.textoSuave} /></View>
              <Texto numerico style={estilos.textoDoExemplo}>{previaDeConversao(fcMostrado, fccMostrado)}</Texto>
            </View>
          ) : null}
        </Cartao>

        {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}

        {inicial && aoTirar ? (
          <Cartao>
            <View style={estilos.tirar}>
              <Texto variante="suave" style={estilos.textoDoTirar}>As dietas que já usam este alimento continuam com os valores gravados.</Texto>
              <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} />
            </View>
          </Cartao>
        ) : null}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  // Seletor no painel de filtros: a largura toda da coluna.
  cheio: { alignSelf: 'stretch' },
  // "Por 100 g" e os valores numa linha que quebra junta (no celular os macros descem inteiros).
  valoresDoAlimento: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  // As medidas da `ValoresDaDieta` à esquerda (`inicio`): o "Tr" não pode mudar o desenho da linha.
  linhaDosValores: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, minWidth: 0, justifyContent: 'flex-start', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  macro: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: espaco(0.5) },
  soParaLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  // 24 px entre os cartões da folha (seção 4.3 do design); dentro de cada cartão, os 16 px do próprio `Cartao`.
  partes: { gap: espaco(3) },
  // Linha da grade (`gradeDoAlimento`): células de largura medida e o mesmo vão nas duas direções, para as colunas baterem.
  linhaDaGrade: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: VAO_DA_GRADE },
  // Sobretítulo à esquerda e a kcal à direita; com a kcal comprida, ela desce inteira.
  tituloDosValores: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: espaco(2), rowGap: espaco(0.5) },
  textoDoTitulo: { flexShrink: 1 },
  kcalNoTitulo: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(0.75), flexShrink: 0 },
  forte: { fontFamily: fontes.monoSemi },
  // Rótulo e poço na mesma medida do `CampoDoMacro` ao lado (gap de 4 e caixa de 44), para as caixas ficarem alinhadas.
  kcalLida: { gap: espaco(0.5) },
  notas: { gap: espaco(0.5) },
  pocoDaKcal: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5), borderRadius: RAIO_CONTROLE },
  // Erro e ajuda colados no campo Grupo (8 px), não soltos no cartão; o mesmo no perfil do fator e no número dele.
  grupo: { gap: espaco(1) },
  fator: { gap: espaco(1) },
  // Entre FC e FCc o vão da grade (16): o mesmo de uma linha de campos para a outra nos cartões de cima.
  fatores: { gap: VAO_DA_GRADE },
  // Nível de dentro do cartão: divisor, não outro contorno (seção 5.1).
  macros: { gap: espaco(1.5), borderTopWidth: 1, paddingTop: espaco(2) },
  exemplo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5) },
  iconeDoExemplo: { flexShrink: 0, paddingTop: 2 },
  textoDoExemplo: { flexShrink: 1 },
  tirar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  textoDoTirar: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
});
