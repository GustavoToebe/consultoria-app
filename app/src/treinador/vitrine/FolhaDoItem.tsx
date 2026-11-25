import { Camera } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { alterarItemDaVitrine, baixarFotoDoItem, criarItemDaVitrine, excluirItemDaVitrine, removerFotoDoItem, trocarFotoDoItem } from '../../api/rotas';
import type { CategoriaDaVitrine } from '../../api/vitrineCategorias';
import type { ItemDaVitrine } from '../../api/vitrineTipos';
import { apagarTemporaria } from '../../aluno/atualizacao/fotos/fotosLocais';
import { anexarFoto } from '../../aluno/atualizacao/fotos/enviarFotoDoAparelho';
import { escolherFoto, FotoRecusada, type FotoPronta, type OrigemDaFoto } from '../../aluno/atualizacao/fotos/prepararFoto';
import { MiniaturaDoItem } from '../../aluno/vitrine/MiniaturaDoItem';
import { centavosParaTela, dataDaTela, dataParaTela, mascaraDeMoeda, centavosDaTela } from '../../dominio/formatos';
import { MAX_CUPOM } from '../../dominio/suplementos';
import {
  comPreco, comTipoDoItem, corpoDoItem, DESCRICAO_MAXIMA, DICA_DA_FOTO_DA_VITRINE, erroDaPaginaPublicaDoItem, FOTO_NAO_SUBIU, interruptorDaPaginaPublica,
  LIMITES_FOTO_DA_VITRINE, MOTIVO_SEM_PRECO, NOME_MAXIMO, NOTA_DO_ITEM_DIGITAL, precoEspecialLiberado, problemasDoItem, rascunhoDoItem, rascunhoVazio,
  rotuloDoTipo, TIPOS_DE_ITEM, type RascunhoDoItem,
} from '../../dominio/vitrine';
import { SEM_CATEGORIA } from '../../dominio/vitrineCategorias';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_FOLHA_LARGA } from '../../tema/tokens';
import { AreaDeFoto } from '../../ui/AreaDeFoto';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CampoData, Interruptor } from '../../ui/Campos';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';
import { avisoDeConflito, ehConflito } from '../financeiro/comum';
import { CampoCategoria } from './CampoCategoria';
import { fotoDoArquivo } from './fotoDoArquivo';
import { InterruptorComMotivo } from './InterruptorComMotivo';

const WEB = Platform.OS === 'web';
/** Lado da foto na seção "Item". */
const LADO_DA_FOTO = 180;
/** A partir desta largura do formulário a foto fica à esquerda dos campos; abaixo, em cima (celular). */
const LARGURA_FOTO_AO_LADO = 560;

/** Campo do rascunho → chave do `fieldErrors` da API (as mesmas de `problemasDoItem`). */
const CHAVE_DO_ERRO: Record<keyof RascunhoDoItem, string> = {
  nome: 'nome', descricao: 'descricao', tipo: 'tipo', preco: 'precoCentavos', precoEspecial: 'precoEspecialCentavos', especialAte: 'especialAte',
  cupom: 'cupom', linkUrl: 'linkUrl', categoriaId: 'categoriaId', ativo: 'ativo', naPaginaPublica: 'naPaginaPublica', noMarketplace: 'noMarketplace',
};

interface PropsDaFolha {
  item: ItemDaVitrine | 'novo' | null;
  podeAlterar: boolean;
  /** `undefined` enquanto carrega ou se falhou. */
  categorias: readonly CategoriaDaVitrine[] | undefined;
  aoFechar: () => void;
  /** Algo mudou no servidor (item, foto ou categoria criada): a lista e as categorias recarregam. */
  aoMudar: () => void;
}

/**
 * Folha de um item da vitrine em seções (Item, Preço, Onde comprar, Visibilidade), na largura média. Criar já leva a foto:
 * "Criar item" cria e em seguida envia a foto. Se a foto falhar, o item fica criado e a folha vira "Editar item" sobre ele
 * (mesma montagem: a foto escolhida e o erro continuam; tentar de novo só reenvia a foto). Sem `VITRINE_ALTERAR`, só leitura.
 */
