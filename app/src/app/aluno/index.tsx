import { router } from 'expo-router';

import { CabecalhoDoInicio } from '../../aluno/CabecalhoDoInicio';
import { CartaoCompromissos } from '../../aluno/CartaoCompromissos';
import { CartaoAguaDoDia } from '../../aluno/CartaoAguaDoDia';
import { CartaoDietaDoInicio } from '../../aluno/CartaoDietaDoInicio';
import { CartaoHoje } from '../../aluno/CartaoHoje';
import { ParaFazer } from '../../aluno/ParaFazer';
import { ProgressoSemana } from '../../aluno/ProgressoSemana';
import { SecaoDoInicio } from '../../aluno/SecaoDoInicio';
import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { caminhoDaSessao } from '../../aluno/useSessaoDoDia';
import { normalizarTreino } from '../../dominio/editorTreino';
import { diaDaSemana, hojeIso } from '../../dominio/formatos';
import { dietaNoInicio, estadoDoHoje } from '../../dominio/inicioDoAluno';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Tela } from '../../ui/Tela';

/**
 * Início do aluno: o resumo do dia. Marca e "Olá", a dieta compacta com a água, a água do dia (só com meta na dieta),
 * o cartão Hoje (o único primário),
 * as pendências, os próximos compromissos presenciais (só leitura) e a faixa da semana. A lista de divisões, o PDF e
 * a mobilidade ficam na aba Treino. Sempre o plano em uso. Em 390 o botão do treino de hoje precisa aparecer na primeira tela.
 */
export default function InicioAluno() {
  const { pacote, carregando, erroPacote, tentarDeNovo } = useAluno();
  const { usuario } = useSessao();
  const dieta = useDietaDoAluno();
  const hoje = hojeIso();
  const treino = pacote?.pacote.treino ?? null;
  const conteudo = treino ? normalizarTreino(treino.conteudo) : null;
  const nome = pacote?.pacote.aluno.nome ?? usuario?.nome ?? null;
  const dietaDoPlano = dieta.dados ? dieta.dados.dieta : undefined;
  const estadoDaDieta = dietaNoInicio({ conteudo: dietaDoPlano === undefined ? undefined : dietaDoPlano?.conteudo ?? null, erro: !!dieta.erro });
  const semPacote = !pacote;
  const estadoHoje = estadoDoHoje({ conteudo, dia: diaDaSemana(), carregando: semPacote && carregando, erro: semPacote && !carregando && !!erroPacote });

  return (
    <Tela bordas={['top']} largura={720}>
      <CabecalhoDoInicio nome={nome} hoje={hoje} />
      <CartaoDietaDoInicio estado={estadoDaDieta} aoTentarDeNovo={dieta.recarregar} />
      {dietaDoPlano?.conteudo.aguaLitros ? <CartaoAguaDoDia compacto metaLitros={dietaDoPlano.conteudo.aguaLitros} /> : null}
      <SecaoHojeDoInicio
        estado={estadoHoje}
        hoje={hoje}
        carregando={semPacote && carregando}
        erro={semPacote && erroPacote ? { texto: `${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`, aoTentarDeNovo: () => void tentarDeNovo(), causa: erroPacote } : undefined}
      />
      {pacote ? <ParaFazer /> : null}
      <CartaoCompromissos />
      {pacote ? <ProgressoSemana hoje={hoje} /> : null}
    </Tela>
  );
}

/** Título "Hoje" e o cartão do dia. "Escolher treino" abre a aba Treino, onde estão as divisões. */
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
  return (
    <SecaoDoInicio titulo="Hoje">
      {carregando && estado.tipo === 'carregando' ? <Esqueleto texto="Carregando seu treino" cartoes={1} /> : (
        <CartaoHoje
          estado={estado}
          erro={erro}
          aoVerTreino={() => estado.tipo === 'treino' && router.push(caminhoDaSessao(estado.sessao.uid, hoje))}
          aoEscolher={() => router.push('/aluno/treino')}
        />
      )}
    </SecaoDoInicio>
  );
}
