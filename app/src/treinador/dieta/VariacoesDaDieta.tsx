import { CalendarDays, Check, Copy, Trash2 } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoDieta, VariacaoDaDieta } from '../../api/tipos';
import { DIAS_CURTOS, DIAS_SEMANA } from '../../dominio/editorTreino';
import {
  alternarDia, DIAS_DA_SEMANA, diasSemVariacao, dividirPorDia, duplicarVariacao, excluirVariacao, LIMITE_DE_VARIACOES,
  renomearVariacao, ROTULO_MAXIMO, textoDosDiasCurtos, usarEmTodosOsDias,
} from '../../dominio/variacoesDaDieta';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Alerta } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { coresDaSelecao } from '../../ui/selecao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

interface Props {
  conteudo: ConteudoDieta;
  /** A variação aberta (`null` = dieta sem variação). */
  aberta: VariacaoDaDieta | null;
  /** Uids com problema na validação: ponto vermelho no chip da variação. */
  comProblema: ReadonlySet<string>;
  aoAbrir: (uid: string) => void;
  /** Mudança sem desfazer (nome, dias). */
  alterar: (mudanca: (a: ConteudoDieta) => ConteudoDieta) => void;
  comDesfazer: (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta) => void;
  /** A barra do "Desfazer" quando a última mudança desfazível foi aqui. */
  aviso?: ReactNode;
}

/**
 * Dieta por dia da semana (decisões 6 a 8 do plano): sem variação, só o convite "Criar variação por dia"; com variações,
 * os chips delas (nome e dias; o aberto em seleção neutra com ✓) e, da aberta, o nome, os sete dias (marcar um dia o tira
 * da outra variação) e as ações. Fica acima do "Total do dia", que soma a variação aberta.
 */
export function VariacoesDaDieta({ conteudo: c, aberta, comProblema, aoAbrir, alterar, comDesfazer, aviso }: Props) {
  const [saiuDoNome, setSaiuDoNome] = useState<string | null>(null);

  if (!aberta) {
    return (
      <Cartao titulo="Dias da semana" descricao="A mesma dieta vale em todos os dias. Para refeições diferentes em alguns dias, crie uma variação."
        acoes={<Botao rotulo="Criar variação por dia" tipo="secundario" Icone={CalendarDays} aoTocar={() => {
          const dividida = dividirPorDia(c);
          comDesfazer('Variação criada. A dieta de antes virou a “Variação 1”.', () => dividida);
          aoAbrir(dividida.variacoes[1].uid);
        }} />}>
        {aviso}
      </Cartao>
    );
  }

  const semDia = diasSemVariacao(c);
  const vazias = c.variacoes.filter((v) => v.dias.length === 0);
  const nomeVazio = aberta.rotulo.trim() === '';
  const nomeDe = (v: VariacaoDaDieta) => v.rotulo.trim() || 'Variação sem nome';
  const outraDoDia = (dia: number) => c.variacoes.find((v) => v.uid !== aberta.uid && v.dias.includes(dia));
  const noLimite = c.variacoes.length >= LIMITE_DE_VARIACOES;

  const duplicar = () => {
    const indice = c.variacoes.findIndex((v) => v.uid === aberta.uid);
    const depois = duplicarVariacao(c, aberta.uid);
    const copia = depois.variacoes[indice + 1];
    if (depois === c || !copia) return;
    comDesfazer(`Variação “${nomeDe(aberta)}” duplicada. Marque os dias da cópia.`, () => depois);
    aoAbrir(copia.uid);
  };

  return (
    <Cartao titulo="Dias da semana" descricao="Cada variação tem as próprias refeições e vale nos dias marcados. Orientações, observações, suplementação e água valem para todas.">
      {/* Quebra linha também no celular (a `FaixaDeChips` rolaria e deixaria fora da vista a cópia recém-duplicada, que é a
          aberta); são no máximo sete chips. */}
      <View style={estilos.chips} accessibilityRole="tablist" accessibilityLabel="Variações da dieta">
        {c.variacoes.map((v) => (
          <ChipDaVariacao key={v.uid} variacao={v} nome={nomeDe(v)} aberta={v.uid === aberta.uid} erro={comProblema.has(v.uid)} aoAbrir={() => aoAbrir(v.uid)} />
        ))}
      </View>
      {aviso}
      <View style={estilos.aberta}>
        <Campo
          rotulo="Nome da variação"
          valor={aberta.rotulo}
          aoMudar={(t) => alterar((a) => renomearVariacao(a, aberta.uid, t))}
          onBlur={() => setSaiuDoNome(aberta.uid)}
          maxLength={ROTULO_MAXIMO}
          erro={nomeVazio && saiuDoNome === aberta.uid ? 'Dê um nome à variação. Ele aparece para o aluno: “Hoje: <nome>”.' : null}
          ajuda={`Até ${ROTULO_MAXIMO} caracteres. Ex.: “Dia de treino”, “Fim de semana”.`}
        />
        <View style={estilos.dias}>
          <Texto variante="rotulo">Dias desta variação</Texto>
          <View style={estilos.linhaDosDias} role="group" accessibilityLabel={`Dias da variação ${nomeDe(aberta)}`}>
            {DIAS_DA_SEMANA.map((dia) => {
              const outra = outraDoDia(dia);
              return (
                <ChipDoDia key={dia} curto={DIAS_CURTOS[dia - 1]} marcado={aberta.dias.includes(dia)}
                  nome={`${DIAS_SEMANA[dia - 1]}${outra ? `, está em ${nomeDe(outra)}` : ''}`}
                  dica={outra ? `Marcar tira o dia de ${nomeDe(outra)}.` : undefined}
                  aoAlternar={() => alterar((a) => alternarDia(a, aberta.uid, dia))} />
              );
            })}
          </View>
          <Texto variante="pequeno">Marcar um dia o tira da outra variação.</Texto>
        </View>
        {semDia.length || vazias.length ? (
          // Variação sem dia bloqueia a publicação; dia sem variação só avisa (o "dia de descanso" é permitido).
          <Alerta tom="atencao" titulo={vazias.length ? 'Para publicar, marque ao menos um dia em cada variação' : 'Dias sem dieta marcada'}
            texto={[
              semDia.length ? `Dias sem variação: ${textoDosDiasCurtos(semDia)}. Nesses dias o aluno vê "Sem dieta marcada para hoje"; pode publicar assim.` : null,
              vazias.length ? `Sem dia marcado: ${vazias.map(nomeDe).join(', ')}.` : null,
            ].filter(Boolean).join(' ')} />
        ) : null}
        <LinhaDeAcoes>
          <Botao rotulo="Duplicar variação" tipo="secundario" Icone={Copy} aoTocar={duplicar}
            desabilitado={noLimite} motivo={`No máximo ${LIMITE_DE_VARIACOES} variações, uma por dia.`} />
          {c.variacoes.length > 1 ? (
            <Botao rotulo="Excluir variação" rotuloAcessivel={`Excluir a variação ${nomeDe(aberta)}`} tipo="perigoTexto" Icone={Trash2}
              aoTocar={() => comDesfazer(`Variação “${nomeDe(aberta)}” excluída.`, (a) => excluirVariacao(a, aberta.uid))} />
          ) : null}
          <Botao rotulo="Usar esta em todos os dias" rotuloAcessivel={`Usar a variação ${nomeDe(aberta)} em todos os dias e tirar as variações`} tipo="fantasma"
            aoTocar={() => comDesfazer(
              c.variacoes.length > 1 ? `A dieta voltou a ser uma só, com “${nomeDe(aberta)}”. As outras variações saíram.` : 'A dieta voltou a valer igual em todos os dias.',
              (a) => usarEmTodosOsDias(a, aberta.uid),
            )} />
        </LinhaDeAcoes>
      </View>
    </Cartao>
  );
}

