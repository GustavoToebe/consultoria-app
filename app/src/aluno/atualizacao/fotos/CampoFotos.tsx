import { Image } from 'expo-image';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { baixarFotoDoAluno } from '../../../api/rotas';
import type { PerguntaAtualizacao, RespostaAtualizacao } from '../../../api/tipos';
import {
  contagemDeFotos, idsDeFotos, fotosAceitas, TEXTO_FOTOS_INDISPONIVEIS, TEXTO_FOTOS_SEM_CONEXAO, vagasDeFoto,
} from '../../../dominio/fotosAtualizacao';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, RAIO } from '../../../tema/tokens';
import { Botao } from '../../../ui/Botao';
import { Folha } from '../../../ui/Folha';
import { ImagemProtegida } from '../../../ui/ImagemProtegida';
import { LinhaDeAcoes } from '../../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Texto } from '../../../ui/Texto';
import { useControleDeFotos, type ItemDeFoto } from './ControleDeFotos';
import { uriDaFotoLocal } from './fotosLocais';

const MINIATURA = 96;

interface Props {
  pergunta: PerguntaAtualizacao;
  /** Ids das fotos já enviadas (resposta da pergunta). */
  valor: RespostaAtualizacao;
  /** Treinador: como baixar uma foto já enviada (rota da atualização ou da anamnese). Sem isto, só o aluno vê. */
  carregarDaEquipe?: (fotoId: string) => Promise<Blob>;
  rotulo: string;
}

/**
 * Pergunta FOTOS. Aluno (com {@link ContextoDeFotos}): anexa, vê e remove antes de enviar. Treinador (sem contexto): só vê as
 * enviadas, pela rota dele. As imagens só existem atrás da API; "—" quando não há nenhuma.
 */