export function FolhaDoItem({ item, ...resto }: PropsDaFolha) {
  if (!item) return null;
  return <Formulario key={item === 'novo' ? 'novo' : `${item.id}:${item.versao}`} inicial={item === 'novo' ? null : item} {...resto} />;
}

function Formulario({ inicial, podeAlterar, categorias, aoFechar, aoMudar }: Omit<PropsDaFolha, 'item'> & { inicial: ItemDaVitrine | null }) {
  const { avisar } = useAviso();
  const { lojaHabilitada } = useSessao();
  const { largura, aoMedir } = useFaixaDeLargura();
  const aoLado = largura >= LARGURA_FOTO_AO_LADO;
  // A foto muda o item sem mudar a versão (tabela à parte na API): o estado local evita remontar e perder o que foi digitado.
  const [item, setItem] = useState(inicial);
  const [r, setR] = useState<RascunhoDoItem>(() => (inicial ? rascunhoDoItem(inicial) : rascunhoVazio()));
  const [ateTexto, setAteTexto] = useState(dataParaTela(inicial?.especialAte));
  const [doServidor, setDoServidor] = useState<Record<string, string>>({});
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [removendoFoto, setRemovendoFoto] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  // Foto escolhida e ainda não enviada: no "Novo item", até criar; depois de uma falha, até o "Tentar de novo".
  const [pendente, setPendente] = useState<FotoPronta | null>(null);
  const [erroDaFoto, setErroDaFoto] = useState<string | null>(null);
  const [criadas, setCriadas] = useState<CategoriaDaVitrine[]>([]);

  // A cópia reduzida da foto (no celular, um arquivo no cache) sai quando é trocada, enviada ou quando a folha fecha.
  const pendenteRef = useRef<FotoPronta | null>(null);
  useEffect(() => { pendenteRef.current = pendente; }, [pendente]);
  useEffect(() => () => descartar(pendenteRef.current), []);

  const ateIso = precoEspecialLiberado(r) ? dataDaTela(ateTexto) : '';
  const locais = problemasDoItem({ ...r, especialAte: ateIso ?? '' });
  if (ateIso === undefined) locais.especialAte = 'Informe a data completa, no formato DD/MM/AAAA.';
  const erros: Record<string, string> = { ...(tentou ? locais : {}), ...doServidor };
  const listaDeCategorias = categorias ? [...categorias, ...criadas.filter((c) => !categorias.some((x) => x.id === c.id))] : criadas.length ? criadas : undefined;

  const mudar = <K extends keyof RascunhoDoItem>(campo: K, valor: RascunhoDoItem[K]) => {
    setR((atual) => ({ ...atual, [campo]: valor }));
    setDoServidor(({ [CHAVE_DO_ERRO[campo]]: _, ...resto }) => resto);
  };
  const mudarPreco = (texto: string) => {
    setR((atual) => comPreco(atual, texto));
    if (!texto.trim()) setAteTexto('');
    setDoServidor(({ precoCentavos: _a, precoEspecialCentavos: _b, especialAte: _c, ...resto }) => resto);
  };
  // Trocar para físico tira o item da página pública (`comTipoDoItem`) e, com isso, o erro do servidor nesse campo.
  const mudarTipo = (tipo: RascunhoDoItem['tipo']) => {
    setR((atual) => comTipoDoItem(atual, tipo));
    setDoServidor(({ tipo: _t, naPaginaPublica: _p, noMarketplace: _m, ...resto }) => resto);
  };
  const pagina = interruptorDaPaginaPublica(r.tipo, lojaHabilitada);
  const erroDaPagina = erroDaPaginaPublicaDoItem(erros);

  const falhar = (e: unknown) => {
    setEnviando(false);
    if (ehConflito(e)) {
      setExcluindo(false);
      avisar(avisoDeConflito('O item foi alterado'), 'neutro');
      aoMudar();
      aoFechar();
      return;
    }
    const porCampo = errosPorCampo(e);
    if (Object.keys(porCampo).length > 0 && !excluindo) { setDoServidor(porCampo); return; }
    setErro(e);
  };

  /** Envia a foto ao item `id`. Falhou: a foto fica guardada, com o erro e o "Tentar de novo" na área. */
  const enviarFoto = async (pronta: FotoPronta, id: string, mensagemDaFalha?: string): Promise<boolean> => {
    setEnviandoFoto(true);
    setErroDaFoto(null);
    try {
      const dados = new FormData();
      await anexarFoto(dados, pronta);
      const novo = await trocarFotoDoItem(id, dados);
      setItem((atual) => (atual ? { ...atual, temFoto: novo.temFoto, fotoAtualizadaEm: novo.fotoAtualizadaEm } : atual));
      setPendente(null);
      descartar(pronta);
      return true;
    } catch (e) {
      setPendente(pronta);
      setErroDaFoto(mensagemDaFalha ?? textoDoErro(e));
      return false;
    } finally {
      setEnviandoFoto(false);
    }
  };

  /** Foto nova escolhida (galeria, câmera ou solta): no "Novo item" só fica guardada; num item que existe, vai na hora. */
  const usarFoto = async (pronta: FotoPronta) => {
    if (pendente) descartar(pendente);
    if (!item) { setPendente(pronta); setErroDaFoto(null); return; }
    if (await enviarFoto(pronta, item.id)) { avisar('Foto do item salva.', 'sucesso'); aoMudar(); }
  };
  const recusar = (e: unknown) => setErroDaFoto(e instanceof FotoRecusada ? e.message : textoDoErro(e));
  const escolher = async (origem: OrigemDaFoto) => {
    try {
      const pronta = await escolherFoto(origem, LIMITES_FOTO_DA_VITRINE);
      if (pronta) await usarFoto(pronta);
    } catch (e) { recusar(e); }
  };
  const soltar = async (arquivo: File) => {
    try { await usarFoto(await fotoDoArquivo(arquivo)); } catch (e) { recusar(e); }
  };
  const tentarFotoDeNovo = async () => {
    if (!item || !pendente) return;
    if (await enviarFoto(pendente, item.id, erroDaFoto ?? undefined)) { avisar('Foto do item salva.', 'sucesso'); aoMudar(); }
  };
  const removerFotoLocalOuPedir = () => {
    if (pendente) { descartar(pendente); setPendente(null); setErroDaFoto(null); return; }
    setRemovendoFoto(true);
  };

  const salvar = async () => {
    setTentou(true);
    if (Object.keys(locais).length > 0) return;
    setEnviando(true);
    setErro(null);
    setDoServidor({});
    const corpo = corpoDoItem({ ...r, especialAte: ateIso ?? '' }, item?.versao);
    if (item) {
      alterarItemDaVitrine(item.id, corpo).then(() => {
        setEnviando(false);
        avisar('Item salvo.', 'sucesso');
        aoMudar();
        aoFechar();
      }, falhar);
      return;
    }
    let criado: ItemDaVitrine;
    try { criado = await criarItemDaVitrine(corpo); } catch (e) { falhar(e); return; }
    // Daqui em diante o item existe: um novo "Salvar" vira PUT e tentar a foto de novo não cria outro item.
    setItem(criado);
    setEnviando(false);
    aoMudar();
    if (pendente && !(await enviarFoto(pendente, criado.id, FOTO_NAO_SUBIU))) return;
    avisar(pendente ? 'Item criado com a foto.' : 'Item criado.', 'sucesso');
    aoMudar();
    aoFechar();
  };

  const excluir = () => {
    if (!item) return;
    setEnviando(true);
    setErro(null);
    excluirItemDaVitrine(item.id, item.versao).then(() => {
      setEnviando(false);
      avisar('Item excluído.', 'sucesso');
      aoMudar();
      aoFechar();
    }, falhar);
  };

  const removerFoto = () => {
    if (!item) return;
    setEnviandoFoto(true);
    removerFotoDoItem(item.id).then(() => {
      setEnviandoFoto(false);
      setRemovendoFoto(false);
      setItem((atual) => (atual ? { ...atual, temFoto: false, fotoAtualizadaEm: null } : atual));
      avisar('Foto do item removida.', 'sucesso');
      aoMudar();
    }, (e: unknown) => {
      setEnviandoFoto(false);
      setRemovendoFoto(false);
      setErroDaFoto(textoDoErro(e));
    });
  };

  const titulo = !item ? 'Novo item' : podeAlterar ? 'Editar item' : 'Item da vitrine';
  const ocupado = enviando || enviandoFoto;
  const previa = pendente ? (
    <Image source={{ uri: pendente.uri }} style={{ width: LADO_DA_FOTO, height: LADO_DA_FOTO }} accessibilityLabel="Foto escolhida para o item" resizeMode="cover" />
  ) : item?.temFoto ? <MiniaturaDoItem item={item} carregar={baixarFotoDoItem} tamanho={LADO_DA_FOTO} /> : null;
  const liberado = precoEspecialLiberado(r);
  const idDoContador = 'contador-da-descricao';
  const contador = `${r.descricao.length}/${DESCRICAO_MAXIMA}`;

  if (!podeAlterar) {
    return (
      <Folha visivel titulo={titulo} aoFechar={aoFechar} largura={LARGURA_FOLHA_LARGA}>
        {item ? <SomenteLeitura item={item} lojaHabilitada={lojaHabilitada} /> : null}
      </Folha>
    );
  }

  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar} largura={LARGURA_FOLHA_LARGA}
      rodape={(
        <LinhaDeAcoes alinhar="fim">
          {item ? <Botao rotulo="Excluir" tipo="perigoTexto" aoTocar={() => { setErro(null); setExcluindo(true); }} desabilitado={ocupado} /> : null}
          <Botao rotulo={item ? 'Salvar item' : 'Criar item'} aoTocar={() => void salvar()} carregando={enviando} desabilitado={enviandoFoto}
            motivo="Aguarde o envio da foto." />
        </LinhaDeAcoes>
      )}>
      <View style={estilos.secoes}>
        <Secao titulo="Item">
          {/* Mede dentro do cartão: é a largura que a foto e os campos dividem. */}
          <View onLayout={aoMedir} style={aoLado ? estilos.fotoAoLado : estilos.coluna}>
            <AreaDeFoto rotulo="Foto do item" dica={DICA_DA_FOTO_DA_VITRINE} previa={previa} lado={LADO_DA_FOTO}
              aoEscolher={() => void escolher('galeria')} aoSoltarArquivo={WEB ? (a) => void soltar(a) : undefined}
              aoRemover={removerFotoLocalOuPedir} aoTentarDeNovo={item && pendente ? () => void tentarFotoDeNovo() : undefined}
              carregando={enviandoFoto} desabilitado={enviando} erro={erroDaFoto}
              extras={!WEB ? <Botao rotulo="Tirar foto" tipo="secundario" Icone={Camera} aoTocar={() => void escolher('camera')} desabilitado={ocupado} /> : null} />
            <View style={estilos.camposDoItem}>
              <Campo rotulo="Nome" valor={r.nome} aoMudar={(t) => mudar('nome', t)} maxLength={NOME_MAXIMO} erro={erros.nome ?? null} />
              <CampoCategoria valor={r.categoriaId} nomeAtual={item?.categoriaNome ?? null} tipo={r.tipo} categorias={listaDeCategorias}
                aoMudar={(id) => mudar('categoriaId', id)} aoCriar={(c) => { setCriadas((l) => [...l, c]); aoMudar(); }} erro={erros.categoriaId ?? null} />
              <View style={estilos.grupoCurto}>
                <Campo rotulo="Descrição (opcional)" valor={r.descricao} aoMudar={(t) => mudar('descricao', t)} linhas={3}
                  maxLength={DESCRICAO_MAXIMA} erro={erros.descricao ?? null} ajudaForaDoCampo={{ id: idDoContador, texto: `${contador} caracteres` }} />
                <Texto variante="pequeno" numerico nativeID={idDoContador} style={estilos.contador} aria-hidden>{contador}</Texto>
              </View>
            </View>
          </View>
          <View style={estilos.linhaDoTipo}>
            <Escolha rotulo="Tipo" opcoes={TIPOS_DE_ITEM.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))} valor={r.tipo} aoMudar={mudarTipo} />
            {r.tipo === 'DIGITAL' ? <Texto variante="pequeno" style={estilos.nota}>{NOTA_DO_ITEM_DIGITAL}</Texto> : null}
          </View>
        </Secao>

        <Secao titulo="Preço">
          <CamposEmLinha minimo={170}>
            <CampoDePreco rotulo="Preço (opcional)" texto={r.preco} aoMudar={mudarPreco} erro={erros.precoCentavos ?? null} />
            <CampoDePreco rotulo="Preço especial" texto={r.precoEspecial} aoMudar={(t) => mudar('precoEspecial', t)}
              erro={liberado ? erros.precoEspecialCentavos ?? null : null} desabilitado={!liberado} />
            <CampoData rotulo="Até" nome="Prazo do preço especial" rotuloAcessivel="Até: prazo do preço especial" regra="PLANEJAMENTO"
              valor={ateTexto} desabilitado={!liberado}
              aoMudar={(t) => { setAteTexto(t); setDoServidor(({ especialAte: _, ...resto }) => resto); }} erro={liberado ? erros.especialAte ?? null : null} />
          </CamposEmLinha>
          {!liberado ? <Texto variante="pequeno">{MOTIVO_SEM_PRECO}</Texto> : null}
        </Secao>

        <Secao titulo="Onde comprar">
          <CamposEmLinha minimo={220}>
            <Campo rotulo="Cupom (opcional)" valor={r.cupom} aoMudar={(t) => mudar('cupom', t)} maxLength={MAX_CUPOM} autoCapitalize="characters"
              autoCorrect={false} placeholder="O aluno copia com um toque" erro={erros.cupom ?? null} />
            <Campo rotulo="Link (opcional)" valor={r.linkUrl} aoMudar={(t) => mudar('linkUrl', t)} autoCapitalize="none" autoCorrect={false}
              keyboardType="url" inputMode="url" placeholder="https://… (abre fora do app)" erro={erros.linkUrl ?? null} />
          </CamposEmLinha>
        </Secao>

        <Secao titulo="Visibilidade">
          <Interruptor rotulo="Item ativo" valor={r.ativo} aoMudar={(v) => mudar('ativo', v)}
            ajuda="Desligado, o item some da vitrine dos alunos e continua guardado aqui." />
          {pagina.visivel ? (
            <View style={estilos.grupoCurto}>
              <InterruptorComMotivo rotulo="Aparece na página pública" valor={r.naPaginaPublica}
                aoMudar={(v) => mudar('naPaginaPublica', v)} desabilitado={!pagina.habilitado} motivo={pagina.motivo}
                ajuda={pagina.habilitado ? 'Quem tem o link da página vê o item, se ele estiver ativo.' : undefined} />
              {erroDaPagina ? <MensagemDeErro erro={erroDaPagina} /> : null}
            </View>
          ) : null}
        </Secao>
        {erro && !excluindo ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
      <PainelConfirmacao visivel={excluindo} titulo="Excluir este item?"
        mensagem={`“${item?.nome ?? ''}” sai da vitrine e a foto é apagada. Não dá para desfazer; para só esconder dos alunos, desligue “Item ativo”.`}
        rotuloConfirmar="Excluir item" rotuloCancelar="Voltar" perigo carregando={enviando}
        aoConfirmar={excluir} aoCancelar={() => setExcluindo(false)}>
        {erro && excluindo ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </PainelConfirmacao>
      <PainelConfirmacao visivel={removendoFoto} titulo="Remover a foto?" mensagem="O item fica sem foto para os alunos."
        rotuloConfirmar="Remover foto" rotuloCancelar="Voltar" perigo carregando={enviandoFoto}
        aoConfirmar={removerFoto} aoCancelar={() => setRemovendoFoto(false)} />
    </Folha>
  );
}