/** Chip da variação: nome e dias; a aberta com a superfície de seleção e ✓ (nunca a cor da marca); erro = ponto vermelho e texto no nome acessível. */
function ChipDaVariacao({ variacao: v, nome, aberta, erro, aoAbrir }: { variacao: VariacaoDaDieta; nome: string; aberta: boolean; erro: boolean; aoAbrir: () => void }) {
  const { cores } = useTema();
  const sel = coresDaSelecao(cores, aberta);
  const dias = textoDosDiasCurtos(v.dias);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: aberta }}
      // No RN-web o `accessibilityState.selected` não vira atributo: sem isto o leitor de tela não sabe qual aba está aberta.
      aria-selected={aberta}
      accessibilityLabel={`${nome}, ${dias}${erro ? ', precisa corrigir' : ''}`}
      onPress={aoAbrir}
      style={(st) => [estilos.chip, { backgroundColor: aberta || sobre(st) ? cores.sobre : sel.fundo, borderColor: sel.borda }]}>
      {aberta ? <Check size={16} color={sel.texto} strokeWidth={2.5} /> : null}
      <View style={estilos.textoDoChip}>
        <Texto numberOfLines={1} style={[estilos.nome, { color: sel.texto }]}>{nome}</Texto>
        <Texto variante="pequeno" numberOfLines={1}>{dias}</Texto>
      </View>
      {erro ? <View style={[estilos.ponto, { backgroundColor: cores.perigo, borderColor: sel.fundo }]} /> : null}
    </Pressable>
  );
}

/** Um dia da semana (caixa de marcar): ✓ em cima do nome curto quando marcado, sem mudar a altura; sete cabem em 390 px. */
function ChipDoDia({ curto, nome, dica, marcado, aoAlternar }: { curto: string; nome: string; dica?: string; marcado: boolean; aoAlternar: () => void }) {
  const { cores } = useTema();
  const sel = coresDaSelecao(cores, marcado);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      aria-checked={marcado}
      accessibilityLabel={nome}
      accessibilityHint={dica}
      onPress={aoAlternar}
      style={(st) => [estilos.dia, { backgroundColor: marcado || sobre(st) ? cores.sobre : sel.fundo, borderColor: sel.borda }]}>
      <View style={estilos.marca}>{marcado ? <Check size={14} color={sel.texto} strokeWidth={2.5} /> : null}</View>
      <Texto style={[estilos.curto, { color: sel.texto }]}>{curto}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  aberta: { gap: espaco(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(0.75),
    minHeight: ALVO_TOQUE,
    maxWidth: 260,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(0.5),
    borderRadius: RAIO,
    borderWidth: 1,
  },
  textoDoChip: { flexShrink: 1 },
  nome: { fontFamily: fontes.semi, fontSize: 14 },
  ponto: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  dias: { gap: espaco(1) },
  // Em 390 px sobram 324 px no cartão: sete dias com 2 px entre eles dão ~44,5 px cada (alvo de 44); no PC, no máximo
  // 72. Mais estreito que isso (zoom, fonte grande), quebra a linha em vez de encolher abaixo de 44.
  linhaDosDias: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  dia: {
    flex: 1,
    minWidth: ALVO_TOQUE,
    maxWidth: 72,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: RAIO_CONTROLE,
    borderWidth: 1,
  },
  marca: { height: 14, justifyContent: 'center' },
  curto: { fontFamily: fontes.semi, fontSize: 14 },
});
