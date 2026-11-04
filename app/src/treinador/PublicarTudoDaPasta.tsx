import { router } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { publicarPasta } from '../api/rotas';
import type { PastaResumo, TipoPlano } from '../api/tipos';
import { PERMISSOES_DO_PLANO } from '../dominio/permissoes';
import {
  agruparProblemasPorPlano,
  contagemDeProblemas,
  resumoDaPublicacao,
  situacaoDoPublicar,
  TEXTO_DO_CONFLITO_DA_PUBLICACAO,
  textoDoErroDaPublicacao,
  textoDosPendentesDuplicados,
  versoesDosPendentes,
  type PlanosDaPasta,
  type ProblemasPorPlano,
} from '../dominio/publicarPasta';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { Alerta } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { rotaDoEditor } from './CartaoPlanos';

type Resultado =
  | { tipo: 'publicado'; texto: string }
  | { tipo: 'erros'; grupos: ProblemasPorPlano[] }
  /** `versoes` = as da tentativa que voltou com os avisos: "Publicar mesmo assim" reenvia exatamente essas, nunca as de uma recarga posterior. */
  | { tipo: 'avisos'; grupos: ProblemasPorPlano[]; versoes: ReturnType<typeof versoesDosPendentes> }
  | { tipo: 'conflito' }
  | { tipo: 'duplicados'; texto: string }
  | { tipo: 'falha'; texto: string };

interface Props {
  pasta: PastaResumo;
  /** Planos da pasta por tipo (`null` = desconhecido); `null` inteiro enquanto nada chegou. */
  planos: PlanosDaPasta | null;
  /** Versões dos pendentes das listas carregadas, sem depender da funcionalidade guardada no `/eu`. */
  versoes: Record<string, number>;
  /** Primeira carga dos planos ainda a caminho. */
  carregando: boolean;
  /** Alguma lista de planos está sendo buscada de novo: o botão espera, para não mandar versões velhas. */
  atualizando: boolean;
  /** Tipos cuja lista de planos falhou ao carregar: o botão fica desabilitado até a lista chegar. */
  falhou: Partial<Record<TipoPlano, boolean>>;
  /** Busca de novo só as listas (dos tipos indicados) que falharam. */
  aoTentarDeNovo: (tipos: TipoPlano[]) => void;
  /** Depois de publicar algo: a Folha, os selos e o resumo da ficha buscam de novo. */
  aoPublicar: () => void;
  /** Os planos mudaram desde que a tela os leu (409 `CONFLITO_EDICAO`): a Folha, os selos e o resumo buscam de novo. */
  aoRecarregar: () => void;
  /** Antes de abrir o editor de um plano (fecha a Folha, que é um Modal). */
  aoNavegar: () => void;
}

/**
 * "Publicar tudo" da Folha da pasta (C21): publica de uma vez os rascunhos alterados de treino, dieta e mobilidade.
 * A API valida todos antes e é tudo ou nada: com erro em um plano, ou aviso ainda não confirmado, nada é publicado e a
 * lista vem por plano. O pedido leva a versão de cada plano pendente que a tela leu (`versoes`): se mudou, a API responde
 * 409 e a tela recarrega e avisa; dois pendentes do mesmo tipo (409) pedem arquivar o que não deve ir ao aluno, sem tentar de novo.
 * Lista de planos que falhou ou sendo buscada de novo trava o botão com o motivo visível (a que falhou ganha "Tentar de novo"),
 * para nunca mandar `versoes` incompletas ou velhas. Botão secundário (o primário da Folha é Finalizar/Reabrir). O resultado fica aqui mesmo, dentro
 * da Folha: o aviso do rodapé ficaria atrás dela, e um painel de confirmação seria um modal sobre outro.
 */
