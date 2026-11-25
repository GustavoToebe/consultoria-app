import { useId, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { colunasPorCelula } from '../dominio/colunasPorCelula';
import type { Preferencias, TamanhoTexto } from '../dominio/preferencias';
import { fatorDoTexto } from '../dominio/preferencias';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { CLARO, CODIGOS_DA_COR_DE_ACAO, CODIGOS_PALETAS_VISIVEIS, coresDaAcao, ESCURO, espaco, fontes, misturar, NOMES_DA_COR_DE_ACAO, PALETAS, paletaDe, RAIO, RAIO_CONTROLE, type Cores, type FaixaDeLargura } from '../tema/tokens';
import { Alvenaria } from './Alvenaria';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Switch } from '../components/ui/switch';
import { Escolha } from './Escolha';
import { Grade } from './Grade';
import { LinhaDeConfiguracao, SecaoDeConfiguracao } from './LinhaDeConfiguracao';
import { OpcaoCartao } from './OpcaoCartao';
import { PainelConfirmacao } from './PainelConfirmacao';
import { SeloEditando } from './SeloEditando';
import { useFaixaDaTela } from './Tela';
import { Texto } from './Texto';

const TAMANHOS: { valor: TamanhoTexto; rotulo: string }[] = [
  { valor: 'PADRAO', rotulo: 'Padrão' },
  { valor: 'MEDIO', rotulo: 'Médio' },
  { valor: 'GRANDE', rotulo: 'Grande' },
  { valor: 'EXTRA', rotulo: 'Extra' },
];

/** Teto de cada coluna nas Ajustes do treinador (a tela soma duas e o vão; `app/treinador/ajustes.tsx`). */
export const LARGURA_DA_COLUNA = 720;
const VAO = espaco(3);
/** Coluna mais estreita que isto não entra: o segmento ainda cabe ao lado de um nome curto. */
const CELULA_MINIMA = 360;
/** Colunas pela faixa da `Tela` (4.10): 1 no celular, 2 na normal e na larga, 3 na ultralarga. */
const TETO_DE_COLUNAS: Record<FaixaDeLargura, number> = { compacta: 1, normal: 2, larga: 2, ultralarga: 3 };

const VARIACOES_DE_TOM = CODIGOS_PALETAS_VISIVEIS.filter((c) => c !== 'ESCURO' && c !== 'CLARO');

interface Secao {
  chave: string;
  titulo: string;
  /**
   * Altura estimada além das linhas, em linhas de ~80 px (grades, prévias, descrições de duas linhas), para a alvenaria
   * escolher a coluna antes de medir. Medido em 1280: Tema e cores ~1150 px, Leitura ~730, Treino e dados ~410, Layout
   * ~240, Navegador ~140; fica Tema e cores com Navegador de um lado e o resto do outro.
   */
  extra: number;
  linhas: ReactNode[];
}

/**
 * Aparência e preferências (25/11): valem só neste aparelho e para a conta da pessoa. Cinco seções (Tema e cores, Leitura,
 * Layout, Treino e dados, Navegador), uma linha por opção (`ui/LinhaDeConfiguracao`); opção que não vale para o perfil ou a
 * plataforma some, e a seção vazia também. `duasColunas` (Ajustes do treinador): as seções em colunas empilhadas
 * (`ui/Alvenaria`), 1, 2 ou 3 pela faixa da `Tela`; sem ela (a folha do aluno), uma coluna. "Restaurar padrão" é a
 * `RestaurarPreferencias`, que cada tela põe no próprio cabeçalho. `comTitulo` mostra o título "Preferências".
 * `extras`: cartões de quem usa a tela (os lembretes do aluno), depois das seções, para o `ui/` não importar a área do aluno.
 */
