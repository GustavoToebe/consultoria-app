import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarErgogenico, criarErgogenico, inativarErgogenico, listarErgogenicos } from '../../api/rotas';
import type { ErgogenicoDaBiblioteca, ErgogenicoDaBibliotecaRequest } from '../../api/tipos';
import {
  agruparErgogenicos,
  categoriasDosErgogenicos,
  filtrarErgogenicos,
  nomeEPrincipio,
  resumoDoGrupo,
  sugerirCategorias,
  textoOuTraco,
} from '../../dominio/ergogenicos';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Permitido } from '../../ui/Permitido';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { espaco } from '../../tema/tokens';
import { BarraDaBiblioteca } from './BarraDaBiblioteca';

// As medidas da `FolhaAlimento`: 180 px por campo deixa o par lado a lado na folha do PC (600) e empilhado no celular.
const estilos = StyleSheet.create({
  partes: { gap: espaco(3) },
  linhaDeCampos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(2) },
  campoLargo: { flexGrow: 1, flexBasis: 180 },
  tirar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  textoDoTirar: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
});

/**
 * Aba "Outros" da biblioteca: medicação, ergogênicos e o que mais o treinador registrar (dado sensível: a aba só existe
 * com ERGOGENICO_LER). Só o que está no rótulo: nome, princípio ativo, concentração e apresentação. O sistema não sugere
 * dose, não soma e não compara. A categoria é do treinador (texto livre): nada de grupos fixos na entrada.
 */
