import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, PencilLine, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Alimento, ItemDieta, Refeicao, UnidadeAlimento } from '../../api/tipos';
import { novaOpcao, novoItem, recalcularItem, somar, type Totais } from '../../dominio/dieta';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { numeroParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { UNIDADES } from '../biblioteca/AbaAlimentos';

/** "2.236 kcal · P 180,2 g · C 250 g · G 60,1 g"; valor que falta aparece como "—" (nunca inventado). */
export function textoTotais(t: Totais): string {
  const g = (v: number | null) => (v === null ? '—' : `${numeroParaTela(v, 1)} g`);
  return `${t.kcal === null ? '—' : numeroParaTela(t.kcal, 0)} kcal · P ${g(t.proteina)} · C ${g(t.carboidrato)} · G ${g(t.gordura)}`;
}

interface Props {
  refeicao: Refeicao;
  posicao: number;
  total: number;
  aberta: boolean;
  comProblema: Set<string>;
  alimentos: Map<string, Alimento>;
  aoAbrir: () => void;
  aoMudar: (r: Refeicao) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
  removivel?: boolean;
  aoSalvarModelo?: () => void;
  /** Abre a escolha de alimento; o item entra na opção indicada. */
  aoEscolherAlimento: (opcao: number) => void;
}

/** Refeição: nome, horário, observação e as opções (A, B...) com os itens e o total de cada opção. */
export function CartaoRefeicao(p: Props) {
  const { cores } = useTema();
  const r = p.refeicao;
  const [opcaoAtiva, setOpcaoAtiva] = useState(0);
  const indice = Math.min(opcaoAtiva, Math.max(0, r.opcoes.length - 1));
  const opcao = r.opcoes[indice];
  const mudar = (parcial: Partial<Refeicao>) => p.aoMudar({ ...r, ...parcial });
  const mudarItens = (fn: (itens: ItemDieta[]) => ItemDieta[]) =>
    mudar({ opcoes: substituir(r.opcoes, indice, { ...opcao, itens: fn(opcao.itens) }) });

  return (
    <View style={[estilos.cartao, { borderColor: p.comProblema.has(r.uid) ? cores.perigo : cores.borda, backgroundColor: cores.superficie }]}>
      <View style={estilos.topo}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${p.aberta ? 'Fechar' : 'Abrir'} refeição ${r.nome || p.posicao + 1}`} accessibilityState={{ expanded: p.aberta }} onPress={p.aoAbrir} style={estilos.titulo}>
          <Texto variante="subtitulo">
            {r.horario ? `${r.horario} · ` : ''}
            {r.nome || `Refeição ${p.posicao + 1}`}
          </Texto>
          <Texto variante="suave">
            {r.opcoes.length} {r.opcoes.length === 1 ? 'opção' : 'opções'} · Opção {r.opcoes[0]?.rotulo ?? '—'}: {textoTotais(somar(r.opcoes[0]?.itens ?? []))}
          </Texto>
          {p.comProblema.has(r.uid) ? <Selo texto="Corrigir" tipo="perigo" /> : null}
        </Pressable>
        <View style={estilos.acoes}>
          <IconeBotao Icone={ArrowUp} rotulo="Subir refeição" desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
          <IconeBotao Icone={ArrowDown} rotulo="Descer refeição" desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
          <IconeBotao Icone={p.aberta ? ChevronUp : ChevronDown} rotulo={p.aberta ? 'Fechar refeição' : 'Abrir refeição'} aoTocar={p.aoAbrir} />
        </View>
      </View>
      {p.aberta ? (
        <View style={estilos.corpo}>
          <View style={estilos.linha}>
            <View style={estilos.nome}>
              <Campo rotulo="Nome" valor={r.nome} aoMudar={(nome) => mudar({ nome })} maxLength={80} placeholder="Ex.: Café da manhã" />
            </View>
            <View style={estilos.horario}>
              <Campo rotulo="Horário" valor={r.horario ?? ''} aoMudar={(t) => mudar({ horario: t || null })} maxLength={5} placeholder="07:00" />
            </View>
          </View>
          <Campo rotulo="Observação (opcional)" valor={r.observacao ?? ''} aoMudar={(t) => mudar({ observacao: t || null })} linhas={2} maxLength={1000} />
          <Abas
            abas={r.opcoes.map((o, i) => ({ valor: String(i), rotulo: `Opção ${o.rotulo}` }))}
            ativa={String(indice)}
            aoMudar={(v) => setOpcaoAtiva(Number(v))}
          />
          {opcao ? (
            <View style={estilos.opcao}>
              {opcao.itens.length === 0 ? <Texto variante="suave">Nenhum item nesta opção.</Texto> : null}
              {opcao.itens.map((item, ii) => (
                <LinhaItem
                  key={item.uid}
                  item={item}
                  comProblema={p.comProblema.has(item.uid)}
                  aoMudar={(novo) => mudarItens((itens) => substituir(itens, ii, recalcularItem(novo, novo.alimentoId ? p.alimentos.get(novo.alimentoId) : undefined)))}
                  aoRemover={() => mudarItens((itens) => remover(itens, ii))}
                  aoMover={(d) => mudarItens((itens) => mover(itens, ii, d))}
                />
              ))}
              <Texto style={estilos.total}>Total da opção {opcao.rotulo}: {textoTotais(somar(opcao.itens))}</Texto>
              <View style={estilos.botoes}>
                <Botao rotulo="Adicionar alimento" tipo="secundario" Icone={Plus} aoTocar={() => p.aoEscolherAlimento(indice)} />
                <Botao rotulo="Item manual" tipo="secundario" Icone={PencilLine} aoTocar={() => mudarItens((itens) => [...itens, novoItem()])} />
                {r.opcoes.length > 1 ? (
                  <Botao
                    rotulo={`Remover opção ${opcao.rotulo}`}
                    tipo="perigoTexto"
                    Icone={Trash2}
                    aoTocar={() => {
                      setOpcaoAtiva(0);
                      mudar({ opcoes: remover(r.opcoes, indice) });
                    }}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
          <View style={estilos.botoes}>
            {r.opcoes.length < 6 ? (
              <Botao
                rotulo="Adicionar opção"
                tipo="secundario"
                Icone={Plus}
                aoTocar={() => {
                  setOpcaoAtiva(r.opcoes.length);
                  mudar({ opcoes: [...r.opcoes, novaOpcao(r.opcoes)] });
                }}
              />
            ) : null}
            {p.aoSalvarModelo ? <Botao rotulo="Salvar como modelo" tipo="secundario" aoTocar={p.aoSalvarModelo} /> : null}
          {p.removivel !== false ? <Botao rotulo="Remover refeição" tipo="perigoTexto" Icone={Trash2} aoTocar={p.aoRemover} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function LinhaItem({
  item,
  comProblema,
  aoMudar,
  aoRemover,
  aoMover,
}: {
  item: ItemDieta;
  comProblema: boolean;
  aoMudar: (i: ItemDieta) => void;
  aoRemover: () => void;
  removivel?: boolean;
  aoSalvarModelo?: () => void;
  aoMover: (d: -1 | 1) => void;
}) {
  const { cores } = useTema();
  const mudar = (parcial: Partial<ItemDieta>) => aoMudar({ ...item, ...parcial });
  return (
    <View style={[estilos.item, { borderColor: comProblema ? cores.perigo : cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.topo}>
        <View style={estilos.titulo}>
          {item.manual ? (
            <Campo rotulo="Item" valor={item.nome} aoMudar={(nome) => mudar({ nome })} maxLength={160} />
          ) : (
            <Texto style={estilos.nomeItem}>{item.nome}</Texto>
          )}
        </View>
        <IconeBotao Icone={ArrowUp} rotulo={`Subir ${item.nome || 'item'}`} aoTocar={() => aoMover(-1)} />
        <IconeBotao Icone={ArrowDown} rotulo={`Descer ${item.nome || 'item'}`} aoTocar={() => aoMover(1)} />
        <IconeBotao Icone={Trash2} rotulo={`Remover ${item.nome || 'item'}`} cor={cores.perigo} aoTocar={aoRemover} />
      </View>
      <View style={estilos.linha}>
        <View style={estilos.quantidade}>
          <CampoNumerico rotulo="Quantidade" valor={item.quantidade} aoMudar={(quantidade) => mudar({ quantidade })} />
        </View>
        <Escolha descricao="Unidade" opcoes={UNIDADES} valor={item.unidade} aoMudar={(unidade: UnidadeAlimento) => mudar({ unidade })} />
      </View>
      {item.manual ? (
        <View style={estilos.linha}>
          <View style={estilos.valor}>
            <CampoNumerico rotulo="Kcal" valor={item.kcal} aoMudar={(kcal) => mudar({ kcal })} />
          </View>
          <View style={estilos.valor}>
            <CampoNumerico rotulo="P (g)" valor={item.proteina} aoMudar={(proteina) => mudar({ proteina })} />
          </View>
          <View style={estilos.valor}>
            <CampoNumerico rotulo="C (g)" valor={item.carboidrato} aoMudar={(carboidrato) => mudar({ carboidrato })} />
          </View>
          <View style={estilos.valor}>
            <CampoNumerico rotulo="G (g)" valor={item.gordura} aoMudar={(gordura) => mudar({ gordura })} />
          </View>
        </View>
      ) : (
        <Texto variante="suave">{textoTotais(somar([item]))}</Texto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.5) },
  titulo: { flex: 1, gap: espaco(0.5), minHeight: 44, justifyContent: 'center' },
  acoes: { flexDirection: 'row' },
  corpo: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-end' },
  nome: { flex: 1, minWidth: 200 },
  horario: { width: 100 },
  opcao: { gap: espaco(1) },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(1) },
  nomeItem: { fontFamily: fontes.semi },
  quantidade: { width: 120 },
  valor: { width: 92 },
  total: { fontFamily: fontes.semi },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