export function PreferenciasDoApp({ comTitulo = true, extras, duasColunas = false }: { comTitulo?: boolean; extras?: ReactNode; duasColunas?: boolean }) {
  const sessao = useSessao();
  const { preferencias, escolherPreferencia, fatorTexto, marca, cores, variante } = useTema();
  const faixa = useFaixaDaTela();
  const mudar = (parcial: Partial<Preferencias>) => escolherPreferencia(parcial);
  const temaDaConsultoria = paletaDe(sessao.marca?.temaPadrao).cores;
  // O texto fala com quem lê: o aluno recebe o tema do treinador; o treinador é quem o escolhe, em Marca.
  const aluno = sessao.usuario?.papel === 'ALUNO';
  // Aluno e treinador escolhem, cada um a sua, só com a chave da plataforma ligada; desligada, o app segue em kg e a escolha nem aparece.
  const escolheUnidade = sessao.unidadeDeCargaHabilitada;
  const idDasVariacoes = useId();

  const secoes: Secao[] = [
    {
      chave: 'tema', titulo: 'Tema e cores', extra: 12, linhas: [
        <LinhaDeConfiguracao key="tema" nome="Tema" forma="grade">
          <View role="radiogroup" aria-label="Tema" style={estilos.tema}>
            {/* Quatro opções com descrição: 2 × 2 no máximo (3 + 1 deixaria uma sozinha e quebraria os nomes). */}
            <GradeDeEscolhas minimo={220} maximo={2}>
              <OpcaoCartao
                titulo="Padrão da consultoria"
                descricao={aluno ? 'O tema que o seu treinador escolheu' : 'O tema escolhido em Marca'}
                selecionada={preferencias.tema === 'CONSULTORIA'}
                aoEscolher={() => mudar({ tema: 'CONSULTORIA' })}
                amostra={<AmostraDoTema esquerda={temaDaConsultoria} cor={marca} />}
              />
              <OpcaoCartao titulo="Escuro" selecionada={preferencias.tema === 'ESCURO'} aoEscolher={() => mudar({ tema: 'ESCURO' })}
                amostra={<AmostraDoTema esquerda={ESCURO} cor={marca} />} />
              <OpcaoCartao titulo="Claro" selecionada={preferencias.tema === 'CLARO'} aoEscolher={() => mudar({ tema: 'CLARO' })}
                amostra={<AmostraDoTema esquerda={CLARO} cor={marca} />} />
              <OpcaoCartao
                titulo="Igual ao aparelho"
                descricao="Muda com o tema do aparelho"
                selecionada={preferencias.tema === 'SISTEMA'}
                aoEscolher={() => mudar({ tema: 'SISTEMA' })}
                amostra={<AmostraDoTema esquerda={ESCURO} direita={CLARO} cor={marca} />}
              />
            </GradeDeEscolhas>
            {/* Um subgrupo do mesmo radiogroup: escolher uma variação tira a escolha de cima. */}
            <View role="group" aria-labelledby={idDasVariacoes} style={estilos.variacoes}>
              <Texto variante="secao" nativeID={idDasVariacoes}>Variações de tom</Texto>
              <GradeDeEscolhas minimo={160}>
                {VARIACOES_DE_TOM.map((codigo) => (
                  <OpcaoCartao key={codigo} titulo={PALETAS[codigo].nome} selecionada={preferencias.tema === codigo}
                    aoEscolher={() => mudar({ tema: codigo })} amostra={<AmostraDoTema esquerda={PALETAS[codigo].cores} cor={marca} />} />
                ))}
              </GradeDeEscolhas>
            </View>
          </View>
        </LinhaDeConfiguracao>,
        <LinhaDeConfiguracao key="corDeAcao" nome="Cor de ação" descricao="Botões de adicionar e trocar, a aba ativa e o item em edição." forma="grade">
          <View role="radiogroup" aria-label="Cor de ação">
            <GradeDeEscolhas minimo={180}>
              {CODIGOS_DA_COR_DE_ACAO.map((codigo) => (
                <OpcaoCartao
                  key={codigo}
                  titulo={NOMES_DA_COR_DE_ACAO[codigo]}
                  descricao={codigo === 'INDIGO' ? 'Padrão' : codigo === 'MARCA' ? 'A cor da consultoria' : undefined}
                  selecionada={preferencias.corDeAcao === codigo}
                  aoEscolher={() => mudar({ corDeAcao: codigo })}
                  amostra={<AmostraDaAcao cor={coresDaAcao(codigo, cores, variante, marca).acao} />}
                />
              ))}
            </GradeDeEscolhas>
          </View>
          <PreviaDaAcao />
        </LinhaDeConfiguracao>,
        // A "Cor das séries" entra aqui, numa linha.
      ],
    },
    {
      chave: 'leitura', titulo: 'Leitura', extra: 5, linhas: [
        <LinhaDeConfiguracao key="tamanho" nome="Tamanho do texto" descricao="Vale para todos os textos do app." forma="grade">
          <View role="radiogroup" aria-label="Tamanho do texto">
            <GradeDeEscolhas minimo={140}>
              {TAMANHOS.map((t) => (
                <OpcaoCartao
                  key={t.valor}
                  titulo={t.rotulo}
                  tamanhoDoTitulo={16 * fatorDoTexto(t.valor)}
                  descricao={t.valor === 'PADRAO' ? 'Tamanho original' : `${Math.round(fatorDoTexto(t.valor) * 100)}% do original`}
                  selecionada={preferencias.tamanhoTexto === t.valor}
                  aoEscolher={() => mudar({ tamanhoTexto: t.valor })}
                />
              ))}
            </GradeDeEscolhas>
          </View>
          <PreviaDoTexto nome={sessao.marca?.nome ?? 'Sua consultoria'} fator={fatorTexto} />
        </LinhaDeConfiguracao>,
        <LinhaDeConfiguracao key="contraste" nome="Contraste" descricao="Alto deixa bordas, campos e textos secundários mais nítidos.">
          <Escolha descricao="Contraste" opcoes={[{ valor: 'PADRAO', rotulo: 'Padrão' }, { valor: 'ALTO', rotulo: 'Alto' }]}
            valor={preferencias.contraste} aoMudar={(contraste) => mudar({ contraste })} />
        </LinhaDeConfiguracao>,
        <LinhaDeConfiguracao key="bordas" nome="Bordas reforçadas" descricao="Bordas mais escuras e mais grossas em volta dos blocos." forma="interruptor">
          <Switch checked={preferencias.bordasReforcadas} onCheckedChange={(bordasReforcadas) => mudar({ bordasReforcadas })} accessibilityLabel="Bordas reforçadas" />
        </LinhaDeConfiguracao>,
        <LinhaDeConfiguracao key="animacoes" nome="Animações" descricao="Reduzir tira os movimentos de entrada, mola e contagem.">
          <Escolha descricao="Animações" opcoes={[{ valor: 'SISTEMA', rotulo: 'Igual ao aparelho' }, { valor: 'REDUZIDO', rotulo: 'Reduzir' }]}
            valor={preferencias.movimento} aoMudar={(movimento) => mudar({ movimento })} />
        </LinhaDeConfiguracao>,
      ],
    },
    {
      chave: 'layout', titulo: 'Layout', extra: 1, linhas: [
        <LinhaDeConfiguracao key="largura" nome="Largura do conteúdo" descricao="Automática aproveita a tela larga; Limitada segura em 1800 px.">
          <Escolha descricao="Largura do conteúdo" opcoes={[{ valor: 'AUTOMATICA', rotulo: 'Automática' }, { valor: 'LIMITADA', rotulo: 'Limitada' }]}
            valor={preferencias.larguraConteudo} aoMudar={(larguraConteudo) => mudar({ larguraConteudo })} />
        </LinhaDeConfiguracao>,
        <LinhaDeConfiguracao key="detalhes" nome="Detalhes abrem" descricao="No computador. No celular, abrem sempre de baixo.">
          <Escolha descricao="Detalhes abrem" opcoes={[{ valor: 'LATERAL', rotulo: 'Na lateral' }, { valor: 'CENTRO', rotulo: 'No centro' }]}
            valor={preferencias.detalhesAbrem} aoMudar={(detalhesAbrem) => mudar({ detalhesAbrem })} />
        </LinhaDeConfiguracao>,
      ],
    },
    {
      chave: 'treino', titulo: 'Treino e dados', extra: 2, linhas: [
        escolheUnidade ? (
          <LinhaDeConfiguracao key="unidade" nome="Unidade da carga" descricao={aluno
            ? 'Como você vê e digita o peso. O registro fica em kg; trocar não muda o que já foi registrado.'
            : 'Como você vê e digita a carga, recordes, relatórios e PDFs. Tudo fica em kg; trocar não muda plano nem registro.'}>
            <Escolha descricao="Unidade da carga" opcoes={[{ valor: 'kg', rotulo: 'Quilos (kg)' }, { valor: 'lb', rotulo: 'Libras (lb)' }]}
              valor={preferencias.unidadeDeCarga} aoMudar={(unidadeDeCarga) => mudar({ unidadeDeCarga })} />
          </LinhaDeConfiguracao>
        ) : null,
        <LinhaDeConfiguracao key="graficos" nome="Mostrar gráficos" descricao="De progresso e de peso. Desligado, as telas mostram só as listas." forma="interruptor">
          <Switch checked={preferencias.graficos} onCheckedChange={(graficos) => mudar({ graficos })} accessibilityLabel="Mostrar gráficos" />
        </LinhaDeConfiguracao>,
        // A vibração só acontece no treino do aluno (marcar série e fim do descanso): o treinador não a vê.
        Platform.OS !== 'web' && aluno ? (
          <LinhaDeConfiguracao key="vibracao" nome="Vibração" descricao="Ao marcar série e no fim do descanso." forma="interruptor">
            <Switch checked={preferencias.vibracao} onCheckedChange={(vibracao) => mudar({ vibracao })} accessibilityLabel="Vibração" />
          </LinhaDeConfiguracao>
        ) : null,
      ],
    },
    {
      chave: 'navegador', titulo: 'Navegador', extra: 1, linhas: [
        Platform.OS === 'web' ? (
          <LinhaDeConfiguracao key="barras" nome="Barras de rolagem escuras" descricao="No tema escuro. Desligado, as barras ficam claras." forma="interruptor">
            <Switch checked={preferencias.barrasEscuras} onCheckedChange={(barrasEscuras) => mudar({ barrasEscuras })} accessibilityLabel="Barras de rolagem escuras" />
          </LinhaDeConfiguracao>
        ) : null,
      ],
    },
  ];
  const visiveis = secoes.map((s) => ({ ...s, linhas: s.linhas.filter(Boolean) })).filter((s) => s.linhas.length > 0);

  return (
    <View style={estilos.coluna}>
      {comTitulo ? (
        <View style={estilos.cabecaPreferencias}>
          <Texto variante="titulo">Preferências</Texto>
          <Texto variante="suave">Valem só neste aparelho e para a sua conta.</Texto>
        </View>
      ) : null}
      <Alvenaria
        vao={VAO}
        colunas={(largura) => (duasColunas ? Math.min(TETO_DE_COLUNAS[faixa], visiveis.length, colunasPorCelula(largura, CELULA_MINIMA, VAO)) : 1)}
        pecas={visiveis.map((s) => ({ chave: s.chave, peso: s.linhas.length + s.extra, conteudo: <SecaoDeConfiguracao titulo={s.titulo} linhas={s.linhas} /> }))}
      />
      {/* Fora da alvenaria: o do treinador some na web, e uma peça vazia deixaria um vão. */}
      {extras}
    </View>
  );
}

