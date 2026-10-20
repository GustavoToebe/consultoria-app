import { ProgressoSemana } from '../../aluno/ProgressoSemana';
import { EntradaEmCascata, usePrimeiraLista } from '../../ui/EntradaEmCascata';
import { router } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import { useState } from 'react';

import { CabecalhoDoInicio } from '../../aluno/CabecalhoDoInicio';
import { CartaoDietaDoInicio } from '../../aluno/CartaoDietaDoInicio';
import { CartaoHoje } from '../../aluno/CartaoHoje';
import { CartaoDivisaoLeitura, LinhaDaDivisao } from '../../aluno/LinhaDaDivisao';
import { ParaFazer } from '../../aluno/ParaFazer';
import { SecaoDoInicio } from '../../aluno/SecaoDoInicio';
import { SeletorPlano } from '../../aluno/SeletorPlano';
import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { caminhoDaSessao } from '../../aluno/useSessaoDoDia';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataHoraParaTela, diaDaSemana, hojeIso } from '../../dominio/formatos';
import { dataParaAbrir, dietaNoInicio, ehDeHoje, estadoDoHoje, letraDaDivisao } from '../../dominio/inicioDoAluno';
import { periodoCurto } from '../../dominio/periodoCurto';
import { sessoesDaSemana } from '../../dominio/semana';
import { useAluno } from '../../offline/AlunoProvider';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoTreino } from '../../pdf/pdfTreino';
import { useSessao } from '../../sessao/SessaoProvider';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Vazio } from '../../ui/Estados';
import { Grade } from '../../ui/Grade';
import { NoPlano } from '../../ui/NoPlano';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Início do aluno, nesta ordem (proposta do Gustavo, 19/10; em 390/360 o Hoje precisa aparecer na primeira tela): marca e
 * foto, "Olá, <nome>." com a data, plano em uso (só com mais de um), Dieta compacta com a água do dia (R15), "Hoje" (o
 * único primário da tela), "Suas pendências" (anamnese e atualização), "Divisões da semana" e "Sua semana". Funciona com
 * o pacote salvo, sem internet. As regras de cada estado moram em `dominio/inicioDoAluno`.
 */
export default function InicioAluno() {
  const { pacote, carregando, erroPacote, escolhida, tentarDeNovo } = useAluno();
  const { usuario } = useSessao();
  const animar = usePrimeiraLista(!!pacote);
  const { avisar } = useAviso();
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const dieta = useDietaDoAluno();
  const hoje = hojeIso();
  // Outro plano escolhido no seletor: só consulta (o registro das séries é do plano vigente).
  const somenteLeitura = !!escolhida;
  const treino = (escolhida ? escolhida.planos.treino : pacote?.pacote.treino) ?? null;
  const conteudo = treino ? normalizarTreino(treino.conteudo) : null;
  const nome = pacote?.pacote.aluno.nome ?? usuario?.nome ?? null;
  const periodo = treino ? periodoCurto(treino, hoje) : null;

  // Dieta: plano escolhido sem dieta não mostra nada; o vigente distingue "lendo", "falhou" e "não publicada".
  const dietaDoPlano = escolhida ? escolhida.planos.dieta : dieta.dados ? dieta.dados.dieta : undefined;
  const estadoDaDieta = dietaNoInicio({ conteudo: dietaDoPlano === undefined ? undefined : dietaDoPlano?.conteudo ?? null, erro: !!dieta.erro });
  const mostrarDieta = !(escolhida && !escolhida.planos.dieta);

  const semPacote = !pacote;
  const estadoHoje = estadoDoHoje({ conteudo, dia: diaDaSemana(), carregando: semPacote && carregando, erro: semPacote && !carregando && !!erroPacote });

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

  return (
    <Tela bordas={['top']} largura={720}>
      <CabecalhoDoInicio nome={nome} hoje={hoje} />
      {pacote ? <SeletorPlano soComVarios rotulo={treino ? `${treino.titulo}${periodo ? ` · ${periodo}` : ''}` : null} /> : null}
      {mostrarDieta ? <CartaoDietaDoInicio estado={estadoDaDieta} aoTentarDeNovo={dieta.recarregar} /> : null}
      {semPacote ? (
        <SecaoHojeDoInicio
          estado={estadoHoje}
          hoje={hoje}
          carregando={carregando}
          erro={erroPacote ? { texto: `${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`, aoTentarDeNovo: () => void tentarDeNovo(), causa: erroPacote } : undefined}
        />
      ) : somenteLeitura ? (
        <Texto variante="suave">Você está consultando outro plano. Para registrar séries, volte ao plano em uso.</Texto>
      ) : (
        <SecaoHojeDoInicio estado={estadoHoje} hoje={hoje} carregando={false} />
      )}
      {pacote ? <ParaFazer /> : null}
      {pacote && !treino && somenteLeitura ? (
        <Vazio titulo="Sem treino neste plano" texto="Este plano só tem dieta publicada." />
      ) : null}
      {conteudo && treino ? (
        <>
          <AlvoDeRolagem chave="divisoes">
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
                        aoAbrir={s.exercicios.length ? () => router.push(caminhoDaSessao(s.uid, dataParaAbrir(s, treino.inicio, treino.fim, hoje))) : undefined}
                      />
                    )}
                  </EntradaEmCascata>
                ))}
              </Grade>
            </SecaoDoInicio>
          </AlvoDeRolagem>
          {somenteLeitura ? null : <ProgressoSemana hoje={hoje} />}
          {conteudo.objetivo || conteudo.orientacoes ? (
            <Cartao titulo="Orientações do treinador">
              {conteudo.objetivo ? <Texto>Objetivo: {conteudo.objetivo}</Texto> : null}
              {conteudo.orientacoes ? <Texto variante="suave">{conteudo.orientacoes}</Texto> : null}
            </Cartao>
          ) : null}
          <NoPlano funcionalidade="PDF"><Botao rotulo="Baixar PDF do treino" tipo="secundario" cheio Icone={FileDown} carregando={gerandoPdf} aoTocar={() => void pdf()} /></NoPlano>
        </>
      ) : null}
      {pacote ? <Texto variante="suave">Plano baixado em {dataHoraParaTela(pacote.salvoEm)}. Funciona sem internet.</Texto> : null}
    </Tela>
  );
}

/** Título "Hoje" e o cartão do dia. Mora aqui (dentro da `Tela`) para o "Escolher treino" poder rolar até as divisões. */
function SecaoHojeDoInicio({
  estado,
  hoje,
  carregando,
  erro,
}: {
  estado: ReturnType<typeof estadoDoHoje>;
  hoje: string;
  carregando: boolean;
  erro?: { texto: string; aoTentarDeNovo: () => void; causa?: unknown };
}) {
  const { rolarAte } = useRolagem();
  return (
    <SecaoDoInicio titulo="Hoje">
      {carregando && estado.tipo === 'carregando' ? <Esqueleto texto="Carregando seu treino" cartoes={1} /> : (
        <CartaoHoje
          estado={estado}
          erro={erro}
          aoVerTreino={() => estado.tipo === 'treino' && router.push(caminhoDaSessao(estado.sessao.uid, hoje))}
          aoEscolher={() => rolarAte(['divisoes'])}
        />
      )}
    </SecaoDoInicio>
  );
}
