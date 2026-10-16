import { Image } from 'expo-image';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { baixarFotoDoAluno, baixarFotoDoTreinador } from '../../../api/rotas';
import type { PerguntaAtualizacao, RespostaAtualizacao } from '../../../api/tipos';
import { contagemDeFotos, idsDeFotos, TEXTO_FOTOS_INDISPONIVEIS, TEXTO_FOTOS_SEM_CONEXAO, vagasDeFoto } from '../../../dominio/fotosAtualizacao';
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
  /** Atualização a que as fotos pertencem (a rota do treinador pede o id dela). */
  atualizacaoId: string | null;
  rotulo: string;
}

/**
 * Pergunta FOTOS. Aluno (com {@link ContextoDeFotos}): anexa, vê e remove antes de enviar. Treinador (sem contexto): só vê as
 * enviadas, pela rota dele. As imagens só existem atrás da API; "—" quando não há nenhuma.
 */
export function CampoFotos({ pergunta: p, valor, atualizacaoId, rotulo }: Props) {
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
    controle ? () => baixarFotoDoAluno(item.id) : () => baixarFotoDoTreinador(atualizacaoId ?? '', item.id);
  const miniatura = (item: ItemDeFoto, tamanho: number, aoTocar?: () => void) =>
    item.tipo === 'enviada' ? (
      <ImagemProtegida chave={item.id} carregar={carregar(item)} descricao="Foto da atualização" tamanho={tamanho} aoTocar={aoTocar} />
    ) : (
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Foto da atualização, ainda neste aparelho" onPress={aoTocar}
        style={[estilos.local, { width: tamanho, height: tamanho, borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
        <Image source={{ uri: uriDaFotoLocal(controle?.usuarioId ?? '', item.nome) }} contentFit="cover" style={estilos.imagem} />
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

  const vagas = vagasDeFoto(enviadas.length, locais.length, controle.maximoPorPergunta);
  const semConexao = !controle.guardaNoAparelho && !controle.online;
  const motivo = vagas === 0 ? `Você já anexou ${controle.maximoPorPergunta} fotos.` : semConexao ? TEXTO_FOTOS_SEM_CONEXAO : undefined;
  const bloqueado = vagas === 0 || semConexao;
  return (
    <View style={estilos.pergunta}>
      {cabecalho}
      {ajuda}
      <Texto variante="pequeno">
        Só você e seu treinador veem as fotos. {controle.guardaNoAparelho ? 'Elas ficam neste aparelho até você enviar a atualização.' : 'Elas sobem assim que você escolhe.'}
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
      ) : (
        <Texto>—</Texto>
      )}
      <Texto variante="pequeno" numerico>{contagemDeFotos(itens.length, controle.maximoPorPergunta)}</Texto>
      <LinhaDeAcoes>
        <Botao rotulo={controle.guardaNoAparelho ? 'Escolher da galeria' : 'Escolher foto'} tipo="secundario" Icone={ImagePlus}
          carregando={controle.ocupado} desabilitado={bloqueado} motivo={motivo} aoTocar={() => void controle.anexar(p.id, 'galeria')} />
        {controle.guardaNoAparelho ? (
          <Botao rotulo="Tirar foto" tipo="secundario" Icone={Camera} carregando={controle.ocupado} desabilitado={bloqueado}
            aoTocar={() => void controle.anexar(p.id, 'camera')} />
        ) : null}
      </LinhaDeAcoes>
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
        <ImagemProtegida chave={`grande:${item.id}`} carregar={carregarDe(item)} descricao="Foto da atualização ampliada" tamanho={lado} />
      ) : item?.tipo === 'local' ? (
        <Image source={{ uri: uriDaFotoLocal(usuarioId, item.nome) }} accessibilityLabel="Foto da atualização ampliada" contentFit="contain"
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