/**
 * "Restaurar padrão" (secundário) com a confirmação na tela. Cada tela o põe no cabeçalho: `acoes` do `Cabecalho` nas
 * Ajustes do treinador, `acaoNoTopo` da folha de Aparência do aluno.
 */
export function RestaurarPreferencias() {
  const sessao = useSessao();
  const { restaurarPadrao } = useTema();
  const { avisar } = useAviso();
  const [confirmando, setConfirmando] = useState(false);
  const aluno = sessao.usuario?.papel === 'ALUNO';
  const lembretes = aluno || (Platform.OS !== 'web' && sessao.pode('AGENDA_LER'));
  return (
    <>
      <Botao rotulo="Restaurar padrão" tipo="secundario" aoTocar={() => setConfirmando(true)} />
      <PainelConfirmacao
        visivel={confirmando}
        titulo="Restaurar as preferências?"
        mensagem={`Volta todas as preferências deste aparelho ao padrão${sessao.unidadeDeCargaHabilitada ? '; a carga volta a kg' : ''}${lembretes ? '; os lembretes de compromisso ficam desligados' : ''}.`}
        rotuloConfirmar="Restaurar"
        aoConfirmar={() => {
          restaurarPadrao();
          setConfirmando(false);
          avisar('Preferências restauradas.', 'sucesso');
        }}
        aoCancelar={() => setConfirmando(false)}
      />
    </>
  );
}

