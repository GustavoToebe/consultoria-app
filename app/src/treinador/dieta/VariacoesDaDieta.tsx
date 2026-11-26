import { CalendarDays, Copy, Trash2 } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta, VariacaoDaDieta } from '../../api/tipos';
import {
  alternarDia, diasSemVariacao, dividirPorDia, duplicarVariacao, excluirVariacao, LIMITE_DE_VARIACOES, novaVariacao,
  renomearVariacao, ROTULO_MAXIMO, textoDosDiasCurtos, usarEmTodosOsDias,
} from '../../dominio/variacoesDaDieta';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Alerta } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { AbasDeVariacao } from './AbasDeVariacao';
import { FaixaDaSemana } from './FaixaDaSemana';

interface Props {
  conteudo: ConteudoDieta;
  /** A variação aberta (`null` = dieta sem variação). */
  aberta: VariacaoDaDieta | null;
  /** Uids com problema na validação: ícone de erro na aba da variação. */
  comProblema: ReadonlySet<string>;
  aoAbrir: (uid: string) => void;
  /** Mudança sem desfazer (nome, dias). */
  alterar: (mudanca: (a: ConteudoDieta) => ConteudoDieta) => void;
  comDesfazer: (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta) => void;
  /** A barra do "Desfazer" quando a última mudança desfazível foi aqui. */
  aviso?: ReactNode;
}

/**
 * Dieta por dia da semana (decisões 6 a 8 do plano; abas e faixa da semana em 25/11): sem variação, só o convite "Criar
 * variação por dia"; com variações, as abas delas (o desenho das opções da refeição, com "+ Nova variação" no fim) e, da
 * aberta, numa linha só no PC: o nome (até 420 px, contador no canto), a faixa da semana (o número da variação de cada
 * dia; tocar passa o dia para a aberta) e as ações. No celular, o nome em cima e a faixa numa linha. Fica acima do
 * "Total do dia", que soma a variação aberta.
 */
