import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { obterRegrasDeAtencao, obterRegrasDeAtencaoDoAluno, salvarRegraDeAtencaoDoAluno, voltarRegraDeAtencaoDoAlunoAGeral } from '../../api/rotas';
import type { AlunoDetalhe, PerguntaDaRegra, RegraDoAluno, RegrasDoAlunoResposta } from '../../api/tipos';
import {
  aceitaNumero, corpoDaExcecao, erroDoNumeroDaExcecao, excecaoMudou, modoDaExcecao, numeroDaExcecao, resumoDasExcecoes,
  TEXTOS_DAS_EXCECOES, textoDaExcecao, textoDaRegraGeral, type ModoDaExcecao,
} from '../../dominio/excecoesDeAtencao';
import { primeiroNome } from '../../dominio/gruposDeAlunos';
import { MODELOS_DE_REGRA } from '../../dominio/regrasDeAtencao';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO_CONTROLE } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { codigoApi, erroDeConexao, errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeDado } from '../../ui/ListaDeDados';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { REGRAS_ATENCAO_INDISPONIVEIS } from './TelaRegrasDeAtencao';

const SEM_INTERNET = 'Não foi possível salvar. Confira a internet e tente de novo.';

const statusDoErro = (erro: unknown): number | undefined =>
  typeof erro === 'object' && erro !== null && 'status' in erro && typeof erro.status === 'number' ? erro.status : undefined;

/**
 * "Regras de atenção" nos Dados do aluno › Configuração do acompanhamento (etapa 2, C8): o resumo das exceções do aluno e
 * "Ajustar", que abre uma folha com as regras ligadas da consultoria; em cada uma, regra geral, outro número (só nos modelos
 * com número, campo vazio: o app não sugere) ou desligada só para ele. Salva por regra (PUT/DELETE). Some sem a chave da
 * plataforma, sem `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER` ou com 403/503; sem `REGRA_ATENCAO_ALTERAR` + `ALUNO_ALTERAR`, só leitura.
 */
export function RegrasDoAlunoNaFicha({ aluno }: { aluno: AlunoDetalhe }) {
  const { pode, regrasAtencaoHabilitada } = useSessao();
  const ver = !!regrasAtencaoHabilitada && pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
  const carga = useCarregar(ver ? `regras-de-atencao-do-aluno:${aluno.id}` : null, () => obterRegrasDeAtencaoDoAluno(aluno.id));
  const [aberta, setAberta] = useState(false);
  if (!ver || codigoApi(carga.erro) === REGRAS_ATENCAO_INDISPONIVEIS || statusDoErro(carga.erro) === 403) return null;

  const podeAjustar = pode('REGRA_ATENCAO_ALTERAR') && pode('ALUNO_ALTERAR');
  const regras = carga.dados?.regras ?? [];
  const valor = carga.dados ? resumoDasExcecoes(regras) : carga.erro ? textoDoErro(carga.erro) : TEXTOS_DAS_EXCECOES.carregando;
  const motivo = podeAjustar && aluno.anonimizado ? TEXTOS_DAS_EXCECOES.anonimizado : undefined;
  return (
    <LinhaDeDado rotulo={TEXTOS_DAS_EXCECOES.linha} valor={valor}
      nota={carga.erro && !carga.dados ? <MensagemErro texto={textoDoErro(carga.erro)} tentarDeNovo={carga.recarregar} /> : undefined}
      acoes={carga.dados && regras.length ? (
        <>
          <Botao rotulo={podeAjustar ? TEXTOS_DAS_EXCECOES.ajustar : TEXTOS_DAS_EXCECOES.ver}
            rotuloAcessivel={`${podeAjustar ? TEXTOS_DAS_EXCECOES.ajustar : TEXTOS_DAS_EXCECOES.ver}: regras de atenção de ${aluno.nome}`}
            tipo="secundario" tamanho="pequeno" desabilitado={!!motivo} motivo={motivo} aoTocar={() => setAberta(true)} />
          {aberta ? (
            <FolhaDasRegrasDoAluno aluno={aluno} dados={carga.dados} podeAjustar={podeAjustar && !aluno.anonimizado}
              aoMudar={carga.definir} aoRecarregar={carga.recarregar} aoFechar={() => setAberta(false)} />
          ) : null}
        </>
      ) : undefined} />
  );
}

function FolhaDasRegrasDoAluno({ aluno, dados, podeAjustar, aoMudar, aoRecarregar, aoFechar }: {
  aluno: AlunoDetalhe;
  dados: RegrasDoAlunoResposta;
  podeAjustar: boolean;
  aoMudar: (novo: RegrasDoAlunoResposta) => void;
  aoRecarregar: () => void;
  aoFechar: () => void;
}) {
  // Rótulo e escala das perguntas vêm da lista geral (as mesmas permissões de leitura).
  const perguntas = useCarregar('regras-de-atencao-perguntas', () => obterRegrasDeAtencao());
  const nome = primeiroNome(aluno.nome);
  return (
    <Folha visivel titulo={`Regras de atenção de ${nome}`} aoFechar={aoFechar}
      rodape={<Botao rotulo="Fechar" tipo="secundario" aoTocar={aoFechar} />}>
      <Texto variante="suave">{TEXTOS_DAS_EXCECOES.vale}</Texto>
      {!podeAjustar ? <Texto variante="suave">{TEXTOS_DAS_EXCECOES.soLeitura}</Texto> : null}
      {perguntas.erro && !perguntas.dados ? (
        <MensagemErro texto={textoDoErro(perguntas.erro)} erro={perguntas.erro} tentarDeNovo={perguntas.recarregar} />
      ) : !perguntas.dados ? (
        <Esqueleto cartoes={dados.regras.length} texto="Carregando as regras" />
      ) : (
        <View style={estilos.lista}>
          {dados.regras.map((r) => (
            // A chave leva a versão: salvar traz a linha de novo, sem o rascunho antigo.
            <LinhaDaRegraDoAluno key={`${r.regraId}:${r.excecao?.versao ?? 'geral'}`} alunoId={aluno.id} regra={r}
              perguntas={perguntas.dados!.perguntas} podeAjustar={podeAjustar} aoMudar={aoMudar} aoRecarregar={aoRecarregar} />
          ))}
        </View>
      )}
    </Folha>
  );
}

