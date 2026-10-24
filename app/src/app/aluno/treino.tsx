import { router } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import { useState } from 'react';

import { CartaoDivisaoLeitura, LinhaDaDivisao } from '../../aluno/LinhaDaDivisao';
import { SecaoDoInicio } from '../../aluno/SecaoDoInicio';
import { SeletorPlano } from '../../aluno/SeletorPlano';
import { caminhoDaSessao } from '../../aluno/useSessaoDoDia';
import { normalizarTreino } from '../../dominio/editorTreino';
import { diaDaSemana, hojeIso } from '../../dominio/formatos';
import { dataParaAbrir, ehDeHoje, letraDaDivisao } from '../../dominio/inicioDoAluno';
import { mobilidadeParaExibir, temAbaMobilidade } from '../../dominio/mobilidade';
import { periodoCurto } from '../../dominio/periodoCurto';
import { sessoesDaSemana } from '../../dominio/semana';
import { useAluno } from '../../offline/AlunoProvider';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoTreino } from '../../pdf/pdfTreino';
import { EntradaEmCascata, usePrimeiraLista } from '../../ui/EntradaEmCascata';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { Vazio } from '../../ui/Estados';
import { Grade } from '../../ui/Grade';
import { NoPlano } from '../../ui/NoPlano';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { ConteudoDaMobilidade } from './mobilidade';

/**
 * Aba Treino: as divisões da semana, as orientações, o PDF e a mobilidade. O seletor de outro plano fica aqui e é só
 * consulta; registrar série continua no plano em uso, pelo cartão Hoje do Início. A mobilidade só entra quando há
 * plano publicado.
 */
export default function TreinoAluno() {
  const { pacote, escolhida, mobilidade } = useAluno();
  const animar = usePrimeiraLista(!!pacote);
  const { avisar } = useAviso();
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const hoje = hojeIso();
  const somenteLeitura = !!escolhida;
  const treino = (escolhida ? escolhida.planos.treino : pacote?.pacote.treino) ?? null;
  const conteudo = treino ? normalizarTreino(treino.conteudo) : null;
  const periodo = treino ? periodoCurto(treino, hoje) : null;
  const versaoMobilidade = mobilidadeParaExibir(mobilidade, escolhida ? { mobilidade: escolhida.planos.mobilidade } : null);
  const mostrarMobilidade = temAbaMobilidade(mobilidade, escolhida ? { mobilidade: escolhida.planos.mobilidade } : null);

  const pdf = async () => {
    if (!treino || !pacote) return;
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

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Treino" subtitulo="As divisões da semana, do jeito que o treinador montou." />
      {pacote ? <SeletorPlano soComVarios rotulo={treino ? `${treino.titulo}${periodo ? ` · ${periodo}` : ''}` : null} /> : null}
      {somenteLeitura ? <Texto variante="suave">Você está vendo outro plano. Para registrar uma série, volte ao plano em uso.</Texto> : null}
      {pacote && !treino ? <Vazio titulo="Sem treino" texto={somenteLeitura ? 'Este plano só tem dieta publicada.' : 'Seu treinador ainda não publicou um treino.'} /> : null}
      {conteudo && treino ? (
        <>
          <SecaoDoInicio titulo="Divisões da semana">
            <Grade>
              {sessoesDaSemana(conteudo).map((s, i) => (
                <EntradaEmCascata key={s.uid} indice={i} animar={animar}>
                  {somenteLeitura ? (
                    <CartaoDivisaoLeitura sessao={s} />
                  ) : (
                    <LinhaDaDivisao
                      sessao={s}
                      letra={letraDaDivisao(conteudo, s)}
                      hoje={ehDeHoje(s, diaDaSemana())}
                      href={s.exercicios.length ? caminhoDaSessao(s.uid, dataParaAbrir(s, treino.inicio, treino.fim, hoje)) : undefined}
                      aoAbrir={s.exercicios.length ? () => router.push(caminhoDaSessao(s.uid, dataParaAbrir(s, treino.inicio, treino.fim, hoje))) : undefined}
                    />
                  )}
                </EntradaEmCascata>
              ))}
            </Grade>
          </SecaoDoInicio>
          {conteudo.objetivo || conteudo.orientacoes ? (
            <Cartao titulo="Orientações do treinador">
              {conteudo.objetivo ? <Texto>Objetivo: {conteudo.objetivo}</Texto> : null}
              {conteudo.orientacoes ? <Texto variante="suave">{conteudo.orientacoes}</Texto> : null}
            </Cartao>
          ) : null}
          <NoPlano funcionalidade="PDF">
            <Botao rotulo="Baixar PDF do treino" tipo="secundario" cheio Icone={FileDown} carregando={gerandoPdf} aoTocar={() => void pdf()} />
          </NoPlano>
        </>
      ) : null}
      {mostrarMobilidade ? (
        <SecaoDoInicio titulo="Mobilidade">
          <Texto variante="suave">Mobilidade e alongamentos do seu treinador, com vídeo quando houver.</Texto>
          {versaoMobilidade ? <ConteudoDaMobilidade versao={versaoMobilidade} /> : <Vazio titulo="Sem mobilidade" texto="Este plano não tem mobilidade publicada." />}
        </SecaoDoInicio>
      ) : null}
    </Tela>
  );
}