export function PublicarTudoDaPasta({ pasta, planos, versoes: versoesDaTela, carregando, atualizando, falhou, aoTentarDeNovo, aoPublicar, aoRecarregar, aoNavegar }: Props) {
  const { pode, temFuncionalidade } = useSessao();
  const { confirmar } = useSaidaGuardada();
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // Lista que falhou ou sendo buscada de novo deixa o botão desabilitado com o motivo (nada vai à API; a que falhou
  // ganha o "Tentar de novo"); sem isso, só trava quando falta a permissão de um tipo QUE TEM alteração; o resto (tipo
  // não lido) a API decide.
  const situacao = situacaoDoPublicar(planos, falhou, temFuncionalidade('MOBILIDADE'), pode, atualizando);
  const motivo = carregando ? 'Carregando os planos da pasta.' : situacao.motivo;

  const publicar = async (confirmarAvisos: boolean, versoesDosAvisos?: ReturnType<typeof versoesDosPendentes>) => {
    if (!situacao.podePublicar) return;
    setPublicando(true);
    const versoes = versoesDosAvisos ?? versoesDaTela;
    try {
      const r = await publicarPasta(pasta.id, { confirmarAvisos, versoes });
      setResultado({ tipo: 'publicado', texto: resumoDaPublicacao(r) });
      if (r.publicados.length) aoPublicar();
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'CONFLITO_EDICAO') {
        setResultado({ tipo: 'conflito' });
        aoRecarregar();
      } else if (e instanceof ErroApi && e.codigo === 'PLANOS_PENDENTES_DUPLICADOS') {
        setResultado({ tipo: 'duplicados', texto: textoDosPendentesDuplicados(e.campos, planos) ?? textoDoErro(e) });
      } else if (e instanceof ErroApi && (e.codigo === 'PLANO_INVALIDO' || e.codigo === 'CONFIRMAR_AVISOS')) {
        const grupos = agruparProblemasPorPlano(e.campos, planos ?? { treino: null, dieta: null, mobilidade: null });
        setResultado(e.codigo === 'PLANO_INVALIDO' ? { tipo: 'erros', grupos } : { tipo: 'avisos', grupos, versoes });
      } else {
        setResultado({ tipo: 'falha', texto: e instanceof ErroApi ? textoDoErroDaPublicacao({ status: e.status, codigo: e.codigo, mensagem: textoDoErro(e) }) : textoDoErro(e) });
      }
    } finally {
      setPublicando(false);
    }
  };

  // Passa pela guarda (a ficha pode estar com os dados do aluno em edição, D7); a Folha só fecha se a pessoa sair.
  const abrir = (tipo: TipoPlano, planoId: string) => confirmar(() => {
    aoNavegar();
    router.push(rotaDoEditor(tipo, planoId));
  });

  return (
    <View style={estilos.bloco}>
      <Texto variante="suave">
        Publica de uma vez os rascunhos alterados de treino, dieta e mobilidade desta pasta. Se algum plano tiver erro,
        nada é publicado.
      </Texto>
      <LinhaDeAcoes>
        <Botao rotulo="Publicar tudo" rotuloAcessivel={`Publicar tudo da pasta ${pasta.titulo}`} tipo="secundario" Icone={Send}
          carregando={publicando} desabilitado={!!motivo} motivo={motivo ?? undefined} aoTocar={() => void publicar(false)} />
        {!carregando && situacao.tiposComFalha.length ? (
          <Botao rotulo="Tentar de novo" rotuloAcessivel="Tentar carregar os planos de novo" tipo="fantasma" aoTocar={() => aoTentarDeNovo(situacao.tiposComFalha)} />
        ) : null}
      </LinhaDeAcoes>
      {/* Região viva: o leitor de tela anuncia o resultado sem tirar o foco do botão. */}
      <View accessibilityLiveRegion="polite" style={estilos.bloco}>
        {resultado?.tipo === 'publicado' ? <Alerta tom="sucesso" texto={resultado.texto} /> : null}
        {resultado?.tipo === 'falha' ? <Alerta tom="perigo" texto={resultado.texto} /> : null}
        {resultado?.tipo === 'conflito' ? <Alerta tom="atencao" titulo="Nada foi publicado" texto={TEXTO_DO_CONFLITO_DA_PUBLICACAO} /> : null}
        {resultado?.tipo === 'duplicados' ? <Alerta tom="atencao" titulo="Nada foi publicado" texto={resultado.texto} /> : null}
        {resultado?.tipo === 'erros' ? (
          <Alerta tom="perigo" titulo="Nada foi publicado" texto="Corrija os planos abaixo e publique de novo.">
            <ListaPorPlano grupos={resultado.grupos} tom="perigo" aoAbrir={abrir} />
          </Alerta>
        ) : null}
        {resultado?.tipo === 'avisos' ? (
          <Alerta tom="atencao" titulo="Nada foi publicado ainda" texto="Os planos podem ser publicados, mas confira os avisos:">
            <ListaPorPlano grupos={resultado.grupos} tom="atencao" aoAbrir={abrir} />
            <LinhaDeAcoes>
              <Botao rotulo="Publicar mesmo assim" tipo="secundario" Icone={Send} carregando={publicando}
                desabilitado={!!motivo} motivo={motivo ?? undefined} aoTocar={() => void publicar(true, resultado.versoes)} />
              <Botao rotulo="Cancelar" tipo="fantasma" desabilitado={publicando} aoTocar={() => setResultado(null)} />
            </LinhaDeAcoes>
          </Alerta>
        ) : null}
      </View>
    </View>
  );
}

/** Um bloco por plano: nome legível, quantos problemas e a mensagem de cada um; "Abrir" leva ao editor dele. */
function ListaPorPlano({ grupos, tom, aoAbrir }: { grupos: ProblemasPorPlano[]; tom: 'perigo' | 'atencao'; aoAbrir: (tipo: TipoPlano, planoId: string) => void }) {
  const { cores } = useTema();
  const { pode } = useSessao();
  const avisos = tom === 'atencao';
  return (
    <View style={estilos.grupos}>
      {grupos.map((g) => (
        <View key={g.chave} style={[estilos.grupo, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
          <View style={estilos.cabecalhoDoGrupo}>
            <Texto style={estilos.tituloDoGrupo}>{g.titulo}</Texto>
            <Selo texto={contagemDeProblemas(g.problemas.length, avisos)} tipo={tom} />
          </View>
          {g.problemas.map((p, i) => (
            <View key={i} style={estilos.problema}>
              <Selo texto={avisos ? 'Aviso' : 'Erro'} tipo={tom} />
              <Texto style={estilos.mensagem}>{p.mensagem}</Texto>
            </View>
          ))}
          {g.tipo && g.planoId && pode(PERMISSOES_DO_PLANO[g.tipo].alterar) ? (
            <LinhaDeAcoes>
              <Botao rotulo="Abrir o plano" rotuloAcessivel={`Abrir ${g.titulo}`} tipo="secundario" aoTocar={() => aoAbrir(g.tipo as TipoPlano, g.planoId as string)} />
            </LinhaDeAcoes>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  grupos: { gap: espaco(1), marginTop: espaco(0.5) },
  grupo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(0.75) },
  cabecalhoDoGrupo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  tituloDoGrupo: { fontFamily: fontes.semi, flexShrink: 1 },
  problema: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  mensagem: { flex: 1 },
});