export function AbaErgogenicos() {
  const { avisar } = useAviso();
  const { dados, erro, carregando, recarregar } = useCarregar('biblioteca-ergogenicos', () => listarErgogenicos());
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [editando, setEditando] = useState<ErgogenicoDaBiblioteca | 'novo' | null>(null);
  const [inativar, setInativar] = useState<ErgogenicoDaBiblioteca | null>(null);
  const categorias = categoriasDosErgogenicos(dados ?? []);
  const grupos = agruparErgogenicos(filtrarErgogenicos(dados ?? [], busca, categoria));

  const confirmarInativar = () => {
    const alvo = inativar;
    setInativar(null);
    if (!alvo) return;
    inativarErgogenico(alvo.id).then(
      () => {
        avisar(`“${alvo.nome}” saiu da biblioteca.`, 'sucesso');
        recarregar();
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  return (
    <>
      <Cartao
        titulo="Outros"
        descricao="Medicação, ergogênicos e o que mais você quiser ter à mão, nas categorias que você criar. Só o que está no rótulo: dose, horário e prescrição quem escreve é você, na dieta do aluno."
        acoes={<Permitido codigo="ERGOGENICO_ALTERAR"><Botao rotulo="Novo item" Icone={Plus} aoTocar={() => setEditando('novo')} /></Permitido>}>
        <BarraDaBiblioteca rotulo="Buscar em Outros" placeholder="Nome, princípio ativo ou categoria" valor={busca} aoMudar={setBusca}
          filtro={categorias.length ? { tipo: 'uma', rotulo: 'Categoria', valor: categoria, todos: '', aoMudar: setCategoria,
            opcoes: [{ valor: '', rotulo: 'Todas' }, ...categorias.map((c) => ({ valor: c, rotulo: c }))] } : null} />
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
        {!dados && carregando ? <Esqueleto /> : null}
        {dados && grupos.length === 0 ? (
          <Vazio
            titulo={dados.length ? 'Nenhum item encontrado' : 'Biblioteca vazia'}
            texto={dados.length ? 'Tente outro termo ou outra categoria.' : 'Cadastre um item ou importe a lista pelo script de importação.'}
            acao={dados.length ? { rotulo: 'Limpar filtros', aoTocar: () => { setBusca(''); setCategoria(''); } } : undefined}
          />
        ) : null}
      </Cartao>
      {grupos.map((g) => (
        <Cartao key={g.categoria ?? ''} cabecalho={<CabecalhoDeGrupo titulo={g.rotulo} resumo={resumoDoGrupo(g.itens.length)} />}>
          {/* Uma superfície só, com divisórias entre os itens (sem caixa por registro): o cartão já é o contêiner. */}
          <ListaDeLinhas divisorias>{g.itens.map((e) => (
            <LinhaDaLista key={e.id} titulo={nomeEPrincipio(e)}
              metadados={`Concentração: ${textoOuTraco(e.concentracao)} · Apresentação: ${textoOuTraco(e.apresentacao)}`}
              acoesAoLado
              acoes={<Permitido codigo="ERGOGENICO_ALTERAR"><IconeBotao Icone={Pencil} moldura rotulo={`Editar ${e.nome}`} aoTocar={() => setEditando(e)} /></Permitido>} />
          ))}</ListaDeLinhas>
        </Cartao>
      ))}
      {editando ? (
        <FolhaErgogenico
          inicial={editando === 'novo' ? null : editando}
          categorias={categorias}
          aoTirar={editando === 'novo' ? undefined : () => { const alvo = editando; setEditando(null); setInativar(alvo); }}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
            avisar('Item salvo.', 'sucesso');
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={inativar !== null}
        titulo={`Tirar “${inativar?.nome ?? ''}” da biblioteca?`}
        mensagem="As dietas que já usam este item continuam com o que foi gravado nelas."
        rotuloConfirmar="Tirar da biblioteca"
        perigo
        aoConfirmar={confirmarInativar}
        aoCancelar={() => setInativar(null)}
      />
    </>
  );
}

function FolhaErgogenico({
  inicial,
  categorias,
  aoFechar,
  aoSalvar,
  aoTirar,
}: {
  aoTirar?: () => void;
  inicial: ErgogenicoDaBiblioteca | null;
  categorias: string[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '');
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [principio, setPrincipio] = useState(inicial?.principioAtivo ?? '');
  const [concentracao, setConcentracao] = useState(inicial?.concentracao ?? '');
  const [apresentacao, setApresentacao] = useState(inicial?.apresentacao ?? '');
  const [observacao, setObservacao] = useState(inicial?.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);
  const completo = nome.trim() !== '';
  const sugestoes = sugerirCategorias(categorias, categoria);

  const salvar = () => {
    if (!completo) return;
    const dados: ErgogenicoDaBibliotecaRequest = {
      categoria: categoria.trim() || null,
      nome: nome.trim(),
      principioAtivo: principio.trim() || null,
      concentracao: concentracao.trim() || null,
      apresentacao: apresentacao.trim() || null,
      observacao: observacao.trim() || null,
    };
    setSalvando(true);
    setErro(null);
    (inicial ? alterarErgogenico(inicial.id, dados) : criarErgogenico(dados)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={inicial ? 'Editar item' : 'Novo item'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!completo} motivo="Informe o nome." />
        </>
      }>
      {/* Mesma composição da `FolhaAlimento`: um cartão com faixa de título por assunto, 24 px entre eles. A categoria
          continua antes do nome: é por ela que a lista se agrupa. */}
      <View style={estilos.partes}>
        <Cartao titulo="Identificação" nivel={3}>
          <Campo
            rotulo="Categoria (opcional)"
            valor={categoria}
            aoMudar={setCategoria}
            erro={campos.categoria}
            maxLength={60}
            ajuda="Escreva o nome da categoria ou toque numa sugestão. Vazio fica em “Sem categoria”."
          />
          {sugestoes.length ? (
            <LinhaDeAcoes>
              {sugestoes.map((c) => (
                <Botao key={c} rotulo={c} tipo="secundario" aoTocar={() => setCategoria(c)} />
              ))}
            </LinhaDeAcoes>
          ) : null}
          <View style={estilos.linhaDeCampos}>
            <View style={estilos.campoLargo}>
              <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={120} />
            </View>
            <View style={estilos.campoLargo}>
              <Campo rotulo="Princípio ativo (opcional)" valor={principio} aoMudar={setPrincipio} erro={campos.principioAtivo} maxLength={160} />
            </View>
          </View>
        </Cartao>

        <Cartao titulo="Concentração e apresentação" nivel={3}>
          <View style={estilos.linhaDeCampos}>
            <View style={estilos.campoLargo}>
              <Campo rotulo="Concentração (opcional)" valor={concentracao} aoMudar={setConcentracao} erro={campos.concentracao} maxLength={40}
                ajuda="Como está na embalagem, por exemplo “200 mg/ml”." />
            </View>
            <View style={estilos.campoLargo}>
              <Campo rotulo="Apresentação (opcional)" valor={apresentacao} aoMudar={setApresentacao} erro={campos.apresentacao} maxLength={40}
                ajuda="Por exemplo “10 ml” ou “50 caps”." />
            </View>
          </View>
        </Cartao>

        <Cartao titulo="Observação" nivel={3}>
          <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} erro={campos.observacao} maxLength={500} linhas={3} />
        </Cartao>

        {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}

        {inicial && aoTirar ? (
          <Cartao>
            <View style={estilos.tirar}>
              <Texto variante="suave" style={estilos.textoDoTirar}>As dietas que já usam este item continuam com o que foi gravado nelas.</Texto>
              <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} />
            </View>
          </Cartao>
        ) : null}
      </View>
    </Folha>
  );
}
