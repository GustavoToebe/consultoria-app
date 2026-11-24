import { Image } from 'expo-image';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { baixarFotoDoAluno } from '../../../api/rotas';
import type { PerguntaAtualizacao, RespostaAtualizacao } from '../../../api/tipos';
import {
  contagemDeFotos, espacosDasFotos, type EspacoDeFoto, idsDeFotos, fotosAceitas, TEXTO_DO_GUIA, TEXTO_FOTOS_INDISPONIVEIS,
  TEXTO_FOTOS_SEM_CONEXAO, vagasDeFoto,
} from '../../../dominio/fotosAtualizacao';
import { maximoDeFotos } from '../../../dominio/questionario';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, RAIO } from '../../../tema/tokens';
import { Botao } from '../../../ui/Botao';
import { Folha } from '../../../ui/Folha';
import { IconeBotao } from '../../../ui/IconeBotao';
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
  /** Formulário sendo respondido sem as fotos do aluno (a prévia do treinador): mostra o guia dos lugares vazio. */
  respondendo?: boolean;
}

/**
 * Pergunta FOTOS. Aluno (com {@link ContextoDeFotos}): anexa, vê e remove antes de enviar. Treinador (sem contexto): só vê as
 * enviadas, pela rota dele. As imagens só existem atrás da API; "—" quando não há nenhuma. Com `lugares`, um espaço por
 * lugar com o nome, na ordem (a foto i é o lugar i): o aluno preenche em ordem e só a última foto sai.
 */
