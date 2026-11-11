import { router } from 'expo-router';
import { Lock, Pencil, UserX, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { obterPerfilDaComunidade } from '../api/comunidade';
import type { PerfilDaComunidade } from '../api/comunidadeTipos';
import { CHAVE_DO_MEU_PERFIL } from '../aluno/AvisoDoPerfil';
import { MapaDeTreinos } from '../aluno/MapaDeTreinos';
import { hojeEmBrasilia } from '../dominio/financeiro';
import { corDoPerfil, molduraDoPerfil } from '../dominio/perfilDaComunidade';
import {
  buscarFotoDoColega, erroDaLeitura, soONome, TEXTO_LIMITE_DE_LEITURA, TEXTO_PERFIL_NAO_ENCONTRADO, TEXTO_PERFIL_RESERVADO,
  TEXTO_PERFIL_SEM_CONEXAO, textoDoNivel, textoDosTreinos,
} from '../dominio/perfilDoColega';
import { useTema } from '../tema/TemaProvider';
import { corDoTomDoPerfil, espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Esqueleto } from '../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../ui/Estados';
import { Folha } from '../ui/Folha';
import { IniciaisDePerfil } from '../ui/FotoDePerfil';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';
import { FotoDoColega } from './FotoDoColega';
import { AtividadeRecente, Destaques, Insignias, RecordesDeCarga } from './SecoesDoPerfilDoColega';

const FOTO = 88;

/**
 * Perfil de um colega na Comunidade, no estilo do Steam (plano `perfil-estilo-steam`): capa com a foto na moldura e na cor
 * que ele escolheu, nome, apelido, nível e treinos; depois destaques, atividade dos últimos 30 dias, insígnias e recordes de
 * carga. Aberto pelo autor de um post ou comentário e pela lista de colegas. Só com internet e nada fica no aparelho: sem
 * conexão a folha diz isso e não mostra o que tinha lido. Reservado e visto por outro aluno: só nome, apelido e iniciais. O
 * próprio aluno vê tudo e ganha o atalho "Editar meu perfil". Nunca peso corporal, medidas, dieta, saúde nem horário.
 */
export function FolhaPerfilDoColega({ autorId, online, aoFechar }: { autorId: string | null; online: boolean; aoFechar: () => void }) {
  // Cada abertura (e cada volta da internet) é uma leitura nova: o colega pode ter reservado o perfil ou saído no meio-tempo,
  // e a chave nova garante que o lido antes não aparece enquanto a resposta não chega.
  const [abertura, setAbertura] = useState({ autorId, online, n: 0 });
  if (abertura.autorId !== autorId || abertura.online !== online) setAbertura({ autorId, online, n: abertura.n + 1 });
  const chave = autorId && online ? `perfil-comunidade:${abertura.n}:${autorId}` : null;
  const perfil = useCarregar(chave, (k) => obterPerfilDaComunidade(k.split(':').slice(2).join(':')));
  const dados = perfil.dadosDeOutraChave || perfil.carregando ? undefined : perfil.dados;
  const erro = perfil.carregando ? undefined : perfil.erro;
  const tipoDoErro = erro ? erroDaLeitura(erro) : null;

  const editar = () => {
    aoFechar();
    router.push({ pathname: '/aluno/conta', params: { secao: CHAVE_DO_MEU_PERFIL } });
  };

  return (
    <Folha visivel={!!autorId} titulo="Perfil na Comunidade" aoFechar={aoFechar}>
      {!online ? (
        <Vazio Icone={WifiOff} texto={TEXTO_PERFIL_SEM_CONEXAO} />
      ) : tipoDoErro === 'nao-encontrado' ? (
        <Vazio Icone={UserX} texto={TEXTO_PERFIL_NAO_ENCONTRADO} />
      ) : tipoDoErro === 'limite' ? (
        <Alerta tom="atencao" texto={TEXTO_LIMITE_DE_LEITURA}>
          <LinhaDeAcoes><Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={perfil.recarregar} /></LinhaDeAcoes>
        </Alerta>
      ) : erro ? (
        <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={perfil.recarregar} />
      ) : !dados ? (
        <Esqueleto cartoes={2} texto="Carregando o perfil" />
      ) : (
        <PerfilAberto perfil={dados} aoEditar={editar} />
      )}
    </Folha>
  );
}

function PerfilAberto({ perfil, aoEditar }: { perfil: PerfilDaComunidade; aoEditar: () => void }) {
  const { cores, modo } = useTema();
  const reservadoParaMim = soONome(perfil);
  // Reservado para quem vê: nada da cor nem da moldura (a API nem manda); a faixa da capa fica neutra.
  const tom = reservadoParaMim ? cores.borda : corDoTomDoPerfil(corDoPerfil(perfil.cor).tom, modo === 'ESCURO');
  const atividade = perfil.atividade;

  return (
    <View style={estilos.blocos}>
      {/* M1: o próprio aluno vê o mapa dos treinos no topo (some sozinho com o retorno desligado); colegas não. */}
      {perfil.ehVoce ? <MapaDeTreinos /> : null}
      <View style={[estilos.capa, { backgroundColor: cores.superficie2, borderColor: cores.borda, borderTopColor: tom }]}>
        <View style={estilos.foto}>
          {reservadoParaMim
            ? <IniciaisDePerfil nome={perfil.nome} tamanho={FOTO} />
            : <FotoDoColega autorId={perfil.autorId} nome={perfil.nome} temFoto={buscarFotoDoColega(perfil)} tamanho={FOTO}
                cor={tom} moldura={molduraDoPerfil(perfil.moldura).valor} />}
        </View>
        <View style={estilos.identidade}>
          <View style={estilos.linha}>
            <Texto variante="titulo" nivel={3}>{perfil.nome}</Texto>
            {perfil.ehVoce ? <Selo texto="Você" tipo="neutro" /> : null}
          </View>
          {perfil.apelido ? <Texto variante="suave" accessibilityLabel={`apelido ${perfil.apelido}`}>«{perfil.apelido}»</Texto> : null}
          {reservadoParaMim ? (
            <View style={[estilos.linha, estilos.reservado]}>
              <Lock size={16} color={cores.textoSuave} aria-hidden />
              <Texto variante="suave">{TEXTO_PERFIL_RESERVADO}</Texto>
            </View>
          ) : (
            <View style={[estilos.linha, estilos.numeros]}>
              {perfil.nivel !== undefined ? (
                <View style={[estilos.nivel, { borderColor: tom, backgroundColor: cores.superficie }]}>
                  <Texto variante="rotulo" cor={cores.texto} numerico>{textoDoNivel(perfil.nivel)}</Texto>
                </View>
              ) : null}
              {perfil.treinosConcluidos !== undefined ? <Texto variante="suave" numerico>{textoDosTreinos(perfil.treinosConcluidos)}</Texto> : null}
            </View>
          )}
        </View>
      </View>

      {perfil.ehVoce ? (
        <View style={estilos.meu}>
          {perfil.reservado ? <Texto variante="suave">Seu perfil está reservado: os colegas veem só o seu nome e o apelido.</Texto> : null}
          <LinhaDeAcoes><Botao rotulo="Editar meu perfil" tipo="secundario" Icone={Pencil} aoTocar={aoEditar} /></LinhaDeAcoes>
        </View>
      ) : null}

      {reservadoParaMim ? null : (
        <>
          <Destaques destaques={perfil.destaques ?? []} tom={tom} />
          {atividade ? (
            <AtividadeRecente dias={atividade.diasTreinadosUltimos30} conquistas={atividade.ultimasConquistas} hoje={hojeEmBrasilia()} tom={tom} />
          ) : null}
          <Insignias conquistas={perfil.conquistas ?? []} tom={tom} />
          <RecordesDeCarga recordes={perfil.recordes ?? []} />
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  blocos: { gap: espaco(3) },
  // A faixa de cima, na cor do colega, é o "fundo do perfil" do Steam em versão contida: identifica sem pintar texto.
  capa: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(2), borderWidth: 1, borderTopWidth: 6, borderRadius: RAIO, padding: espaco(2) },
  foto: { flexShrink: 0 },
  identidade: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0, gap: espaco(0.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  numeros: { marginTop: espaco(0.5), gap: espaco(1.5) },
  reservado: { marginTop: espaco(0.5), flexWrap: 'nowrap' },
  // Nível num selo de contorno na cor do colega; o número fica na cor do texto (o laranja do claro não serve de texto).
  nivel: { borderWidth: 1, borderRadius: 999, paddingHorizontal: espaco(1.25), paddingVertical: 2 },
  meu: { gap: espaco(1) },
});
