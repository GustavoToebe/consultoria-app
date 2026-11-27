import { Library, PencilLine, Trash2 } from 'lucide-react-native';
import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { ConteudoDieta } from '../../api/tipos';
import { type AbaDosComplementos, type ArranjoDosComplementos, arranjoDosComplementos, contagemDaAba, LIMITES_DOS_COMPLEMENTOS, problemasDosComplementos } from '../../dominio/complementosDaDieta';
import { LINHA_DAS_TRES_COLUNAS, LINHA_DO_TOTAL_ULTRALARGO } from '../../dominio/colunasDaDieta';
import { inteiroComMilhar } from '../../dominio/formatos';
import { remover, substituir } from '../../dominio/editorTreino';
import { linhaDeErgogenico } from '../../dominio/ergogenicos';
import { moverPara } from '../../dominio/reordenar';
import { novoUid } from '../../dominio/uid';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_TEXTO_CORRIDO, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoQueCresce } from '../../ui/CampoQueCresce';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { BotaoDeAbrir } from '../treino/BotaoDeAbrir';
import { CampoDaTabela } from './CampoDaTabela';
import { COLUNA_DA_DOSE, COLUNA_DE_DETALHE, COLUNA_DO_HORARIO, LARGURA_DA_TABELA } from './colunasDosComplementos';
import { ContadorDeCaracteres } from './ContadorDeCaracteres';
import { OrientacoesDaDieta } from './OrientacoesDaDieta';
import { PreviaDasObservacoes } from './PreviaDosComplementos';
import { SuplementacaoDaDieta } from './SuplementacaoDaDieta';

type Ergogenico = NonNullable<ConteudoDieta['ergogenicos']>[number];

interface Props {
  conteudo: ConteudoDieta;
  aoMudar: (parcial: Partial<ConteudoDieta>) => void;
  /** Remoção com a barra "Desfazer" do editor. */
  comDesfazer: (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta, onde?: { secao?: 'complementos' }) => void;
  aviso?: ReactNode;
  /** Porção da embalagem do produto escolhido nesta abertura (só referência ao escrever a dose). */
  porcoes: Record<string, string>;
  veBiblioteca: boolean;
  veErgogenicos: boolean;
  editaErgogenicos: boolean;
  /** Abre a escolha da biblioteca (suplemento ou ergogênico). */
  aoEscolherDaBiblioteca: (tipo: 'suplemento' | 'ergogenico') => void;
  /** "Ir ao primeiro" da lista de problemas: os uids do problema; `vez` muda a cada pedido. Abre a aba Suplementação ou Outros se o problema está lá. */
  irPara?: { uids: string[]; vez: number } | null;
}

const SECAO = { secao: 'complementos' } as const;

/**
 * Complementos da dieta (25/11), abaixo das refeições: um cartão com abas, sem teto de largura (26/11). Orientações
 * (lista compacta e reordenável, `OrientacoesDaDieta`) e Observações (com o contador) em largura de leitura, à esquerda;
 * Suplementação na largura toda (tabela no PC e cartões no celular, `SuplementacaoDaDieta`) e, só com `ERGOGENICO_LER`,
 * Outros (medicação e ergogênicos; sem `ERGOGENICO_ALTERAR`, só leitura). A aba com problema leva o ícone na cor da
 * gravidade (`problemasDosComplementos`). A aba aberta fica neste estado: o editor não remonta o cartão ao salvar, ao
 * recarregar o plano nem ao trocar de refeição, então ela não volta à primeira (e nada se guarda no aparelho, 4.8).
 * O modelo de uma refeição só não tem complementos (seriam descartados ao aplicar).
 */
