import { ProgressoSemana } from '../../aluno/ProgressoSemana';
import { CartaoAtualizacao } from '../../aluno/atualizacao/CartaoAtualizacao';
import { EntradaEmCascata, usePrimeiraLista } from '../../ui/EntradaEmCascata';
import { router } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CartaoDivisao, CartaoDivisaoLeitura } from '../../aluno/CartaoDivisao';
import { CartaoDietaDoInicio } from '../../aluno/CartaoDietaDoInicio';
import { CartaoHoje } from '../../aluno/CartaoHoje';
import { SeletorPlano } from '../../aluno/SeletorPlano';
import { caminhoDaSessao } from '../../aluno/useSessaoDoDia';
import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { useVersaoDaFotoDePerfil } from '../../aluno/versaoDaFotoDePerfil';
import { baixarFotoDePerfil } from '../../api/rotas';
import type { Sessao } from '../../api/tipos';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataHoraParaTela, dataParaTela, diaDaSemana, hojeIso } from '../../dominio/formatos';
import { sessaoDoDia, sessoesDaSemana } from '../../dominio/semana';
import { useAluno } from '../../offline/AlunoProvider';
import { espaco } from '../../tema/tokens';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoTreino } from '../../pdf/pdfTreino';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { NoPlano } from '../../ui/NoPlano';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { FotoDePerfil } from '../../ui/FotoDePerfil';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Treino do aluno: "Treino de hoje" em destaque e as divisões do plano com as datas do período. Funciona com o pacote
 * salvo, sem internet.
 */
export default function TreinoAluno() {
  const { pacote, carregando, erroPacote, registros, escolhida } = useAluno();
  const versaoDaFoto = useVersaoDaFotoDePerfil();
  const animar = usePrimeiraLista(!!pacote);
  const { avisar } = useAviso();
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const dietaVigente = useDietaDoAluno().dados?.dieta;
  const hoje = hojeIso();
  // Outro plano escolhido no seletor: só consulta (o registro das séries é do plano vigente).
  const somenteLeitura = !!escolhida;
  const treino = (escolhida ? escolhida.planos.treino : pacote?.pacote.treino) ?? null;

  if (!pacote) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho mostrarMarca="sempre" />
        {carregando ? <Esqueleto texto="Carregando seu treino" /> : null}
        {!carregando && erroPacote ? (
          <MensagemErro texto={`${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`} />
        ) : null}
      </Tela>
    );
  }

  const pdf = async () => {
    if (!treino) return;
    setGerandoPdf(true);
    try {
      const marca = pacote.pacote.marca;
      await imprimir(
        documentoTreino({
          marca,
          logoDataUri: await logoComoDataUri(marca),
          aluno: pacote.pacote.aluno.nome,
          titulo: treino.titulo,
          inicio: treino.inicio,
          fim: treino.fim,
          versao: treino.numero,
          conteudo: normalizarTreino(treino.conteudo),
          tipoTrabalho: pacote.pacote.configuracao.tipoTrabalho,
          instrucoesTreino: pacote.pacote.configuracao.instrucoesTreino ?? null,
          rodapePdf: null,
          emitidoEm: new Date(),
        }),
      );
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setGerandoPdf(false);
    }
  };

  const conteudo = treino ? normalizarTreino(treino.conteudo) : null;
  const deHoje = conteudo ? sessaoDoDia(conteudo, diaDaSemana()) : null;
  const registrosDe = (s: Sessao, data: string) =>
    registros.filter((r) => r.data === data && r.sessaoUid === s.uid && r.planoVersaoId === treino?.versaoId && r.concluida);
  const periodo =
    treino && (treino.inicio || treino.fim) ? `${dataParaTela(treino.inicio) || '—'} a ${dataParaTela(treino.fim) || '—'}` : null;

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho mostrarMarca="sempre" />
      <View style={estilos.saudacao}>
        <FotoDePerfil chave={`perfil:${versaoDaFoto}`} carregar={baixarFotoDePerfil} nome={pacote.pacote.aluno.nome} />
        <Texto variante="titulo" style={estilos.ola}>Olá, {pacote.pacote.aluno.nome.split(' ')[0]}</Texto>
      </View>
      <Texto variante="suave">Seu treino da semana: abra o de hoje e registre carga e repetições. Funciona sem internet.</Texto>
      <SeletorPlano rotulo={treino ? `${treino.titulo}${periodo ? ` · ${periodo}` : ''}` : null} />
      <CartaoAtualizacao />
      <CartaoDietaDoInicio versao={escolhida ? escolhida.planos.dieta : dietaVigente} />
      {!treino || !conteudo ? (
        <Vazio
          titulo={escolhida ? 'Sem treino neste plano' : 'Sem plano de treino'}
          texto={escolhida ? 'Este plano só tem dieta publicada.' : 'Seu treinador ainda não publicou um treino para você.'}
        />
      ) : (
        <>
          {somenteLeitura ? (
            <Texto variante="suave">Você está consultando outro plano. Para registrar séries, volte ao plano em uso.</Texto>
          ) : (
            <>
              <CartaoHoje
                sessao={deHoje}
                hoje={hoje}
                feitas={deHoje ? registrosDe(deHoje, hoje).length : 0}
                aoAbrir={() => deHoje && router.push(caminhoDaSessao(deHoje.uid, hoje))}
              />
              <ProgressoSemana hoje={hoje} />
            </>
          )}
          <Texto variante="bloco">Divisões da semana</Texto>
          {sessoesDaSemana(conteudo).map((s, i) => (
            <EntradaEmCascata key={s.uid} indice={i} animar={animar}>
            {somenteLeitura ? <CartaoDivisaoLeitura sessao={s} /> : <CartaoDivisao
              sessao={s}
              inicio={treino.inicio}
              fim={treino.fim}
              hoje={hoje}
              treinouEm={(d) => registrosDe(s, d).length > 0}
              aoAbrir={(d) => router.push(caminhoDaSessao(s.uid, d))}
            />}
            </EntradaEmCascata>
          ))}
          {conteudo.objetivo || conteudo.orientacoes ? (
            <Cartao titulo="Orientações do treinador">
              {conteudo.objetivo ? <Texto>Objetivo: {conteudo.objetivo}</Texto> : null}
              {conteudo.orientacoes ? <Texto variante="suave">{conteudo.orientacoes}</Texto> : null}
            </Cartao>
          ) : null}
          <NoPlano funcionalidade="PDF"><Botao rotulo="Baixar PDF do treino" tipo="secundario" cheio Icone={FileDown} carregando={gerandoPdf} aoTocar={() => void pdf()} /></NoPlano>
          <Texto variante="suave">
            {treino.titulo} (v{treino.numero}) · atualizado em {dataHoraParaTela(pacote.salvoEm)}
          </Texto>
        </>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  saudacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  ola: { flex: 1 },
});
