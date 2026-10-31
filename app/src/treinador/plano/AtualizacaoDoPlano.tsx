import { ExternalLink, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { QuestionarioAtualizacao } from '../../aluno/atualizacao/QuestionarioAtualizacao';
import { atualizacaoDoAluno, atualizacoesDoAluno, baixarFotoDoTreinador, detalheAtualizacao, listarPastas } from '../../api/rotas';
import type { Atualizacao } from '../../api/tipos';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../../dominio/atualizacao';
import { atualizacaoParaOPlano, AVISO_SEM_ATUALIZACAO_NA_PASTA, rotuloDaAtualizacaoAnterior } from '../../dominio/atualizacaoDoPlano';
import { idSeguro } from '../../dominio/caminhoDaPasta';
import { dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_EDITOR, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { ICONE_DO_SELO } from '../iconesDosSelos';
import { ResumoDaAtualizacao } from '../ResumoDaAtualizacao';

interface Props {
  alunoId: string;
  /** Pasta do plano aberto no editor; sem pasta, nada aparece. */
  pastaId: string | null | undefined;
}

/** `hrefAttrs` é do react-native-web (vira `target`/`rel` do `<a>`); o tipo do React Native não o conhece. */
type PropsDeAncora = PressableProps & { href: string; hrefAttrs: { target: string; rel: string } };

/**
 * A atualização da pasta ao lado do editor do plano do aluno (reunião de 30/10): o treinador lê as respostas enquanto
 * monta o plano, sem perder o rascunho. Só com `ATUALIZACAO_LER`.
 *
 * - **Web:** `<a href>` de verdade que abre a atualização **sempre em outra aba** (`target="_blank"`, sem passar pela
 *   navegação do app): a aba do editor continua com o que não foi salvo. Na URL vai só o id.
 * - **Celular:** "Ver atualização" abre uma `Folha` só de leitura com o aluno, a pasta e a data, e o mesmo resumo e
 *   respostas do detalhe da atualização. O detalhe é buscado ao abrir; nada fica no aparelho.
 *
 * Qual atualização (`atualizacaoParaOPlano`): a da pasta, se já enviada; senão a última enviada do aluno (a pasta
 * renovada ainda não tem atualização, e é a anterior que o treinador lê ao revisar os rascunhos), com a pasta e a data
 * dela escritas acima, para não ser confundida com a da pasta do plano. Sem nenhuma: "Sem atualização nesta pasta".
 */
export function AtualizacaoDoPlano({ alunoId, pastaId }: Props) {
  const { pode } = useSessao();
  const valida = idSeguro(alunoId) && idSeguro(pastaId) ? pastaId : null;
  const ver = pode('ATUALIZACAO_LER') && valida !== null;
  // Mesmo carregamento da Folha da pasta (`CartaoPastas`): a atual e o histórico do aluno, duas buscas, sem uma por pasta.
  // A lista de pastas só é buscada quando a atualização é de outra pasta, para dizer qual.
  const carga = useCarregar(ver ? `atualizacao-do-plano:${alunoId}:${valida}` : null, async () => {
    const [atual, historico] = await Promise.all([atualizacaoDoAluno(alunoId).catch(() => null), atualizacoesDoAluno(alunoId)]);
    const escolhida = atualizacaoParaOPlano(valida ?? '', atual, historico);
    if (!escolhida || escolhida.daPasta) return escolhida ? { ...escolhida, tituloDaPasta: null } : null;
    const pastas = await listarPastas(alunoId).catch(() => null);
    return { ...escolhida, tituloDaPasta: pastas?.find((p) => p.id === escolhida.atualizacao.pastaId)?.titulo ?? null };
  });
  const [aberta, setAberta] = useState(false);
  if (!ver) return null;
  if (carga.erro) {
    return (
      <View style={estilos.linha}>
        <Texto variante="suave">Não foi possível carregar a atualização desta pasta.</Texto>
        <Botao rotulo="Tentar de novo" tipo="fantasma" aoTocar={carga.recarregar} />
      </View>
    );
  }
  // Enquanto carrega, nada: a linha aparece pronta e não empurra o editor duas vezes.
  if (carga.dados === undefined) return null;
  if (!carga.dados) return <Texto variante="suave">Sem atualização nesta pasta.</Texto>;

  const { atualizacao: registrada, daPasta, tituloDaPasta } = carga.dados;
  const selo = statusAtualizacaoTreinador(registrada);
  const data = dataParaTela(registrada.dataAtualizacao);
  const deQual = daPasta ? `de ${data}` : `de ${tituloDaPasta?.trim() || 'outra pasta'} de ${data}`;
  const acoes = (
    <View style={estilos.linha}>
      <Selo texto={selo.texto} tipo={selo.tipo} Icone={ICONE_DO_SELO[selo.tipo]} />
      {Platform.OS === 'web' ? (
        <LinkEmOutraAba href={caminhoAtualizacaoTreinador(registrada)} rotuloAcessivel={`Abrir atualização ${deQual} em outra aba`} />
      ) : (
        <Botao rotulo="Ver atualização" rotuloAcessivel={`Ver atualização ${deQual}`} tipo="secundario" Icone={FileText} aoTocar={() => setAberta(true)} />
      )}
      {aberta ? <FolhaDaAtualizacao atualizacao={registrada} alunoId={alunoId} aoFechar={() => setAberta(false)} /> : null}
    </View>
  );
  if (daPasta) return acoes;
  return (
    <View style={estilos.anterior}>
      <Texto style={estilos.rotuloDaAnterior}>{rotuloDaAtualizacaoAnterior(tituloDaPasta, data)}</Texto>
      <Texto variante="suave">{AVISO_SEM_ATUALIZACAO_NA_PASTA}</Texto>
      {acoes}
    </View>
  );
}

/** O `<a>` com cara de botão secundário; o clique fica com o navegador (outra aba), nunca com o roteador do app. */
function LinkEmOutraAba({ href, rotuloAcessivel }: { href: string; rotuloAcessivel: string }) {
  const { cores } = useTema();
  const props: PropsDeAncora = {
    href,
    hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' },
    accessibilityRole: 'link',
    accessibilityLabel: rotuloAcessivel,
    style: (estado) => [estilos.ancora, { borderColor: cores.borda, backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }],
  };
  return (
    <Pressable {...props}>
      <View style={estilos.conteudoDaAncora}>
        <ExternalLink size={18} color={cores.texto} strokeWidth={2} />
        <Texto numberOfLines={2} style={[estilos.rotulo, { color: cores.texto }]}>Abrir atualização em outra aba</Texto>
      </View>
    </Pressable>
  );
}

/**
 * Consulta da atualização no celular, por cima do editor: diz de qual aluno, pasta e data é (a da atualização exibida,
 * que pode ser de outra pasta), e mostra o resumo e as
 * respostas como no detalhe (`atualizacoes/[id]`), sem feedback nem navegação (o rascunho do editor fica onde está).
 */
function FolhaDaAtualizacao({ atualizacao, alunoId, aoFechar }: { atualizacao: Atualizacao; alunoId: string; aoFechar: () => void }) {
  const id = atualizacao.id;
  const pastaId = atualizacao.pastaId;
  const carga = useCarregar(`atualizacao-do-plano-folha:${id ?? alunoId}:${pastaId ?? ''}`, async () => {
    // A atualização ainda sem linha no banco (aberta) não tem detalhe próprio: vale a que já veio.
    const [detalhe, pastas] = await Promise.all([
      id ? detalheAtualizacao(id) : Promise.resolve(atualizacao),
      listarPastas(alunoId).catch(() => null),
    ]);
    return { detalhe, pasta: (pastaId ? pastas?.find((p) => p.id === pastaId)?.titulo : null) ?? null };
  });
  const a = carga.dados?.detalhe ?? null;
  const nome = a?.nomeAluno ?? atualizacao.nomeAluno;
  const selo = a?.dataAtualizacao ? statusAtualizacaoTreinador(a) : null;
  return (
    <Folha visivel titulo={nome ? `Atualização de ${nome}` : 'Atualização do aluno'} largura={LARGURA_EDITOR} aoFechar={aoFechar}>
      <View style={estilos.identificacao}>
        <CampoLeitura rotulo="Aluno" valor={nome} />
        <CampoLeitura rotulo="Pasta" valor={carga.dados ? carga.dados.pasta : undefined} />
        <CampoLeitura rotulo="Data da atualização" valor={dataParaTela(atualizacao.dataAtualizacao)} numerico />
      </View>
      {carga.erro ? <MensagemErro texto={textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} /> : null}
      {!a && !carga.erro ? <Esqueleto texto="Carregando atualização" cartoes={2} /> : null}
      {a && (!a.modelo || !a.enviadaEm) ? <Texto variante="suave">O aluno ainda não enviou esta atualização.</Texto> : null}
      {a?.modelo && a.enviadaEm ? (
        <>
          <ResumoDaAtualizacao atualizacao={a} modelo={a.modelo} selo={selo ? { texto: selo.curto, tipo: selo.tipo, Icone: ICONE_DO_SELO[selo.tipo] } : null} />
          <QuestionarioAtualizacao modelo={a.modelo} dataAtualizacao={a.dataAtualizacao} resumo={a.resumo} respostas={a.respostas ?? {}}
            carregarFotoDaEquipe={a.id ? (foto) => baixarFotoDoTreinador(a.id ?? '', foto) : undefined} />
        </>
      ) : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  anterior: { gap: espaco(0.5), maxWidth: '100%' },
  rotuloDaAnterior: { fontFamily: fontes.semi },
  identificacao: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  ancora: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(2),
    paddingVertical: espaco(0.75),
    borderRadius: RAIO,
    borderWidth: 1,
    justifyContent: 'center',
  },
  conteudoDaAncora: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  rotulo: { fontFamily: fontes.semi, fontSize: 15, flexShrink: 1 },
});
