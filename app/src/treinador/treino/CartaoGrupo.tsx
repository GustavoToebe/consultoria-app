import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronUp, Link2, Plus, Unlink } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Configuracao, Grupo } from '../../api/tipos';
import { DESCANSO_MAXIMO_DO_GRUPO, grupoEmSequencia, MAXIMO_DE_VOLTAS, type MudancaDoGrupo } from '../../dominio/combinacoes';
import { explicacaoDaCombinacao, nomeDaCombinacao } from '../../dominio/metodologia';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_EDITOR, LINHA_DA_FAIXA, RAIO } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { type Vizinho, motivoParaTrocarTipoDoGrupo, opcoesDeGrupo } from './acoesDeGrupo';
import { ErroDoCampo } from './CamposDaPrescricao';

/** "3 exercícios · 4 voltas · 90 s depois do grupo" (o que a linha do grupo na lista mostra, sem abrir). */
export function linhaDoGrupo(g: Grupo, tamanho: number): string {
  const partes = [`${tamanho} ${tamanho === 1 ? 'exercício' : 'exercícios'}`];
  if (g.tecnica === 'CIRCUITO') partes.push(g.voltas == null ? 'voltas —' : `${g.voltas} ${g.voltas === 1 ? 'volta' : 'voltas'}`);
  if (grupoEmSequencia(g.tecnica)) partes.push('cada série com o próprio descanso');
  else if (g.descansoAposSegundos != null) partes.push(`${g.descansoAposSegundos} s depois do grupo`);
  return partes.join(' · ');
}

/**
 * Exercícios feitos juntos na lista (as duas colunas e o celular): uma linha compacta com o tipo, as voltas e quantos
 * exercícios, e os membros embaixo, presos por um fio à esquerda (sem moldura: no celular a moldura era mais um nível de
 * caixa). Tocar na linha escolhe o grupo, que abre a edição no inspetor (duas colunas) ou logo abaixo dela (`edicao`).
 */
export function GrupoNaLista({ grupo: g, config, tamanho, comErro, escolhido, duas, aoEscolher, edicao, children }: {
  grupo: Grupo; config: Configuracao | null; tamanho: number; comErro: boolean;
  /** É o grupo aberto (no inspetor ou embaixo da linha). */
  escolhido: boolean;
  duas: boolean;
  aoEscolher: () => void;
  /** A edição do grupo (`EditorDoGrupo`), só no empilhado e com o grupo aberto. */
  edicao?: ReactNode;
  /** Os itens ou cartões dos exercícios do grupo. */
  children: ReactNode;
}) {
  const { cores, bordas } = useTema();
  const nome = nomeDaCombinacao(config, g.tecnica);
  const linha = linhaDoGrupo(g, tamanho);
  const Seta = duas ? ChevronRight : escolhido ? ChevronUp : ChevronDown;
  const borda = escolhido ? cores.texto : comErro ? cores.perigo : cores.borda;
  return (
    <View style={estilos.naLista} role="group" accessibilityLabel={`${nome}, ${tamanho} exercícios feitos juntos`}>
      <AlvoDeRolagem chave={g.uid}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={duas ? { selected: escolhido } : { expanded: escolhido }}
          aria-current={duas && escolhido ? 'true' : undefined}
          accessibilityLabel={`Grupo ${nome}: ${linha}${comErro ? ', corrigir' : ''}. ${duas ? 'Editar o grupo' : escolhido ? 'Fechar a edição do grupo' : 'Editar o grupo'}`}
          onPress={aoEscolher}
          style={(s) => [estilos.linha, {
            borderWidth: bordas.bloco, borderColor: borda,
            backgroundColor: escolhido ? cores.superficie : sobre(s) ? cores.superficie2 : cores.superficie3,
          }]}>
          <Link2 size={18} color={cores.texto} strokeWidth={2} />
          <View style={estilos.textos}>
            <Texto style={estilos.nome} numberOfLines={1}>{nome}</Texto>
            <Texto variante="pequeno" numerico numberOfLines={2}>{linha}</Texto>
          </View>
          {comErro ? <Selo texto="Corrigir" tipo="perigo" /> : null}
          <Seta size={18} color={escolhido ? cores.texto : cores.textoSuave} strokeWidth={2} />
        </Pressable>
      </AlvoDeRolagem>
      {edicao ?? null}
      <View style={[estilos.membros, { borderLeftColor: escolhido ? cores.texto : cores.bordaCampo }]}>{children}</View>
    </View>
  );
}

interface Props {
  grupo: Grupo;
  config: Configuracao | null;
  /** Quantos exercícios o grupo tem agora. */
  tamanho: number;
  primeiro: boolean;
  ultimo: boolean;
  /** Problemas do grupo da validação: `geral`, `tecnica`, `voltas`, `descansoAposSegundos`. */
  erros: Problemas;
  /** Exercícios soltos ao lado do grupo que podem entrar nele. */
  vizinhos: Vizinho[];
  /** Por que não dá para incluir mais (grupo cheio, pré e pós-exaustão); só aparece sem vizinho que possa entrar. */
  dica?: string | null;
  aoMudar: (mudanca: MudancaDoGrupo) => void;
  aoMover: (delta: -1 | 1) => void;
  aoIncluir: (indice: number) => void;
  aoDesfazer: () => void;
}

/**
 * Edição do grupo de exercícios (no inspetor, nas duas colunas; embaixo da linha do grupo, no empilhado): o tipo (nome da
 * metodologia), as voltas do circuito, o descanso depois do grupo, incluir o vizinho e desfazer. O descanso por série de
 * cada exercício nunca é tocado aqui; em pré e pós-exaustão não existe descanso do grupo.
 */