export function CampoFotos({ pergunta: p, valor, carregarDaEquipe, rotulo }: Props) {
  const controle = useControleDeFotos();
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const [ampliada, setAmpliada] = useState<ItemDeFoto | null>(null);
  const [removendo, setRemovendo] = useState<ItemDeFoto | null>(null);
  const enviadas = idsDeFotos(valor);
  const locais = controle?.locais[p.id] ?? [];
  const itens: ItemDeFoto[] = [
    ...enviadas.map((id) => ({ tipo: 'enviada' as const, id })),
    ...locais.map((nome) => ({ tipo: 'local' as const, nome })),
  ];
  const lado = Math.min(width - espaco(8), 520);

  const carregar = (item: Extract<ItemDeFoto, { tipo: 'enviada' }>) =>
    controle || !carregarDaEquipe ? () => baixarFotoDoAluno(item.id) : () => carregarDaEquipe(item.id);
  const miniatura = (item: ItemDeFoto, tamanho: number, aoTocar?: () => void) =>
    item.tipo === 'enviada' ? (
      <ImagemProtegida chave={item.id} carregar={carregar(item)} descricao="Foto enviada" tamanho={tamanho} aoTocar={aoTocar} />
    ) : (
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Foto ainda neste aparelho" onPress={aoTocar}
        style={[estilos.local, { width: tamanho, height: tamanho, borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
        <Image source={{ uri: uriDaFotoLocal(controle?.usuarioId ?? '', item.nome) }} cachePolicy="none" contentFit="cover" style={estilos.imagem} />
      </Pressable>
    );

  const cabecalho = <Texto variante="rotulo">{rotulo}</Texto>;
  const ajuda = p.ajuda ? <Texto variante="pequeno">{p.ajuda}</Texto> : null;

  // Treinador, ou aluno com a atualização já enviada.
  if (!controle || !controle.editavel) {
    const desligado = controle && controle.habilitado === false && !itens.length;
    return (
      <View style={estilos.pergunta}>
        {cabecalho}
        {ajuda}
        {itens.length ? (
          <View style={estilos.grade}>{itens.map((item) => <View key={chaveDe(item)}>{miniatura(item, MINIATURA, () => setAmpliada(item))}</View>)}</View>
        ) : (
          <Texto>{desligado ? TEXTO_FOTOS_INDISPONIVEIS : '—'}</Texto>
        )}
        <Ampliada item={ampliada} lado={lado} aoFechar={() => setAmpliada(null)} carregarDe={carregar} usuarioId={controle?.usuarioId ?? ''} />
      </View>
    );
  }

  if (controle.habilitado === false || controle.habilitado === null) {
    return (
      <View style={estilos.pergunta}>
        {cabecalho}
        <Texto>{TEXTO_FOTOS_INDISPONIVEIS}</Texto>
        {controle.habilitado === null && !controle.online ? <Texto variante="pequeno">{TEXTO_FOTOS_SEM_CONEXAO}</Texto> : null}
      </View>
    );
  }

  // Cada pergunta tem o próprio limite (frente, costas e lado com uma foto cada); o servidor confere de novo no envio.
  const limite = fotosAceitas(p.max, controle.maximoPorPergunta);
  const vagas = vagasDeFoto(enviadas.length, locais.length, limite);
  const semConexao = !controle.guardaNoAparelho && !controle.online;
  const motivo = vagas === 0 ? `Esta pergunta aceita até ${limite} fotos.` : semConexao ? TEXTO_FOTOS_SEM_CONEXAO : undefined;
  const bloqueado = vagas === 0 || semConexao;
  // Uma foto só: depois de anexar os botões somem (trocar = remover e anexar de novo); com várias, ficam com o motivo.
  const mostrarBotoes = !(limite === 1 && vagas === 0);
  return (
    <View style={estilos.pergunta}>
      {cabecalho}
      {ajuda}
      <Texto variante="pequeno">
        Só você e seu treinador veem as fotos. {controle.guardaNoAparelho ? 'Elas ficam neste aparelho até você enviar.' : 'Elas sobem assim que você escolhe.'}
      </Texto>
      {itens.length ? (
        <View style={estilos.grade}>
          {itens.map((item) => (
            <View key={chaveDe(item)} style={estilos.celula}>
              {miniatura(item, MINIATURA, () => setAmpliada(item))}
              <Pressable accessibilityRole="button" accessibilityLabel="Remover esta foto" onPress={() => setRemovendo(item)}
                hitSlop={8} style={[estilos.remover, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
                <X size={16} color={cores.texto} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {limite > 1 ? <Texto variante="pequeno" numerico>{contagemDeFotos(itens.length, limite)}</Texto> : null}
      {mostrarBotoes ? <LinhaDeAcoes>
        <Botao rotulo={controle.guardaNoAparelho ? 'Escolher da galeria' : 'Adicionar foto'} tipo="secundario" Icone={ImagePlus}
          carregando={controle.ocupado} desabilitado={bloqueado} motivo={motivo} aoTocar={() => void controle.anexar(p.id, 'galeria', limite)} />
        {controle.guardaNoAparelho ? (
          <Botao rotulo="Tirar foto" tipo="secundario" Icone={Camera} carregando={controle.ocupado} desabilitado={bloqueado} motivo={motivo}
            aoTocar={() => void controle.anexar(p.id, 'camera', limite)} />
        ) : null}
      </LinhaDeAcoes> : null}
      <Ampliada item={ampliada} lado={lado} aoFechar={() => setAmpliada(null)} carregarDe={carregar} usuarioId={controle.usuarioId} />
      <PainelConfirmacao visivel={removendo !== null} titulo="Remover esta foto?"
        mensagem={removendo?.tipo === 'local' ? 'Ela sai deste aparelho.' : 'Ela é apagada do servidor e não volta.'}
        rotuloConfirmar="Remover" perigo
        aoCancelar={() => setRemovendo(null)}
        aoConfirmar={() => {
          const item = removendo;
          setRemovendo(null);
          if (item) void controle.remover(p.id, item);
        }} />
    </View>
  );
}

const chaveDe = (item: ItemDeFoto) => (item.tipo === 'enviada' ? `e:${item.id}` : `l:${item.nome}`);

function Ampliada({ item, lado, aoFechar, carregarDe, usuarioId }: {
  item: ItemDeFoto | null;
  lado: number;
  aoFechar: () => void;
  carregarDe: (item: Extract<ItemDeFoto, { tipo: 'enviada' }>) => () => Promise<Blob>;
  usuarioId: string;
}) {
  return (
    <Folha titulo="Foto" visivel={item !== null} aoFechar={aoFechar}>
      {item?.tipo === 'enviada' ? (
        <ImagemProtegida chave={`grande:${item.id}`} carregar={carregarDe(item)} descricao="Foto ampliada" tamanho={lado} />
      ) : item?.tipo === 'local' ? (
        <Image source={{ uri: uriDaFotoLocal(usuarioId, item.nome) }} cachePolicy="none" accessibilityLabel="Foto ampliada" contentFit="contain"
          style={{ width: lado, height: lado }} />
      ) : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  pergunta: { gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  celula: { position: 'relative' },
  local: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  imagem: { width: '100%', height: '100%' },
  remover: {
    position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', minWidth: 28, minHeight: 28,
  },
});
