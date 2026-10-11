import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarSuplemento, criarSuplemento, inativarSuplemento, listarSuplementos } from '../../api/rotas';
import type { SuplementoDaBiblioteca, SuplementoDaBibliotecaRequest } from '../../api/tipos';
import { erroDoLink, TAMANHO_MAXIMO_LINK } from '../../dominio/links';
import {
  categoriasDe,
  descricaoDaPorcao,
  filtrarSuplementos,
  marcaECategoria,
  saboresDoTexto,
  saboresParaCampo,
  saboresParaTela,
} from '../../dominio/suplementos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Grade } from '../../ui/Grade';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Permitido } from '../../ui/Permitido';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/** Suplementos da consultoria: nome, marca, categoria, porção, sabores e link do produto. Não somam nada na dieta. */
export function AbaSuplementos() {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const { dados, erro, carregando, recarregar } = useCarregar('biblioteca-suplementos', () => listarSuplementos());
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [editando, setEditando] = useState<SuplementoDaBiblioteca | 'novo' | null>(null);
  const [inativar, setInativar] = useState<SuplementoDaBiblioteca | null>(null);
  const lista = filtrarSuplementos(dados ?? [], busca, categoria);
  const categorias = categoriasDe(dados ?? []);

  const confirmarInativar = () => {
    const alvo = inativar;
    setInativar(null);
    if (!alvo) return;
    inativarSuplemento(alvo.id).then(
      () => {
        avisar(`“${alvo.nome}” saiu da biblioteca.`, 'sucesso');
        recarregar();
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  const abrir = (s: SuplementoDaBiblioteca) => {
    void abrirLinkExterno(s.link).then((ok) => {
      if (!ok) avisar('Não foi possível abrir o link.', 'perigo');
    });
  };

  return (
    <Cartao
      titulo="Suplementos da biblioteca"
      descricao="Os produtos que você escolhe na sugestão de suplementação da dieta. Só nome, porção e link: nada é somado."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><Botao rotulo="Novo suplemento" Icone={Plus} aoTocar={() => setEditando('novo')} /></Permitido>}>
      <View style={estilos.busca}>
        <Campo rotulo="Buscar suplemento" valor={busca} aoMudar={setBusca} />
      </View>
      {categorias.length ? (
        <Escolha
          descricao="Categoria"
          valor={categoria}
          aoMudar={setCategoria}
          opcoes={[{ valor: '', rotulo: 'Todas' }, ...categorias.map((c) => ({ valor: c, rotulo: c }))]}
        />
      ) : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && lista.length === 0 ? (
        <Vazio
          titulo={dados.length ? 'Nenhum suplemento encontrado' : 'Biblioteca de suplementos vazia'}
          texto={dados.length ? 'Tente outro termo ou outra categoria.' : 'Cadastre um suplemento ou importe a lista pelo script de importação.'}
          acao={dados.length
            ? { rotulo: 'Limpar filtros', aoTocar: () => { setBusca(''); setCategoria(''); } }
            : { rotulo: 'Cadastrar suplemento', aoTocar: () => setEditando('novo') }}
        />
      ) : null}
      <Grade gap={espaco(2)}>{lista.map((s) => (
        <View key={s.id} style={[estilos.linha, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
          <View style={estilos.dados}>
            <Texto variante="bloco">{s.nome}</Texto>
            <Texto variante="suave">{marcaECategoria(s)}</Texto>
            <Texto variante="suave" numerico>Porção: {descricaoDaPorcao(s)}</Texto>
            <Texto variante="suave">Sabores: {saboresParaTela(s)}</Texto>
            {s.link ? <Botao rotulo="Ver produto" tipo="secundario" Icone={ExternalLink} aoTocar={() => abrir(s)} /> : null}
          </View>
          <Permitido codigo="BIBLIOTECA_ALTERAR"><IconeBotao Icone={Pencil} rotulo={`Editar ${s.nome}`} aoTocar={() => setEditando(s)} /></Permitido>
        </View>
      ))}</Grade>
      {editando ? (
        <FolhaSuplemento
          inicial={editando === 'novo' ? null : editando}
          aoTirar={editando === 'novo' ? undefined : () => { const alvo = editando; setEditando(null); setInativar(alvo); }}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
            avisar('Suplemento salvo.', 'sucesso');
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={inativar !== null}
        titulo={`Tirar “${inativar?.nome ?? ''}” da biblioteca?`}
        mensagem="As dietas que já usam este suplemento continuam com o nome e o link gravados."
        rotuloConfirmar="Tirar da biblioteca"
        perigo
        aoConfirmar={confirmarInativar}
        aoCancelar={() => setInativar(null)}
      />
    </Cartao>
  );
}

function FolhaSuplemento({ inicial, aoFechar, aoSalvar, aoTirar }: { aoTirar?: () => void; inicial: SuplementoDaBiblioteca | null; aoFechar: () => void; aoSalvar: () => void }) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [marca, setMarca] = useState(inicial?.marca ?? '');
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '');
  const [porcao, setPorcao] = useState(inicial?.porcao ?? '');
  const [porcoes, setPorcoes] = useState(inicial?.porcoesPorEmbalagem ?? '');
  const [sabores, setSabores] = useState(saboresParaCampo(inicial?.sabores ?? []));
  const [link, setLink] = useState(inicial?.link ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);
  const erroLink = erroDoLink(link);
  const completo = nome.trim() !== '' && !erroLink;

  const salvar = () => {
    if (!completo) return;
    const dados: SuplementoDaBibliotecaRequest = {
      nome: nome.trim(),
      marca: marca.trim() || null,
      categoria: categoria.trim() || null,
      porcao: porcao.trim() || null,
      porcoesPorEmbalagem: porcoes.trim() || null,
      sabores: saboresDoTexto(sabores),
      link: link.trim() || null,
    };
    setSalvando(true);
    setErro(null);
    (inicial ? alterarSuplemento(inicial.id, dados) : criarSuplemento(dados)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={inicial ? 'Editar suplemento' : 'Novo suplemento'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!completo} />
        </>
      }>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={120} />
      <Campo rotulo="Marca (opcional)" valor={marca} aoMudar={setMarca} erro={campos.marca} maxLength={80} />
      <Campo rotulo="Categoria (opcional)" valor={categoria} aoMudar={setCategoria} erro={campos.categoria} maxLength={60}
        ajuda="Texto livre: Pré-treino, Creatina, Whey…" />
      <Campo rotulo="Porção (opcional)" valor={porcao} aoMudar={setPorcao} erro={campos.porcao} maxLength={80}
        ajuda="Como está no rótulo, por exemplo “1 dosador (3g)”." />
      <Campo rotulo="Porções por embalagem (opcional)" valor={porcoes} aoMudar={setPorcoes} erro={campos.porcoesPorEmbalagem} maxLength={40} />
      <Campo rotulo="Sabores (opcional)" valor={sabores} aoMudar={setSabores} erro={campos.sabores} ajuda="Separe por vírgula." />
      <Campo rotulo="Link do produto (opcional)" valor={link} aoMudar={setLink} erro={erroLink ?? campos.link}
        maxLength={TAMANHO_MAXIMO_LINK} autoCapitalize="none" autoCorrect={false} keyboardType="url"
        ajuda="Link https. Abre fora do app, sem login." />
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {inicial && aoTirar ? <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  busca: { flex: 1, minWidth: 220, maxWidth: 480 },
  linha: { flexGrow: 1, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: RAIO, paddingLeft: espaco(1.5), paddingVertical: 2 },
  dados: { flex: 1, gap: 2, paddingVertical: espaco(0.75), alignItems: 'flex-start' },
});
