import { router } from 'expo-router';

import { CabecalhoDoInicio } from '../../aluno/CabecalhoDoInicio';
import { CartaoCompromissos } from '../../aluno/CartaoCompromissos';
import { CartaoAguaDoDia } from '../../aluno/CartaoAguaDoDia';
import { CartaoDietaDoInicio } from '../../aluno/CartaoDietaDoInicio';
import { CartaoHoje } from '../../aluno/CartaoHoje';
import { MapaDeTreinos } from '../../aluno/MapaDeTreinos';
import { ParaFazer } from '../../aluno/ParaFazer';
import { ProgressoSemana } from '../../aluno/ProgressoSemana';
import { SecaoDoInicio } from '../../aluno/SecaoDoInicio';
import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { caminhoDaConclusao, caminhoDaSessao } from '../../aluno/useSessaoDoDia';
import { normalizarTreino } from '../../dominio/editorTreino';
import { textoDoHojeConcluido } from '../../dominio/conclusaoNaTela';
import { diaDaSemana, hojeIso } from '../../dominio/formatos';
import { dietaNoInicio, estadoDoHoje, proximoTreino } from '../../dominio/inicioDoAluno';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Tela } from '../../ui/Tela';

/**
 * Início do aluno: o resumo do dia. Marca e "Olá", a dieta compacta com a água, a água do dia (só com meta na dieta),
 * o cartão Hoje (o único primário),
 * as pendências, os próximos compromissos presenciais (só leitura), a faixa da semana e o mapa de treinos do ano (só com o retorno ligado). A lista de divisões, o PDF e
 * a mobilidade ficam na aba Treino. Sempre o plano em uso. Em 390 o botão do treino de hoje precisa aparecer na primeira tela.
 */
export default function InicioAluno() {
  const { pacote, carregando, erroPacote, pacoteRecusado, tentarDeNovo, sessaoConcluidaDe } = useAluno();
  const { usuario } = useSessao();
  const dieta = useDietaDoAluno();
  const hoje = hojeIso();
  const treino = pacote?.pacote.treino ?? null;
  const conteudo = treino ? normalizarTreino(treino.conteudo) : null;
  const nome = pacote?.pacote.aluno.nome ?? usuario?.nome ?? null;
  const dietaDoPlano = dieta.dados ? dieta.dados.dieta : undefined;
  const estadoDaDieta = dietaNoInicio({ conteudo: dietaDoPlano === undefined ? undefined : dietaDoPlano?.conteudo ?? null, erro: !!dieta.erro });
  const semPacote = !pacote;
  const dia = diaDaSemana();
  const estadoHoje = estadoDoHoje({ conteudo, dia, carregando: semPacote && carregando, erro: semPacote && !carregando && !!erroPacote, recusado: semPacote && pacoteRecusado });

  // N3: treino de hoje já concluído (só existe com o retorno ligado: sem ele nunca há conclusão).
  const conclusao = treino && estadoHoje.tipo === 'treino' ? sessaoConcluidaDe(treino.versaoId, estadoHoje.sessao.uid, hoje) : null;
  const concluido = conclusao?.concluida && estadoHoje.tipo === 'treino'
    ? { texto: textoDoHojeConcluido(conclusao), aoVerResumo: () => router.push(caminhoDaConclusao(estadoHoje.sessao.uid, hoje)) }
    : null;

  return (
    <Tela bordas={['top']} largura={720}>
      <CabecalhoDoInicio nome={nome} hoje={hoje} />
      <CartaoDietaDoInicio estado={estadoDaDieta} aoTentarDeNovo={dieta.recarregar} />
      {dietaDoPlano?.conteudo.aguaLitros ? <CartaoAguaDoDia compacto metaLitros={dietaDoPlano.conteudo.aguaLitros} /> : null}
      <SecaoHojeDoInicio
        estado={estadoHoje}
        proximo={estadoHoje.tipo === 'descanso' ? proximoTreino(conteudo, hoje, treino?.fim ?? null) : null}
        hoje={hoje}
        concluido={concluido}
        carregando={semPacote && carregando}
        erro={semPacote && erroPacote ? { texto: `${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`, aoTentarDeNovo: () => void tentarDeNovo(), causa: erroPacote } : undefined}
      />
      {pacote ? <ParaFazer /> : null}
      <CartaoCompromissos />
      {pacote ? <ProgressoSemana hoje={hoje} /> : null}
      <MapaDeTreinos />
    </Tela>
  );
}

/** Título "Hoje" e o cartão do dia. "Escolher treino" abre a aba Treino, onde estão as divisões. */
function SecaoHojeDoInicio({
  estado,
  proximo,
  hoje,
  concluido,
  carregando,
  erro,
}: {
  estado: ReturnType<typeof estadoDoHoje>;
  proximo: string | null;
  hoje: string;
  concluido: { texto: string; aoVerResumo: () => void } | null;
  carregando: boolean;
  erro?: { texto: string; aoTentarDeNovo: () => void; causa?: unknown };
}) {
  return (
    <SecaoDoInicio titulo="Hoje">
      {carregando && estado.tipo === 'carregando' ? <Esqueleto texto="Carregando seu treino" cartoes={1} /> : (
        <CartaoHoje
          estado={estado}
          proximo={proximo}
          concluido={concluido}
          erro={erro}
          aoVerTreino={() => estado.tipo === 'treino' && router.push(caminhoDaSessao(estado.sessao.uid, hoje))}
          aoEscolher={() => router.push('/aluno/treino')}
        />
      )}
    </SecaoDoInicio>
  );
}
