import { router } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { ErroApi } from '../api/cliente';
import type { CorpoDaLiberacao } from '../api/liberacaoDePlano';
import { publicarPasta } from '../api/rotas';
import type { PastaResumo, TipoPlano } from '../api/tipos';
import { corpoDaLiberacao, destinoDoErro, erroDoCampo, type EscolhaDaLiberacao } from '../dominio/liberacaoDePlano';
import { PERMISSOES_DO_PLANO } from '../dominio/permissoes';
import {
  agruparProblemasPorPlano,
  contagemDePendentes,
  contagemDeProblemas,
  resumoDosPendentes,
  resumoDaPublicacao,
  rotuloDoPublicarDaPasta,
  situacaoDoPublicar,
  TEXTO_DO_CONFLITO_DA_PUBLICACAO,
  textoDoErroDaPublicacao,
  textoDosPendentesDuplicados,
  textoDosPuladosAgendados,
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
import { EscolhaDaLiberacaoDoPlano } from './plano/EscolhaDaLiberacao';

type Versoes = ReturnType<typeof versoesDosPendentes>;

type Resultado =
  /** `pulados`: plano agendado e sem alteração, que o "Publicar tudo" não reagenda (bloco E). */
  | { tipo: 'publicado'; texto: string; pulados: string | null }
  | { tipo: 'erros'; grupos: ProblemasPorPlano[] }
  /**
   * `versoes` e `liberacao` = as da tentativa que voltou com os avisos: "Publicar mesmo assim" reenvia exatamente essas,
   * nunca as de uma recarga posterior nem uma data mexida depois.
   */
  | { tipo: 'avisos'; grupos: ProblemasPorPlano[]; versoes: Versoes; liberacao: CorpoDaLiberacao }
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
  /**
   * O botão é o primário da Folha (bloco F). Com a atualização para revisar, quem é primário é o "Revisar atualização" e
   * este vira secundário: um primário por folha.
   */
  principal: boolean;
}

/**
 * "Publicar tudo" da Folha da pasta (C21): publica de uma vez os rascunhos alterados de treino, dieta e mobilidade.
 * A API valida todos antes e é tudo ou nada: com erro em um plano, ou aviso ainda não confirmado, nada é publicado e a
 * lista vem por plano. O pedido leva a versão de cada plano pendente que a tela leu (`versoes`): se mudou, a API responde
 * 409 e a tela recarrega e avisa; dois pendentes do mesmo tipo (409) pedem arquivar o que não deve ir ao aluno, sem tentar de novo.
 * Lista de planos que falhou ou sendo buscada de novo trava o botão com o motivo visível (a que falhou ganha "Tentar de novo"),
 * para nunca mandar `versoes` incompletas ou velhas; dois pendentes do mesmo tipo e "nada a publicar" também travam o botão
 * com o motivo, sem chamar a API. O botão é o primário da Folha (`principal`), salvo com a atualização para revisar. A
 * escolha da liberação só aparece quando há o que publicar. O resultado fica aqui mesmo, dentro da Folha: o aviso do
 * rodapé ficaria atrás dela, e um painel de confirmação seria um modal sobre outro.
 */
