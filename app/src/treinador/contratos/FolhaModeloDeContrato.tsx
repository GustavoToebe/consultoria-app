import { useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import {
  alterarModeloDeContrato, criarModeloDeContrato, LIMITES_DO_CONTRATO, listarModelosDeContrato, previaDoModeloDeContrato, type ModeloDeContrato,
} from '../../api/contratos';
import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import { CAMPOS_DO_CONTRATO, erroDosCamposDesconhecidos, GRUPOS_DOS_CAMPOS, inserirCampo, type SelecaoDoTexto } from '../../dominio/contratos';
import { inteiroComMilhar } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FOLHA_LARGA, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { codigoApi, erroDeConexao, errosPorCampo, focarPrimeiroComErro, textoDoErro } from '../../ui/erros';
import { FaixaDeChips } from '../../ui/FaixaDeChips';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { useCarregar } from '../../ui/useCarregar';

export type AbaDoModelo = 'texto' | 'previa';

const SEM_INTERNET = 'Confira a internet e tente de novo.';

interface AlertaDaFolha { tom: 'perigo' | 'atencao'; texto: string; recarregar?: boolean }

/**
 * Criar, editar ou ver um modelo de contrato (tela A). Aba Texto: nome, os campos para inserir no cursor (chips por grupo) e o
 * texto. Aba Prévia (só com `CONTRATO_ALTERAR`): o modelo SALVO com dados de exemplo da API. Nada salva sozinho: o rodapé
 * diz "Tudo salvo"/"Alterações não salvas" e "Salvar modelo" envia; depois de salvar a folha fica aberta como "Editar".
 * Sem `CONTRATO_ALTERAR`, ou modelo arquivado, é só leitura do texto cru (com os `{campos}`).
 */
export function FolhaModeloDeContrato({ modelo, abaInicial, podeAlterar, aoSalvar, aoFechar }: {
  modelo: ModeloDeContrato | null;
  abaInicial: AbaDoModelo;
  podeAlterar: boolean;
  aoSalvar: (m: ModeloDeContrato) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const { width } = useWindowDimensions();
  const [atual, setAtual] = useState(modelo);
  const [nome, setNome] = useState(modelo?.nome ?? '');
  const [texto, setTexto] = useState(modelo?.texto ?? '');
  const [arquivou, setArquivou] = useState(false);
  const editavel = podeAlterar && !atual?.arquivadoEm && !arquivou;
  const [aba, setAba] = useState<AbaDoModelo>(editavel ? abaInicial : 'texto');
  const [erros, setErros] = useState<{ nome?: string; texto?: string }>({});
  const [alerta, setAlerta] = useState<AlertaDaFolha | null>(null);
  const [salvando, setSalvando] = useState(false);
  const nomeRef = useRef<TextInput>(null);
  const textoRef = useRef<TextInput>(null);
  // Onde o cursor está no texto; o chip insere ali. `cursor` é aplicado uma vez depois de inserir e solto na próxima mudança.
  const selecao = useRef<SelecaoDoTexto>({ inicio: texto.length, fim: texto.length });
  const [cursor, setCursor] = useState<{ start: number; end: number } | undefined>(undefined);
  const mudou = nome !== (atual?.nome ?? '') || texto !== (atual?.texto ?? '');
  const { fechar, aviso } = useFecharComAviso(true, editavel && mudou, aoFechar);
  const previa = useCarregar(aba === 'previa' && atual && editavel ? `previa-modelo-contrato:${atual.id}:${atual.versao}` : null, (c) => previaDoModeloDeContrato(c.split(':')[1]));

  const inserir = (codigo: string) => {
    // Na web o `textarea` guarda a seleção mesmo sem o foco (e o `onSelectionChange` não vem quando o valor é trocado de fora).
    const el = textoRef.current as unknown as { selectionStart?: unknown; selectionEnd?: unknown } | null;
    if (Platform.OS === 'web' && typeof el?.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
      selecao.current = { inicio: el.selectionStart, fim: el.selectionEnd };
    }
    const r = inserirCampo(texto, selecao.current, codigo);
    setTexto(r.texto);
    setErros((e) => ({ ...e, texto: undefined }));
    selecao.current = { inicio: r.cursor, fim: r.cursor };
    setCursor({ start: r.cursor, end: r.cursor });
    requestAnimationFrame(() => textoRef.current?.focus());
  };

  const descartar = () => {
    setNome(atual?.nome ?? '');
    setTexto(atual?.texto ?? '');
    setErros({});
    setAlerta(null);
  };

  const recarregar = () => {
    if (!atual) return;
    listarModelosDeContrato().then(
      (todos) => {
        const novo = todos.find((m) => m.id === atual.id);
        if (!novo) return;
        setAtual(novo);
        setNome(novo.nome);
        setTexto(novo.texto);
        setAlerta(null);
        if (novo.arquivadoEm) setArquivou(true);
        aoSalvar(novo);
      },
      (e: unknown) => setAlerta({ tom: 'perigo', texto: erroDeConexao(e) ? SEM_INTERNET : textoDoErro(e) }),
    );
  };

  const salvar = () => {
    if (salvando) return;
    const locais = {
      nome: nome.trim() ? undefined : 'Informe o nome do modelo.',
      texto: !texto.trim() ? 'Escreva o texto do contrato.' : erroDosCamposDesconhecidos(texto) ?? undefined,
    };
    setErros(locais);
    setAlerta(null);
    if (locais.nome || locais.texto) {
      focarPrimeiroComErro(locais as Record<string, string>, [['nome', nomeRef], ['texto', textoRef]]);
      return;
    }
    setSalvando(true);
    const corpo = { nome: nome.trim(), texto };
    (atual ? alterarModeloDeContrato(atual.id, { ...corpo, versao: atual.versao }) : criarModeloDeContrato(corpo)).then(
      (salvo) => {
        setSalvando(false);
        setAtual(salvo);
        setNome(salvo.nome);
        setTexto(salvo.texto);
        aoSalvar(salvo);
        avisar('Modelo salvo.', 'sucesso');
      },
      (e: unknown) => {
        setSalvando(false);
        const codigo = codigoApi(e);
        if (codigo === 'CONTRATO_MODELO_NOME_EM_USO') {
          setErros({ nome: 'Já existe um modelo ativo com este nome.' });
          focarPrimeiroComErro({ nome: 'x' }, [['nome', nomeRef]]);
        } else if (codigo === 'CONTRATO_MODELO_INVALIDO') {
          const campos = errosPorCampo(e);
          if (campos.nome || campos.texto) {
            setErros({ nome: campos.nome, texto: campos.texto });
            focarPrimeiroComErro(campos, [['nome', nomeRef], ['texto', textoRef]]);
          } else setAlerta({ tom: 'perigo', texto: textoDoErro(e) });
        } else if (codigo === 'CONFLITO_EDICAO') {
          setAlerta({ tom: 'atencao', texto: 'Outra pessoa alterou este modelo. Recarregue para ver a versão atual.', recarregar: true });
        } else if (codigo === 'CONTRATO_MODELO_ARQUIVADO') {
          setArquivou(true);
          setAba('texto');
          setAlerta({ tom: 'atencao', texto: 'Este modelo foi arquivado e não pode mais ser editado.' });
        } else {
          setAlerta({ tom: 'perigo', texto: erroDeConexao(e) ? SEM_INTERNET : textoDoErro(e) });
        }
      },
    );
  };

  const titulo = !atual ? 'Novo modelo de contrato' : editavel ? 'Editar modelo de contrato' : 'Modelo de contrato';
  const rodape = editavel && mudou ? (
    <>
      <Botao rotulo="Descartar" tipo="secundario" desabilitado={salvando} motivo="Salvando o modelo." aoTocar={descartar} />
      <Botao rotulo="Salvar modelo" carregando={salvando} aoTocar={salvar} />
    </>
  ) : undefined;
  const statusDoRodape = editavel ? (
    <View aria-live="polite">
      <Texto variante="suave" cor={mudou ? cores.texto : undefined}>
        {mudou ? 'Alterações não salvas' : atual ? 'Tudo salvo' : 'Escreva o nome e o texto do modelo.'}
      </Texto>
    </View>
  ) : undefined;

  return (
    <Folha visivel titulo={titulo} aoFechar={fechar} largura={LARGURA_FOLHA_LARGA} telaCheiaNoCelular rodape={rodape} statusDoRodape={statusDoRodape}>
      <View style={estilos.corpo}>
        {alerta ? (
          <Alerta tom={alerta.tom} texto={alerta.texto}>
            {alerta.recarregar ? <View style={estilos.acaoDoAlerta}><Botao rotulo="Recarregar" tipo="secundario" aoTocar={recarregar} /></View> : null}
          </Alerta>
        ) : null}
        {editavel ? (
          <Campo ref={nomeRef} rotulo="Nome do modelo" valor={nome} aoMudar={(t) => { setNome(t); setErros((e) => ({ ...e, nome: undefined })); }}
            erro={erros.nome} maxLength={LIMITES_DO_CONTRATO.nomeDoModelo} />
        ) : (
          <View style={estilos.leitura}>
            <Texto variante="rotulo">Nome do modelo</Texto>
            <Texto>{atual?.nome}</Texto>
          </View>
        )}
        {editavel ? (
          <Abas abas={[{ valor: 'texto', rotulo: 'Texto' }, { valor: 'previa', rotulo: 'Prévia' }]} ativa={aba} aoMudar={setAba} ativacao="manual" />
        ) : null}
        {!editavel ? (
          <View style={estilos.leitura}>
            <Texto variante="rotulo">Texto do contrato</Texto>
            <View style={[estilos.papel, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
              <Texto selectable>{atual?.texto}</Texto>
            </View>
          </View>
        ) : aba === 'texto' ? (
          <>
            <View style={estilos.campos}>
              <Texto variante="bloco" nivel={3}>Inserir campo</Texto>
              {GRUPOS_DOS_CAMPOS.map((g) => (
                <View key={g} style={estilos.grupo}>
                  <Texto variante="secao">{g}</Texto>
                  <FaixaDeChips quebrar={width >= LARGURA_MENU_LATERAL} accessibilityLabel={`Campos: ${g}`}>
                    {CAMPOS_DO_CONTRATO.filter((c) => c.grupo === g).map((c) => (
                      <Botao key={c.codigo} rotulo={c.rotulo} rotuloAcessivel={`Inserir campo ${c.rotulo}`} tipo="secundario" tamanho="pequeno" aoTocar={() => inserir(c.codigo)} />
                    ))}
                  </FaixaDeChips>
                </View>
              ))}
            </View>
            <Campo ref={textoRef} rotulo="Texto do contrato" valor={texto} linhas={16} maxLength={LIMITES_DO_CONTRATO.textoDoModelo}
              aoMudar={(t) => { setTexto(t); setErros((e) => ({ ...e, texto: undefined })); }}
              selection={cursor}
              onSelectionChange={(e) => {
                const { start, end } = e.nativeEvent.selection;
                selecao.current = { inicio: start, fim: end };
                if (cursor) setCursor(undefined);
              }}
              erro={erros.texto} ajuda="Use **negrito** e __sublinhado__. Toque num campo para inseri-lo onde está o cursor." />
            <View style={estilos.rodapeDoTexto}>
              <Texto variante="pequeno" style={estilos.nota}>Plano, valor, parcelas e vigência vêm da contratação escolhida ao gerar.</Texto>
              <Texto variante="pequeno" numerico>{`${inteiroComMilhar(texto.length)} de ${inteiroComMilhar(LIMITES_DO_CONTRATO.textoDoModelo)}`}</Texto>
            </View>
          </>
        ) : !atual ? (
          <Texto variante="suave">Salve o modelo para ver a prévia com dados de exemplo.</Texto>
        ) : (
          <View style={estilos.leitura}>
            {mudou ? <Alerta tom="atencao" texto="A prévia mostra a versão salva. Salve para ver as alterações." /> : null}
            {previa.erro && !previa.dados ? <MensagemErro texto={erroDeConexao(previa.erro) ? SEM_INTERNET : textoDoErro(previa.erro)} erro={previa.erro} tentarDeNovo={previa.recarregar} /> : null}
            {!previa.dados && !previa.erro ? <Esqueleto texto="Carregando a prévia" cartoes={1} /> : null}
            {previa.dados ? (
              <View style={[estilos.papel, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
                <Texto variante="bloco">{previa.dados.titulo}</Texto>
                <TextoFormatado texto={previa.dados.texto} />
              </View>
            ) : null}
            <Texto variante="pequeno">Dados de exemplo, nenhum dado de aluno.</Texto>
          </View>
        )}
      </View>
      {aviso}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
  leitura: { gap: espaco(1) },
  campos: { gap: espaco(1) },
  grupo: { gap: espaco(0.5) },
  papel: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  rodapeDoTexto: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco(2), flexWrap: 'wrap' },
  nota: { flexShrink: 1 },
  acaoDoAlerta: { marginTop: espaco(1), alignItems: 'flex-start' },
});