export function VariacoesDaDieta({ conteudo: c, aberta, comProblema, aoAbrir, alterar, comDesfazer, aviso }: Props) {
  const [saiuDoNome, setSaiuDoNome] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  if (!aberta) {
    return (
      <Cartao titulo="Dias da semana" descricao="A mesma dieta vale em todos os dias. Para refeições diferentes em alguns dias, crie uma variação."
        acoes={<Botao rotulo="Criar variação por dia" tipo="acao" Icone={CalendarDays} aoTocar={() => {
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
  const limite = c.variacoes.length >= LIMITE_DE_VARIACOES ? `No máximo ${LIMITE_DE_VARIACOES} variações, uma por dia.` : null;

  const duplicar = () => {
    const indice = c.variacoes.findIndex((v) => v.uid === aberta.uid);
    const depois = duplicarVariacao(c, aberta.uid);
    const copia = depois.variacoes[indice + 1];
    if (depois === c || !copia) return;
    comDesfazer(`Variação “${nomeDe(aberta)}” duplicada. Marque os dias da cópia.`, () => depois);
    aoAbrir(copia.uid);
  };
  const criar = () => {
    const depois = novaVariacao(c);
    const nova = depois.variacoes.at(-1);
    if (depois === c || !nova) return;
    comDesfazer(`“${nova.rotulo}” criada, sem refeições. Marque os dias e monte as refeições dela.`, () => depois);
    aoAbrir(nova.uid);
  };
  const excluir = () => {
    setExcluindo(false);
    comDesfazer(`Variação “${nomeDe(aberta)}” excluída.`, (a) => excluirVariacao(a, aberta.uid));
  };

  return (
    <Cartao titulo="Dias da semana" descricao="Cada variação tem as próprias refeições e vale nos dias marcados. Orientações, observações, suplementação e água valem para todas.">
      <AbasDeVariacao variacoes={c.variacoes} aberta={aberta.uid} comProblema={comProblema} nomeDe={nomeDe} aoAbrir={aoAbrir}
        aoCriar={criar} motivoDoCriar={limite} />
      {aviso}
      <View style={estilos.aberta}>
        <View style={estilos.linha}>
          <View style={estilos.nome}>
            <Campo
              rotulo="Nome da variação"
              valor={aberta.rotulo}
              aoMudar={(t) => alterar((a) => renomearVariacao(a, aberta.uid, t))}
              onBlur={() => setSaiuDoNome(aberta.uid)}
              maxLength={ROTULO_MAXIMO}
              placeholder="Ex.: Dia de treino"
              erro={nomeVazio && saiuDoNome === aberta.uid ? 'Dê um nome à variação. Ele aparece para o aluno: “Hoje: <nome>”.' : null}
            />
            {/* O contador fica no canto de cima, na linha do rótulo: o erro, embaixo, não o empurra. */}
            <Texto variante="pequeno" numerico style={estilos.contador} accessibilityLabel={`${aberta.rotulo.length} de ${ROTULO_MAXIMO} caracteres`}>
              {`${aberta.rotulo.length}/${ROTULO_MAXIMO}`}
            </Texto>
          </View>
          <View style={estilos.semana}>
            <FaixaDaSemana conteudo={c} aberta={aberta} nomeDe={nomeDe} aoAlternar={(dia) => alterar((a) => alternarDia(a, aberta.uid, dia))} />
          </View>
          <LinhaDeAcoes alinhar="fim" style={estilos.acoes}>
            <Botao rotulo="Duplicar" rotuloAcessivel={`Duplicar a variação ${nomeDe(aberta)}`} tipo="acao" Icone={Copy} aoTocar={duplicar}
              desabilitado={limite !== null} motivo={limite ?? undefined} />
            <Botao rotulo="Usar em todos os dias" rotuloAcessivel={`Usar a variação ${nomeDe(aberta)} em todos os dias e tirar as variações`} tipo="secundario"
              aoTocar={() => comDesfazer(
                c.variacoes.length > 1 ? `A dieta voltou a ser uma só, com “${nomeDe(aberta)}”. As outras variações saíram.` : 'A dieta voltou a valer igual em todos os dias.',
                (a) => usarEmTodosOsDias(a, aberta.uid),
              )} />
            {c.variacoes.length > 1 ? (
              <Botao rotulo="Excluir" rotuloAcessivel={`Excluir a variação ${nomeDe(aberta)}`} tipo="perigoTexto" Icone={Trash2} aoTocar={() => setExcluindo(true)} />
            ) : null}
          </LinhaDeAcoes>
        </View>
        {semDia.length || vazias.length ? (
          // Variação sem dia bloqueia a publicação; dia sem variação só avisa (o "dia de descanso" é permitido).
          <Alerta tom="atencao" titulo={vazias.length ? 'Para publicar, marque ao menos um dia em cada variação' : 'Dias sem dieta marcada'}
            texto={[
              semDia.length ? `Dias sem variação: ${textoDosDiasCurtos(semDia)}. Nesses dias o aluno vê "Sem dieta marcada para hoje"; pode publicar assim.` : null,
              vazias.length ? `Sem dia marcado: ${vazias.map(nomeDe).join(', ')}.` : null,
            ].filter(Boolean).join(' ')} />
        ) : null}
      </View>
      <PainelConfirmacao visivel={excluindo} titulo={`Excluir a variação “${nomeDe(aberta)}”?`}
        mensagem={`As refeições dela saem e ${aberta.dias.length ? `${textoDosDiasCurtos(aberta.dias)} ficam` : 'os dias dela ficam'} sem dieta até você marcar em outra variação. Dá para desfazer logo depois.`}
        rotuloConfirmar="Excluir variação" perigo aoConfirmar={excluir} aoCancelar={() => setExcluindo(false)} />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  aberta: { gap: espaco(2) },
  // PC: nome, faixa e ações numa linha (quebra quando não cabe); celular: cada um na largura toda, um embaixo do outro.
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(3), rowGap: espaco(2) },
  nome: { position: 'relative', flexGrow: 1, flexBasis: 260, maxWidth: 420 },
  contador: { position: 'absolute', top: 0, right: 0 },
  semana: { flexGrow: 1, flexBasis: 308, maxWidth: 460 },
  // As ações descem até a linha dos campos (abaixo dos rótulos) e ficam na ponta direita.
  acoes: { flexGrow: 1, alignSelf: 'flex-end' },
});