export function PublicarTudoDaPasta({ pasta, planos, versoes: versoesDaTela, carregando, atualizando, falhou, aoTentarDeNovo, aoPublicar, aoRecarregar, aoNavegar, principal }: Props) {
  const { cores } = useTema();
  const { pode, temFuncionalidade } = useSessao();
  const { confirmar } = useSaidaGuardada();
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // Uma data só para todos os planos publicados agora (bloco E); o padrão é liberar na hora e avisar, como antes.
  const [escolha, setEscolha] = useState<EscolhaDaLiberacao>({ modo: 'agora', dataTexto: '', avisar: true });
  const [tentou, setTentou] = useState(false);
  const [erroDaData, setErroDaData] = useState<string | null>(null);
  const refData = useRef<TextInput>(null);
  // Lista que falhou ou sendo buscada de novo deixa o botão desabilitado com o motivo (nada vai à API; a que falhou
  // ganha o "Tentar de novo"); sem isso, só trava quando falta a permissão de um tipo QUE TEM alteração; o resto (tipo
  // não lido) a API decide.
  const situacao = situacaoDoPublicar(planos, falhou, temFuncionalidade('MOBILIDADE'), pode, atualizando);
  const motivo = carregando ? 'Carregando os planos da pasta.' : situacao.motivo;
  // Enquanto as listas são buscadas de novo, a escolha continua se ainda havia o que publicar: não some e volta num piscar.
  const comEscolha = !carregando && (situacao.podePublicar || (atualizando && (contagemDePendentes(planos) ?? 0) > 0));

  const publicar = async (confirmarAvisos: boolean, dosAvisos?: { versoes: Versoes; liberacao: CorpoDaLiberacao }) => {
    if (!situacao.podePublicar) return;
    let liberacao = dosAvisos?.liberacao;
    if (!liberacao) {
      const r = corpoDaLiberacao(escolha);
      if ('erro' in r) {
        setTentou(true);
        refData.current?.focus();
        return;
      }
      liberacao = r.corpo;
    }
    setPublicando(true);
    const versoes = dosAvisos?.versoes ?? versoesDaTela;
    // A lista do clique: a recarga depois de publicar já traz o plano novo e perderia quem foi pulado.
    const planosDoClique = planos;
    try {
      const r = await publicarPasta(pasta.id, { confirmarAvisos, versoes, ...liberacao });
      setResultado({ tipo: 'publicado', texto: resumoDaPublicacao(r), pulados: textoDosPuladosAgendados(r.pulados, planosDoClique) });
      if (r.publicados.length) aoPublicar();
    } catch (e) {
      const destino = e instanceof ErroApi ? destinoDoErro(e) : null;
      if (destino && 'campo' in destino) {
        setResultado(null);
        setErroDaData(destino.campo);
      } else if (e instanceof ErroApi && e.codigo === 'CONFLITO_EDICAO') {
        setResultado({ tipo: 'conflito' });
        aoRecarregar();
      } else if (e instanceof ErroApi && e.codigo === 'PLANOS_PENDENTES_DUPLICADOS') {
        setResultado({ tipo: 'duplicados', texto: textoDosPendentesDuplicados(e.campos, planos) ?? textoDoErro(e) });
      } else if (e instanceof ErroApi && (e.codigo === 'PLANO_INVALIDO' || e.codigo === 'CONFIRMAR_AVISOS')) {
        const grupos = agruparProblemasPorPlano(e.campos, planos ?? { treino: null, dieta: null, mobilidade: null });
        setResultado(e.codigo === 'PLANO_INVALIDO' ? { tipo: 'erros', grupos } : { tipo: 'avisos', grupos, versoes, liberacao });
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
    <View style={[estilos.bloco, estilos.separado, { borderTopColor: cores.divisor }]}>
      <Texto variante="suave">
        {/* "Vai publicar…" só quando dá para publicar: com duplicados ou sem permissão o motivo do botão diz o porquê. */}
        {(situacao.podePublicar ? resumoDosPendentes(planos) : null) ?? 'Publica de uma vez os planos com alterações não publicadas desta pasta.'} Se algum plano tiver erro, nada é publicado.
      </Texto>
      {comEscolha ? <EscolhaDaLiberacaoDoPlano valor={escolha} refData={refData}
        erro={escolha.modo === 'agendar' ? erroDaData ?? erroDoCampo(escolha.dataTexto, tentou) : null}
        aoMudar={(v) => { setEscolha(v); setErroDaData(null); }} /> : null}
      <LinhaDeAcoes>
        <Botao {...rotuloDoPublicarDaPasta(planos, pasta.titulo)} tipo={principal ? 'primario' : 'secundario'} Icone={Send}
          carregando={publicando} desabilitado={!!motivo} motivo={motivo ?? undefined} aoTocar={() => void publicar(false)} />
        {!carregando && situacao.tiposComFalha.length ? (
          <Botao rotulo="Tentar de novo" rotuloAcessivel="Tentar carregar os planos de novo" tipo="fantasma" aoTocar={() => aoTentarDeNovo(situacao.tiposComFalha)} />
        ) : null}
      </LinhaDeAcoes>
      {/* Região viva: o leitor de tela anuncia o resultado sem tirar o foco do botão. */}
      <View accessibilityLiveRegion="polite" style={estilos.bloco}>
        {resultado?.tipo === 'publicado' ? <Alerta tom="sucesso" texto={resultado.texto} /> : null}
        {resultado?.tipo === 'publicado' && resultado.pulados ? <Alerta tom="atencao" texto={resultado.pulados} /> : null}
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
                desabilitado={!!motivo} motivo={motivo ?? undefined} aoTocar={() => void publicar(true, { versoes: resultado.versoes, liberacao: resultado.liberacao })} />
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
  // Fio entre a lista dos planos e o publicar, no mesmo cartão.
  separado: { borderTopWidth: 1, paddingTop: espaco(1.5) },
  grupos: { gap: espaco(1), marginTop: espaco(0.5) },
  grupo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(0.75) },
  cabecalhoDoGrupo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  tituloDoGrupo: { fontFamily: fontes.semi, flexShrink: 1 },
  problema: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  mensagem: { flex: 1 },
});
