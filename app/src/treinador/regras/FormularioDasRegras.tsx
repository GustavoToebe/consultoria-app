import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { salvarRegrasDeAtencao } from '../../api/rotas';
import type { RegrasDeAtencaoResposta, TipoDeRegraDeAtencao } from '../../api/tipos';
import {
  alternarModelo, corpoDoLote, errosDasRegras, errosDoLoteDaApi, MODELOS_DE_REGRA, modeloLigado, motivoDoTeto, novaRegra,
  rascunhoDasRegras, rascunhoMudou, regrasDoModelo, resumoDasRegras, temErros, TEXTOS_DAS_REGRAS, textoDaLeitura, TIPOS_DE_REGRA,
  type ErrosDaRegra, type RegraEmEdicao,
} from '../../dominio/regrasDeAtencao';
import { novoUid } from '../../dominio/uid';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Cartao } from '../../ui/Cartao';
import { Alerta } from '../../ui/Estados';
import { codigoApi, erroDeConexao, errosPorCampo, textoDoErro } from '../../ui/erros';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { LinkTexto } from '../../ui/LinkTexto';
import { Texto } from '../../ui/Texto';
import { BarraDeSalvar, ColunasDeAjustes, GrupoDeOpcoes } from '../financeiro/AjustesDaAba';
import { ExcecoesPorAluno } from './ExcecoesPorAluno';
import { ModeloDaRegra } from './ModeloDaRegra';

const CONFIRA_OS_CAMPOS = 'Confira os campos marcados.';
const TEXTO_SEM_INTERNET = 'Não foi possível salvar. Confira a internet e tente de novo.';

/**
 * O corpo de Configurações › Regras de atenção: à esquerda o cartão "Me avise quando" (um modelo por linha) e, ao lado, "Como
 * funciona". Com `REGRA_ATENCAO_ALTERAR` edita um rascunho e salva o lote inteiro (C1, `corpoDoLote`); sem ela, só leitura. O
 * rascunho mora aqui; a validação, o lote e os textos são de `dominio/regrasDeAtencao`.
 */
export function FormularioDasRegras({ dados, podeAlterar, aoSalvar, aoRecarregar }: {
  dados: RegrasDeAtencaoResposta;
  podeAlterar: boolean;
  aoSalvar: (novo: RegrasDeAtencaoResposta) => void;
  aoRecarregar: () => void;
}) {
  return (
    <ColunasDeAjustes
      ajustes={podeAlterar ? <Edicao dados={dados} aoSalvar={aoSalvar} aoRecarregar={aoRecarregar} /> : <Leitura dados={dados} />}
      apoio={<><ComoFunciona /><ExcecoesPorAluno dados={dados} /></>} />
  );
}

/** Campo da regra que a pessoa já deixou (o erro local só aparece depois disso, ou depois de tentar salvar). */
const chaveDoCampo = (chave: string, campo: keyof ErrosDaRegra) => `${chave}:${campo}`;

