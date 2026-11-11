import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { meuPerfilDaComunidade, salvarMeuPerfilDaComunidade } from '../api/comunidade';
import { baixarFotoDePerfil } from '../api/rotas';
import { MolduraDaFoto } from '../comunidade/MolduraDaFoto';
import {
  AJUDA_DO_RESERVAR, alternarDestaque, contadorDeDestaques, CORES_DO_PERFIL, corDoPerfil, corpoDoManterVisivel, corpoDoPerfil, molduraDoPerfil,
  MOLDURAS_DO_PERFIL, mostrarAvisoDoPerfil, notaDoReservar, perfilMudou, reservadoNaTela, type EdicaoDoPerfil,
} from '../dominio/perfilDaComunidade';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { corDoTomDoPerfil, espaco, RAIO } from '../tema/tokens';
import { AlvoDeRolagem } from '../ui/AlvoDeRolagem';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { CaixaSelecao } from '../ui/CaixaSelecao';
import { MensagemDeErro } from '../ui/Campo';
import { Interruptor } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../ui/Estados';
import { codigoApi, separarErros, textoDoErro } from '../ui/erros';
import { FotoDePerfil } from '../ui/FotoDePerfil';
import { GradeDeOpcoes } from '../ui/GradeDeOpcoes';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { OpcaoCartao } from '../ui/OpcaoCartao';
import { useRolagem } from '../ui/RolagemComTopo';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { AvisoDoPerfil, CHAVE_DO_MEU_PERFIL, textoDoErroDoPerfil } from './AvisoDoPerfil';
import { useVersaoDaFotoDePerfil } from './versaoDaFotoDePerfil';

const FOTO = 72;
const AMOSTRA = 22;

/**
 * "Meu perfil" da Comunidade, na Conta do aluno depois do apelido: reservar (decisão 3), até 4 destaques entre as conquistas
 * já ganhas (decisão 6), cor de destaque e moldura da foto (decisão 7), com a prévia do que os colegas veem, e o aviso único
 * (decisão 11). O PUT substitui as quatro preferências: o corpo sempre leva o que o aluno não tocou (`corpoDoPerfil`). Só com
 * internet: sem conexão antes de carregar, o cartão some; depois de carregar, fica com as escolhas e o salvar espera a rede.
 */
