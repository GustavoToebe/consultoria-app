import { Camera, ImagePlus } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  alterarItemDaVitrine, baixarFotoDoItem, criarItemDaVitrine, excluirItemDaVitrine, removerFotoDoItem, trocarFotoDoItem,
} from '../../api/rotas';
import type { ItemDaVitrine } from '../../api/vitrineTipos';
import { apagarTemporaria } from '../../aluno/atualizacao/fotos/fotosLocais';
import { anexarFoto } from '../../aluno/atualizacao/fotos/enviarFotoDoAparelho';
import { escolherFoto, FotoRecusada, type LimitesDaReducao, type OrigemDaFoto } from '../../aluno/atualizacao/fotos/prepararFoto';
import { MiniaturaDoItem } from '../../aluno/vitrine/MiniaturaDoItem';
import { dataDaTela, dataParaTela, centavosParaTela } from '../../dominio/formatos';
import { MAX_CUPOM } from '../../dominio/suplementos';
import {
  comTipoDoItem, corpoDoItem, DESCRICAO_MAXIMA, erroDaPaginaPublicaDoItem, interruptorDaPaginaPublica, NOME_MAXIMO, problemasDoItem,
  rascunhoDoItem, rascunhoVazio, rotuloDoTipo, TIPOS_DE_ITEM, type RascunhoDoItem,
} from '../../dominio/vitrine';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
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
import { avisoDeConflito, CampoMoeda, ehConflito } from '../financeiro/comum';
import { InterruptorComMotivo } from './InterruptorComMotivo';

/** O que a API aceita na foto do item (D3: 1600 px, 300 KB depois da limpeza): o aparelho já manda dentro disso. */
const LIMITES_FOTO_DA_VITRINE: LimitesDaReducao = { lados: [1600, 1200, 900, 640], bytesMaximo: 300_000 };

/** Campo do rascunho → chave do `fieldErrors` da API (as mesmas de `problemasDoItem`). */
const CHAVE_DO_ERRO: Record<keyof RascunhoDoItem, string> = {
  nome: 'nome', descricao: 'descricao', tipo: 'tipo', preco: 'precoCentavos', precoEspecial: 'precoEspecialCentavos',
  especialAte: 'especialAte', cupom: 'cupom', linkUrl: 'linkUrl', ativo: 'ativo', naPaginaPublica: 'naPaginaPublica', noMarketplace: 'noMarketplace',
};

/** Folha de um item da vitrine: criar, editar, foto e excluir (com `VITRINE_ALTERAR`); sem ela, só leitura. */
export function FolhaDoItem({ item, podeAlterar, aoFechar, aoMudar, aoCriar }: {
  item: ItemDaVitrine | 'novo' | null;
  podeAlterar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
  /** Item criado: a folha reabre nele para a foto (que só vai sobre item que já existe). */
  aoCriar: (item: ItemDaVitrine) => void;
}) {
  if (!item) return null;
  return <Formulario key={item === 'novo' ? 'novo' : `${item.id}:${item.versao}`} inicial={item === 'novo' ? null : item}
    podeAlterar={podeAlterar} aoFechar={aoFechar} aoMudar={aoMudar} aoCriar={aoCriar} />;
}

