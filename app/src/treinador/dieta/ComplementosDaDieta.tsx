import { ExternalLink, Library, Link2Off, Plus, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../../api/tipos';
import { remover, substituir } from '../../dominio/editorTreino';
import { linhaDeErgogenico } from '../../dominio/ergogenicos';
import { novoUid } from '../../dominio/uid';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { BotaoDeAbrir } from '../treino/BotaoDeAbrir';

type Suplementacao = ConteudoDieta['suplementacao'][number];
type Ergogenico = NonNullable<ConteudoDieta['ergogenicos']>[number];

interface Props {
  conteudo: ConteudoDieta;
  aoMudar: (parcial: Partial<ConteudoDieta>) => void;
  /** Remoção com a barra "Desfazer" do editor. */
  comDesfazer: (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta) => void;
  /** Porção da embalagem do produto escolhido nesta abertura (só referência ao escrever a dose). */
  porcoes: Record<string, string>;
  veBiblioteca: boolean;
  veErgogenicos: boolean;
  editaErgogenicos: boolean;
  aoEscolherSuplemento: () => void;
  aoEscolherErgogenico: () => void;
}

/**
 * Complementos da dieta (orientações, observações, suplementação e "Outros"), abaixo das refeições. Cada linha da
 * suplementação e de "Outros" é um sub-cartão com "#N · Nome" e a lixeira no canto (reunião, N24/C71); em "Outros" só
 * nome, dose e horário ficam à vista e o resto mora em "Mais detalhes", aberto quando já tem algo. O modelo de uma
 * refeição só não tem complementos (seriam descartados ao aplicar).
 */
export function ComplementosDaDieta({ conteudo: c, aoMudar: mudar, comDesfazer, porcoes, veBiblioteca, veErgogenicos, editaErgogenicos, aoEscolherSuplemento, aoEscolherErgogenico }: Props) {
  const { cores } = useTema();
  const ergogenicos = c.ergogenicos ?? [];
  return <>
    <Texto variante="bloco" nivel={2}>Complementos</Texto>
    <Cartao faixa titulo="Orientações" descricao="Títulos e textos que o aluno lê junto com a dieta." nivel={3} recolhivel recolhido={c.orientacoes.length === 0}>
      {c.orientacoes.map((o, oi) => (
        <View key={oi} style={[estilos.orientacao, { borderColor: cores.borda }]}>
          <View style={estilos.cresce}>
            <Campo rotulo="Título" valor={o.titulo} aoMudar={(titulo) => mudar({ orientacoes: substituir(c.orientacoes, oi, { ...o, titulo }) })} maxLength={80} />
            <Campo rotulo="Texto" valor={o.texto} aoMudar={(texto) => mudar({ orientacoes: substituir(c.orientacoes, oi, { ...o, texto }) })} linhas={2} maxLength={2000} />
          </View>
          <IconeBotao Icone={Trash2} rotulo={`Remover orientação ${o.titulo || oi + 1}`} cor={cores.perigo} aoTocar={() => comDesfazer(`Orientação “${o.titulo || oi + 1}” removida.`, (a) => ({ ...a, orientacoes: remover(a.orientacoes, oi) }))} />
        </View>
      ))}
      <View style={estilos.acoes}>
        <Botao rotulo="Adicionar orientação" tipo="secundario" Icone={Plus} aoTocar={() => mudar({ orientacoes: [...c.orientacoes, { titulo: '', texto: '' }] })} />
      </View>
    </Cartao>

    <Cartao faixa titulo="Observações" nivel={3} recolhivel recolhido={!c.observacoes}>
      <Campo rotulo="Observações (opcional)" valor={c.observacoes ?? ''} aoMudar={(t) => mudar({ observacoes: t || null })} linhas={4} maxLength={8000} />
    </Cartao>

    <Cartao faixa titulo="Suplementação" nivel={3} recolhivel recolhido={c.suplementacao.length === 0}>
      <Texto variante="suave">Campo livre do treinador. O sistema só guarda e mostra o que for escrito aqui; da biblioteca vêm só o nome, o link e o cupom do produto. A dose é a que você prescreve, não a porção da embalagem.</Texto>
      {c.suplementacao.map((s, si) => (
        <ItemDeSuplementacao key={s.uid} item={s} posicao={si} porcao={porcoes[s.uid]}
          aoMudar={(parcial) => mudar({ suplementacao: substituir(c.suplementacao, si, { ...s, ...parcial }) })}
          aoRemover={() => comDesfazer(`Suplementação “${s.nome || si + 1}” removida.`, (a) => ({ ...a, suplementacao: remover(a.suplementacao, si) }))} />
      ))}
      <View style={estilos.acoes}>
        {veBiblioteca ? <Botao rotulo="Escolher da biblioteca" tipo="secundario" Icone={Library} aoTocar={aoEscolherSuplemento} /> : null}
        <Botao
          rotulo="Adicionar linha"
          tipo="secundario"
          Icone={Plus}
          aoTocar={() => mudar({ suplementacao: [...c.suplementacao, { uid: novoUid(), nome: '', dose: '', horario: '', observacao: '', link: null, cupom: null }] })}
        />
      </View>
    </Cartao>

    {veErgogenicos ? (
      <Cartao faixa titulo="Outros (medicação e ergogênicos)" nivel={3} recolhivel recolhido={ergogenicos.length === 0}>
        <Texto variante="suave">
          Campo livre do treinador. O sistema só guarda e mostra o que for escrito aqui; da biblioteca vêm só nome, princípio ativo e concentração.
          {editaErgogenicos ? '' : ' Seu perfil só pode ler esta lista.'}
        </Texto>
        {ergogenicos.map((e, ei) => (
          <ItemDeErgogenico key={e.uid} item={e} posicao={ei} editavel={editaErgogenicos}
            aoMudar={(parcial) => mudar({ ergogenicos: substituir(ergogenicos, ei, { ...e, ...parcial }) })}
            aoRemover={() => comDesfazer(`Item “${e.nome || ei + 1}” removido.`, (a) => ({ ...a, ergogenicos: remover(a.ergogenicos ?? [], ei) }))} />
        ))}
        {editaErgogenicos ? (
          <View style={estilos.acoes}>
            <Botao rotulo="Escolher da biblioteca" tipo="secundario" Icone={Library} aoTocar={aoEscolherErgogenico} />
            <Botao
              rotulo="Adicionar linha"
              tipo="secundario"
              Icone={Plus}
              aoTocar={() => mudar({ ergogenicos: [...ergogenicos, linhaDeErgogenico({ nome: '', principioAtivo: null, concentracao: null }, novoUid())] })}
            />
          </View>
        ) : null}
      </Cartao>
    ) : null}
  </>;
}

/** Sub-cartão de uma linha (nível "item": `superficie2` + borda), com "#N · Nome" e a lixeira no canto. */
function SubCartao({ posicao, nome, remover, children }: { posicao: number; nome: string; remover?: ReactNode; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.subCartao, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <CabecalhoDoItem titulo={`#${posicao + 1} · ${nome.trim() || 'Sem nome'}`} aberto nomeDoItem="item" remover={remover} />
      {children}
    </View>
  );
}

function ItemDeSuplementacao({ item: s, posicao, porcao, aoMudar, aoRemover }: {
  item: Suplementacao; posicao: number; porcao?: string; aoMudar: (parcial: Partial<Suplementacao>) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  return (
    <SubCartao posicao={posicao} nome={s.nome}
      remover={<IconeBotao Icone={Trash2} rotulo={`Remover ${s.nome || 'linha'}`} cor={cores.perigo} aoTocar={aoRemover} />}>
      <View style={estilos.grade}>
        <View style={estilos.campo}><Campo rotulo="Nome" valor={s.nome} aoMudar={(nome) => aoMudar({ nome })} maxLength={120} /></View>
        <View style={estilos.campo}>
          <Campo rotulo="Dose prescrita" valor={s.dose} aoMudar={(dose) => aoMudar({ dose })} maxLength={120} ajuda={porcao ? `Embalagem: ${porcao} (só referência)` : undefined} />
        </View>
        <View style={estilos.campo}><Campo rotulo="Horário" valor={s.horario} aoMudar={(horario) => aoMudar({ horario })} maxLength={120} /></View>
        <View style={estilos.campo}><Campo rotulo="Observação" valor={s.observacao} aoMudar={(observacao) => aoMudar({ observacao })} maxLength={500} /></View>
      </View>
      {s.link ? (
        <View style={estilos.acoes}>
          <Botao rotulo="Ver produto" tipo="secundario" Icone={ExternalLink} aoTocar={() => { void abrirLinkExterno(s.link).then((ok) => { if (!ok) avisar('Não foi possível abrir o link.', 'perigo'); }); }} />
          <Botao rotulo="Tirar link" tipo="perigoTexto" Icone={Link2Off} aoTocar={() => aoMudar({ link: null })} />
        </View>
      ) : null}
      {s.cupom ? (
        <View style={estilos.acoes}>
          <Texto numerico variante="suave">Cupom: {s.cupom}</Texto>
          <Botao rotulo="Tirar cupom" tipo="perigoTexto" aoTocar={() => aoMudar({ cupom: null })} />
        </View>
      ) : null}
    </SubCartao>
  );
}

const MAIS_DETALHES = 'Mais detalhes (princípio ativo, concentração, observação)';

function ItemDeErgogenico({ item: e, posicao, editavel, aoMudar, aoRemover }: {
  item: Ergogenico; posicao: number; editavel: boolean; aoMudar: (parcial: Partial<Ergogenico>) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  // Nasce aberto se algum dos quatro campos secundários já tem texto (também o item que veio da biblioteca).
  const [detalhes, setDetalhes] = useState(() => !!(e.principioAtivo || e.concentracao || e.prescricao || e.observacao));
  return (
    <SubCartao posicao={posicao} nome={e.nome}
      remover={editavel ? <IconeBotao Icone={Trash2} rotulo={`Remover ${e.nome || 'item'}`} cor={cores.perigo} aoTocar={aoRemover} /> : undefined}>
      <View style={estilos.grade}>
        <View style={estilos.campo}><Campo rotulo="Nome" valor={e.nome} aoMudar={(nome) => aoMudar({ nome })} maxLength={120} editable={editavel} /></View>
        <View style={estilos.campo}><Campo rotulo="Dose prescrita" valor={e.dose} aoMudar={(dose) => aoMudar({ dose })} maxLength={120} editable={editavel} /></View>
        <View style={estilos.campo}><Campo rotulo="Horário" valor={e.horario} aoMudar={(horario) => aoMudar({ horario })} maxLength={120} editable={editavel} /></View>
      </View>
      <BotaoDeAbrir texto={MAIS_DETALHES} aberto={detalhes} aoAlternar={() => setDetalhes(!detalhes)} />
      {detalhes ? (
        <View style={estilos.grade}>
          <View style={estilos.campo}>
            <Campo rotulo="Princípio ativo" valor={e.principioAtivo} aoMudar={(principioAtivo) => aoMudar({ principioAtivo })} maxLength={160} editable={editavel} />
          </View>
          <View style={estilos.campo}>
            <Campo rotulo="Concentração" valor={e.concentracao} aoMudar={(concentracao) => aoMudar({ concentracao })} maxLength={40} editable={editavel} />
          </View>
          <View style={estilos.campo}>
            <Campo rotulo="Prescrição (opcional)" valor={e.prescricao} aoMudar={(prescricao) => aoMudar({ prescricao })} maxLength={200} editable={editavel} />
          </View>
          <View style={estilos.campoLargo}>
            <Campo rotulo="Observação" valor={e.observacao} aoMudar={(observacao) => aoMudar({ observacao })} maxLength={500} editable={editavel} />
          </View>
        </View>
      ) : null}
    </SubCartao>
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  orientacao: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1), borderTopWidth: 1, paddingTop: espaco(1) },
  cresce: { flex: 1, gap: espaco(1) },
  subCartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campo: { minWidth: 190, flex: 1 },
  campoLargo: { minWidth: 190, flexBasis: '100%' },
});