export function CartaoMeuPerfil() {
  const { online } = useAluno();
  const { usuario } = useSessao();
  const { cores, modo } = useTema();
  const { avisar } = useAviso();
  const { rolarAte } = useRolagem();
  const { secao } = useLocalSearchParams<{ secao?: string }>();
  const versaoDaFoto = useVersaoDaFotoDePerfil();
  const carga = useCarregar(online ? 'aluno-perfil-comunidade' : null, () => meuPerfilDaComunidade());
  const [edicao, setEdicao] = useState<EdicaoDoPerfil>({});
  const [recusou, setRecusou] = useState(false);
  const [salvando, setSalvando] = useState<'salvar' | 'entender' | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const lido = carga.dados;

  // Vindo do atalho do aviso na Comunidade: rola até aqui quando o cartão já tem o que mostrar e tira o parâmetro do endereço.
  useEffect(() => {
    if (secao !== CHAVE_DO_MEU_PERFIL || !lido) return;
    rolarAte([CHAVE_DO_MEU_PERFIL]);
    router.setParams({ secao: undefined });
  }, [secao, lido, rolarAte]);

  if (!lido) {
    if (!online || (carga.erro instanceof ErroApi && carga.erro.semConexao)) return null;
    return (
      <Cartao titulo="Meu perfil">
        {carga.erro
          ? <MensagemErro texto={textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} />
          : <Esqueleto cartoes={1} texto="Carregando seu perfil" />}
      </Cartao>
    );
  }

  const reservado = reservadoNaTela(lido, edicao);
  const destaques = edicao.destaques ?? lido.destaques;
  const cor = corDoPerfil(edicao.cor ?? lido.cor);
  const moldura = molduraDoPerfil(edicao.moldura ?? lido.moldura);
  const tom = corDoTomDoPerfil(cor.tom, modo === 'ESCURO');
  const mudou = perfilMudou(lido, edicao);
  const nota = notaDoReservar(lido, edicao);
  const titulos = new Map(lido.opcoesDeDestaque.map((c) => [c.tipo, c.titulo]));

  const mudar = (parte: EdicaoDoPerfil) => {
    setEdicao((atual) => ({ ...atual, ...parte }));
    setErros({});
  };

  const enviar = (acao: 'salvar' | 'entender', corpo: ReturnType<typeof corpoDoPerfil>) => {
    setSalvando(acao);
    setErros({});
    salvarMeuPerfilDaComunidade(corpo).then(
      (resposta) => {
        setSalvando(null);
        carga.definir(resposta);
        if (acao === 'salvar') {
          setEdicao({});
          setRecusou(false);
        } else {
          // "Entendi" só grava a escolha de não reservar; o que o aluno estava mexendo continua na tela.
          setEdicao(({ reservado: _ignorado, ...resto }) => resto);
        }
        avisar(acao === 'salvar' ? 'Perfil salvo.' : 'Pronto: seu perfil continua visível para os colegas.', 'sucesso');
      },
      (erro: unknown) => {
        setSalvando(null);
        if (codigoApi(erro) === 'ALUNO_ANONIMIZADO') {
          setEdicao({});
          carga.recarregar();
          avisar(textoDoErro(erro), 'neutro');
          return;
        }
        const { campos, geral } = separarErros(erro, ['destaques', 'cor', 'moldura'], textoDoErroDoPerfil(erro));
        setErros(campos);
        if (geral) avisar(geral, 'perigo');
      },
    );
  };

  const erroDoGrupo = (campo: string) =>
    erros[campo] ? <MensagemDeErro erro={erros[campo]} /> : null;

  return (
    <AlvoDeRolagem chave={CHAVE_DO_MEU_PERFIL}>
      <View testID="cartao-meu-perfil">
        <Cartao titulo="Meu perfil" descricao="Como seus colegas veem você na Comunidade.">
          {mostrarAvisoDoPerfil(lido) && edicao.reservado === undefined ? (
            <AvisoDoPerfil entendendo={salvando === 'entender'}
              motivoDesabilitado={!online ? 'Sem conexão.' : salvando === 'salvar' ? 'Salvando o perfil.' : undefined}
              aoEntender={() => enviar('entender', corpoDoManterVisivel(lido))} />
          ) : null}

          <View style={[estilos.previa, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}
            accessibilityLabel={reservado ? 'Prévia: perfil reservado, os colegas veem só o nome e o apelido.' : `Prévia do perfil: moldura ${moldura.nome.toLowerCase()} na cor ${cor.nome.toLowerCase()}.`}>
            <Texto variante="secao">Prévia</Texto>
            <View style={estilos.linhaDaPrevia}>
              {reservado ? null : (
                <MolduraDaFoto moldura={moldura.valor} cor={tom} tamanho={FOTO}>
                  <FotoDePerfil chave={`perfil:${versaoDaFoto}`} carregar={baixarFotoDePerfil} nome={usuario?.nome} tamanho={FOTO} />
                </MolduraDaFoto>
              )}
              <View style={estilos.textosDaPrevia}>
                <Texto variante="bloco">{usuario?.nome ?? 'Você'}</Texto>
                {reservado ? (
                  <>
                    <Selo texto="Reservado" tipo="neutro" />
                    <Texto variante="pequeno">Os colegas veem só seu nome e apelido.</Texto>
                  </>
                ) : destaques.length ? (
                  <View style={estilos.selos}>
                    {destaques.map((t) => <Selo key={t} texto={titulos.get(t) ?? t} tipo="neutro" />)}
                  </View>
                ) : (
                  <Texto variante="pequeno">Sem destaques escolhidos.</Texto>
                )}
              </View>
            </View>
          </View>

          <View style={estilos.bloco}>
            <Interruptor rotulo="Reservar meu perfil" ajuda={AJUDA_DO_RESERVAR} valor={reservado} aoMudar={(v) => mudar({ reservado: v })} />
            {nota ? <Texto variante="pequeno">{nota}</Texto> : null}
          </View>

          <View style={estilos.bloco} role="group" aria-label="Destaques">
            <View style={estilos.topoDoGrupo}>
              <Texto variante="rotulo" cor={cores.texto}>Destaques</Texto>
              <Texto variante="pequeno" numerico accessibilityLiveRegion="polite">{contadorDeDestaques(destaques.length, recusou)}</Texto>
            </View>
            <Texto variante="pequeno">Escolha até 4 conquistas para aparecer no topo do seu perfil, na ordem em que marcar.</Texto>
            {lido.opcoesDeDestaque.length ? (
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
            ) : (
              <Vazio texto="Você ainda não tem conquistas. Conforme treinar, elas aparecem aqui para você destacar." />
            )}
            {erroDoGrupo('destaques')}
          </View>

          <GradeDeOpcoes rotulo="Cor de destaque" descricao="Pinta a moldura da sua foto.">
            {CORES_DO_PERFIL.map((c) => (
              <OpcaoCartao key={c.valor} titulo={c.nome} selecionada={cor.valor === c.valor} aoEscolher={() => mudar({ cor: c.valor })}
                amostra={<View style={[estilos.amostra, { backgroundColor: corDoTomDoPerfil(c.tom, modo === 'ESCURO'), borderColor: cores.borda }]} />} />
            ))}
          </GradeDeOpcoes>
          {erroDoGrupo('cor')}

          <GradeDeOpcoes rotulo="Moldura da foto">
            {MOLDURAS_DO_PERFIL.map((m) => (
              <OpcaoCartao key={m.valor} titulo={m.nome} descricao={m.descricao} selecionada={moldura.valor === m.valor} aoEscolher={() => mudar({ moldura: m.valor })}
                amostra={(
                  <MolduraDaFoto moldura={m.valor} cor={tom} tamanho={AMOSTRA}>
                    <View style={[estilos.miniatura, { backgroundColor: cores.superficie3 }]} />
                  </MolduraDaFoto>
                )} />
            ))}
          </GradeDeOpcoes>
          {erroDoGrupo('moldura')}

          {!online ? <Alerta tom="atencao" texto="Sem conexão. Suas escolhas continuam aqui; salve quando a internet voltar." /> : null}
          <LinhaDeAcoes alinhar="fim">
            <Botao rotulo="Salvar perfil" carregando={salvando === 'salvar'} desabilitado={!mudou || !online || salvando !== null}
              motivo={!online ? 'Sem conexão.' : !mudou ? 'Nada mudou.' : salvando === 'entender' ? 'Gravando sua escolha.' : undefined}
              aoTocar={() => enviar('salvar', corpoDoPerfil(lido, edicao))} />
          </LinhaDeAcoes>
        </Cartao>
      </View>
    </AlvoDeRolagem>
  );
}

const estilos = StyleSheet.create({
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  linhaDaPrevia: { flexDirection: 'row', alignItems: 'center', gap: espaco(2), flexWrap: 'wrap' },
  textosDaPrevia: { flex: 1, minWidth: 160, gap: espaco(0.75), alignItems: 'flex-start' },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  bloco: { gap: espaco(0.75) },
  topoDoGrupo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: espaco(1), flexWrap: 'wrap' },
  lista: { gap: espaco(1) },
  amostra: { width: 28, height: 28, borderRadius: 14, borderWidth: 1 },
  miniatura: { width: AMOSTRA, height: AMOSTRA, borderRadius: AMOSTRA / 2 },
});