export function ComplementosDaDieta({ conteudo: c, aoMudar: mudar, comDesfazer, aviso, porcoes, veBiblioteca, veErgogenicos, editaErgogenicos, aoEscolherDaBiblioteca, irPara }: Props) {
  const { cores } = useTema();
  const ergogenicos = c.ergogenicos ?? [];
  const [aba, setAba] = useState<AbaDosComplementos>('orientacoes');
  const [vezVista, setVezVista] = useState(irPara?.vez);
  const [larguraDeOutros, setLarguraDeOutros] = useState(0);
  // A largura do cartão na linha do editor (o `TelaDoEditor` não é uma `Tela`, então não há `useFaixaDaTela` aqui): a
  // mesma régua do Total do dia (`colunasDaDieta`), as faixas `larga` e `ultralarga` vistas de dentro do recuo.
  const [linha, setLinha] = useState<number | null>(null);
  const arranjo = arranjoDosComplementos(linha, LINHA_DAS_TRES_COLUNAS, LINHA_DO_TOTAL_ULTRALARGO);
  if (irPara && irPara.vez !== vezVista) {
    setVezVista(irPara.vez);
    if (c.suplementacao.some((s) => irPara.uids.includes(s.uid))) setAba('suplementacao');
    else if (veErgogenicos && ergogenicos.some((e) => irPara.uids.includes(e.uid))) setAba('outros');
  }
  // Sem ERGOGENICO_LER a aba Outros não existe (nem a lista vem da API).
  const ativa: AbaDosComplementos = aba === 'outros' && !veErgogenicos ? 'orientacoes' : aba;
  const problemas = problemasDosComplementos(c);
  const abas = [
    { valor: 'orientacoes' as const, rotulo: 'Orientações', contagem: contagemDaAba(c.orientacoes.length), problema: problemas.orientacoes },
    { valor: 'observacoes' as const, rotulo: 'Observações', problema: problemas.observacoes },
    { valor: 'suplementacao' as const, rotulo: 'Suplementação', contagem: contagemDaAba(c.suplementacao.length), problema: problemas.suplementacao },
    ...(veErgogenicos ? [{ valor: 'outros' as const, rotulo: 'Outros', contagem: contagemDaAba(ergogenicos.length), problema: problemas.outros }] : []),
  ];

  return (
    <View onLayout={(e) => setLinha(Math.round(e.nativeEvent.layout.width))}>
    <Cartao titulo="Complementos">
      {aviso}
      <Abas abas={abas} ativa={ativa} aoMudar={setAba} fundo={cores.superficie} />
      <View style={estilos.painel}>
        {ativa === 'orientacoes' ? (
          <OrientacoesDaDieta orientacoes={c.orientacoes} arranjo={arranjo} aoMudar={(orientacoes) => mudar({ orientacoes })}
            aoRemover={(i) => comDesfazer(`Orientação “${c.orientacoes[i]?.titulo.trim() || i + 1}” removida.`, (a) => ({ ...a, orientacoes: remover(a.orientacoes, i) }), SECAO)} />
        ) : null}
        {ativa === 'observacoes' ? <ObservacoesDaDieta valor={c.observacoes ?? ''} arranjo={arranjo} aoMudar={(t) => mudar({ observacoes: t || null })} /> : null}
        {ativa === 'suplementacao' ? (
          <SuplementacaoDaDieta itens={c.suplementacao} porcoes={porcoes} veBiblioteca={veBiblioteca}
            aoMudar={(i, parcial) => mudar({ suplementacao: substituir(c.suplementacao, i, { ...c.suplementacao[i], ...parcial }) })}
            aoMover={(de, para) => mudar({ suplementacao: moverPara(c.suplementacao, de, para) })}
            aoRemover={(i) => comDesfazer(`Suplemento “${c.suplementacao[i]?.nome.trim() || i + 1}” removido.`, (a) => ({ ...a, suplementacao: remover(a.suplementacao, i) }), SECAO)}
            aoAdicionarManual={() => {
              const uid = novoUid();
              mudar({ suplementacao: [...c.suplementacao, { uid, nome: '', dose: '', horario: '', observacao: '', link: null, cupom: null }] });
              return uid;
            }}
            aoEscolherDaBiblioteca={() => aoEscolherDaBiblioteca('suplemento')} />
        ) : null}
        {ativa === 'outros' ? (
          <View style={estilos.outros} onLayout={(ev) => setLarguraDeOutros(ev.nativeEvent.layout.width)}>
            <Texto variante="suave">
              {editaErgogenicos ? 'Medicação e ergogênicos do aluno. Da biblioteca vêm o nome, o princípio ativo e a concentração.' : 'Medicação e ergogênicos do aluno. Seu perfil só pode ler esta lista.'}
            </Texto>
            {ergogenicos.length === 0 ? <Texto variante="suave">Nenhum item ainda.</Texto> : null}
            {ergogenicos.map((e, ei) => (
              <ItemDeErgogenico key={e.uid} item={e} posicao={ei} editavel={editaErgogenicos} emColunas={larguraDeOutros >= LARGURA_DA_TABELA}
                aoMudar={(parcial) => mudar({ ergogenicos: substituir(ergogenicos, ei, { ...e, ...parcial }) })}
                aoRemover={() => comDesfazer(`Item “${e.nome || ei + 1}” removido.`, (a) => ({ ...a, ergogenicos: remover(a.ergogenicos ?? [], ei) }), SECAO)} />
            ))}
            {editaErgogenicos ? (
              <LinhaDeAcoes>
                <Botao rotulo="Ergogênico da biblioteca" rotuloAcessivel="Ergogênico da biblioteca (medicação ou ergogênico)" tipo="acao" Icone={Library} aoTocar={() => aoEscolherDaBiblioteca('ergogenico')} />
                <Botao
                  rotulo="Ergogênico manual"
                  rotuloAcessivel="Ergogênico manual (medicação ou ergogênico)"
                  tipo="secundario"
                  Icone={PencilLine}
                  aoTocar={() => mudar({ ergogenicos: [...ergogenicos, linhaDeErgogenico({ nome: '', principioAtivo: null, concentracao: null }, novoUid())] })}
                />
              </LinhaDeAcoes>
            ) : null}
          </View>
        ) : null}
      </View>
    </Cartao>
    </View>
  );
}