function Edicao({ dados, aoSalvar, aoRecarregar }: {
  dados: RegrasDeAtencaoResposta;
  aoSalvar: (novo: RegrasDeAtencaoResposta) => void;
  aoRecarregar: () => void;
}) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [rascunho, setRascunho] = useState<RegraEmEdicao[]>(() => rascunhoDasRegras(dados.regras));
  const [tocados, setTocados] = useState<ReadonlySet<string>>(new Set());
  const [tentou, setTentou] = useState(false);
  // Os erros do 422, já na linha certa; somem do campo que a pessoa muda.
  const [doServidor, setDoServidor] = useState<Record<string, ErrosDaRegra>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const numeros = useRef(new Map<string, TextInput | null>());

  const locais = errosDasRegras(rascunho, dados.perguntas);
  const mudou = rascunhoMudou(rascunho, dados.regras);
  useGuardaDeSaida(mudou);

  const erro = (chave: string, campo: keyof ErrosDaRegra) =>
    doServidor[chave]?.[campo] ?? (tentou || tocados.has(chaveDoCampo(chave, campo)) ? locais[chave]?.[campo] : undefined);

  const tirarDoServidor = (chave: string, campos: readonly (keyof ErrosDaRegra)[]) => setDoServidor((atual) => {
    if (!atual[chave]) return atual;
    const resto = { ...atual[chave] };
    for (const c of campos) delete resto[c];
    return { ...atual, [chave]: resto };
  });

  const acoesDo = (tipo: TipoDeRegraDeAtencao) => ({
    alternar: (ligar: boolean) => setRascunho((r) => alternarModelo(r, tipo, ligar, novoUid())),
    mudar: (chave: string, parcial: Partial<Pick<RegraEmEdicao, 'perguntaId' | 'limite'>>) => {
      setRascunho((r) => r.map((x) => (x.chave === chave ? { ...x, ...parcial } : x)));
      const campos = Object.keys(parcial) as (keyof ErrosDaRegra)[];
      tirarDoServidor(chave, campos);
      // Escolher a pergunta é deixar o campo; a escala nova pode mudar o erro do número.
      if (parcial.perguntaId !== undefined) setTocados((t) => new Set(t).add(chaveDoCampo(chave, 'perguntaId')));
    },
    sairDoNumero: (chave: string) => setTocados((t) => new Set(t).add(chaveDoCampo(chave, 'limite'))),
    adicionar: () => setRascunho((r) => [...r, novaRegra(tipo, novoUid())]),
    remover: (chave: string) => setRascunho((r) => r.filter((x) => x.chave !== chave)),
    erro,
    refDoNumero: (chave: string) => (campo: TextInput | null) => { numeros.current.set(chave, campo); },
  });

  const descartar = () => {
    setRascunho(rascunhoDasRegras(dados.regras));
    setTocados(new Set());
    setTentou(false);
    setDoServidor({});
    setErroGeral(null);
  };

  /** Foco no primeiro número com erro, na ordem da tela (a pergunta não recebe foco: o erro dela é anunciado). */
  const focarNoPrimeiroNumero = (erros: Readonly<Record<string, ErrosDaRegra>>) => {
    const primeira = TIPOS_DE_REGRA.flatMap((t) => regrasDoModelo(rascunho, t)).find((r) => erros[r.chave]?.limite);
    if (primeira) setTimeout(() => numeros.current.get(primeira.chave)?.focus(), 0);
  };

  const salvar = () => {
    if (enviando) return;
    if (temErros(locais)) {
      setTentou(true);
      setErroGeral(CONFIRA_OS_CAMPOS);
      focarNoPrimeiroNumero(locais);
      return;
    }
    const { corpo, chaves } = corpoDoLote(dados.versao, rascunho, dados.regras);
    setEnviando(true);
    setErroGeral(null);
    setDoServidor({});
    salvarRegrasDeAtencao(corpo).then(
      (novo) => {
        setEnviando(false);
        avisar(TEXTOS_DAS_REGRAS.salvas, 'sucesso');
        aoSalvar(novo);
      },
      (e: unknown) => {
        setEnviando(false);
        if (codigoApi(e) === 'CONFLITO_EDICAO') {
          avisar(TEXTOS_DAS_REGRAS.conflito, 'neutro');
          aoRecarregar();
          return;
        }
        const campos = errosPorCampo(e);
        if (Object.keys(campos).length > 0) {
          // 422 `REGRA_INVALIDA`: a mensagem da API vai, sem reescrever, para a linha e o campo que ela aponta.
          const { porRegra, geral } = errosDoLoteDaApi(campos, chaves);
          setDoServidor(porRegra);
          setErroGeral(geral ?? CONFIRA_OS_CAMPOS);
          focarNoPrimeiroNumero(porRegra);
          return;
        }
        setErroGeral(erroDeConexao(e) ? TEXTO_SEM_INTERNET : textoDoErro(e));
      },
    );
  };

  const teto = motivoDoTeto(rascunho, dados.teto);
  const podeVerQuestionarios = pode('QUESTIONARIO_LER');
  // Uma regra gravada desligada também vai no lote e é validada: com erro a corrigir, os campos do modelo aparecem.
  const comErroVisivel = (tipo: TipoDeRegraDeAtencao) => regrasDoModelo(rascunho, tipo).some((r) => erro(r.chave, 'perguntaId') || erro(r.chave, 'limite'));

  return (
    <Cartao titulo={TEXTOS_DAS_REGRAS.cartao} descricao={resumoDasRegras(rascunho)}
      rodape={(
        <BarraDeSalvar mudou={mudou} enviando={enviando} aoSalvar={salvar} aoDescartar={descartar}
          rotuloSalvar="Salvar regras" rotuloAcessivelDescartar="Descartar alterações das regras de atenção"
          erro={erroGeral ? <Alerta tom="perigo" texto={erroGeral} /> : null} />
      )}>
      <GrupoDeOpcoes>
        {TIPOS_DE_REGRA.map((tipo) => {
          const ligado = modeloLigado(rascunho, tipo);
          return (
            <ModeloDaRegra key={tipo} modelo={MODELOS_DE_REGRA[tipo]} regras={regrasDoModelo(rascunho, tipo)} ligado={ligado}
              aberto={ligado || comErroVisivel(tipo)} perguntas={dados.perguntas} teto={teto} acoes={acoesDo(tipo)}
              podeVerQuestionarios={podeVerQuestionarios} />
          );
        })}
      </GrupoDeOpcoes>
    </Cartao>
  );
}

