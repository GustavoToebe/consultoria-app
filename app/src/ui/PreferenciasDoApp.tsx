import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { OPCOES_DIAS_ANIVERSARIO } from '../dominio/aniversariosDosAlunos';
import type { Preferencias, TamanhoTexto } from '../dominio/preferencias';
import { fatorDoTexto } from '../dominio/preferencias';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { CLARO, CODIGOS_DA_COR_DE_ACAO, CODIGOS_PALETAS_VISIVEIS, coresDaAcao, ESCURO, espaco, fontes, misturar, NOMES_DA_COR_DE_ACAO, PALETAS, paletaDe, RAIO, RAIO_CONTROLE, type Cores } from '../tema/tokens';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Interruptor } from './Campos';
import { Cartao } from './Cartao';
import { Escolha } from './Escolha';
import { GradeDeOpcoes } from './GradeDeOpcoes';
import { OpcaoCartao } from './OpcaoCartao';
import { PainelConfirmacao } from './PainelConfirmacao';
import { SeloEditando } from './SeloEditando';
import { Texto } from './Texto';

const TAMANHOS: { valor: TamanhoTexto; rotulo: string }[] = [
  { valor: 'PADRAO', rotulo: 'Padrão' },
  { valor: 'MEDIO', rotulo: 'Médio' },
  { valor: 'GRANDE', rotulo: 'Grande' },
  { valor: 'EXTRA', rotulo: 'Extra' },
];

/**
 * Colunas lado a lado pelo `flexWrap` (a largura do próprio contêiner decide, sem medir): a partir de uns 950 px (janela de
 * 1280 com o menu aberto) cabem duas de 464; abaixo, uma coluna na ordem de sempre. O teto de 720 deixa o interruptor perto do rótulo.
 */
const BASE_DA_COLUNA = 464;
const LARGURA_DA_COLUNA = 720;

const VARIACOES_DE_TOM = CODIGOS_PALETAS_VISIVEIS.filter((c) => c !== 'ESCURO' && c !== 'CLARO');

/**
 * Preferências pessoais: tema, contraste, bordas reforçadas, tamanho do texto, animações, vibração e restaurar o padrão. Valem só neste
 * aparelho. `comTitulo` mostra o título "Preferências" (o painel do aluno); a tela Ajustes do treinador já tem o seu.
 * `duasColunas` (Ajustes do treinador, no PC largo): o tema à esquerda e o resto (leitura, uso e unidade) à direita; a
 * mesma árvore numa coluna ou em duas, e "Restaurar padrão" sempre depois de tudo.
 */
