import { Fragment, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarPlanos, versaoPlano } from '../../api/rotas';
import type { TipoPlano, VersaoDetalhe } from '../../api/tipos';
import { textoDaAgua, totalDoDia } from '../../dominio/dieta';
import {
  abasDoPrescrito, dietaDoPrescrito, dietaLida, outrosDoPrescrito, ROTULO_DA_ABA_DO_PRESCRITO, suplementosDoPrescrito, treinoDoPrescrito,
  versaoDoPrescrito, type AbaDoPrescrito, type LinhaDoPrescrito,
} from '../../dominio/prescritoDaAtualizacao';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { MensagemErro } from '../../ui/Estados';
import { LinkTexto } from '../../ui/LinkTexto';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { ValoresDaDieta } from '../../ui/ValoresDaDieta';
import { rotaDoEditor } from '../CartaoPlanos';

/** As abas da dieta leem o mesmo plano: trocar entre Dieta, Suplementos e Outros não busca de novo. */
const TIPO_DA_ABA: Record<AbaDoPrescrito, TipoPlano> = { treino: 'treino', dieta: 'dieta', suplementos: 'dieta', outros: 'dieta' };

const SEM_PLANO: Record<TipoPlano, string> = {
  treino: 'A pasta desta atualização não tem treino publicado.',
  dieta: 'A pasta desta atualização não tem dieta publicada.',
  mobilidade: 'A pasta desta atualização não tem mobilidade publicada.',
};

type Carga = { versao: VersaoDetalhe<unknown> | null; agendada: boolean };

/**
 * "O que está prescrito" na revisão da atualização (bloco D, 2.2): o treino e a dieta publicados da pasta desta atualização em
 * linhas curtas, só leitura, ao lado das respostas. Abas compactas Treino | Dieta | Suplementos | Outros; aba sem permissão
 * some e uma só vira título. Busca só o tipo da aba aberta (lista de planos e a versão que o aluno vê); erro fica dentro do
 * cartão, com "Tentar de novo", e nunca derruba a tela.
 */
export function PrescritoDaAtualizacao({ alunoId, pastaId }: { alunoId: string; pastaId: string | null }) {
  const { pode } = useSessao();
  const abas = abasDoPrescrito(pode);
  const [escolhida, setEscolhida] = useState<AbaDoPrescrito | null>(null);
  const aba = escolhida && abas.includes(escolhida) ? escolhida : abas[0] ?? null;
  const tipo = aba ? TIPO_DA_ABA[aba] : null;
  const carga = useCarregar<Carga>(tipo && pastaId ? `prescrito:${tipo}:${alunoId}:${pastaId}` : null, async () => {
    const escolha = versaoDoPrescrito(await listarPlanos(tipo!, alunoId), pastaId);
    if (!escolha) return { versao: null, agendada: false };
    return { versao: await versaoPlano(tipo!, escolha.planoId, escolha.numero), agendada: escolha.agendada };
  });
  if (!aba || !tipo) return null;
  const titulo = 'Prescrição atual';
  const dados = carga.dados && !carga.erro ? carga.dados : null;
  return (
    <Cartao titulo={abas.length === 1 ? `${titulo}: ${ROTULO_DA_ABA_DO_PRESCRITO[aba]}` : titulo}>
      {abas.length > 1 ? (
        <Abas abas={abas.map((valor) => ({ valor, rotulo: ROTULO_DA_ABA_DO_PRESCRITO[valor] }))} ativa={aba} aoMudar={setEscolhida} />
      ) : null}
      {!pastaId ? <Texto variante="suave">Esta atualização não tem pasta.</Texto> : null}
      {carga.erro ? <MensagemErro texto={textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} /> : null}
      {pastaId && !carga.erro && !dados ? <Texto variante="suave">Carregando o que está prescrito…</Texto> : null}
      {dados && !dados.versao ? <Texto variante="suave">{SEM_PLANO[tipo]}</Texto> : null}
      {dados?.versao ? <ConteudoDaAba aba={aba} tipo={tipo} versao={dados.versao} agendada={dados.agendada} /> : null}
    </Cartao>
  );
}