export function EditorDoGrupo(p: Props) {
  const { cores, bordas } = useTema();
  const g = p.grupo;
  const nome = nomeDaCombinacao(p.config, g.tecnica);
  const explicacao = explicacaoDaCombinacao(p.config, g.tecnica);
  const emSequencia = grupoEmSequencia(g.tecnica);
  const quantosErros = Object.keys(p.erros).length;
  return (
    <View style={[estilos.cartao, { borderWidth: bordas.bloco, borderColor: quantosErros ? cores.perigo : cores.borda, backgroundColor: cores.superficie }]}>
      <View style={[estilos.topo, { backgroundColor: cores.faixaForte, borderBottomColor: cores.bordaCampo }]}>
        <View style={estilos.titulo}>
          <Texto variante="bloco" nivel={3}>{`Grupo: ${nome}`}</Texto>
          <Texto variante="suave" numerico>{linhaDoGrupo(g, p.tamanho)}</Texto>
        </View>
        {quantosErros ? <Selo texto="Corrigir" tipo="perigo" /> : null}
        <View style={estilos.setas}>
          <IconeBotao moldura Icone={ArrowUp} rotulo={`Subir ${nome}`} desabilitado={p.primeiro} aoTocar={() => p.aoMover(-1)} />
          <IconeBotao moldura Icone={ArrowDown} rotulo={`Descer ${nome}`} desabilitado={p.ultimo} aoTocar={() => p.aoMover(1)} />
        </View>
      </View>
      <View style={estilos.corpo}>
        {explicacao ? <Texto variante="suave">{explicacao}</Texto> : null}
        <ErroDoCampo mensagem={p.erros.geral} />

        <Escolha rotulo="Tipo de grupo" compacta opcoes={opcoesDeGrupo(p.config, g.tecnica).map((o) => {
          const motivo = o.valor === g.tecnica ? null : motivoParaTrocarTipoDoGrupo(p.tamanho, o.valor, p.config);
          return { valor: o.valor, rotulo: o.rotulo, desabilitada: !!motivo, motivo: motivo ?? undefined };
        })} valor={g.tecnica} aoMudar={(tecnica) => p.aoMudar({ tecnica })} />
        <ErroDoCampo mensagem={p.erros.tecnica} />

        <View style={estilos.campos}>
          {g.tecnica === 'CIRCUITO' ? (
            <View style={estilos.campo}>
              <CampoNumerico rotulo="Voltas" inteiro valor={g.voltas} aoMudar={(voltas) => p.aoMudar({ voltas })}
                erro={p.erros.voltas} ajuda={`De 1 a ${MAXIMO_DE_VOLTAS}.`} />
            </View>
          ) : null}
          {emSequencia ? (
            <Texto variante="pequeno" style={estilos.semDescanso}>Cada série mantém o próprio descanso: {nome.toLowerCase()} não tem descanso depois do grupo.</Texto>
          ) : (
            <View style={estilos.campo}>
              <CampoNumerico rotulo="Descanso depois do grupo" inteiro sufixo="s" valor={g.descansoAposSegundos} aoMudar={(descansoAposSegundos) => p.aoMudar({ descansoAposSegundos })}
                erro={p.erros.descansoAposSegundos} ajuda={`De 0 a ${DESCANSO_MAXIMO_DO_GRUPO} s, depois de cada volta. Vazio = sem descanso do grupo.`} />
            </View>
          )}
        </View>

        <Texto variante="pequeno">As setas de cada exercício trocam a ordem dentro do grupo; na ponta, o exercício sai do grupo. As setas do grupo movem todos juntos.</Texto>
        <LinhaDeAcoes>
          {p.vizinhos.map((v) => (
            <Botao key={v.indice} rotulo={`Incluir ${v.nome}`} rotuloAcessivel={`Incluir ${v.nome} no grupo ${nome}, ${v.lado === 'antes' ? 'o exercício logo acima' : 'o exercício logo abaixo'}`}
              tipo="secundario" Icone={Plus} aoTocar={() => p.aoIncluir(v.indice)} />
          ))}
          <Botao rotulo="Desfazer grupo" rotuloAcessivel={`Desfazer o grupo ${nome}: os exercícios ficam soltos, com as séries`} tipo="fantasma" Icone={Unlink} aoTocar={p.aoDesfazer} />
        </LinhaDeAcoes>
        {!p.vizinhos.length && p.dica ? <Texto variante="pequeno">{p.dica}</Texto> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  naLista: { gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25), minHeight: ALVO_TOQUE, borderRadius: RAIO, paddingVertical: espaco(1), paddingHorizontal: espaco(1.25) },
  textos: { flex: 1, gap: 2 },
  nome: { fontFamily: fontes.semi },
  // O fio prende os membros ao grupo sem mais uma caixa em volta.
  membros: { borderLeftWidth: 2, marginLeft: espaco(1.5), paddingLeft: espaco(1.25), gap: espaco(1) },
  cartao: { borderRadius: RAIO, overflow: 'hidden' },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), paddingVertical: espaco(1.25), borderBottomWidth: LINHA_DA_FAIXA },
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: 2, minHeight: ALVO_TOQUE, justifyContent: 'center' },
  setas: { flexDirection: 'row', gap: espaco(0.75), marginLeft: 'auto' },
  // Em 1920 o inspetor passa de 1200 px: o texto e os campos do grupo ficam na medida do editor.
  corpo: { gap: espaco(1.5), padding: espaco(1.5), paddingTop: espaco(2), maxWidth: LARGURA_EDITOR },
  campos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campo: { flexGrow: 1, flexBasis: 200, maxWidth: 320 },
  semDescanso: { flexBasis: '100%' },
});
