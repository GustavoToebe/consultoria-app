import { ChevronDown, ChevronRight, CircleAlert, Ellipsis, ExternalLink, Library, Link2Off, PencilLine, TicketX, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Suplemento } from '../../api/tipos';
import { faltaNoSuplemento, LIMITES_DOS_COMPLEMENTOS, linhasDoNome, nomeSemQuebra } from '../../dominio/complementosDaDieta';
import { linkParaAbrir } from '../../dominio/links';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { AlcaDeArraste, ItemArrastavel, LARGURA_DA_ALCA, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { coresDaEdicao } from '../../ui/selecao';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { NUMERICO } from '../../ui/tipografia';
import { acoesDeMover } from '../acoesDeMover';
import type { AcaoDoMenu } from '../FolhaDeAcoes';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { CampoDaTabela } from './CampoDaTabela';
import { COLUNA_DA_DOSE, COLUNA_DO_HORARIO, LARGURA_DA_TABELA } from './colunasDosComplementos';

type Modo = 'tabela' | 'cartoes';

const VAO = espaco(1);
const RECUO = espaco(1);

/**
 * Aba Suplementação do cartão Complementos (25/11). PC: tabela com o cabeçalho uma vez (Suplemento, Dose prescrita,
 * Horário, Observação; fora do leitor de tela, cada campo tem o nome dele), uma faixa por suplemento com a alça e o ⋯
 * (mover, Tirar link, Tirar cupom e Excluir com Desfazer). Sem teto de largura (26/11): colunas proporcionais (Suplemento
 * 28%, Dose 12% e Horário 10%, os dois com teto; a Observação fica com o resto). Os campos crescem sozinhos de uma a
 * duas linhas (`CampoDaTabela`; o que passar rola dentro do campo); o link do
 * produto abre fora do app (só https, `linkParaAbrir`) pelo ícone no fim do campo do nome (só com link; 27/11); o cupom fica embaixo dele. Celular:
 * um cartão compacto (nome em cima, "dose · horário" embaixo) que abre os campos ao tocar, um aberto por vez.
 */
export function SuplementacaoDaDieta({ itens, porcoes, veBiblioteca, aoMudar, aoMover, aoRemover, aoAdicionarManual, aoEscolherDaBiblioteca }: {
  itens: Suplemento[];
  /** Porção da embalagem do produto escolhido nesta abertura (só referência ao escrever a dose). */
  porcoes: Record<string, string>;
  veBiblioteca: boolean;
  aoMudar: (indice: number, parcial: Partial<Suplemento>) => void;
  aoMover: (de: number, para: number) => void;
  /** Remove com a barra "Desfazer" do editor. */
  aoRemover: (indice: number) => void;
  /** Acrescenta uma linha manual em branco e devolve o uid dela (que nasce aberta e com o foco no nome). */
  aoAdicionarManual: () => string;
  aoEscolherDaBiblioteca: () => void;
}) {
  const [largura, setLargura] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);
  const [focar, setFocar] = useState<string | null>(null);
  const modo: Modo = largura >= LARGURA_DA_TABELA ? 'tabela' : 'cartoes';
  const arraste = useArrasteDaLista({ total: itens.length, folga: 3, aoSoltar: aoMover });
  return (
    <View style={estilos.aba} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {itens.length === 0 ? (
        <Texto variante="suave">Nenhum suplemento ainda. Escolha da biblioteca (vêm o nome, o link e o cupom) ou escreva um manual.</Texto>
      ) : (
        <View style={estilos.itens} role="group" accessibilityLabel="Suplementação da dieta">
          {modo === 'tabela' ? <CabecalhoDasColunas /> : null}
          {itens.map((s, i) => (
            <ItemArrastavel key={s.uid} arraste={arraste} indice={i}>
              <LinhaDoSuplemento modo={modo} item={s} posicao={i} total={itens.length} porcao={porcoes[s.uid]}
                aberto={aberto === s.uid} focar={focar === s.uid}
                alca={<AlcaDeArraste arraste={arraste} indice={i} />}
                aoAlternar={() => { setFocar(null); setAberto(aberto === s.uid ? null : s.uid); }}
                aoMudar={(parcial) => aoMudar(i, parcial)} aoMover={(d) => aoMover(i, i + d)} aoRemover={() => aoRemover(i)} />
            </ItemArrastavel>
          ))}
        </View>
      )}
      <LinhaDeAcoes>
        {veBiblioteca ? <Botao rotulo="Suplemento da biblioteca" tipo="acao" Icone={Library} aoTocar={aoEscolherDaBiblioteca} /> : null}
        <Botao rotulo="Suplemento manual" tipo="secundario" Icone={PencilLine} aoTocar={() => {
          const uid = aoAdicionarManual();
          setAberto(uid);
          setFocar(uid);
        }} />
      </LinhaDeAcoes>
    </View>
  );
}

