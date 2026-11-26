import { Library, PencilLine, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../../api/tipos';
import { type AbaDosComplementos, contagemDaAba, LIMITES_DOS_COMPLEMENTOS, problemasDosComplementos } from '../../dominio/complementosDaDieta';
import { remover, substituir } from '../../dominio/editorTreino';
import { linhaDeErgogenico } from '../../dominio/ergogenicos';
import { moverPara } from '../../dominio/reordenar';
import { novoUid } from '../../dominio/uid';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_TEXTO_CORRIDO, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { BotaoDeAbrir } from '../treino/BotaoDeAbrir';
import { ContadorDeCaracteres } from './ContadorDeCaracteres';
import { OrientacoesDaDieta } from './OrientacoesDaDieta';
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
    <Cartao titulo="Complementos">
      {aviso}
      <Abas abas={abas} ativa={ativa} aoMudar={setAba} fundo={cores.superficie} />
      <View style={estilos.painel}>
        {ativa === 'orientacoes' ? (
          <OrientacoesDaDieta orientacoes={c.orientacoes} aoMudar={(orientacoes) => mudar({ orientacoes })}
            aoRemover={(i) => comDesfazer(`Orientação “${c.orientacoes[i]?.titulo.trim() || i + 1}” removida.`, (a) => ({ ...a, orientacoes: remover(a.orientacoes, i) }), SECAO)} />
        ) : null}
        {ativa === 'observacoes' ? <ObservacoesDaDieta valor={c.observacoes ?? ''} aoMudar={(t) => mudar({ observacoes: t || null })} /> : null}
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
          <View style={estilos.outros}>
            <Texto variante="suave">
              {editaErgogenicos ? 'Medicação e ergogênicos do aluno. Da biblioteca vêm o nome, o princípio ativo e a concentração.' : 'Medicação e ergogênicos do aluno. Seu perfil só pode ler esta lista.'}
            </Texto>
            {ergogenicos.length === 0 ? <Texto variante="suave">Nenhum item ainda.</Texto> : null}
            {ergogenicos.map((e, ei) => (
              <ItemDeErgogenico key={e.uid} item={e} posicao={ei} editavel={editaErgogenicos}
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
  );
}

/** Observações em largura de leitura (~72 caracteres), com o contador de caracteres no canto (até 8.000, o limite da API). */
function ObservacoesDaDieta({ valor, aoMudar }: { valor: string; aoMudar: (t: string) => void }) {
  const max = LIMITES_DOS_COMPLEMENTOS.observacoes;
  return (
    <View style={estilos.leitura}>
      <Campo rotulo="Observações (opcional)" valor={valor} aoMudar={aoMudar} linhas={8} maxLength={max}
        ajuda="O aluno lê junto com a dieta, com as quebras de linha." erro={valor.length > max ? `Até ${max} caracteres.` : null} />
      <ContadorDeCaracteres usados={valor.length} maximo={max} />
    </View>
  );
}

const MAIS_DETALHES = 'Mais detalhes (princípio ativo, concentração, observação)';

/** Item de "Outros" (nível "item": `superficie2` + borda), com "#N · Nome" e a lixeira no canto; o resto em "Mais detalhes", fechado. */
function ItemDeErgogenico({ item: e, posicao, editavel, aoMudar, aoRemover }: {
  item: Ergogenico; posicao: number; editavel: boolean; aoMudar: (parcial: Partial<Ergogenico>) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  // Nasce fechado, mesmo com texto nos quatro campos secundários (regra de 18/11; o item que veio da biblioteca também).
  const [detalhes, setDetalhes] = useState(false);
  const L = LIMITES_DOS_COMPLEMENTOS;
  return (
    <View style={[estilos.subCartao, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <CabecalhoDoItem titulo={`#${posicao + 1} · ${e.nome.trim() || 'Sem nome'}`} aberto nomeDoItem="item"
        remover={editavel ? <IconeBotao Icone={Trash2} rotulo={`Remover ${e.nome || 'item'}`} cor={cores.perigo} aoTocar={aoRemover} /> : undefined} />
      <View style={estilos.grade}>
        <View style={estilos.campo}><Campo rotulo="Nome" valor={e.nome} aoMudar={(nome) => aoMudar({ nome })} maxLength={L.campoCurto} editable={editavel} /></View>
        <View style={estilos.campo}><Campo rotulo="Dose prescrita" valor={e.dose} aoMudar={(dose) => aoMudar({ dose })} maxLength={L.campoCurto} editable={editavel} /></View>
        <View style={estilos.campo}><Campo rotulo="Horário" valor={e.horario} aoMudar={(horario) => aoMudar({ horario })} maxLength={L.campoCurto} editable={editavel} /></View>
      </View>
      <BotaoDeAbrir texto={MAIS_DETALHES} aberto={detalhes} aoAlternar={() => setDetalhes(!detalhes)} />
      {detalhes ? (
        <View style={estilos.grade}>
          <View style={estilos.campo}>
            <Campo rotulo="Princípio ativo" valor={e.principioAtivo} aoMudar={(principioAtivo) => aoMudar({ principioAtivo })} maxLength={L.principioAtivo} editable={editavel} />
          </View>
          <View style={estilos.campo}>
            <Campo rotulo="Concentração" valor={e.concentracao} aoMudar={(concentracao) => aoMudar({ concentracao })} maxLength={L.concentracao} editable={editavel} />
          </View>
          <View style={estilos.campo}>
            <Campo rotulo="Prescrição (opcional)" valor={e.prescricao} aoMudar={(prescricao) => aoMudar({ prescricao })} maxLength={L.prescricao} editable={editavel} />
          </View>
          <View style={estilos.campoLargo}>
            <Campo rotulo="Observação" valor={e.observacao} aoMudar={(observacao) => aoMudar({ observacao })} maxLength={L.observacao} editable={editavel} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  painel: { paddingTop: espaco(1) },
  leitura: { gap: espaco(0.5), maxWidth: LARGURA_TEXTO_CORRIDO },
  outros: { gap: espaco(1.5) },
  subCartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campo: { minWidth: 190, flex: 1 },
  campoLargo: { minWidth: 190, flexBasis: '100%' },
});
