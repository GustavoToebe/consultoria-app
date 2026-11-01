import { Permitido } from '../../ui/Permitido';
import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { catalogoAlimentos, catalogoExercicios, gruposDoCatalogo, importarDoCatalogo, listarAlimentos, listarExercicios, type TipoBiblioteca } from '../../api/rotas';
import { CREDITOS_CATALOGO, passosDasInstrucoes, resumoNutrientes, textoMostrando } from '../../dominio/catalogo';
import { textoDosFatores } from '../../dominio/fatoresDoAlimento';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { CaixaDaLinha, LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { MODALIDADES } from '../../dominio/modalidades';
import { normalizar } from '../treino/FolhaBiblioteca';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { marcadosExistentes } from '../../dominio/selecaoMultiplaSuspensa';
import { BarraDaBiblioteca } from './BarraDaBiblioteca';

interface ItemCatalogo {
  id: string;
  nome: string;
  detalhe: string;
  /** Passos de execução (só exercícios; a fonte já vem em português). */
  passos: string[];
  /** Fotos do catálogo (`<id>/0.jpg`); vazio nos alimentos. */
  imagens: string[];
  /** "FC 1,75" quando o catálogo de alimentos traz fator; vazio nos exercícios. */
  fatores: string | null;
  /** Citação curta dos fatores do alimento. */
  fonteFatores: string | null;
}

interface ListaCatalogo {
  itens: ItemCatalogo[];
  total: number;
}

/** Catálogo público (só leitura): marcar vários e importar para a biblioteca da consultoria. */
export function AbaCatalogo() {
  const { marcaTexto } = useTema();
  const { avisar } = useAviso();
  const [tipo, setTipo] = useState<TipoBiblioteca>('exercicios');
  const [busca, setBusca] = useState('');
  const [gruposMarcados, setGruposMarcados] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const termo = useAtrasado(busca.trim(), 300);
  const grupos = useCarregar(`catalogo-grupos:${tipo}`, () => gruposDoCatalogo(tipo));
  const opcoesDeGrupo = (grupos.dados ?? []).map((g) => ({ valor: g, rotulo: g }));
  // Só vale o que a lista de grupos do tipo atual ainda tem (trocar Exercícios/Alimentos não deixa filtro escondido).
  const gruposDoFiltro = [...marcadosExistentes(opcoesDeGrupo, gruposMarcados)].sort();
  const { dados, erro, carregando, recarregar } = useCarregar(
    `catalogo:${tipo}:${gruposDoFiltro.join('|')}:${termo}`,
    async (): Promise<ListaCatalogo> => {
      if (tipo === 'exercicios') {
        const r = await catalogoExercicios(termo, gruposDoFiltro);
        return {
          total: r.total,
          itens: r.itens.map((e) => ({
            id: e.id,
            nome: e.nome,
            // Sem repetir ("Peso corporal · Abdômen · Peso corporal": modalidade e equipamento iguais).
            detalhe: [...new Set([MODALIDADES[e.modalidade] ?? e.modalidade, e.grupoMuscular, e.equipamento].filter(Boolean))].join(' · '),
            passos: passosDasInstrucoes(e.instrucoes),
            imagens: e.imagens,
            fatores: null,
            fonteFatores: null,
          })),
        };
      }
      const r = await catalogoAlimentos(termo, gruposDoFiltro);
      return {
        total: r.total,
        itens: r.itens.map((a) => ({
          id: a.id,
          nome: a.nome,
          detalhe: [a.grupo, resumoNutrientes(a)].filter(Boolean).join(' · '),
          passos: [],
          imagens: [],
          fatores: textoDosFatores(a),
          fonteFatores: a.fonteFatores,
        })),
      };
    },
  );

  // O que já está na biblioteca (mesmo nome, como a importação compara) aparece marcado e não se escolhe de novo.
  const daBiblioteca = useCarregar(tipo === 'exercicios' ? 'biblioteca-exercicios' : 'biblioteca-alimentos', (): Promise<{ nome: string }[]> => tipo === 'exercicios' ? listarExercicios() : listarAlimentos());
  const nomesNaBiblioteca = new Set((daBiblioteca.dados ?? []).map((x) => normalizar(x.nome.trim())));
  const alternar = (id: string) =>
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const importar = () => {
    setImportando(true);
    importarDoCatalogo(tipo, [...marcados]).then(
      (r) => {
        setImportando(false);
        setMarcados(new Set());
        daBiblioteca.recarregar();
        avisar(`${r.importados} importado(s)${r.ignorados ? `, ${r.ignorados} já estava(m) na biblioteca` : ''}.`, 'sucesso');
      },
      (e: unknown) => {
        setImportando(false);
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  return (
    <Cartao
      titulo="Catálogo público"
      descricao="Só leitura. Marque o que quer e importe para a sua biblioteca; os que já estão nela (mesmo nome) são ignorados."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><Botao
        rotulo={`Importar selecionados (${marcados.size})`}
        Icone={Download}
        carregando={importando}
        desabilitado={marcados.size === 0}
        aoTocar={importar}
      /></Permitido>}>
      <Escolha
        descricao="Catálogo"
        opcoes={[
          { valor: 'exercicios', rotulo: 'Exercícios' },
          { valor: 'alimentos', rotulo: 'Alimentos' },
        ]}
        valor={tipo}
        aoMudar={(t) => {
          setTipo(t);
          setGruposMarcados(new Set());
          setAberto(null);
          setMarcados(new Set());
        }}
      />
      <BarraDaBiblioteca rotulo="Buscar no catálogo" placeholder={tipo === 'exercicios' ? 'Nome do exercício' : 'Nome do alimento'} valor={busca} aoMudar={setBusca}
        filtro={opcoesDeGrupo.length ? { tipo: 'varias', rotulo: 'Grupo', rotuloDeTodos: 'Todos', opcoes: opcoesDeGrupo, marcados: new Set(gruposDoFiltro), aoMudar: setGruposMarcados } : null} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? <Vazio titulo="Nenhum resultado no catálogo" texto="Tente outro nome ou ajuste o filtro de grupo." /> : null}
      {dados && dados.itens.length > 0 ? <ListaDeLinhas>{dados.itens.map((item) => {
        const sel = marcados.has(item.id);
        const expandido = aberto === item.id;
        const jaTem = nomesNaBiblioteca.has(normalizar(item.nome.trim()));
        const fatores = [item.fatores, item.fonteFatores].filter(Boolean).join(' · ');
        return (
          <LinhaDaLista key={item.id} titulo={item.nome} metadados={item.detalhe} descricao={fatores || undefined}
            selos={jaTem ? [{ texto: 'Já na biblioteca', tipo: 'neutro' }] : undefined}
            marcado={sel} esmaecido={jaTem}
            // A foto é irmã (não filha) da caixa e do toque que marca: tocar nela só amplia.
            inicio={<View style={estilos.inicio}>
              <CaixaDaLinha rotulo={jaTem ? `${item.nome}, já na biblioteca` : item.nome} marcado={sel} desabilitado={jaTem} aoMudar={() => alternar(item.id)} />
              {/* Exercício sem foto reserva a caixa (ícone), para o título alinhar com os que têm; alimento não tem miniatura. */}
              {tipo === 'exercicios' ? <DemonstracaoDoExercicio exercicioId={null} nome={item.nome} imagens={item.imagens} papel="EQUIPE" largura={56} altura={56} preencher ampliavel reservarEspaco /> : null}
            </View>}
            aoTocarTextos={jaTem ? undefined : () => alternar(item.id)}
            acoes={item.passos.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: expandido }}
                accessibilityLabel={`${expandido ? 'Esconder' : 'Ver'} instruções de ${item.nome}`}
                onPress={() => setAberto(expandido ? null : item.id)}
                style={estilos.verInstrucoes}>
                <Texto variante="pequeno" cor={marcaTexto}>{expandido ? 'Esconder instruções' : 'Ver instruções'}</Texto>
              </Pressable>
            ) : undefined}>
            {expandido ? (
              <View style={estilos.passos}>
                {item.passos.map((p, i) => (
                  <Texto key={i} variante="pequeno">{`${i + 1}. ${p}`}</Texto>
                ))}
              </View>
            ) : null}
          </LinhaDaLista>
        );
      })}</ListaDeLinhas> : null}
      {dados && textoMostrando(dados.itens.length, dados.total) ? (
        <Texto variante="pequeno" accessibilityLiveRegion="polite">{textoMostrando(dados.itens.length, dados.total)}</Texto>
      ) : null}
      <View style={estilos.creditos}>
        <Texto variante="suave">{tipo === 'alimentos' ? CREDITOS_CATALOGO.alimentos : CREDITOS_CATALOGO.exercicios}</Texto>
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  inicio: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  verInstrucoes: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1) },
  passos: { gap: espaco(0.5), paddingHorizontal: espaco(1.5), paddingBottom: espaco(1.5) },
  creditos: { marginTop: espaco(2) },
  /** O seletor nasce com alignSelf flex-start; na barra (alinhada pela base) ele subia e ficava fora do lugar. */
});
