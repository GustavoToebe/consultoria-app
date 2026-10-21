import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

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
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
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
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Permitido } from '../../ui/Permitido';
import { Texto } from '../../ui/Texto';
import { BarraDaBiblioteca, FiltroDaBiblioteca } from './BarraDaBiblioteca';
import { useCarregar } from '../../ui/useCarregar';

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
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_MENU_LATERAL;

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
        <BarraDaBiblioteca rotulo="Buscar em Outros" placeholder="Nome, princípio ativo ou categoria" valor={busca} aoMudar={setBusca}>
          {categorias.length ? <FiltroDaBiblioteca rotulo="Categoria" valor={categoria} aoMudar={setCategoria}
            opcoes={[{ valor: '', rotulo: 'Todas' }, ...categorias.map((c) => ({ valor: c, rotulo: c }))]} /> : null}
        </BarraDaBiblioteca>
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
          {largo ? <TitulosDasColunas /> : null}
          {g.itens.map((e) => (
            <LinhaDeErgogenico key={e.id} item={e} largo={largo} aoEditar={() => setEditando(e)} />
          ))}
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

function TitulosDasColunas() {
  const { cores } = useTema();
  return (
    <View style={[estilos.titulos, { borderColor: cores.divisor }]}>
      <Texto variante="rotulo" style={estilos.colNome}>Nome / Princípio ativo</Texto>
      <Texto variante="rotulo" style={estilos.colValor}>Concentração</Texto>
      <Texto variante="rotulo" style={estilos.colValor}>Apresentação</Texto>
      <View style={estilos.colAcao} />
    </View>
  );
}

function LinhaDeErgogenico({ item, largo, aoEditar }: { item: ErgogenicoDaBiblioteca; largo: boolean; aoEditar: () => void }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.linha, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      {largo ? (
        <>
          <Texto style={estilos.colNome}>{nomeEPrincipio(item)}</Texto>
          <Texto numerico style={estilos.colValor}>{textoOuTraco(item.concentracao)}</Texto>
          <Texto numerico style={estilos.colValor}>{textoOuTraco(item.apresentacao)}</Texto>
        </>
      ) : (
        <View style={estilos.empilhado}>
          <Texto variante="bloco">{nomeEPrincipio(item)}</Texto>
          <Texto variante="suave" numerico>Concentração: {textoOuTraco(item.concentracao)}</Texto>
          <Texto variante="suave" numerico>Apresentação: {textoOuTraco(item.apresentacao)}</Texto>
        </View>
      )}
      <View style={estilos.colAcao}>
        <Permitido codigo="ERGOGENICO_ALTERAR"><IconeBotao Icone={Pencil} rotulo={`Editar ${item.nome}`} aoTocar={aoEditar} /></Permitido>
      </View>
    </View>
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
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!completo} />
        </>
      }>
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
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={120} />
      <Campo rotulo="Princípio ativo (opcional)" valor={principio} aoMudar={setPrincipio} erro={campos.principioAtivo} maxLength={160} />
      <Campo rotulo="Concentração (opcional)" valor={concentracao} aoMudar={setConcentracao} erro={campos.concentracao} maxLength={40}
        ajuda="Como está na embalagem, por exemplo “200 mg/ml”." />
      <Campo rotulo="Apresentação (opcional)" valor={apresentacao} aoMudar={setApresentacao} erro={campos.apresentacao} maxLength={40}
        ajuda="Por exemplo “10 ml” ou “50 caps”." />
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} erro={campos.observacao} maxLength={500} linhas={3} />
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {inicial && aoTirar ? <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  busca: { flex: 1, minWidth: 220, maxWidth: 480 },
  titulos: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), paddingHorizontal: espaco(1.5), paddingBottom: espaco(0.75), borderBottomWidth: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, paddingLeft: espaco(1.5), paddingVertical: 2, minHeight: 48 },
  empilhado: { flex: 1, gap: 2, paddingVertical: espaco(0.75) },
  colNome: { flex: 3, minWidth: 0 },
  colValor: { flex: 1.2, minWidth: 0 },
  colAcao: { width: 48, alignItems: 'flex-end' },
});