/** Grade de opções em cartão medida pela própria largura (a coluna, não a janela), até 4 por linha (ou `maximo`). */
function GradeDeEscolhas({ minimo, maximo, children }: { minimo: number; maximo?: number; children: ReactNode }) {
  return <Grade gap={espaco(1)} colunas={(largura) => colunasPorCelula(largura, minimo, espaco(1), maximo)}>{children}</Grade>;
}

/** Caixa neutra rotulada "Prévia" (mesmo fundo da prévia do texto): só para olhar, nada aqui recebe foco nem toque. */
function CaixaDePrevia({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const { cores } = useTema();
  const id = useId();
  return (
    <View role="group" aria-labelledby={id} style={[estilos.previa, estilos.inerte, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <Texto variante="secao" nativeID={id}>{rotulo}</Texto>
      {children}
    </View>
  );
}

/** Botão de ação desabilitado (nas cores da escolha, que é o que se quer ver) e o selo "Editando". */
function PreviaDaAcao() {
  const { cores } = useTema();
  return (
    <CaixaDePrevia rotulo="Prévia">
      <View style={estilos.linhaDaPrevia}>
        <View role="button" aria-disabled accessibilityState={{ disabled: true }} aria-label="Adicionar refeição"
          style={[estilos.botaoDaPrevia, { backgroundColor: cores.acaoSuave, borderColor: misturar(cores.acaoSuave, cores.acao, 0.35) }]}>
          <Texto aria-hidden style={[estilos.textoDaPrevia, { color: cores.acao }]}>+ Adicionar refeição</Texto>
        </View>
        {/* O selo se alinha ao topo sozinho: a caixa o centra na altura do botão. */}
        <View><SeloEditando /></View>
      </View>
    </CaixaDePrevia>
  );
}

/** Quadradinho de 40 px do tema (meio a meio no "Igual ao aparelho"), sempre com as cores fixas daquele tema. */
function AmostraDoTema({ esquerda, direita, cor }: { esquerda: Cores; direita?: Cores; cor: string }) {
  return (
    <View style={estilos.amostra}>
      <View style={[estilos.meia, { backgroundColor: esquerda.fundo }]}>
        <View style={[estilos.barra, { backgroundColor: cor }]} />
        <View style={[estilos.cartaozinho, { backgroundColor: esquerda.superficie, borderColor: esquerda.borda }]} />
      </View>
      {direita ? (
        <View style={[estilos.meia, { backgroundColor: direita.fundo }]}>
          <View style={[estilos.barra, { backgroundColor: cor }]} />
          <View style={[estilos.cartaozinho, { backgroundColor: direita.superficie, borderColor: direita.borda }]} />
        </View>
      ) : null}
    </View>
  );
}

/** Cartão de exemplo no tamanho escolhido. É só para olhar: não faz nada e some para o leitor de tela. */
function PreviaDoTexto({ nome, fator }: { nome: string; fator: number }) {
  const { cores, marca, sobreMarca } = useTema();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[estilos.previa, estilos.inerte, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <Texto variante="secao">Prévia ({Math.round(fator * 100)}%)</Texto>
      <Texto variante="bloco">{nome}</Texto>
      <Texto>Segunda - Costas</Texto>
      <Texto variante="suave">5 exercícios · 2 dias no período</Texto>
      <View style={[estilos.botaoDeMentira, { backgroundColor: marca }]}>
        <Texto style={{ color: sobreMarca, fontFamily: fontes.semi, fontSize: 15 }}>Começar treino</Texto>
      </View>
    </View>
  );
}

/** Bolinha da cor de ação na opção (decorativa: o nome da opção diz a cor). */
function AmostraDaAcao({ cor }: { cor: string }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[estilos.amostraDaAcao, { backgroundColor: cor }]} />;
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(3) },
  cabecaPreferencias: { gap: 2, marginTop: espaco(1) },
  tema: { gap: espaco(2) },
  variacoes: { gap: espaco(1) },
  amostraDaAcao: { width: 26, height: 26, borderRadius: 13 },
  inerte: { pointerEvents: 'none' },
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.5) },
  linhaDaPrevia: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), flexWrap: 'wrap', marginTop: espaco(0.5) },
  botaoDaPrevia: { minHeight: 40, paddingHorizontal: espaco(2), borderRadius: RAIO_CONTROLE, borderWidth: 1, justifyContent: 'center' },
  textoDaPrevia: { fontFamily: fontes.semi, fontSize: 14 },
  amostra: { width: 40, height: 40, flexDirection: 'row' },
  meia: { flex: 1, padding: 4, gap: 3 },
  barra: { height: 5, width: '80%', borderRadius: 3 },
  cartaozinho: { flex: 1, borderWidth: 1, borderRadius: 3 },
  botaoDeMentira: { minHeight: 44, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espaco(2), marginTop: espaco(1), alignSelf: 'flex-start' },
});