/** A cópia local da foto (só no celular há arquivo no cache para apagar). */
function descartar(foto: FotoPronta | null) {
  if (foto && Platform.OS !== 'web') void apagarTemporaria(foto.uri);
}

/** Cada seção é um cartão com faixa de título, como em Editar alimento e Editar exercício. */
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <Cartao titulo={titulo} nivel={3}>{children}</Cartao>;
}

/** Preço com a máscara de moeda; desabilitado (sem preço) não aceita digitar. */
function CampoDePreco({ rotulo, texto, aoMudar, erro, desabilitado }: { rotulo: string; texto: string; aoMudar: (t: string) => void; erro: string | null; desabilitado?: boolean }) {
  const centavos = centavosDaTela(texto);
  const exibido = centavos === null ? '' : centavosParaTela(centavos);
  return (
    <Campo numerico rotulo={rotulo} valor={exibido} aoMudar={(novo) => aoMudar(mascaraDeMoeda(exibido, novo))} placeholder="R$ 0,00"
      keyboardType="number-pad" inputMode="numeric" erro={erro} editable={!desabilitado} />
  );
}

function SomenteLeitura({ item, lojaHabilitada }: { item: ItemDaVitrine; lojaHabilitada: boolean }) {
  return (
    <View style={estilos.secoes}>
      <Secao titulo="Item">
        <View style={estilos.fotoAoLado}>
          <MiniaturaDoItem item={item} carregar={baixarFotoDoItem} tamanho={LADO_DA_FOTO} />
          <View style={estilos.camposDoItem}>
            <CampoLeitura rotulo="Nome" valor={item.nome} />
            <CampoLeitura rotulo="Categoria" valor={item.categoriaNome ?? SEM_CATEGORIA} />
            <CampoLeitura rotulo="Descrição" valor={item.descricao} />
            <CampoLeitura rotulo="Tipo" valor={rotuloDoTipo(item.tipo)} />
          </View>
        </View>
      </Secao>
      <Secao titulo="Preço">
        <CamposEmLinha>
          <CampoLeitura rotulo="Preço" valor={centavosParaTela(item.precoCentavos)} numerico />
          <CampoLeitura rotulo="Preço especial" valor={item.precoEspecialCentavos != null ? centavosParaTela(item.precoEspecialCentavos) : null} numerico />
          <CampoLeitura rotulo="Até" valor={dataParaTela(item.especialAte)} />
        </CamposEmLinha>
      </Secao>
      <Secao titulo="Onde comprar">
        <CamposEmLinha minimo={220}>
          <CampoLeitura rotulo="Cupom" valor={item.cupom} />
          <CampoLeitura rotulo="Link" valor={item.linkUrl} />
        </CamposEmLinha>
      </Secao>
      <Secao titulo="Visibilidade">
        <CamposEmLinha>
          <CampoLeitura rotulo="Situação" valor={item.ativo ? 'Ativo' : 'Inativo'} />
          {lojaHabilitada ? <CampoLeitura rotulo="Página pública" valor={item.naPaginaPublica ? 'Aparece' : 'Não aparece'} /> : null}
        </CamposEmLinha>
      </Secao>
    </View>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre os cartões da folha (seção 4.3 do design); dentro de cada cartão, os 16 px do próprio `Cartao`.
  secoes: { gap: espaco(3) },
  coluna: { gap: espaco(1.5) },
  fotoAoLado: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2), flexWrap: 'wrap' },
  camposDoItem: { flex: 1, minWidth: 240, gap: espaco(1.5) },
  grupoCurto: { gap: espaco(0.5) },
  contador: { alignSelf: 'flex-end', marginTop: -espaco(0.25) },
  linhaDoTipo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(2), rowGap: espaco(1) },
  nota: { flexShrink: 1, flexBasis: 280, flexGrow: 1, paddingBottom: espaco(1) },
});