function LinhaDaRegraDoAluno({ alunoId, regra, perguntas, podeAjustar, aoMudar, aoRecarregar }: {
  alunoId: string;
  regra: RegraDoAluno;
  perguntas: readonly PerguntaDaRegra[];
  podeAjustar: boolean;
  aoMudar: (novo: RegrasDoAlunoResposta) => void;
  aoRecarregar: () => void;
}) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const [modo, setModo] = useState<ModoDaExcecao>(() => modoDaExcecao(regra));
  const [texto, setTexto] = useState(() => numeroDaExcecao(regra));
  const [tocado, setTocado] = useState(false);
  const [doServidor, setDoServidor] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const titulo = textoDaRegraGeral(regra, perguntas);
  const modelo = MODELOS_DE_REGRA[regra.tipo];
  const erroLocal = modo === 'NUMERO' ? erroDoNumeroDaExcecao(regra, texto, perguntas) : undefined;
  const erroDoNumero = doServidor ?? (tocado ? erroLocal : undefined);
  const mudou = excecaoMudou(regra, modo, texto);

  const opcoes: { valor: ModoDaExcecao; rotulo: string }[] = [
    { valor: 'GERAL', rotulo: TEXTOS_DAS_EXCECOES.geral },
    ...(aceitaNumero(regra) ? [{ valor: 'NUMERO' as const, rotulo: TEXTOS_DAS_EXCECOES.numero }] : []),
    { valor: 'DESLIGADA', rotulo: TEXTOS_DAS_EXCECOES.desligada },
  ];

  const salvar = () => {
    if (enviando || !mudou) return;
    if (erroLocal) { setTocado(true); return; }
    setEnviando(true);
    setErroGeral(null);
    setDoServidor(null);
    const pedido = modo === 'GERAL'
      ? voltarRegraDeAtencaoDoAlunoAGeral(alunoId, regra.regraId).then(() => null)
      : salvarRegraDeAtencaoDoAluno(alunoId, regra.regraId, corpoDaExcecao(regra, modo, texto));
    pedido.then(
      (novo) => {
        setEnviando(false);
        avisar(modo === 'GERAL' ? TEXTOS_DAS_EXCECOES.voltou : TEXTOS_DAS_EXCECOES.salva, 'sucesso');
        if (novo) aoMudar(novo); else aoRecarregar();
      },
      (e: unknown) => {
        setEnviando(false);
        if (codigoApi(e) === 'CONFLITO_EDICAO') {
          avisar(TEXTOS_DAS_EXCECOES.conflito, 'neutro');
          aoRecarregar();
          return;
        }
        const campos = errosPorCampo(e);
        if (campos.limite) { setDoServidor(campos.limite); return; }
        setErroGeral(erroDeConexao(e) ? SEM_INTERNET : (campos.ativa ?? textoDoErro(e)));
      },
    );
  };

  return (
    <View style={[estilos.regra, { borderColor: cores.divisor, borderRadius: RAIO_CONTROLE }]}>
      <View style={estilos.cabeca}>
        <Texto variante="rotulo" cor={cores.texto}>{titulo}</Texto>
        <Texto variante="pequeno">{textoDaExcecao(regra, perguntas)}</Texto>
      </View>
      {podeAjustar ? (
        <>
          <Escolha<ModoDaExcecao> descricao={`Para este aluno: ${titulo}`} opcoes={opcoes} valor={modo} compacta
            aoMudar={(v) => { setModo(v); setDoServidor(null); setErroGeral(null); }} />
          {modo === 'NUMERO' && modelo.campo ? (
            <View style={estilos.numero}>
              <Campo numerico rotulo={modelo.campo} valor={texto} autoComplete="off" maxLength={5}
                keyboardType={regra.tipo === 'PESO_MUDOU' ? 'decimal-pad' : 'number-pad'}
                aoMudar={(t) => { setTexto(t.replace(/[^\d,.]/g, '')); setDoServidor(null); }}
                onBlur={() => setTocado(true)} erro={erroDoNumero ?? null} />
            </View>
          ) : null}
          {erroGeral ? <Alerta tom="perigo" texto={erroGeral} /> : null}
          {mudou ? (
            <View style={estilos.acoes}>
              <Botao rotulo="Salvar" rotuloAcessivel={`Salvar: ${titulo}`} tipo="primario" tamanho="pequeno" carregando={enviando}
                aoTocar={salvar} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  // Borda, não fundo: a trilha da escolha já é `superficie2` e sumiria num fundo igual.
  regra: { padding: espaco(1.5), gap: espaco(1.25), borderWidth: 1 },
  cabeca: { gap: 2 },
  numero: { maxWidth: 320 },
  acoes: { alignItems: 'flex-start' },
});