/**
 * Observações com o contador de caracteres no canto (até 8.000, o limite da API). `lista`: em largura de leitura (~72
 * caracteres), como antes. Lado a lado (27/11, faixa `larga` em diante): o campo à esquerda (50%), crescendo com o texto,
 * e "Como o aluno vê" à direita (50%); a frase "O aluno lê junto com a dieta" sai, porque a prévia mostra isso.
 */
function ObservacoesDaDieta({ valor, arranjo, aoMudar }: { valor: string; arranjo: ArranjoDosComplementos; aoMudar: (t: string) => void }) {
  const max = LIMITES_DOS_COMPLEMENTOS.observacoes;
  const idDoContador = useId();
  const erro = valor.length > max ? `Até ${inteiroComMilhar(max)} caracteres.` : null;
  if (arranjo === 'lista') {
    return (
      <View style={estilos.leitura}>
        <Campo rotulo="Observações (opcional)" valor={valor} aoMudar={aoMudar} linhas={8} maxLength={max}
          ajuda="O aluno lê junto com a dieta, com as quebras de linha." erro={erro} />
        <ContadorDeCaracteres usados={valor.length} maximo={max} />
      </View>
    );
  }
  return (
    <View style={estilos.lado}>
      <View style={[estilos.metade, estilos.campoComContador]}>
        <CampoQueCresce rotulo="Observações (opcional)" valor={valor} aoMudar={aoMudar} linhas={8} maximoDeLinhas={30} maxLength={max}
          ajudaForaDoCampo={{ id: idDoContador, texto: `${inteiroComMilhar(valor.length)} de ${inteiroComMilhar(max)} caracteres` }} erro={erro} />
        <ContadorDeCaracteres nativeID={idDoContador} usados={valor.length} maximo={max} />
      </View>
      <View style={estilos.metade}><PreviaDasObservacoes texto={valor} /></View>
    </View>
  );
}

const MAIS_DETALHES = 'Mais detalhes (princípio ativo, concentração, observação)';

/**
 * Item de "Outros" (nível "item": `superficie2` + borda), com "#N · Nome" e a lixeira no canto; o resto em "Mais
 * detalhes", fechado. A partir de 720 px de lista (26/11), as colunas da Suplementação (`colunasDosComplementos`): Dose e
 * Horário com teto e o Nome com o resto; em "Mais detalhes", princípio ativo, concentração e prescrição com teto e a
 * Observação com o resto. Abaixo disso, a grade que quebra (celular).
 */