/** Os títulos das colunas, uma vez, com o mesmo recuo da faixa (a alça e o ⋯ ficam sem título). */
function CabecalhoDasColunas() {
  return (
    <View aria-hidden style={[estilos.linhaDaTabela, estilos.cabecalho]}>
      <View style={estilos.colunaDaAlca} />
      <View style={estilos.colunaDoNome}><Texto variante="rotulo">Suplemento</Texto></View>
      <View style={estilos.colunaDaDose}><Texto variante="rotulo">Dose prescrita</Texto></View>
      <View style={estilos.colunaDoHorario}><Texto variante="rotulo">Horário</Texto></View>
      <View style={estilos.colunaDaObservacao}><Texto variante="rotulo">Observação</Texto></View>
      <View style={estilos.colunaDasAcoes} />
    </View>
  );
}

function LinhaDoSuplemento({ modo, item: s, posicao, total, porcao, aberto, focar, alca, aoAlternar, aoMudar, aoMover, aoRemover }: {
  modo: Modo;
  item: Suplemento;
  posicao: number;
  total: number;
  porcao?: string;
  aberto: boolean;
  focar: boolean;
  alca: ReactNode;
  aoAlternar: () => void;
  aoMudar: (parcial: Partial<Suplemento>) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
}) {
  const { cores, fatorTexto } = useTema();
  const { avisar } = useAviso();
  const [menu, setMenu] = useState(false);
  const [larguraDoNome, setLarguraDoNome] = useState(0);
  const n = posicao + 1;
  const nome = s.nome.trim() || `suplemento ${n}`;
  const tabela = modo === 'tabela';
  const link = linkParaAbrir(s.link);
  const linkInvalido = !!s.link?.trim() && !link;
  const falta = faltaNoSuplemento(s);
  const L = LIMITES_DOS_COMPLEMENTOS;
  const acoes: AcaoDoMenu[] = [
    ...acoesDeMover({ nome, posicao, total, aoMover }),
    ...(s.link ? [{ rotulo: 'Tirar link', detalhe: `O aluno deixa de ver o link do produto de ${nome}.`, Icone: Link2Off, aoTocar: () => aoMudar({ link: null }) }] : []),
    ...(s.cupom ? [{ rotulo: 'Tirar cupom', detalhe: `O aluno deixa de ver o cupom de ${nome}.`, Icone: TicketX, aoTocar: () => aoMudar({ cupom: null }) }] : []),
    { rotulo: 'Excluir suplemento', detalhe: `Remover ${nome}. Dá para desfazer logo depois.`, Icone: Trash2, perigo: true, aoTocar: aoRemover },
  ];

  const abrirProduto = link ? (
    <IconeBotao Icone={ExternalLink} rotulo={`Abrir produto ${nome} (fora do app)`}
      aoTocar={() => { void abrirLinkExterno(link).then((ok) => { if (!ok) avisar('Não foi possível abrir o link.', 'perigo'); }); }} />
  ) : null;
  // Na tabela os quatro campos são `CampoDaTabela` (uma a duas linhas, mesma altura e o texto na mesma linha de base). No
  // cartão o nome quebra quantas linhas precisar (`linhasDoNome`) e os outros são de uma linha. Na tabela o link do produto
  // é o ícone no fim do campo do nome (`acao` do `Campo`, 27/11), só quando há link: sem coluna vazia nas linhas sem link.
  const CampoDaLinha = tabela ? CampoDaTabela : Campo;
  const campoNome = tabela ? (
    <CampoDaTabela rotulo="Nome" rotuloAcessivel={`Nome do suplemento ${n}`} valor={s.nome} maxLength={L.campoCurto} autoFocus={focar}
      placeholder="Ex.: Creatina" acao={abrirProduto ?? undefined} aoMudar={(nome) => aoMudar({ nome })} />
  ) : (
    <View onLayout={(e) => setLarguraDoNome(e.nativeEvent.layout.width)}>
      <Campo rotulo="Nome" rotuloAcessivel={`Nome do suplemento ${n}`} valor={s.nome} linhas={linhasDoNome(s.nome, larguraDoNome, fatorTexto)}
        maxLength={L.campoCurto} autoFocus={focar} placeholder="Ex.: Creatina" blurOnSubmit onSubmitEditing={() => undefined}
        aoMudar={(v) => aoMudar({ nome: nomeSemQuebra(v) })} />
    </View>
  );
  const campoDose = (
    <CampoDaLinha rotulo="Dose prescrita" rotuloAcessivel={`Dose prescrita do suplemento ${n}`} valor={s.dose} maxLength={L.campoCurto}
      ajuda={porcao ? `Embalagem: ${porcao} (só referência)` : undefined} aoMudar={(dose) => aoMudar({ dose })} />
  );
  const campoHorario = (
    <CampoDaLinha rotulo="Horário" rotuloAcessivel={`Horário do suplemento ${n}`} valor={s.horario} maxLength={L.campoCurto}
      placeholder={tabela ? undefined : 'Ex.: Após o treino'} aoMudar={(horario) => aoMudar({ horario })} />
  );
  const campoObservacao = (
    <CampoDaLinha rotulo="Observação" rotuloAcessivel={`Observação do suplemento ${n}`} valor={s.observacao} maxLength={L.observacao}
      aoMudar={(observacao) => aoMudar({ observacao })} />
  );
  // Embaixo do nome: o cupom (vem da biblioteca; tirar fica no ⋯), o link que a API recusaria e o nome que falta; a dose
  // que falta fica embaixo da dose.
  const seloDaFalta = (qual: string) => (falta === qual ? <View style={estilos.selo}><Selo texto={falta} tipo="atencao" /></View> : null);
  const sobreONome = (
    <>
      {s.cupom ? <Texto variante="pequeno">Cupom: <Texto variante="pequeno" style={NUMERICO}>{s.cupom}</Texto></Texto> : null}
      {linkInvalido ? <View style={estilos.selo}><Selo texto="Link inválido: tire o link no ⋯" tipo="perigo" Icone={CircleAlert} /></View> : null}
      {seloDaFalta('Falta o nome')}
    </>
  );
  const mais = <IconeBotao Icone={Ellipsis} rotulo={`Mais ações de ${nome}`} aoTocar={() => setMenu(true)} />;
  const contorno = linkInvalido ? cores.perigo : 'transparent';
  const folha = menu ? <FolhaDeAcoes titulo={s.nome.trim() || 'Suplemento sem nome'} aoFechar={() => setMenu(false)} acoes={acoes} /> : null;

  if (tabela) {
    return (
      <View style={[estilos.faixa, { backgroundColor: cores.superficie2, borderColor: contorno }]}>
        <View style={estilos.linhaDaTabela}>
          <View style={[estilos.colunaDaAlca, estilos.noMeio]}>{alca}</View>
          <View style={[estilos.colunaDoNome, estilos.celula]}>
            {campoNome}
            {sobreONome}
          </View>
          <View style={[estilos.colunaDaDose, estilos.celula]}>{campoDose}{seloDaFalta('Falta a dose')}</View>
          <View style={estilos.colunaDoHorario}>{campoHorario}</View>
          <View style={estilos.colunaDaObservacao}>{campoObservacao}</View>
          <View style={[estilos.colunaDasAcoes, estilos.noMeio]}>{mais}</View>
        </View>
        {folha}
      </View>
    );
  }

  const Seta = aberto ? ChevronDown : ChevronRight;
  const resumo = [s.dose.trim(), s.horario.trim()].filter(Boolean).join(' · ');
  return (
    <View style={[estilos.faixa, { backgroundColor: aberto ? coresDaEdicao(cores).fundoDoBloco : cores.superficie2, borderColor: contorno }]}>
      <View style={estilos.linhaDoCartao}>
        <View style={estilos.colunaDaAlca}>{alca}</View>
        <Pressable accessibilityRole="button" aria-expanded={aberto}
          accessibilityLabel={`Suplemento ${n} de ${total}: ${s.nome.trim() || 'sem nome'}${resumo ? `, ${resumo}` : ''}${falta ? `, ${falta.toLowerCase()}` : ''}. ${aberto ? 'Fechar edição' : 'Editar'}`}
          onPress={aoAlternar} style={estilos.botaoDoCartao}>
          {(estado) => (
            <View style={[estilos.resumoDoCartao, sobre(estado) && !aberto ? { backgroundColor: cores.superficie3 } : null]}>
              <View style={estilos.tituloDoCartao}>
                <View style={estilos.seta}><Seta size={16} color={aberto ? cores.acao : cores.textoSuave} strokeWidth={2.25} aria-hidden /></View>
                <Texto style={[estilos.nomeDoCartao, s.nome.trim() ? null : { color: cores.textoSuave }]}>{s.nome.trim() || 'Sem nome'}</Texto>
              </View>
              {aberto ? null : (
                <View style={estilos.detalheDoCartao}>
                  {resumo ? <Texto variante="suave">{resumo}</Texto> : null}
                  {s.cupom ? <Texto variante="pequeno">Cupom: <Texto variante="pequeno" style={NUMERICO}>{s.cupom}</Texto></Texto> : null}
                  {linkInvalido ? <View style={estilos.selo}><Selo texto="Link inválido: tire o link no ⋯" tipo="perigo" Icone={CircleAlert} /></View> : null}
                  {falta ? <View style={estilos.selo}><Selo texto={falta} tipo="atencao" /></View> : null}
                </View>
              )}
            </View>
          )}
        </Pressable>
        {abrirProduto}
        {mais}
      </View>
      {aberto ? (
        <View style={estilos.edicao} role="group" accessibilityLabel={`Editando suplemento ${n}`}>
          {campoNome}
          {campoDose}
          {seloDaFalta('Falta a dose')}
          {campoHorario}
          {campoObservacao}
          {sobreONome}
        </View>
      ) : null}
      {folha}
    </View>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: espaco(2) },
  // Sem teto (26/11): a tabela vai na largura toda do cartão; quem não estica são a Dose e o Horário (teto próprio).
  itens: { gap: 6 },
  faixa: { borderRadius: 12, borderWidth: 1, paddingHorizontal: RECUO, paddingVertical: espaco(1) },
  linhaDaTabela: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
  cabecalho: { paddingHorizontal: RECUO + 1, alignItems: 'center' },
  colunaDaAlca: { width: LARGURA_DA_ALCA },
  // Proporções da linha (26/11): Suplemento 28%, Dose e Horário com teto (`colunasDosComplementos`, as mesmas de Outros)
  // e a Observação com o resto.
  colunaDoNome: { width: '28%', minWidth: 0 },
  colunaDaDose: COLUNA_DA_DOSE,
  colunaDoHorario: COLUNA_DO_HORARIO,
  colunaDaObservacao: { flex: 1, minWidth: 0 },
  colunaDasAcoes: { width: ALVO_TOQUE },
  celula: { gap: espaco(0.5) },
  noMeio: { minHeight: ALVO_TOQUE, justifyContent: 'center' },
  selo: { flexDirection: 'row' },
  linhaDoCartao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  botaoDoCartao: { flex: 1, minWidth: 0, minHeight: ALVO_TOQUE, justifyContent: 'center', borderRadius: 8 },
  resumoDoCartao: { gap: 2, paddingHorizontal: espaco(1), paddingVertical: espaco(0.75), borderRadius: 8 },
  tituloDoCartao: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.75) },
  seta: { height: 21, justifyContent: 'center' },
  // O nome quebra quanto precisar (nunca cortado); a dose e o horário ficam embaixo, alinhados ao começo do nome.
  nomeDoCartao: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  detalheDoCartao: { gap: 4, paddingLeft: 16 + espaco(0.75) },
  edicao: { gap: espaco(1.5), paddingTop: espaco(1), paddingBottom: espaco(1), paddingLeft: LARGURA_DA_ALCA + espaco(0.5) },
});
