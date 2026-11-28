import { Dumbbell, House, Salad, UserRound, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Marca, Tema } from '../../api/tipos';
import { modoDoTema, temaDaPrevia, type ModoDaPrevia } from '../../dominio/previaDaMarca';
import { useSessao } from '../../sessao/SessaoProvider';
import { ALVO_TOQUE, espaco, fontes, marcaParaPeca, marcaParaTexto, paletaDe, RAIO, RAIO_CONTROLE, textoSobre, type Cores } from '../../tema/tokens';
import { Escolha } from '../../ui/Escolha';
import { Grade } from '../../ui/Grade';
import { LinkTexto } from '../../ui/LinkTexto';
import { MarcaTitulo } from '../../ui/MarcaTitulo';
import { Texto } from '../../ui/Texto';
import { LARGURA_DO_CELULAR, type ArranjoDaMarca } from './arranjoDaMarca';
import { ALTURA_DO_CELULAR_COM_LEGENDA, Celular } from './Celular';
import { Escala, Inerte } from './Escala';
import { MiniaturaDoEmail, MiniaturaDoPdf } from './MiniaturasDaMarca';

const VAO_DOS_CELULARES = espaco(2);
/** Os dois celulares lado a lado, no tamanho do desenho; a `Escala` os reduz juntos. */
const PAR_DE_CELULARES = { largura: 2 * LARGURA_DO_CELULAR + VAO_DOS_CELULARES, altura: ALTURA_DO_CELULAR_COM_LEGENDA };
const MODOS: { valor: ModoDaPrevia; rotulo: string }[] = [{ valor: 'ESCURO', rotulo: 'Escuro' }, { valor: 'CLARO', rotulo: 'Claro' }];

interface Props {
  marca: Marca;
  /** O tema padrão escolhido no formulário: a prévia começa no modo dele. */
  tema: Tema;
  /** Quem aparece como remetente do e-mail (`remetenteDosEmails`). */
  remetente: string;
  arranjo: ArranjoDaMarca;
}

/**
 * Prévia ao vivo da Marca (28/11): "Ver em: Escuro · Claro" no topo; os dois celulares lado a lado (Início do aluno e
 * Tela de entrar), num desenho fixo de 380 × 640 cada, reduzido para caber (`Escala`: na tela larga cabe na altura do
 * cartão fixo; embaixo do formulário, na largura); embaixo, o cabeçalho do PDF no modelo de Documentos e o e-mail de
 * convite. Tudo com dados fictícios e nada tocável: é desenho.
 */
export function PreviaDaMarca({ marca, tema, remetente, arranjo }: Props) {
  const { temFuncionalidade } = useSessao();
  // O modo escolhido vale para o tema em que foi escolhido: trocar o tema padrão volta a prévia ao modo dele.
  const [vista, setVista] = useState<{ de: Tema; modo: ModoDaPrevia } | null>(null);
  const modo = vista && vista.de === tema ? vista.modo : modoDoTema(tema);
  const mostrado = temaDaPrevia(tema, modo);
  const { nome, cores } = paletaDe(mostrado);
  const larga = arranjo === 'larga';
  return (
    <View style={[estilos.previa, larga ? estilos.esticada : null]}>
      <View style={estilos.topo}>
        <View style={estilos.titulos}>
          <Texto variante="bloco" nivel={2}>Prévia</Texto>
          {/* O desenho dos celulares é inerte e fora do leitor de tela: este texto diz o que ele mostra. */}
          <Texto variante="suave">{`O Início do aluno e a tela de entrar, o cabeçalho do PDF e o e-mail de convite. Muda junto com o que você escolhe ${larga ? 'ao lado' : 'acima'}; dados de exemplo, nada é enviado.`}</Texto>
        </View>
        <View style={estilos.verEm}>
          <Texto variante="rotulo" aria-hidden>Ver em</Texto>
          <Escolha opcoes={MODOS} valor={modo} aoMudar={(m) => setVista({ de: tema, modo: m })} descricao="Ver a prévia em" />
          <Texto variante="suave">{`Paleta ${nome}`}</Texto>
        </View>
      </View>
      <Inerte style={larga ? estilos.esticada : null}>
        <Escala base={PAR_DE_CELULARES} modo={larga ? 'caixa' : 'largura'}>
          <View style={estilos.celulares}>
            <Celular legenda="Início do aluno" descricao={`Prévia do Início do aluno na paleta ${nome}`} testID="previa-da-paleta" cores={cores}>
              <InicioDoAluno marca={marca} cores={cores} />
            </Celular>
            <Celular legenda="Tela de entrar" descricao={`Prévia da tela de entrar na paleta ${nome}`} testID="previa-de-entrar" cores={cores}>
              <TelaDeEntrar marca={marca} cores={cores} />
            </Celular>
          </View>
        </Escala>
      </Inerte>
      <Grade gap={espaco(2)} colunas={(l) => (l >= 520 ? 2 : 1)}>
        <MiniaturaDoPdf marca={marca}
          depois={temFuncionalidade('PDF') ? <LinkTexto texto="Personalizar documentos" href="/treinador/documentos/personalizar" /> : null} />
        <MiniaturaDoEmail variante="convite" marca={marca} remetente={remetente} />
      </Grade>
    </View>
  );
}