export function CampoFotos({ pergunta: p, valor, carregarDaEquipe, rotulo, respondendo }: Props) {
  const controle = useControleDeFotos();
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const [ampliada, setAmpliada] = useState<{ item: ItemDeFoto; titulo: string } | null>(null);
  const [removendo, setRemovendo] = useState<ItemDeFoto | null>(null);
  const enviadas = idsDeFotos(valor);
  const locais = controle?.locais[p.id] ?? [];
  const itens: ItemDeFoto[] = [
    ...enviadas.map((id) => ({ tipo: 'enviada' as const, id })),
    ...locais.map((nome) => ({ tipo: 'local' as const, nome })),
  ];
  const comLugares = (p.lugares?.length ?? 0) > 0;
  const espacos = comLugares ? espacosDasFotos(p, itens) : [];
  const lado = Math.min(width - espaco(8), 520);

  const carregar = (item: Extract<ItemDeFoto, { tipo: 'enviada' }>) =>
    controle || !carregarDaEquipe ? () => baixarFotoDoAluno(item.id) : () => carregarDaEquipe(item.id);
  const miniatura = (item: ItemDeFoto, tamanho: number, aoTocar?: () => void, lugar?: string) =>
    item.tipo === 'enviada' ? (
      <ImagemProtegida chave={item.id} carregar={carregar(item)} descricao={lugar ? `Foto: ${lugar}` : 'Foto enviada'} tamanho={tamanho} aoTocar={aoTocar} />
    ) : (
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={lugar ? `${lugar}: foto ainda neste aparelho` : 'Foto ainda neste aparelho'} onPress={aoTocar}
        style={[estilos.local, { width: tamanho, height: tamanho, borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
        <Image source={{ uri: uriDaFotoLocal(controle?.usuarioId ?? '', item.nome) }} cachePolicy="none" contentFit="cover" style={estilos.imagem} />
      </Pressable>
    );

  /**
   * Um espaço do guia: o nome do lugar em cima e a foto (ou o espaço vazio) embaixo, com `acao` por último. `proximo`
   * destaca o espaço que recebe a próxima foto (contorno de campo e "Próxima"); `semFoto` é o texto dos outros vazios.
   */
  const espacoDoGuia = (e: EspacoDeFoto<ItemDeFoto>, i: number, { proximo, semFoto }: { proximo: boolean; semFoto: string }, acao?: ReactNode) => {
    const item = e.item;
    return (
      <View key={item ? chaveDe(item) : `v:${i}`} style={estilos.espaco}>
        <Texto variante="pequeno" cor={cores.texto} numberOfLines={2}>{e.nome}</Texto>
        {item ? miniatura(item, MINIATURA, () => setAmpliada({ item, titulo: e.nome }), e.nome) : (
          <View accessible accessibilityRole="image" accessibilityLabel={`${e.nome}: ${proximo ? 'próxima foto' : 'sem foto'}`}
            style={[estilos.vazio, { borderColor: proximo ? cores.bordaCampo : cores.divisor, backgroundColor: cores.superficie2 }]}>
            {proximo || semFoto ? <Texto variante="pequeno">{proximo ? 'Próxima' : semFoto}</Texto> : null}
          </View>
        )}
        {acao}
      </View>
    );
  };

  const cabecalho = <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>;
  const ajuda = p.ajuda ? <Texto variante="pequeno">{p.ajuda}</Texto> : null;
  const folhaAmpliada = (usuarioId: string) => (
    <Ampliada item={ampliada?.item ?? null} titulo={ampliada?.titulo ?? 'Foto'} lado={lado} aoFechar={() => setAmpliada(null)} carregarDe={carregar} usuarioId={usuarioId} />
  );

  // Treinador, ou aluno com a atualização já enviada (e a prévia do treinador, sem fotos).
  if (!controle || !controle.editavel) {
    const desligado = controle && controle.habilitado === false && !itens.length;
    const guiaVazio = comLugares && !itens.length && !controle && respondendo;
    return (
      <View style={estilos.pergunta}>
        {cabecalho}
        {ajuda}
        {guiaVazio ? <Texto variante="pequeno">{TEXTO_DO_GUIA}</Texto> : null}
        {comLugares && (itens.length || guiaVazio) ? (
          <View style={estilos.grade}>{espacos.map((e, i) => espacoDoGuia(e, i, { proximo: !!guiaVazio && e.proximo, semFoto: guiaVazio ? '' : '—' }))}</View>
        ) : itens.length ? (
          <View style={estilos.grade}>{itens.map((item) => <View key={chaveDe(item)}>{miniatura(item, MINIATURA, () => setAmpliada({ item, titulo: 'Foto' }))}</View>)}</View>
        ) : (
          <Texto>{desligado ? TEXTO_FOTOS_INDISPONIVEIS : '—'}</Texto>
        )}
        {folhaAmpliada(controle?.usuarioId ?? '')}
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

  // Cada pergunta tem o próprio limite (com lugares, um por lugar); o servidor confere de novo no envio.
  const limite = fotosAceitas(maximoDeFotos(p), controle.maximoPorPergunta);
  const vagas = vagasDeFoto(enviadas.length, locais.length, limite);
  const semConexao = !controle.guardaNoAparelho && !controle.online;
  const motivo = vagas === 0 ? `Esta pergunta aceita até ${limite} fotos.` : semConexao ? TEXTO_FOTOS_SEM_CONEXAO : undefined;
  const bloqueado = vagas === 0 || semConexao;
  // Com lugares, uma foto por toque: a galeria com várias vagas marcaria várias e a ordem da escolha decidiria o lugar.
  const anexarAte = comLugares ? itens.length + 1 : limite;
  // Uma foto só (ou todos os lugares preenchidos): os botões somem (trocar = remover e anexar de novo); com várias, ficam com o motivo.
  const mostrarBotoes = comLugares ? vagas > 0 : !(limite === 1 && vagas === 0);
  const proximo = espacos.find((e) => e.proximo);
  const remover = (item: ItemDeFoto, nome: string) => (
    // Durante o envio o hook ignora o toque: o X fica desabilitado (o botão de anexar ao lado mostra o andamento).
    <IconeBotao Icone={X} rotulo={`Remover a foto: ${nome}`} moldura desabilitado={controle.ocupado} aoTocar={() => setRemovendo(item)} />
  );
  return (
    <View style={estilos.pergunta}>
      {cabecalho}
      {ajuda}
      <Texto variante="pequeno">
        Só você e seu treinador veem as fotos. {controle.guardaNoAparelho ? 'Elas ficam neste aparelho até você enviar.' : 'Elas sobem assim que você escolhe.'}
      </Texto>
      {comLugares ? <>
        <Texto variante="pequeno">{TEXTO_DO_GUIA}</Texto>
        <View style={estilos.grade}>
          {espacos.map((e, i) => espacoDoGuia(e, i, { proximo: e.proximo, semFoto: '' }, e.item && e.removivel ? remover(e.item, e.nome) : undefined))}
        </View>
        {itens.length > 1 ? <Texto variante="pequeno">Para refazer uma foto, remova antes as que vêm depois dela.</Texto> : null}
      </> : itens.length ? (
        <View style={estilos.grade}>
          {itens.map((item) => (
            <View key={chaveDe(item)} style={estilos.celula}>
              {miniatura(item, MINIATURA, () => setAmpliada({ item, titulo: 'Foto' }))}
              <Pressable accessibilityRole="button" accessibilityLabel="Remover esta foto" onPress={() => setRemovendo(item)}
                hitSlop={8} style={[estilos.remover, { backgroundColor: cores.superficie, borderColor: cores.divisor }]}>
                <X size={16} color={cores.texto} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {limite > 1 ? <Texto variante="pequeno" numerico>{contagemDeFotos(itens.length, limite)}</Texto> : null}
      {mostrarBotoes && proximo ? <Texto variante="pequeno" cor={cores.texto}>{`Próxima foto: ${proximo.nome}`}</Texto> : null}
      {mostrarBotoes ? <LinhaDeAcoes>
        <Botao rotulo={controle.guardaNoAparelho ? 'Escolher da galeria' : 'Adicionar foto'} tipo={controle.guardaNoAparelho ? 'secundario' : 'acao'} Icone={ImagePlus}
          carregando={controle.ocupado} desabilitado={bloqueado} motivo={motivo} aoTocar={() => void controle.anexar(p.id, 'galeria', anexarAte)} />
        {controle.guardaNoAparelho ? (
          <Botao rotulo="Tirar foto" tipo="secundario" Icone={Camera} carregando={controle.ocupado} desabilitado={bloqueado} motivo={motivo}
            aoTocar={() => void controle.anexar(p.id, 'camera', anexarAte)} />
        ) : null}
      </LinhaDeAcoes> : null}
      {folhaAmpliada(controle.usuarioId)}
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

function Ampliada({ item, titulo, lado, aoFechar, carregarDe, usuarioId }: {
  item: ItemDeFoto | null;
  titulo: string;
  lado: number;
  aoFechar: () => void;
  carregarDe: (item: Extract<ItemDeFoto, { tipo: 'enviada' }>) => () => Promise<Blob>;
  usuarioId: string;
}) {
  return (
    <Folha titulo={titulo} visivel={item !== null} aoFechar={aoFechar}>
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
  // Largura da miniatura: o nome do lugar (até 40 caracteres) quebra em duas linhas em vez de esticar a grade.
  espaco: { width: MINIATURA, gap: espaco(0.5), alignItems: 'flex-start' },
  vazio: { width: MINIATURA, height: MINIATURA, borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
  local: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  imagem: { width: '100%', height: '100%' },
  remover: {
    position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', minWidth: 28, minHeight: 28,
  },
});