function Formulario({ inicial, podeAlterar, aoFechar, aoMudar, aoCriar }: {
  inicial: ItemDaVitrine | null;
  podeAlterar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
  aoCriar: (item: ItemDaVitrine) => void;
}) {
  const { avisar } = useAviso();
  const { lojaHabilitada } = useSessao();
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

  const ateIso = dataDaTela(ateTexto);
  const locais = problemasDoItem({ ...r, especialAte: ateIso ?? '' });
  if (ateIso === undefined) locais.especialAte = 'Informe a data completa, no formato DD/MM/AAAA.';
  const erros: Record<string, string> = { ...(tentou ? locais : {}), ...doServidor };

  const mudar = <K extends keyof RascunhoDoItem>(campo: K, valor: RascunhoDoItem[K]) => {
    setR((atual) => ({ ...atual, [campo]: valor }));
    setDoServidor(({ [CHAVE_DO_ERRO[campo]]: _, ...resto }) => resto);
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

  const salvar = () => {
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
    } else {
      criarItemDaVitrine(corpo).then((criado) => {
        setEnviando(false);
        avisar('Item criado. Agora dá para adicionar a foto.', 'sucesso');
        aoCriar(criado);
      }, falhar);
    }
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

  const trocarFoto = async (origem: OrigemDaFoto) => {
    if (!item) return;
    let uri: string | null = null;
    setEnviandoFoto(true);
    try {
      const pronta = await escolherFoto(origem, LIMITES_FOTO_DA_VITRINE);
      if (!pronta) return;
      uri = pronta.uri;
      const dados = new FormData();
      await anexarFoto(dados, pronta);
      const novo = await trocarFotoDoItem(item.id, dados);
      setItem((atual) => (atual ? { ...atual, temFoto: novo.temFoto, fotoAtualizadaEm: novo.fotoAtualizadaEm } : atual));
      avisar('Foto do item salva.', 'sucesso');
      aoMudar();
    } catch (e) {
      avisar(e instanceof FotoRecusada ? e.message : textoDoErro(e), 'perigo');
    } finally {
      if (uri && Platform.OS !== 'web') await apagarTemporaria(uri);
      setEnviandoFoto(false);
    }
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
      avisar(textoDoErro(e), 'perigo');
    });
  };

  const titulo = !item ? 'Novo item' : podeAlterar ? 'Editar item' : 'Item da vitrine';
  const ocupado = enviando || enviandoFoto;

  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar}
      rodape={podeAlterar ? (
        <LinhaDeAcoes alinhar="fim">
          {item ? <Botao rotulo="Excluir" tipo="perigoTexto" aoTocar={() => { setErro(null); setExcluindo(true); }} desabilitado={ocupado} /> : null}
          <Botao rotulo={item ? 'Salvar item' : 'Criar item'} aoTocar={salvar} carregando={enviando} desabilitado={enviandoFoto} />
        </LinhaDeAcoes>
      ) : undefined}>
      <View style={estilos.coluna}>
        {item ? (
          <View style={estilos.foto}>
            <Texto variante="rotulo">Foto</Texto>
            {item.temFoto ? <MiniaturaDoItem item={item} carregar={baixarFotoDoItem} tamanho={160} />
              : <Texto variante="suave">{podeAlterar ? 'Sem foto. Uma foto por item, em JPEG.' : 'Sem foto.'}</Texto>}
            {podeAlterar ? (
              <LinhaDeAcoes>
                <Botao rotulo={item.temFoto ? 'Trocar foto' : 'Escolher foto'} tipo="secundario" Icone={ImagePlus}
                  aoTocar={() => void trocarFoto('galeria')} carregando={enviandoFoto} desabilitado={enviando} />
                {Platform.OS !== 'web' ? (
                  <Botao rotulo="Tirar foto" tipo="secundario" Icone={Camera} aoTocar={() => void trocarFoto('camera')} desabilitado={ocupado} />
                ) : null}
                {item.temFoto ? <Botao rotulo="Remover foto" tipo="perigoTexto" aoTocar={() => setRemovendoFoto(true)} desabilitado={ocupado} /> : null}
              </LinhaDeAcoes>
            ) : null}
          </View>
        ) : podeAlterar ? <Texto variante="suave">A foto entra depois de criar o item.</Texto> : null}

        {podeAlterar ? (
          <>
            <Campo rotulo="Nome" valor={r.nome} aoMudar={(t) => mudar('nome', t)} maxLength={NOME_MAXIMO} erro={erros.nome ?? null} />
            <Campo rotulo="Descrição (opcional)" valor={r.descricao} aoMudar={(t) => mudar('descricao', t)} linhas={3}
              maxLength={DESCRICAO_MAXIMA} erro={erros.descricao ?? null} ajuda={`Até ${DESCRICAO_MAXIMA} caracteres.`} />
            <View style={estilos.grupo}>
              <Escolha rotulo="Tipo" opcoes={TIPOS_DE_ITEM.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))} valor={r.tipo} aoMudar={mudarTipo} />
              <Texto variante="pequeno">
                {r.tipo === 'DIGITAL'
                  ? 'No app do celular, item digital mostra só foto, nome e descrição (regra das lojas de aplicativo). Preço, cupom e link aparecem na web.'
                  : 'Item físico mostra tudo, na web e no celular.'}
              </Texto>
            </View>
            <CampoMoeda mascara rotulo="Preço (opcional)" texto={r.preco} aoMudar={(t) => mudar('preco', t)} erro={erros.precoCentavos ?? null}
              ajuda="Sem preço, o aluno vê “—”." />
            <CamposEmLinha>
              <CampoMoeda mascara rotulo="Preço especial (opcional)" texto={r.precoEspecial} aoMudar={(t) => mudar('precoEspecial', t)}
                erro={erros.precoEspecialCentavos ?? null} ajuda="Menor que o preço; o preço aparece riscado ao lado." />
              <CampoData rotulo="Preço especial até (opcional)" nome="Prazo do preço especial" regra="PLANEJAMENTO" valor={ateTexto}
                aoMudar={(t) => { setAteTexto(t); setDoServidor(({ especialAte: _, ...resto }) => resto); }} erro={erros.especialAte ?? null} />
            </CamposEmLinha>
            <Campo rotulo="Cupom (opcional)" valor={r.cupom} aoMudar={(t) => mudar('cupom', t)} maxLength={MAX_CUPOM}
              autoCapitalize="characters" autoCorrect={false} erro={erros.cupom ?? null} ajuda="O aluno copia com um toque." />
            <Campo rotulo="Link (opcional)" valor={r.linkUrl} aoMudar={(t) => mudar('linkUrl', t)} autoCapitalize="none" autoCorrect={false}
              keyboardType="url" inputMode="url" placeholder="https://" erro={erros.linkUrl ?? null} ajuda="Endereço https; abre fora do app." />
            <Interruptor rotulo="Item ativo" valor={r.ativo} aoMudar={(v) => mudar('ativo', v)}
              ajuda="Desligado, o item some da vitrine dos alunos e continua guardado aqui." />
            {pagina.visivel ? (
              <View style={estilos.grupo}>
                <InterruptorComMotivo rotulo="Aparece na página pública" valor={r.naPaginaPublica}
                  aoMudar={(v) => mudar('naPaginaPublica', v)} desabilitado={!pagina.habilitado} motivo={pagina.motivo}
                  ajuda={pagina.habilitado ? 'Quem tem o link da página vê o item, se ele estiver ativo.' : undefined} />
                {erroDaPagina ? <MensagemDeErro erro={erroDaPagina} /> : null}
              </View>
            ) : null}
          </>
        ) : item ? (
          <>
            <CampoLeitura rotulo="Nome" valor={item.nome} />
            <CampoLeitura rotulo="Descrição" valor={item.descricao} />
            <CamposEmLinha>
              <CampoLeitura rotulo="Tipo" valor={rotuloDoTipo(item.tipo)} />
              <CampoLeitura rotulo="Situação" valor={item.ativo ? 'Ativo' : 'Inativo'} />
              {lojaHabilitada ? <CampoLeitura rotulo="Página pública" valor={item.naPaginaPublica ? 'Aparece' : 'Não aparece'} /> : null}
            </CamposEmLinha>
            <CamposEmLinha>
              <CampoLeitura rotulo="Preço" valor={centavosParaTela(item.precoCentavos)} numerico />
              <CampoLeitura rotulo="Preço especial" valor={item.precoEspecialCentavos != null ? centavosParaTela(item.precoEspecialCentavos) : null} numerico />
              <CampoLeitura rotulo="Preço especial até" valor={dataParaTela(item.especialAte)} />
            </CamposEmLinha>
            <CampoLeitura rotulo="Cupom" valor={item.cupom} />
            <CampoLeitura rotulo="Link" valor={item.linkUrl} />
          </>
        ) : null}
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

const estilos = StyleSheet.create({
  coluna: { gap: espaco(1.5) },
  grupo: { gap: espaco(0.5) },
  foto: { gap: espaco(1) },
});