const ABAS: { rotulo: string; Icone: LucideIcon }[] = [
  { rotulo: 'Início', Icone: House },
  { rotulo: 'Treino', Icone: Dumbbell },
  { rotulo: 'Dieta', Icone: Salad },
  { rotulo: 'Conta', Icone: UserRound },
];

function InicioDoAluno({ marca, cores }: { marca: Marca; cores: Cores }) {
  const peca = marcaParaPeca(marca.corPrimaria, [cores.superficie, cores.fundo]);
  const cartao = { backgroundColor: cores.superficie, borderColor: cores.divisor };
  return (
    <>
      <View style={estilos.corpo}>
        <View style={estilos.topoDoInicio}>
          <View style={estilos.marca}><MarcaTitulo marca={marca} tamanho="pequeno" fundo={cores.fundo} /></View>
          <View style={[estilos.foto, { backgroundColor: cores.superficie3 }]}>
            <Texto style={[estilos.iniciais, { color: cores.texto }]}>AF</Texto>
          </View>
        </View>
        <View>
          <Texto style={[estilos.ola, { color: cores.texto }]}>Olá, Ana</Texto>
          <Texto style={[estilos.miudo, { color: cores.textoSuave }]}>Segunda-feira</Texto>
        </View>
        <View style={[estilos.cartao, cartao]}>
          <Texto style={[estilos.rotulo, { color: marcaParaTexto(marca.corPrimaria, cores.superficie) }]}>TREINO A</Texto>
          <Texto style={[estilos.titulo, { color: cores.texto }]}>Costas e bíceps</Texto>
          <Texto style={[estilos.miudo, { color: cores.textoSuave }]}>6 exercícios</Texto>
          <View style={[estilos.botao, { backgroundColor: peca }]}>
            <Texto style={[estilos.textoDoBotao, { color: textoSobre(peca) }]}>Começar</Texto>
          </View>
        </View>
        <View style={[estilos.cartao, cartao]}>
          <Texto style={[estilos.secao, { color: cores.textoSuave }]}>PRÓXIMA REFEIÇÃO</Texto>
          <Texto style={[estilos.item, { color: cores.texto }]}>Almoço · 12h30</Texto>
          <Texto style={[estilos.miudo, { color: cores.textoSuave }]}>Arroz, feijão e frango grelhado</Texto>
        </View>
      </View>
      <View style={[estilos.barra, { backgroundColor: cores.superficie, borderTopColor: cores.divisor }]}>
        {ABAS.map(({ rotulo, Icone }, i) => {
          const ativa = i === 0;
          return (
            <View key={rotulo} style={estilos.aba}>
              <View style={[estilos.pilula, ativa ? { backgroundColor: cores.superficie3 } : null]}>
                <Icone size={18} color={ativa ? cores.texto : cores.textoSuave} strokeWidth={2} />
              </View>
              <Texto style={[estilos.rotuloDaAba, { color: ativa ? cores.texto : cores.textoSuave, fontFamily: ativa ? fontes.semi : fontes.normal }]}>{rotulo}</Texto>
            </View>
          );
        })}
      </View>
    </>
  );
}