export function PreferenciasDoApp({ comTitulo = true, extras, duasColunas = false }: { comTitulo?: boolean; extras?: ReactNode; duasColunas?: boolean }) {
  const sessao = useSessao();
  const { preferencias, escolherPreferencia, restaurarPadrao, fatorTexto, marca, cores, variante } = useTema();
  const { avisar } = useAviso();
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false);
  const coluna = [estilos.coluna, duasColunas ? estilos.metade : null];
  const mudar = (parcial: Partial<Preferencias>) => escolherPreferencia(parcial);
  const temaDaConsultoria = paletaDe(sessao.marca?.temaPadrao).cores;
  // O texto fala com quem lê: o aluno recebe o tema do treinador; o treinador é quem o escolhe, em Marca.
  const aluno = sessao.usuario?.papel === 'ALUNO';
  // Aluno e treinador escolhem, cada um a sua, só com a chave da plataforma ligada; desligada, o app segue em kg e a escolha nem aparece.
  const escolheUnidade = sessao.unidadeDeCargaHabilitada;

  return (
    <View style={estilos.coluna}>
      {comTitulo ? (
        <View style={estilos.cabecaPreferencias}>
          <Texto variante="titulo">Preferências</Texto>
          <Texto variante="suave">Valem só neste aparelho e para a sua conta.</Texto>
        </View>
      ) : null}

      <View style={[estilos.coluna, duasColunas ? estilos.ladoALado : null]}>
      <View style={coluna}>
      <Cartao titulo="Tema" descricao="Escolha o tema principal ou uma variação de tom do catálogo da marca.">
        <GradeDeOpcoes rotulo="Tema">
          <OpcaoCartao
            titulo="Padrão da consultoria"
            descricao={aluno ? 'O tema que o seu treinador escolheu' : 'O tema escolhido em Marca'}
            selecionada={preferencias.tema === 'CONSULTORIA'}
            aoEscolher={() => mudar({ tema: 'CONSULTORIA' })}
            amostra={<AmostraDoTema esquerda={temaDaConsultoria} cor={marca} />}
          />
          <OpcaoCartao
            titulo="Escuro"
            descricao="Fundo #09090B"
            selecionada={preferencias.tema === 'ESCURO'}
            aoEscolher={() => mudar({ tema: 'ESCURO' })}
            amostra={<AmostraDoTema esquerda={ESCURO} cor={marca} />}
          />
          <OpcaoCartao
            titulo="Claro"
            descricao="Cartão #FFFFFF"
            selecionada={preferencias.tema === 'CLARO'}
            aoEscolher={() => mudar({ tema: 'CLARO' })}
            amostra={<AmostraDoTema esquerda={CLARO} cor={marca} />}
          />
          <OpcaoCartao
            titulo="Igual ao aparelho"
            descricao="Muda com o tema do celular ou do computador"
            selecionada={preferencias.tema === 'SISTEMA'}
            aoEscolher={() => mudar({ tema: 'SISTEMA' })}
            amostra={<AmostraDoTema esquerda={ESCURO} direita={CLARO} cor={marca} />}
          />
        </GradeDeOpcoes>
        <View style={estilos.variacoes}>
          <Texto variante="suave">Variações de tom</Texto>
          <GradeDeOpcoes papel="group" rotulo="Variações de tom">
            {VARIACOES_DE_TOM.map((codigo) => (
              <OpcaoCartao
                key={codigo}
                titulo={PALETAS[codigo].nome}
                selecionada={preferencias.tema === codigo}
                aoEscolher={() => mudar({ tema: codigo })}
                amostra={<AmostraDoTema esquerda={PALETAS[codigo].cores} cor={marca} />}
              />
            ))}
          </GradeDeOpcoes>
        </View>
      </Cartao>
      <Cartao titulo="Cor de ação" descricao="Botões de adicionar, usar modelo e trocar, a aba ativa e o item em edição. Índigo é o padrão.">
        <GradeDeOpcoes rotulo="Cor de ação">
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
        </GradeDeOpcoes>
        <View style={estilos.previaDaAcao} accessible accessibilityLabel="Prévia da cor de ação: botão de adicionar e selo Editando">
          <View style={[estilos.botaoDaPrevia, { backgroundColor: cores.acaoSuave, borderColor: misturar(cores.acaoSuave, cores.acao, 0.35) }]}>
            <Texto style={[estilos.textoDaPrevia, { color: cores.acao }]}>+ Adicionar refeição</Texto>
          </View>
          <SeloEditando />
        </View>
      </Cartao>
      </View>

      <View style={coluna}>
      <Cartao titulo="Contraste" descricao="Alto deixa bordas, campos e textos secundários mais nítidos.">
        <Escolha
          descricao="Contraste"
          opcoes={[
            { valor: 'PADRAO', rotulo: 'Padrão' },
            { valor: 'ALTO', rotulo: 'Alto' },
          ]}
          valor={preferencias.contraste}
          aoMudar={(contraste) => mudar({ contraste })}
        />
      </Cartao>

      <Cartao titulo="Bordas" descricao="Para separar melhor cada parte da tela.">
        <Interruptor
          rotulo="Bordas reforçadas"
          ajuda="Bordas mais escuras e mais grossas em volta dos blocos."
          valor={preferencias.bordasReforcadas}
          aoMudar={(bordasReforcadas) => mudar({ bordasReforcadas })}
        />
      </Cartao>

      <Cartao titulo="Tamanho do texto" descricao="Vale para todos os textos do app.">
        <GradeDeOpcoes rotulo="Tamanho do texto">
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
        </GradeDeOpcoes>
        <PreviaDoTexto nome={sessao.marca?.nome ?? 'Sua consultoria'} fator={fatorTexto} />
      </Cartao>

      <Cartao titulo="Largura do conteúdo" descricao="Automática aproveita toda a tela larga; Limitada segura em 1800 px.">
        <Escolha
          descricao="Largura do conteúdo"
          opcoes={[
            { valor: 'AUTOMATICA', rotulo: 'Automática' },
            { valor: 'LIMITADA', rotulo: 'Limitada' },
          ]}
          valor={preferencias.larguraConteudo}
          aoMudar={(larguraConteudo) => mudar({ larguraConteudo })}
        />
      </Cartao>

      <Cartao titulo="Animações" descricao="Reduzir tira os movimentos de entrada, mola e contagem.">
        <Escolha
          descricao="Animações"
          opcoes={[
            { valor: 'SISTEMA', rotulo: 'Igual ao aparelho' },
            { valor: 'REDUZIDO', rotulo: 'Reduzir' },
          ]}
          valor={preferencias.movimento}
          aoMudar={(movimento) => mudar({ movimento })}
        />
      </Cartao>

      <Cartao titulo="Gráficos">
        <Interruptor
          rotulo="Mostrar gráficos de progresso e de peso"
          ajuda="Com o interruptor desligado, as telas mostram só as listas."
          valor={preferencias.graficos}
          aoMudar={(graficos) => mudar({ graficos })}
        />
      </Cartao>

      {/* Só quem lê alunos (o bloco do Início pede ALUNO_LER); mostra só nome, dia e mês. */}
      {!aluno && sessao.pode('ALUNO_LER') ? (
        <Cartao titulo="Aniversários" descricao="Até quantos dias o Início mostra quem faz aniversário. Aparece só o nome e o dia e mês, nunca a idade.">
          <Escolha
            descricao="Aniversários no Início"
            opcoes={OPCOES_DIAS_ANIVERSARIO.map((n) => ({ valor: n, rotulo: n === 0 ? 'Só hoje' : `${n} dias` }))}
            valor={preferencias.diasAniversario}
            aoMudar={(diasAniversario) => mudar({ diasAniversario })}
          />
        </Cartao>
      ) : null}

      {Platform.OS === 'web' ? (
        <Cartao titulo="Navegador">
          <Interruptor
            rotulo="Barras de rolagem escuras no tema escuro"
            ajuda="Com o interruptor desligado, as barras de rolagem ficam claras mesmo no tema escuro."
            valor={preferencias.barrasEscuras}
            aoMudar={(barrasEscuras) => mudar({ barrasEscuras })}
          />
        </Cartao>
      ) : null}

      {escolheUnidade ? (
        <Cartao titulo="Unidade da carga" descricao={aluno
          ? 'Como você vê e digita o peso. O que você registra é guardado em kg; trocar não muda nada do que já foi registrado.'
          : 'Como você vê e digita a carga fixa do treino e como lê cargas, recordes, relatórios e PDFs. O que fica guardado é sempre em kg; trocar não muda nenhum plano nem registro.'}>
          <Escolha
            descricao="Unidade da carga"
            opcoes={[
              { valor: 'kg', rotulo: 'Quilos (kg)' },
              { valor: 'lb', rotulo: 'Libras (lb)' },
            ]}
            valor={preferencias.unidadeDeCarga}
            aoMudar={(unidadeDeCarga) => mudar({ unidadeDeCarga })}
          />
        </Cartao>
      ) : null}

      {/* A vibração só acontece no treino do aluno (marcar série e fim do descanso): o treinador não a vê. */}
      {Platform.OS !== 'web' && aluno ? (
        <Cartao titulo="Vibração">
          <Interruptor
            rotulo="Ao marcar série e no fim do descanso"
            valor={preferencias.vibracao}
            aoMudar={(vibracao) => mudar({ vibracao })}
          />
        </Cartao>
      ) : null}

      {/* Cartões de quem usa a tela (os lembretes do aluno), para o `ui/` não importar a área do aluno. */}
      {extras}
      </View>
      </View>

      <Botao rotulo="Restaurar padrão" tipo="fantasma" aoTocar={() => setConfirmandoRestaurar(true)} />
      <PainelConfirmacao
        visivel={confirmandoRestaurar}
        titulo="Restaurar as preferências?"
        mensagem={`Tema, contraste, bordas, tamanho do texto, animações, gráficos, barras de rolagem e vibração voltam ao padrão${escolheUnidade ? '; a carga volta a kg' : ''}${aluno || (Platform.OS !== 'web' && sessao.pode('AGENDA_LER')) ? '; os lembretes de compromisso ficam desligados' : ''}.`}
        rotuloConfirmar="Restaurar"
        aoConfirmar={() => {
          restaurarPadrao();
          setConfirmandoRestaurar(false);
          avisar('Preferências restauradas.', 'sucesso');
        }}
        aoCancelar={() => setConfirmandoRestaurar(false)}
      />

    </View>
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
      style={[estilos.previa, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <Texto variante="suave">Prévia ({Math.round(fator * 100)}%)</Texto>
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
  amostraDaAcao: { width: 26, height: 26, borderRadius: 13 },
  previaDaAcao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), flexWrap: 'wrap' },
  botaoDaPrevia: { minHeight: 40, paddingHorizontal: espaco(2), borderRadius: RAIO_CONTROLE, borderWidth: 1, justifyContent: 'center' },
  textoDaPrevia: { fontFamily: fontes.semi, fontSize: 14 },
  coluna: { gap: espaco(3) },
  // Cada coluna termina com o próprio conteúdo (sem esticar até a altura da vizinha), alinhadas à esquerda.
  ladoALado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  metade: { flexGrow: 1, flexShrink: 1, flexBasis: BASE_DA_COLUNA, minWidth: 0, maxWidth: LARGURA_DA_COLUNA },
  cabecaPreferencias: { gap: 2, marginTop: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  variacoes: { gap: espaco(1), marginTop: espaco(1) },
  amostra: { width: 40, height: 40, flexDirection: 'row' },
  meia: { flex: 1, padding: 4, gap: 3 },
  barra: { height: 5, width: '80%', borderRadius: 3 },
  cartaozinho: { flex: 1, borderWidth: 1, borderRadius: 3 },
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.5) },
  botaoDeMentira: { minHeight: 44, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espaco(2), marginTop: espaco(1), alignSelf: 'flex-start' },
});
