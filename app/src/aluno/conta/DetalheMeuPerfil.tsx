import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { definirMeuApelido, salvarMeuPerfilDaComunidade } from '../../api/comunidade';
import type { PreferenciasDoPerfil } from '../../api/comunidadeTipos';
import { baixarFotoDePerfil } from '../../api/rotas';
import type { MeusDadosResponse } from '../../api/tipos';
import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import { MolduraDaFoto } from '../../comunidade/MolduraDaFoto';
import { apelidoParaEnviar, erroDoApelido } from '../../dominio/comunidade';
import { envioDoMeuPerfil, SEM_EDICAO_DO_PERFIL, type EdicaoDoMeuPerfil } from '../../dominio/contaDoAluno';
import {
  AJUDA_DO_RESERVAR, alternarDestaque, contadorDeDestaques, CORES_DO_PERFIL, corDoPerfil, corpoDoManterVisivel, MAXIMO_DE_DESTAQUES,
  molduraDoPerfil, MOLDURAS_DO_PERFIL, mostrarAvisoDoPerfil, nomeParaColegas, notaDoReservar, reservadoNaTela, type EdicaoDoPerfil,
} from '../../dominio/perfilDaComunidade';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, corDoTomDoPerfil, espaco, RAIO_CONTROLE } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { codigoApi, separarErros, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { FotoDePerfil } from '../../ui/FotoDePerfil';
import { useRolagem } from '../../ui/RolagemComTopo';
import { coresDaSelecao } from '../../ui/selecao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { AvisoDoPerfil, textoDoErroDoPerfil } from '../AvisoDoPerfil';
import { EscolhaDoNome } from '../EscolhaDoNome';
import { avisarQueOApelidoMudou } from '../versaoDoApelido';
import { useVersaoDaFotoDePerfil } from '../versaoDaFotoDePerfil';
import type { Carga } from './tipos';

const FOTO = 56;
const AMOSTRA = 26;
const BOLINHA = 28;
/** Ponto de rolagem do interruptor, para o atalho "Reservar meu perfil" da Comunidade. */
const ALVO_DO_RESERVAR = 'reservar-meu-perfil';

/**
 * Detalhe "Meu perfil" da Conta (23/11): junta o que eram os cartões Comunidade (apelido) e Meu perfil. A prévia fica fixa
 * no topo da folha; embaixo, apelido, como o nome aparece, destaques, cor e moldura (escolhas compactas) e "Reservar meu
 * perfil". Um "Salvar perfil" só, no rodapé da folha ("Tudo salvo" / "Alterações não salvas" + Descartar + Salvar perfil):
 * manda o apelido e depois o perfil (`envioDoMeuPerfil`), e cada parte é gravada quando a sua rota responde. Fechar com
 * alteração pergunta "Sair sem salvar?". Só com internet: sem conexão, as escolhas ficam e o salvar espera a rede.
 * `focarReservar` (atalho da Comunidade) rola até o interruptor.
 */
export function DetalheMeuPerfil({ perfil, dados, online, focarReservar, aoFechar }: {
  perfil: Carga<PreferenciasDoPerfil>;
  dados: Carga<MeusDadosResponse>;
  online: boolean;
  focarReservar: boolean;
  aoFechar: () => void;
}) {
  const { cores, variante } = useTema();
  const { usuario } = useSessao();
  const { avisar } = useAviso();
  const versaoDaFoto = useVersaoDaFotoDePerfil();
  const [edicao, setEdicao] = useState<EdicaoDoMeuPerfil>(SEM_EDICAO_DO_PERFIL);
  const [recusou, setRecusou] = useState(false);
  const [salvando, setSalvando] = useState<'salvar' | 'entender' | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const status = useRef<View>(null);
  const lido = perfil.dados;
  const meus = dados.dados;
  const salvo = meus?.apelido ?? null;
  const envio = lido && meus ? envioDoMeuPerfil(salvo, lido, edicao) : {};
  const mudou = Object.keys(envio).length > 0;
  const { fechar, aviso } = useFecharComAviso(true, mudou, aoFechar);

  const descartar = () => {
    setEdicao(SEM_EDICAO_DO_PERFIL);
    setErros({});
    setRecusou(false);
    requestAnimationFrame(() => status.current?.focus());
  };

  const anonimizado = (erro: unknown) => {
    setEdicao(SEM_EDICAO_DO_PERFIL);
    perfil.recarregar();
    dados.recarregar();
    avisar(textoDoErro(erro), 'neutro');
  };

  const salvar = async () => {
    if (!lido || !meus || salvando) return;
    const apelidoLocal = edicao.apelido === null ? null : erroDoApelido(edicao.apelido);
    if (apelidoLocal) return;
    setSalvando('salvar');
    setErros({});
    if ('apelido' in envio) {
      const apelido = envio.apelido ?? null;
      try {
        await definirMeuApelido(apelido);
      } catch (erro) {
        setSalvando(null);
        if (codigoApi(erro) === 'ALUNO_ANONIMIZADO') return anonimizado(erro);
        const { campos, geral } = separarErros(erro, ['apelido']);
        setErros(campos);
        if (geral) avisar(geral, 'perigo');
        return;
      }
      dados.definir({ ...meus, apelido });
      setEdicao((atual) => ({ ...atual, apelido: null }));
      avisarQueOApelidoMudou();
    }
    if (envio.perfil) {
      try {
        perfil.definir(await salvarMeuPerfilDaComunidade(envio.perfil));
        setEdicao((atual) => ({ ...atual, perfil: {} }));
        setRecusou(false);
      } catch (erro) {
        setSalvando(null);
        if (codigoApi(erro) === 'ALUNO_ANONIMIZADO') return anonimizado(erro);
        const { campos, geral } = separarErros(erro, ['destaques', 'cor', 'moldura', 'exibicaoDoNome'], textoDoErroDoPerfil(erro));
        setErros(campos);
        if (geral) avisar(geral, 'perigo');
        return;
      }
    }
    setSalvando(null);
    avisar('Perfil salvo.', 'sucesso');
  };

  const entender = () => {
    if (!lido) return;
    setSalvando('entender');
    salvarMeuPerfilDaComunidade(corpoDoManterVisivel(lido)).then(
      (resposta) => {
        setSalvando(null);
        perfil.definir(resposta);
        // "Entendi" só grava a escolha de não reservar; o resto que o aluno mexia continua na tela.
        setEdicao(({ apelido, perfil: { reservado: _ignorado, ...resto } }) => ({ apelido, perfil: resto }));
        avisar('Pronto: seu perfil continua visível para os colegas.', 'sucesso');
      },
      (erro: unknown) => {
        setSalvando(null);
        if (codigoApi(erro) === 'ALUNO_ANONIMIZADO') return anonimizado(erro);
        avisar(textoDoErroDoPerfil(erro), 'perigo');
      },
    );
  };

  const carregado = !!lido && !!meus;
  const reservado = lido ? reservadoNaTela(lido, edicao.perfil) : false;
  const cor = corDoPerfil(edicao.perfil.cor ?? lido?.cor);
  const moldura = molduraDoPerfil(edicao.perfil.moldura ?? lido?.moldura);
  const destaques = edicao.perfil.destaques ?? lido?.destaques ?? [];
  const exibicao = edicao.perfil.exibicaoDoNome ?? lido?.exibicaoDoNome ?? 'NOME';
  // O nome da prévia segue o apelido digitado (ainda sem salvar), como a escolha do nome.
  const apelidoNaTela = edicao.apelido ?? salvo;
  const nomes = meus ? { nome: meus.nome, apelido: edicao.apelido === null ? salvo : apelidoParaEnviar(edicao.apelido) } : null;
  const nomeNaPrevia = nomeParaColegas(exibicao, nomes?.nome ?? usuario?.nome, nomes?.apelido);
  const tom = corDoTomDoPerfil(cor.tom, variante);
  const titulos = new Map((lido?.opcoesDeDestaque ?? []).map((c) => [c.tipo, c.titulo]));
  const mudar = (parte: EdicaoDoPerfil) => {
    setEdicao((atual) => ({ ...atual, perfil: { ...atual.perfil, ...parte } }));
    setErros({});
  };
  const erroLocalDoApelido = edicao.apelido === null ? null : erroDoApelido(edicao.apelido);
  const motivoDoSalvar = !online ? 'Sem conexão.' : erroLocalDoApelido ? 'Corrija o apelido.' : salvando === 'entender' ? 'Gravando sua escolha.' : undefined;
  const erroDoGrupo = (campo: string) => (erros[campo] ? <MensagemDeErro erro={erros[campo]} /> : null);

  const previa = carregado ? (
    <View style={estilos.previa} accessible
      accessibilityLabel={reservado ? `Prévia: ${nomeNaPrevia}, perfil reservado, os colegas veem só o nome.` : `Prévia do perfil: ${nomeNaPrevia}, moldura ${moldura.nome.toLowerCase()} na cor ${cor.nome.toLowerCase()}.`}>
      {reservado ? null : (
        <MolduraDaFoto moldura={moldura.valor} cor={tom} tamanho={FOTO}>
          <FotoDePerfil chave={`perfil:${versaoDaFoto}`} carregar={baixarFotoDePerfil} nome={nomeNaPrevia} tamanho={FOTO} />
        </MolduraDaFoto>
      )}
      <View style={estilos.textosDaPrevia}>
        <Texto variante="secao">Prévia</Texto>
        <Texto variante="bloco" numberOfLines={1}>{nomeNaPrevia}</Texto>
        {reservado ? (
          <View style={estilos.selos}>
            <Selo texto="Reservado" tipo="neutro" />
            <Texto variante="pequeno">Os colegas veem só o seu nome.</Texto>
          </View>
        ) : destaques.length ? (
          <View style={estilos.selos}>{destaques.map((t) => <Selo key={t} texto={titulos.get(t) ?? t} tipo="neutro" />)}</View>
        ) : <Texto variante="pequeno">Sem destaques escolhidos.</Texto>}
      </View>
    </View>
  ) : undefined;

  const rodape = carregado && mudou ? (
    <>
      <Botao rotulo="Descartar" tipo="secundario" desabilitado={!!salvando} motivo="Salvando o perfil." aoTocar={descartar} />
      <Botao rotulo="Salvar perfil" carregando={salvando === 'salvar'} desabilitado={!!motivoDoSalvar}
        motivo={motivoDoSalvar} aoTocar={() => void salvar()} />
    </>
  ) : undefined;
  const statusDoRodape = carregado ? (
    <View ref={status} tabIndex={-1} aria-live="polite" style={estilos.status}>
      <Texto variante="suave" cor={mudou ? cores.texto : undefined}>{mudou ? 'Alterações não salvas' : 'Tudo salvo'}</Texto>
    </View>
  ) : undefined;

  return (
    <Folha visivel lateral detalhe titulo="Meu perfil" aoFechar={fechar} faixa={previa} rodape={rodape} statusDoRodape={statusDoRodape}>
      <View testID="detalhe-meu-perfil" style={estilos.corpo}>
        {!carregado ? (
          perfil.erro || dados.erro
            ? <MensagemErro texto={textoDoErro(perfil.erro ?? dados.erro)} erro={perfil.erro ?? dados.erro}
              tentarDeNovo={() => { if (perfil.erro) perfil.recarregar(); if (dados.erro) dados.recarregar(); }} />
            : <Esqueleto cartoes={2} texto="Carregando seu perfil" />
        ) : (
          <>
            {lido && mostrarAvisoDoPerfil(lido) && edicao.perfil.reservado === undefined ? (
              <AvisoDoPerfil entendendo={salvando === 'entender'}
                motivoDesabilitado={!online ? 'Sem conexão.' : salvando === 'salvar' ? 'Salvando o perfil.' : undefined} aoEntender={entender} />
            ) : null}
            <Campo rotulo="Apelido (opcional)" ajuda="Os colegas veem o apelido se você escolher mostrá-lo logo abaixo. Em branco, ele é apagado."
              valor={apelidoNaTela ?? ''} aoMudar={(t) => { setEdicao((atual) => ({ ...atual, apelido: t })); setErros({}); }}
              erro={erroLocalDoApelido ?? erros.apelido ?? null}
              autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false} maxLength={40} editable={salvando === null} />
            <EscolhaDoNome valor={exibicao} nomes={nomes} erro={erros.exibicaoDoNome} aoEscolher={(v) => mudar({ exibicaoDoNome: v })} />
            <View style={estilos.grupo} role="group" aria-label="Destaques">
              <View style={estilos.topoDoGrupo}>
                <Texto variante="rotulo" cor={cores.texto}>Destaques</Texto>
                <ContadorDeDestaques quantos={destaques.length} recusou={recusou} />
              </View>
              <Texto variante="pequeno">Escolha até 4 conquistas para aparecer no topo do seu perfil, na ordem em que marcar.</Texto>
              {lido?.opcoesDeDestaque.length ? (
                <View style={estilos.lista}>
                  {lido.opcoesDeDestaque.map((c) => (
                    <CaixaSelecao key={c.tipo} rotulo={c.titulo} ajuda={c.descricao} marcado={destaques.includes(c.tipo)}
                      aoMudar={(marcar) => {
                        const r = alternarDestaque(destaques, c.tipo, marcar);
                        setRecusou(r.recusado);
                        if (!r.recusado) mudar({ destaques: r.destaques });
                      }} />
                  ))}
                </View>
              ) : <Vazio texto="Você ainda não tem conquistas. Conforme treinar, elas aparecem aqui para você destacar." />}
              {erroDoGrupo('destaques')}
            </View>
            <EscolhaDaCor valor={cor.valor} aoEscolher={(v) => mudar({ cor: v })} />
            {erroDoGrupo('cor')}
            <View style={estilos.grupo}>
              <Texto variante="rotulo" cor={cores.texto}>Moldura da foto</Texto>
              <View role="radiogroup" aria-label="Moldura da foto" style={estilos.molduras}>
                {MOLDURAS_DO_PERFIL.map((m) => {
                  const escolhida = moldura.valor === m.valor;
                  const sel = coresDaSelecao(cores, escolhida);
                  return (
                    <Pressable key={m.valor} accessibilityRole="radio" accessibilityState={{ checked: escolhida }} aria-checked={escolhida}
                      accessibilityLabel={`${m.nome}. ${m.descricao}`} onPress={() => mudar({ moldura: m.valor })}
                      style={(estado) => [estilos.moldura, { backgroundColor: escolhida || estado.pressed ? sel.fundo : 'transparent', borderColor: escolhida ? sel.borda : cores.divisor }]}>
                      <MolduraDaFoto moldura={m.valor} cor={tom} tamanho={AMOSTRA}>
                        <View style={[estilos.miniatura, { backgroundColor: cores.superficie3 }]} />
                      </MolduraDaFoto>
                      <View style={estilos.nomeDaMoldura}>
                        {escolhida ? <Check size={14} color={cores.texto} strokeWidth={3} /> : null}
                        <Texto variante="pequeno" cor={cores.texto}>{m.nome}</Texto>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {erroDoGrupo('moldura')}
            <AlvoDeRolagem chave={ALVO_DO_RESERVAR}>
              <View style={estilos.grupo}>
                <Interruptor rotulo="Reservar meu perfil" ajuda={AJUDA_DO_RESERVAR} valor={reservado} aoMudar={(v) => mudar({ reservado: v })} />
                {lido && notaDoReservar(lido, edicao.perfil) ? <Texto variante="pequeno">{notaDoReservar(lido, edicao.perfil)}</Texto> : null}
              </View>
            </AlvoDeRolagem>
            {!online ? <Alerta tom="atencao" texto="Sem conexão. Suas escolhas continuam aqui; salve quando a internet voltar." /> : null}
            {focarReservar ? <RolarAteOReservar /> : null}
          </>
        )}
      </View>
      {aviso}
    </Folha>
  );
}

/** Atalho "Reservar meu perfil" da Comunidade: rola a folha até o interruptor uma vez, quando ele já está na tela. */
function RolarAteOReservar() {
  const { rolarAte } = useRolagem();
  useEffect(() => {
    rolarAte([ALVO_DO_RESERVAR]);
  }, [rolarAte]);
  return null;
}

/** "2 de 4": a fonte numérica só nos números; cheio, a frase de como trocar vem em texto comum. */
function ContadorDeDestaques({ quantos, recusou }: { quantos: number; recusou: boolean }) {
  const resto = contadorDeDestaques(quantos, recusou).slice(`${quantos} de ${MAXIMO_DE_DESTAQUES}`.length);
  return (
    <Texto variante="pequeno" accessibilityLiveRegion="polite">
      <Texto variante="pequeno" numerico>{quantos}</Texto> de <Texto variante="pequeno" numerico>{MAXIMO_DE_DESTAQUES}</Texto>{resto}
    </Texto>
  );
}

/** Cor de destaque em bolinhas (cada uma com o nome para o leitor de tela; a escolhida ganha a superfície de seleção e o contorno forte), com o nome da escolhida à vista. */
function EscolhaDaCor({ valor, aoEscolher }: { valor: string; aoEscolher: (v: (typeof CORES_DO_PERFIL)[number]['valor']) => void }) {
  const { cores, variante } = useTema();
  const escolhida = corDoPerfil(valor);
  return (
    <View style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto}>Cor de destaque: {escolhida.nome}</Texto>
      <Texto variante="pequeno">Pinta a moldura da sua foto.</Texto>
      <View role="radiogroup" aria-label="Cor de destaque" style={estilos.bolinhas}>
        {CORES_DO_PERFIL.map((c) => {
          const marcada = c.valor === escolhida.valor;
          const sel = coresDaSelecao(cores, marcada);
          return (
            <Pressable key={c.valor} accessibilityRole="radio" accessibilityState={{ checked: marcada }} aria-checked={marcada}
              accessibilityLabel={c.nome} onPress={() => aoEscolher(c.valor)}
              style={(estado) => [estilos.alvoDaBolinha, { backgroundColor: marcada || estado.pressed ? sel.fundo : 'transparent', borderColor: marcada ? sel.borda : 'transparent' }]}>
              <View style={[estilos.bolinha, { backgroundColor: corDoTomDoPerfil(c.tom, variante), borderColor: cores.borda }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(3) },
  previa: { flexDirection: 'row', alignItems: 'center', gap: espaco(2) },
  textosDaPrevia: { flex: 1, minWidth: 0, gap: espaco(0.5), alignItems: 'flex-start' },
  selos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
  grupo: { gap: espaco(1) },
  topoDoGrupo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: espaco(1), flexWrap: 'wrap' },
  lista: { gap: espaco(1) },
  bolinhas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  alvoDaBolinha: { width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: ALVO_TOQUE / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bolinha: { width: BOLINHA, height: BOLINHA, borderRadius: BOLINHA / 2, borderWidth: 1 },
  molduras: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  moldura: { flexGrow: 1, flexBasis: 72, minHeight: ALVO_TOQUE, alignItems: 'center', gap: espaco(0.75), paddingVertical: espaco(1), paddingHorizontal: espaco(0.5), borderWidth: 1, borderRadius: RAIO_CONTROLE },
  miniatura: { width: AMOSTRA, height: AMOSTRA, borderRadius: AMOSTRA / 2 },
  nomeDaMoldura: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.25) },
  status: { minHeight: 44, justifyContent: 'center' },
});