/**
 * A tela de entrar como as telas públicas com a marca da consultoria (`ui/TelaPublica`: convite e inscrição): no topo a
 * logo centrada (ou o nome na fonte escolhida), o título e o subtítulo, o cartão com os campos e o botão na cor da marca
 * (o `BotaoPublico` com `cor`). O topo estica os filhos como o da `TelaPublica`: com `alignItems: center` a caixa da logo
 * encolhia a 0 e a logo sumia (defeito de 28/11).
 */
function TelaDeEntrar({ marca, cores }: { marca: Marca; cores: Cores }) {
  const campo = { backgroundColor: cores.campo, borderColor: cores.bordaCampo };
  return (
    <View style={estilos.entrar}>
      <View style={estilos.cabecaDeEntrar}>
        <MarcaTitulo marca={marca} tamanho="grande" fundo={cores.fundo} />
        <View style={estilos.titulosDeEntrar}>
          <Texto style={[estilos.tituloDeEntrar, { color: cores.texto }]}>Entre na sua área de aluno</Texto>
          <Texto style={[estilos.miudo, { color: cores.textoSuave }]}>Acesse seus treinos, alimentação e acompanhamento.</Texto>
        </View>
      </View>
      <View style={[estilos.cartao, estilos.campos, { backgroundColor: cores.superficie, borderColor: cores.divisor }]}>
        {['E-mail', 'Senha'].map((r) => (
          <View key={r} style={estilos.campo}>
            <Texto style={[estilos.rotuloDoCampo, { color: cores.texto }]}>{r}</Texto>
            <View style={[estilos.caixa, campo]} />
          </View>
        ))}
        <View style={[estilos.botao, estilos.botaoCheio, { backgroundColor: marca.corPrimaria }]}>
          <Texto style={[estilos.textoDoBotao, { color: textoSobre(marca.corPrimaria) }]}>Entrar</Texto>
        </View>
      </View>
      <Texto style={[estilos.miudo, estilos.centro, { color: cores.textoSuave }]}>Esqueci minha senha</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  previa: { gap: espaco(2) },
  esticada: { flex: 1, minHeight: 0 },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  titulos: { flexGrow: 1, flexShrink: 1, flexBasis: 240, gap: 2 },
  verEm: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  celulares: { flexDirection: 'row', gap: VAO_DOS_CELULARES },
  corpo: { padding: espaco(2), gap: espaco(1.5) },
  topoDoInicio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  marca: { flexShrink: 1, minWidth: 0 },
  foto: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iniciais: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
  ola: { fontFamily: fontes.semi, fontSize: 20, lineHeight: 26 },
  miudo: { fontFamily: fontes.normal, fontSize: 13, lineHeight: 18 },
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  rotulo: { fontFamily: fontes.negrito, fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  secao: { fontFamily: fontes.semi, fontSize: 11, lineHeight: 16, letterSpacing: 0.6 },
  titulo: { fontFamily: fontes.negrito, fontSize: 20, lineHeight: 26 },
  item: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  botao: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: espaco(2), borderRadius: RAIO_CONTROLE, justifyContent: 'center', alignItems: 'center', marginTop: espaco(0.5) },
  botaoCheio: { alignSelf: 'stretch', minHeight: ALVO_TOQUE },
  textoDoBotao: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  barra: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: espaco(1), paddingHorizontal: espaco(0.5) },
  aba: { flex: 1, alignItems: 'center', gap: 2 },
  pilula: { paddingHorizontal: espaco(1.5), paddingVertical: 4, borderRadius: 999 },
  rotuloDaAba: { fontSize: 11, lineHeight: 14 },
  entrar: { flex: 1, padding: espaco(2.5), justifyContent: 'center', gap: espaco(2) },
  // Estica (não centra) como o topo da `TelaPublica`: a logo grande tem `width: 100%` e precisa de uma caixa com largura.
  cabecaDeEntrar: { gap: espaco(2) },
  titulosDeEntrar: { gap: 4 },
  tituloDeEntrar: { fontFamily: fontes.negrito, fontSize: 20, lineHeight: 26 },
  centro: { textAlign: 'center' },
  campos: { gap: espaco(1.5) },
  campo: { gap: 4 },
  rotuloDoCampo: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 18 },
  caixa: { height: 40, borderWidth: 1, borderRadius: RAIO_CONTROLE },
});