/** Sem `REGRA_ATENCAO_ALTERAR`: o mesmo cartão, sem interruptores, com o que cada modelo faz hoje. */
function Leitura({ dados }: { dados: RegrasDeAtencaoResposta }) {
  const { cores } = useTema();
  const rascunho = rascunhoDasRegras(dados.regras);
  return (
    <Cartao titulo={TEXTOS_DAS_REGRAS.cartao} descricao={resumoDasRegras(rascunho)}>
      <GrupoDeOpcoes>
        {TIPOS_DE_REGRA.map((tipo) => {
          const regras = regrasDoModelo(rascunho, tipo);
          const textos = regras.length ? regras.map((r) => textoDaLeitura(r, dados.perguntas)) : [TEXTOS_DAS_REGRAS.desligada];
          // Sem controle, a linha usa a largura toda (a `LinhaDeOpcao` reservaria a coluna vazia do interruptor).
          return (
            <View key={tipo} style={estilos.linhaDeLeitura}>
              <Texto variante="rotulo" cor={cores.texto}>{MODELOS_DE_REGRA[tipo].titulo}</Texto>
              {textos.map((t, i) => <Texto key={i} variante="pequeno">{t}</Texto>)}
            </View>
          );
        })}
      </GrupoDeOpcoes>
      <Texto variante="suave">{TEXTOS_DAS_REGRAS.soLeitura}</Texto>
    </Cartao>
  );
}

/** Apoio: o que a regra faz e o que não faz (texto menor), e onde ligar o aviso no celular. */
function ComoFunciona() {
  const { pode } = useSessao();
  // O aviso no celular só vai a quem lê as atualizações e os dados sensíveis (R8): o atalho só aparece para quem o vê.
  const comAviso = pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
  return (
    <Cartao titulo={TEXTOS_DAS_REGRAS.comoFunciona}>
      <View role="list" style={estilos.itens}>
        {TEXTOS_DAS_REGRAS.itensDoComoFunciona.map((t) => (
          <View key={t} role="listitem" style={estilos.item}>
            <Texto variante="pequeno" aria-hidden>•</Texto>
            <Texto variante="pequeno" style={estilos.textoDoItem}>{t}</Texto>
          </View>
        ))}
      </View>
      {comAviso ? (
        <Texto variante="pequeno">Avisos no celular: <LinkTexto href="/treinador/ajustes" texto="Aparência e preferências" />.</Texto>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linhaDeLeitura: { paddingVertical: espaco(1.5), gap: 2 },
  itens: { gap: espaco(1) },
  item: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start' },
  textoDoItem: { flex: 1 },
});