function ConteudoDaAba({ aba, tipo, versao, agendada }: { aba: AbaDoPrescrito; tipo: TipoPlano; versao: VersaoDetalhe<unknown>; agendada: boolean }) {
  return (
    <View style={estilos.conteudo}>
      <View style={estilos.topo}>
        <Texto variante="pequeno">{`${versao.titulo} · versão ${versao.numero}`}</Texto>
        <LinkTexto texto="Abrir no editor" href={rotaDoEditor(tipo, versao.planoId)} />
      </View>
      {agendada ? <Texto variante="pequeno">Versão agendada: o aluno ainda não a vê.</Texto> : null}
      {aba === 'treino' ? <Treino conteudo={versao.conteudo} /> : null}
      {aba === 'dieta' ? <Dieta conteudo={versao.conteudo} /> : null}
      {aba === 'suplementos' ? <Linhas linhas={suplementosDoPrescrito(dietaLida(versao.conteudo))} vazio="Nenhum suplemento na dieta publicada." /> : null}
      {aba === 'outros' ? <Linhas linhas={outrosDoPrescrito(dietaLida(versao.conteudo))} vazio="Nenhuma medicação ou ergogênico na dieta publicada." /> : null}
    </View>
  );
}

/** Uma linha por item: o nome em texto e o detalhe suave na mesma frase ("Supino reto · 3x6 a 8 - WS"). */
function Linhas({ linhas, vazio }: { linhas: LinhaDoPrescrito[]; vazio?: string }) {
  const { cores } = useTema();
  if (linhas.length === 0) return vazio ? <Texto variante="suave">{vazio}</Texto> : null;
  return (
    <View role="list" style={estilos.linhas}>
      {linhas.map((l) => (
        <View key={l.chave} role="listitem">
          <Texto variante="pequeno" cor={cores.texto}>
            {l.nome}
            {l.detalhe ? <Texto variante="pequeno" numerico>{` · ${l.detalhe}`}</Texto> : null}
          </Texto>
        </View>
      ))}
    </View>
  );
}

function Treino({ conteudo }: { conteudo: unknown }) {
  const sessoes = treinoDoPrescrito(conteudo);
  if (sessoes.length === 0) return <Texto variante="suave">O treino publicado não tem divisões.</Texto>;
  return (
    <>
      {sessoes.map((s) => (
        <View key={s.chave} style={estilos.grupo}>
          <Texto variante="rotulo" nivel={3}>{s.nome}</Texto>
          <Linhas linhas={s.linhas} vazio="Sem exercícios." />
        </View>
      ))}
    </>
  );
}

function Dieta({ conteudo }: { conteudo: unknown }) {
  const { cores } = useTema();
  const dieta = dietaLida(conteudo);
  const secoes = dietaDoPrescrito(dieta);
  const agua = textoDaAgua(dieta.aguaLitros);
  return (
    <>
      {secoes.map((s) => (
        <View key={s.chave} style={estilos.grupo}>
          {s.rotulo ? <Texto variante="rotulo" nivel={3}>{s.rotulo}</Texto> : null}
          {s.refeicoes.length === 0 ? <Texto variante="suave">Sem refeições.</Texto> : null}
          {s.refeicoes.map((r) => (
            <Fragment key={r.chave}>
              <Texto variante="pequeno" cor={cores.texto} style={estilos.refeicao}>{r.horario ? `${r.nome} · ${r.horario}` : r.nome}</Texto>
              <Linhas linhas={r.itens} vazio="Sem itens." />
              {r.outrasOpcoes > 0 ? <Texto variante="pequeno">{r.outrasOpcoes === 1 ? 'Mais 1 opção para o aluno escolher.' : `Mais ${r.outrasOpcoes} opções para o aluno escolher.`}</Texto> : null}
            </Fragment>
          ))}
          {s.refeicoes.length > 0 ? (
            <View style={estilos.total}>
              <Texto variante="rotulo">Total do dia (opção A)</Texto>
              <ValoresDaDieta totais={totalDoDia(s.paraOTotal)} inicio />
            </View>
          ) : null}
        </View>
      ))}
      {agua ? <Texto variante="pequeno" numerico>{`Água: ${agua}`}</Texto> : null}
    </>
  );
}

const estilos = StyleSheet.create({
  conteudo: { gap: espaco(2) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: espaco(2), rowGap: espaco(0.5) },
  grupo: { gap: espaco(1) },
  linhas: { gap: espaco(0.5) },
  refeicao: { fontWeight: '600', marginTop: espaco(0.5) },
  total: { gap: espaco(0.5), marginTop: espaco(0.5) },
});
