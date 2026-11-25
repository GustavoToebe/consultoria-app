import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Aniversariante } from '../../dominio/aniversariosDosAlunos';
import { descricaoDaJanela, fraseSemAniversarios, limiteDoTamanho, restantes, rotuloDoAniversario } from '../../dominio/aniversariosDosAlunos';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import type { TamanhoDoBloco } from '../../dominio/painelBlocos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Folha } from '../../ui/Folha';
import { Selo } from '../../ui/Selo';
import { propsDeLink } from '../../ui/propsDeLink';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

export type ItemDoAniversario = Aniversariante<{ alunoId: string; nome: string; dia: number; mes: number }>;

/**
 * Corpo do bloco "Aniversários" do Início (o título, o tamanho e as opções ficam na faixa do bloco, fora daqui): nome e
 * "Hoje", "Amanhã" ou "dd/mm", na ordem de `aniversariantesDosProximosDias`; Pequeno mostra até 3, Médio 6 e Grande 10, e
 * o "+N" abre a lista inteira numa `Folha`, com a mesma linha. Tocar no nome abre a ficha. Nunca a idade nem o ano (D1 de
 * `docs/planos/aniversarios.md`): só nome, dia e mês entram aqui. Sem ninguém na janela, uma linha diz isso e o bloco fica.
 */
export function BlocoAniversarios({ aniversariantes, tamanho, dias, aoAbrirFicha, hoje = hojeEmBrasilia() }: {
  aniversariantes: readonly ItemDoAniversario[];
  tamanho: TamanhoDoBloco;
  dias: number;
  aoAbrirFicha: (alunoId: string) => void;
  /** "aaaa-mm-dd" de Brasília; padrão, o de agora. */
  hoje?: string;
}) {
  const [folhaAberta, setFolhaAberta] = useState(false);
  if (!aniversariantes.length) return <Texto variante="suave">{fraseSemAniversarios(dias)}</Texto>;
  const limite = limiteDoTamanho(tamanho);
  const resto = restantes(aniversariantes.length, limite);
  return (
    <View style={estilos.corpo}>
      <ListaDeAniversarios itens={aniversariantes.slice(0, limite)} hoje={hoje} aoAbrir={aoAbrirFicha} />
      {resto ? (
        <Botao tipo="fantasma" rotulo={`+${resto} · Ver todos`} rotuloAcessivel={`+${resto}: ver todos os ${aniversariantes.length} aniversários`}
          aoTocar={() => setFolhaAberta(true)} style={estilos.verTodos} />
      ) : null}
      <Folha visivel={folhaAberta} titulo="Aniversários" aoFechar={() => setFolhaAberta(false)}>
        <View style={estilos.corpo}>
          <Texto variante="suave" numerico>{`${aniversariantes.length} aniversários · ${descricaoDaJanela(dias)}`}</Texto>
          <ListaDeAniversarios itens={aniversariantes} hoje={hoje} aoAbrir={(id) => { setFolhaAberta(false); aoAbrirFicha(id); }} />
        </View>
      </Folha>
    </View>
  );
}

function ListaDeAniversarios({ itens, hoje, aoAbrir }: { itens: readonly ItemDoAniversario[]; hoje: string; aoAbrir: (alunoId: string) => void }) {
  const { cores } = useTema();
  return (
    <View role="list">
      {itens.map((a, i) => {
        const quando = rotuloDoAniversario(a, hoje);
        return (
          <View key={a.alunoId} role="listitem" style={i ? [estilos.divisoria, { borderColor: cores.divisor }] : null}>
            {/* Link de verdade na web (nova guia, botão do meio), como as linhas das Folhas do Início. */}
            <Pressable accessibilityRole="link" accessibilityLabel={`${a.nome}, ${quando}`} accessibilityHint="Abre a ficha do aluno"
              {...propsDeLink(`/treinador/alunos/${a.alunoId}`, () => aoAbrir(a.alunoId))}
              style={(e) => [estilos.linha, { backgroundColor: sobre(e) ? cores.sobre : 'transparent' }]}>
              <Texto numberOfLines={1} style={estilos.nome}>{a.nome}</Texto>
              {/* Aniversário não é alerta: "Hoje" ganha só uma pílula neutra (cor é sinal de situação, não destaque). */}
              {/* A caixa centra a pílula na linha (o `Selo` se prende ao topo). */}
              {quando === 'Hoje' ? <View><Selo texto="Hoje" categoria={{ cor: cores.texto, fundo: cores.superficie2 }} /></View> : <Texto variante="suave" numerico>{quando}</Texto>}
              <ChevronRight size={16} color={cores.textoSuave} aria-hidden />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(1) },
  divisoria: { borderTopWidth: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(0.5), borderRadius: 8 },
  nome: { flex: 1, minWidth: 0 },
  // O texto do botão fantasma (recuo de 16) alinhado aos nomes (recuo de 4 da linha).
  verTodos: { alignSelf: 'flex-start', marginLeft: espaco(0.5) - espaco(2) },
});
