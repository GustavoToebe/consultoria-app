import { ExternalLink, Library, Link2Off, PencilLine, Plus, Trash2 } from 'lucide-react-native';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../../api/tipos';
import { remover, substituir } from '../../dominio/editorTreino';
import { linhaDeErgogenico } from '../../dominio/ergogenicos';
import { novoUid } from '../../dominio/uid';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Divisor } from '../../ui/Divisor';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';

interface Props {
  conteudo: ConteudoDieta;
  aoMudar: (parcial: Partial<ConteudoDieta>) => void;
  comDesfazer: (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta) => void;
  /** Abre a escolha da biblioteca (suplemento ou ergogênico). */
  aoEscolherDaBiblioteca: (tipo: 'suplemento' | 'ergogenico') => void;
  /** Porção da embalagem dos produtos escolhidos nesta abertura (só referência, não é gravada). */
  porcoes: Record<string, string>;
  veBiblioteca: boolean;
  /** Sem `ERGOGENICO_LER` o cartão nem aparece; modelos nunca o levam. */
  veErgogenicos: boolean;
  editaErgogenicos: boolean;
}

/**
 * Complementos da dieta: orientações, observações, suplementação e "Outros (medicação e ergogênicos)", cada um num cartão
 * recolhível. Dentro deles, as linhas são separadas por um fio (sem caixa dentro de caixa) e cada botão tem um nome só seu.
 * O sistema só guarda e mostra o que o treinador escreve: nada é calculado nem sugerido.
 */