function ItemDeErgogenico({ item: e, posicao, editavel, emColunas, aoMudar, aoRemover }: {
  item: Ergogenico; posicao: number; editavel: boolean; emColunas: boolean; aoMudar: (parcial: Partial<Ergogenico>) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  // Nasce fechado, mesmo com texto nos quatro campos secundários (regra de 18/11; o item que veio da biblioteca também).
  const [detalhes, setDetalhes] = useState(false);
  const L = LIMITES_DOS_COMPLEMENTOS;
  const grade = emColunas ? estilos.linha : estilos.grade;
  const coluna = (larga: ViewStyle) => (emColunas ? larga : estilos.campo);
  return (
    <View style={[estilos.subCartao, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <CabecalhoDoItem titulo={`#${posicao + 1} · ${e.nome.trim() || 'Sem nome'}`} aberto nomeDoItem="item"
        remover={editavel ? <IconeBotao Icone={Trash2} rotulo={`Remover ${e.nome || 'item'}`} cor={cores.perigo} aoTocar={aoRemover} /> : undefined} />
      <View style={grade}>
        <View style={coluna(estilos.resto)}><CampoDaColuna rotulo="Nome" valor={e.nome} aoMudar={(nome) => aoMudar({ nome })} maxLength={L.campoCurto} editable={editavel} /></View>
        <View style={coluna(COLUNA_DA_DOSE)}><CampoDaColuna rotulo="Dose prescrita" valor={e.dose} aoMudar={(dose) => aoMudar({ dose })} maxLength={L.campoCurto} editable={editavel} /></View>
        <View style={coluna(COLUNA_DO_HORARIO)}><CampoDaColuna rotulo="Horário" valor={e.horario} aoMudar={(horario) => aoMudar({ horario })} maxLength={L.campoCurto} editable={editavel} /></View>
      </View>
      <BotaoDeAbrir texto={MAIS_DETALHES} aberto={detalhes} aoAlternar={() => setDetalhes(!detalhes)} />
      {detalhes ? (
        <View style={grade}>
          <View style={coluna(COLUNA_DE_DETALHE)}>
            <CampoDaColuna rotulo="Princípio ativo" valor={e.principioAtivo} aoMudar={(principioAtivo) => aoMudar({ principioAtivo })} maxLength={L.principioAtivo} editable={editavel} />
          </View>
          <View style={coluna(COLUNA_DA_DOSE)}>
            <CampoDaColuna rotulo="Concentração" valor={e.concentracao} aoMudar={(concentracao) => aoMudar({ concentracao })} maxLength={L.concentracao} editable={editavel} />
          </View>
          <View style={coluna(COLUNA_DE_DETALHE)}>
            <CampoDaColuna rotulo="Prescrição (opcional)" valor={e.prescricao} aoMudar={(prescricao) => aoMudar({ prescricao })} maxLength={L.prescricao} editable={editavel} />
          </View>
          <View style={emColunas ? estilos.resto : estilos.campoLargo}>
            <CampoDaColuna rotulo="Observação" valor={e.observacao} aoMudar={(observacao) => aoMudar({ observacao })} maxLength={L.observacao} editable={editavel} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * O campo da tabela com o rótulo à vista (Outros não tem cabeçalho de colunas: cada item tem o título "#N · Nome"). Cresce
 * até 6 linhas (26/11): a observação de ~120 caracteres pede 5 na coluna mais estreita (~206 px, lista de 720) e o nome
 * de 120, 6 na grade de 654 px; daí em diante rola dentro do campo.
 */
function CampoDaColuna(props: Omit<ComponentProps<typeof Campo>, 'linhas' | 'ref'>) {
  return <CampoDaTabela {...props} rotuloOculto={false} maximoDeLinhas={6} />;
}

const estilos = StyleSheet.create({
  painel: { paddingTop: espaco(1) },
  leitura: { gap: espaco(0.5), maxWidth: LARGURA_TEXTO_CORRIDO },
  lado: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  metade: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  campoComContador: { gap: espaco(0.5) },
  outros: { gap: espaco(1.5) },
  subCartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campo: { minWidth: 190, flex: 1 },
  campoLargo: { minWidth: 190, flexBasis: '100%' },
  // Em colunas: uma linha sem quebra, alinhada pelo topo (rótulos na mesma altura).
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5) },
  resto: { flex: 1, minWidth: 0 },
});