export function ComplementosDaDieta({ conteudo: c, aoMudar: mudar, comDesfazer, aoEscolherDaBiblioteca, porcoes, veBiblioteca, veErgogenicos, editaErgogenicos }: Props) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  return (
    <>
      <Texto variante="bloco" nivel={2}>Complementos</Texto>
      {/* Em janela larga, dois por linha (orientações e observações, suplementação e outros): os campos de texto não
          passam de uns 800 px e a página fica mais curta. Abaixo de ~1170 px de conteúdo, um por linha, como antes. */}
      <View style={estilos.blocos}>
        <View style={estilos.bloco}>
          <Cartao faixa titulo="Orientações" descricao="Títulos e textos que o aluno lê junto com a dieta." nivel={3} recolhivel recolhido={c.orientacoes.length === 0}>
            {c.orientacoes.map((o, oi) => (
              <Fragment key={oi}>
                {oi > 0 ? <Divisor /> : null}
                <View style={estilos.linha}>
                  <View style={estilos.cresce}>
                    <Campo rotulo="Título" valor={o.titulo} aoMudar={(titulo) => mudar({ orientacoes: substituir(c.orientacoes, oi, { ...o, titulo }) })} maxLength={80} />
                    <Campo rotulo="Texto" valor={o.texto} aoMudar={(texto) => mudar({ orientacoes: substituir(c.orientacoes, oi, { ...o, texto }) })} linhas={2} maxLength={2000} />
                  </View>
                  <IconeBotao Icone={Trash2} rotulo={`Remover orientação ${o.titulo || oi + 1}`} cor={cores.perigo} aoTocar={() => comDesfazer(`Orientação “${o.titulo || oi + 1}” removida.`, (a) => ({ ...a, orientacoes: remover(a.orientacoes, oi) }))} />
                </View>
              </Fragment>
            ))}
            <LinhaDeAcoes>
              <Botao rotulo="Adicionar orientação" tipo="secundario" Icone={Plus} aoTocar={() => mudar({ orientacoes: [...c.orientacoes, { titulo: '', texto: '' }] })} />
            </LinhaDeAcoes>
          </Cartao>
        </View>

        <View style={estilos.bloco}>
          <Cartao faixa titulo="Observações" nivel={3} recolhivel recolhido={!c.observacoes}>
            <Campo rotulo="Observações (opcional)" valor={c.observacoes ?? ''} aoMudar={(t) => mudar({ observacoes: t || null })} linhas={4} maxLength={8000} />
          </Cartao>
        </View>

        <View style={estilos.bloco}>
          <Cartao faixa titulo="Suplementação" descricao="Da biblioteca vêm o nome, o link e o cupom; a dose é a que você prescreve." nivel={3} recolhivel recolhido={c.suplementacao.length === 0}>
            {c.suplementacao.map((s, si) => {
              const mudarS = (parcial: Partial<typeof s>) => mudar({ suplementacao: substituir(c.suplementacao, si, { ...s, ...parcial }) });
              const nome = s.nome || `suplemento ${si + 1}`;
              return (
                <Fragment key={s.uid}>
                  {si > 0 ? <Divisor /> : null}
                  <View style={estilos.linha}>
                    <View style={estilos.cresce}>
                      <View style={estilos.grade}>
                        <View style={estilos.campo}><Campo rotulo="Nome" valor={s.nome} aoMudar={(n) => mudarS({ nome: n })} maxLength={120} /></View>
                        <View style={estilos.campo}>
                          <Campo rotulo="Dose prescrita" valor={s.dose} aoMudar={(dose) => mudarS({ dose })} maxLength={120} ajuda={porcoes[s.uid] ? `Embalagem: ${porcoes[s.uid]} (só referência)` : undefined} />
                        </View>
                        <View style={estilos.campo}><Campo rotulo="Horário" valor={s.horario} aoMudar={(horario) => mudarS({ horario })} maxLength={120} /></View>
                        <View style={estilos.campo}><Campo rotulo="Observação" valor={s.observacao} aoMudar={(observacao) => mudarS({ observacao })} maxLength={500} /></View>
                      </View>
                      {/* Link e cupom do produto numa linha só: o que veio da biblioteca e o que dá para tirar. */}
                      {s.link || s.cupom ? (
                        <View style={estilos.produto}>
                          {s.link ? (
                            <>
                              <Botao rotulo="Ver produto" rotuloAcessivel={`Ver produto: ${nome}`} tipo="secundario" Icone={ExternalLink}
                                aoTocar={() => { void abrirLinkExterno(s.link).then((ok) => { if (!ok) avisar('Não foi possível abrir o link.', 'perigo'); }); }} />
                              <Botao rotulo="Tirar link" rotuloAcessivel={`Tirar link de ${nome}`} tipo="perigoTexto" Icone={Link2Off} aoTocar={() => mudarS({ link: null })} />
                            </>
                          ) : null}
                          {s.cupom ? (
                            <>
                              <Texto numerico variante="suave">Cupom: {s.cupom}</Texto>
                              <Botao rotulo="Tirar cupom" rotuloAcessivel={`Tirar cupom de ${nome}`} tipo="perigoTexto" aoTocar={() => mudarS({ cupom: null })} />
                            </>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                    <IconeBotao Icone={Trash2} rotulo={`Remover ${nome}`} cor={cores.perigo} aoTocar={() => comDesfazer(`Suplementação “${s.nome || si + 1}” removida.`, (a) => ({ ...a, suplementacao: remover(a.suplementacao, si) }))} />
                  </View>
                </Fragment>
              );
            })}
            <LinhaDeAcoes>
              {veBiblioteca ? <Botao rotulo="Suplemento da biblioteca" tipo="secundario" Icone={Library} aoTocar={() => aoEscolherDaBiblioteca('suplemento')} /> : null}
              <Botao
                rotulo="Suplemento manual"
                tipo="secundario"
                Icone={PencilLine}
                aoTocar={() => mudar({ suplementacao: [...c.suplementacao, { uid: novoUid(), nome: '', dose: '', horario: '', observacao: '', link: null, cupom: null }] })}
              />
            </LinhaDeAcoes>
          </Cartao>
        </View>

        {veErgogenicos ? (
          <View style={estilos.bloco}>
            <Cartao faixa titulo="Outros (medicação e ergogênicos)" nivel={3} recolhivel recolhido={(c.ergogenicos ?? []).length === 0}
              descricao={editaErgogenicos ? 'Da biblioteca vêm o nome, o princípio ativo e a concentração.' : 'Seu perfil só pode ler esta lista.'}>
              {(c.ergogenicos ?? []).map((e, ei) => {
                const lista = c.ergogenicos ?? [];
                const mudarE = (parcial: Partial<typeof e>) => mudar({ ergogenicos: substituir(lista, ei, { ...e, ...parcial }) });
                return (
                  <Fragment key={e.uid}>
                    {ei > 0 ? <Divisor /> : null}
                    <View style={estilos.linha}>
                      <View style={[estilos.cresce, estilos.grade]}>
                        <View style={estilos.campo}><Campo rotulo="Nome" valor={e.nome} aoMudar={(nome) => mudarE({ nome })} maxLength={120} editable={editaErgogenicos} /></View>
                        <View style={estilos.campo}><Campo rotulo="Princípio ativo" valor={e.principioAtivo} aoMudar={(principioAtivo) => mudarE({ principioAtivo })} maxLength={160} editable={editaErgogenicos} /></View>
                        <View style={estilos.campo}><Campo rotulo="Concentração" valor={e.concentracao} aoMudar={(concentracao) => mudarE({ concentracao })} maxLength={40} editable={editaErgogenicos} /></View>
                        <View style={estilos.campo}><Campo rotulo="Dose prescrita" valor={e.dose} aoMudar={(dose) => mudarE({ dose })} maxLength={120} editable={editaErgogenicos} /></View>
                        <View style={estilos.campo}><Campo rotulo="Horário" valor={e.horario} aoMudar={(horario) => mudarE({ horario })} maxLength={120} editable={editaErgogenicos} /></View>
                        <View style={estilos.campo}><Campo rotulo="Prescrição (opcional)" valor={e.prescricao} aoMudar={(prescricao) => mudarE({ prescricao })} maxLength={200} editable={editaErgogenicos} /></View>
                        <View style={estilos.campoLargo}><Campo rotulo="Observação" valor={e.observacao} aoMudar={(observacao) => mudarE({ observacao })} maxLength={500} editable={editaErgogenicos} /></View>
                      </View>
                      {editaErgogenicos ? (
                        <IconeBotao Icone={Trash2} rotulo={`Remover ${e.nome || 'item'}`} cor={cores.perigo} aoTocar={() => comDesfazer(`Item “${e.nome || ei + 1}” removido.`, (a) => ({ ...a, ergogenicos: remover(a.ergogenicos ?? [], ei) }))} />
                      ) : null}
                    </View>
                  </Fragment>
                );
              })}
              {editaErgogenicos ? (
                <LinhaDeAcoes>
                  <Botao rotulo="Ergogênico da biblioteca" rotuloAcessivel="Ergogênico da biblioteca (medicação ou ergogênico)" tipo="secundario" Icone={Library} aoTocar={() => aoEscolherDaBiblioteca('ergogenico')} />
                  <Botao
                    rotulo="Ergogênico manual"
                    rotuloAcessivel="Ergogênico manual (medicação ou ergogênico)"
                    tipo="secundario"
                    Icone={PencilLine}
                    aoTocar={() => mudar({ ergogenicos: [...(c.ergogenicos ?? []), linhaDeErgogenico({ nome: '', principioAtivo: null, concentracao: null }, novoUid())] })}
                  />
                </LinhaDeAcoes>
              ) : null}
            </Cartao>
          </View>
        ) : null}
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  blocos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(3) },
  // flexShrink: sem ele (padrão 0 no RN) a base de 560 vazava a tela no celular.
  bloco: { flexGrow: 1, flexShrink: 1, flexBasis: 560, minWidth: 0 },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  cresce: { flex: 1, gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campo: { minWidth: 190, flex: 1 },
  campoLargo: { minWidth: 190, flexBasis: '100%' },
  produto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
});
