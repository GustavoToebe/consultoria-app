package br.com.treinos.api.importacao;

import br.com.treinos.api.importacao.ImportacaoDtos.Sugestao;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.completa.Campo;
import br.com.treinos.api.importacao.completa.CasamentoDeNomes;
import br.com.treinos.api.importacao.completa.FormatoDoConteudo;
import br.com.treinos.api.importacao.completa.Normalizacao;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Regra pura (sem banco, sem relógio) que sugere o mapeamento de colunas da importação de uma aba e acha a linha do
 * cabeçalho. Só lê títulos: nunca devolve valor de célula. Os campos e ids são os de {@code ImportacaoService.CAMPOS} (os
 * mesmos ids de {@code app/src/dominio/mapeamentoDaImportacao.ts}). Os sinônimos dos conceitos que a planilha completa também
 * lê vêm do dicionário único ({@link Campo}); aqui ficam só o id, o rótulo e o que é próprio do destino. O app usa as
 * sugestões que {@code /colunas} devolve. Texto comparado sem acento, caixa nem pontuação.
 */
public final class SugestaoDeColunas {

    /** Da mais fraca para a mais forte (a ordem do enum decide o desempate). */
    enum Confianca { PARECIDA, SINONIMO, EXATA }

    private record Casamento(Confianca confianca, int pontos) {
    }

    private static final Set<String> SEM_SENTIDO = Set.of("de", "do", "da", "dos", "das", "em", "no", "na");
    /** O cabeçalho é procurado entre as primeiras linhas do arquivo (o teto de {@code linhaDoCabecalho}). */
    private static final int LINHAS_PROCURADAS = ConfiguracaoDaImportacao.LINHA_DO_CABECALHO_MAXIMA;

    /** {@code termos}: id, rótulo e sinônimos, em palavras (sem as de ligação); os dois primeiros valem como EXATA. */
    private record CampoDoDestino(String id, List<List<String>> termos) {
        Casamento casar(String titulo) {
            List<String> p = palavras(titulo);
            if (p.isEmpty()) {
                return null;
            }
            String compacto = String.join("", p);
            Casamento melhor = null;
            for (int i = 0; i < termos.size(); i++) {
                List<String> t = termos.get(i);
                if (t.isEmpty()) {
                    continue;
                }
                Casamento c = null;
                if (compacto.equals(String.join("", t))) {
                    c = i < 2 ? new Casamento(Confianca.EXATA, 100) : new Casamento(Confianca.SINONIMO, t.size() * 10 + 5);
                } else if (t.size() >= 2 && contemEmSequencia(p, t)) {
                    c = new Casamento(Confianca.SINONIMO, t.size() * 10);
                }
                melhor = melhorDe(melhor, c);
            }
            if (melhor != null) {
                return melhor;
            }
            for (List<String> t : termos) {
                String tc = String.join("", t);
                // A mesma letra inicial evita "Idade" virar "cidade".
                if (compacto.length() >= 5 && tc.length() >= 5 && compacto.charAt(0) == tc.charAt(0) && CasamentoDeNomes.distanciaDeEdicao(compacto, tc) <= 2) {
                    melhor = melhorDe(melhor, new Casamento(Confianca.PARECIDA, 10 - CasamentoDeNomes.distanciaDeEdicao(compacto, tc)));
                } else if (!t.isEmpty() && p.containsAll(t)) {
                    // Todas as palavras do campo no título, em qualquer ordem ("Nome do responsável" contém "responsável").
                    melhor = melhorDe(melhor, new Casamento(Confianca.PARECIDA, 9));
                }
            }
            return melhor;
        }
    }

    private static final Map<String, List<CampoDoDestino>> CAMPOS = new LinkedHashMap<>();

    private static void destino(String id, CampoDoDestino... campos) {
        CAMPOS.put(id, List.of(campos));
    }

    private static CampoDoDestino c(String id, String rotulo, String... sinonimos) {
        List<List<String>> termos = new ArrayList<>();
        termos.add(palavras(id));
        termos.add(palavras(rotulo));
        for (String s : sinonimos) {
            termos.add(palavras(s));
        }
        return new CampoDoDestino(id, List.copyOf(termos));
    }

    /** Campo do destino que é um conceito do dicionário ({@link Campo}): os sinônimos de lá, mais os só deste destino. */
    private static CampoDoDestino c(String id, String rotulo, List<Campo> conceitos, String... sinonimos) {
        List<List<String>> termos = new ArrayList<>(c(id, rotulo, sinonimos).termos());
        for (Campo conceito : conceitos) {
            conceito.sinonimos().forEach(s -> termos.add(palavras(String.join(" ", s))));
        }
        return new CampoDoDestino(id, List.copyOf(termos));
    }

    static {
        destino("alunos",
                c("nome", "Nome", List.of(Campo.ALUNO)),
                c("email", "E-mail", List.of(Campo.EMAIL)),
                c("telefone", "Telefone", List.of(Campo.TELEFONE)),
                c("cpf", "CPF", "documento"),
                c("objetivo", "Objetivo", List.of(Campo.OBJETIVO)),
                c("observacoes", "Observações", List.of(Campo.OBSERVACAO)),
                c("cep", "CEP"),
                c("logradouro", "Logradouro", "rua", "endereco"),
                c("numero", "Número", "num"),
                c("complemento", "Complemento"),
                c("bairro", "Bairro"),
                c("cidade", "Cidade"),
                c("uf", "UF", "estado"),
                c("responsavel", "Responsável", "email responsavel", "e mail responsavel"),
                c("dias", "Dias", "dias de atualizacao", "dias atualizacao", "ciclo"),
                c("situacao", "Situação", List.of(Campo.STATUS, Campo.ATIVO)),
                c("nascimento", "Data de nascimento", "dt nascimento", "data nasc", "dt nasc", "nasc"),
                c("sexo", "Sexo", "genero"));
        destino("pesos",
                // E-mail e CPF identificam o aluno só aqui (a chave da importação de pesos).
                c("aluno", "Aluno", List.of(Campo.ALUNO, Campo.EMAIL), "cpf"),
                c("data", "Data", List.of(Campo.DATA)),
                c("peso", "Peso", List.of(Campo.PESO)),
                c("observacao", "Observação", List.of(Campo.OBSERVACAO)));
        destino("exercicios",
                c("nome", "Nome", List.of(Campo.EXERCICIO)),
                c("grupo", "Grupo", List.of(Campo.GRUPO_MUSCULAR)),
                c("equipamento", "Equipamento", "equipamentos", "aparelho", "maquina"),
                c("modalidade", "Modalidade", "modalidades"),
                c("video", "Vídeo", List.of(Campo.VIDEO)),
                c("observacoes", "Observações", List.of(Campo.OBSERVACAO)));
        destino("alimentos",
                // "Descrição" sozinha é o alimento só aqui: na planilha completa ela pode ser de qualquer coisa.
                c("nome", "Nome", List.of(Campo.ALIMENTO), "descricao"),
                c("quantidade", "Quantidade", List.of(Campo.QUANTIDADE), "quantidade base", "base"),
                c("unidade", "Unidade", List.of(Campo.UNIDADE)),
                c("kcal", "Kcal", List.of(Campo.KCAL)),
                c("proteina", "Proteína", List.of(Campo.PROTEINA)),
                c("carboidrato", "Carboidrato", List.of(Campo.CARBOIDRATO)),
                c("gordura", "Gordura", List.of(Campo.GORDURA)),
                c("fibra", "Fibra", "fibras", "fibra g", "fibra alimentar"),
                c("gramas", "Gramas", "gramas por unidade", "g por unidade"),
                c("fonte", "Fonte"),
                c("fc", "FC", "fator de correcao", "fator correcao"),
                c("fcc", "FCc", "fator de coccao", "fator coccao"),
                c("grupo", "Grupo", "grupo do alimento", "categoria"));
        destino("suplementos",
                c("nome", "Nome", "suplemento", "produto"),
                c("marca", "Marca", "marcas", "fabricante"),
                c("categoria", "Categoria"),
                c("porcao", "Porção", "tamanho da porcao"),
                c("porcoes", "Porções", "porcoes por embalagem", "doses"),
                c("sabores", "Sabores", "sabor"),
                c("link", "Link", "url", "site"),
                c("cupom", "Cupom", "cupom de desconto", "codigo cupom"));
        destino("outros",
                c("nome", "Nome", "item", "medicamento", "ergogenico", "substancia"),
                c("categoria", "Categoria"),
                c("principio", "Princípio", "principio ativo"),
                c("concentracao", "Concentração", "dosagem"),
                c("apresentacao", "Apresentação"),
                c("observacao", "Observação", List.of(Campo.OBSERVACAO)));
    }

    private SugestaoDeColunas() {
    }

    /**
     * Um campo por coluna e uma coluna por campo; vale a maior confiança (EXATA, SINONIMO, PARECIDA) e, nela, o sinônimo
     * mais longo. {@code titulos}: o cabeçalho, célula vazia = "". Destino desconhecido = nenhuma sugestão.
     */
    public static List<Sugestao> sugerir(String destino, List<String> titulos) {
        List<CampoDoDestino> campos = CAMPOS.getOrDefault(destino, List.of());
        record Candidata(int campo, int coluna, Casamento casamento) {
        }
        List<Candidata> candidatas = new ArrayList<>();
        for (int ca = 0; ca < campos.size(); ca++) {
            for (int co = 0; co < titulos.size(); co++) {
                Casamento m = campos.get(ca).casar(titulos.get(co));
                if (m != null) {
                    candidatas.add(new Candidata(ca, co, m));
                }
            }
        }
        candidatas.sort(Comparator.<Candidata, Confianca>comparing(x -> x.casamento().confianca()).reversed()
                .thenComparing(x -> x.casamento().pontos(), Comparator.reverseOrder())
                .thenComparingInt(Candidata::campo).thenComparingInt(Candidata::coluna));
        Set<Integer> camposUsados = new HashSet<>();
        Set<Integer> colunasUsadas = new HashSet<>();
        List<Candidata> aceitas = new ArrayList<>();
        for (Candidata x : candidatas) {
            if (!camposUsados.contains(x.campo()) && !colunasUsadas.contains(x.coluna())) {
                camposUsados.add(x.campo());
                colunasUsadas.add(x.coluna());
                aceitas.add(x);
            }
        }
        aceitas.sort(Comparator.comparingInt(Candidata::campo));
        return aceitas.stream()
                .map(a -> new Sugestao(campos.get(a.campo()).id(), a.coluna(), a.casamento().confianca().name())).toList();
    }

    /**
     * O número, no arquivo, da linha que mais parece cabeçalho entre as {@value #LINHAS_PROCURADAS} primeiras (0 = sem
     * cabeçalho): a de mais células de texto que são nome de campo do destino (EXATA ou SINONIMO; destino nulo vale qualquer
     * um), com ao menos duas, e a primeira em empate; senão a primeira com duas ou mais células e nenhuma com cara de dado
     * (e-mail, data, telefone, número; título como "C1" ou "#" vale); senão a primeira linha, se também não tem cara de dado.
     */
    public static int detectarCabecalho(List<Linha> linhas, String destino) {
        int melhor = 0;
        int pontos = 0;
        for (Linha l : linhas) {
            if (l.numero() > LINHAS_PROCURADAS) {
                break;
            }
            int p = pontosDaLinha(l, destino);
            if (p > pontos) {
                pontos = p;
                melhor = l.numero();
            }
        }
        if (pontos >= 2) {
            return melhor;
        }
        for (Linha l : linhas) {
            if (l.numero() > LINHAS_PROCURADAS) {
                break;
            }
            long preenchidas = l.celulas().stream().filter(x -> !x.texto().isBlank() || x.erro()).count();
            if (preenchidas >= 2 && semDado(l)) {
                return l.numero();
            }
        }
        // Sem nada reconhecido (uma coluna só, títulos como "#" ou "%"), a primeira linha vale se não tem cara de dado.
        return !linhas.isEmpty() && linhas.getFirst().numero() <= LINHAS_PROCURADAS && semDado(linhas.getFirst())
                ? linhas.getFirst().numero() : 0;
    }

    /** Nenhuma célula com cara de dado (e-mail, telefone, data, número…); código como "C1" vale como título. */
    private static boolean semDado(Linha l) {
        return l.celulas().stream().noneMatch(x -> FormatoDoConteudo.de(x).dado() && FormatoDoConteudo.de(x) != FormatoDoConteudo.CODIGO);
    }

    /**
     * O destino de uma aba que a planilha completa não reconhece: o que casa mais campos com o cabeçalho (ao menos dois, e sem
     * empate), ou nulo.
     */
    public static String destinoPeloCabecalho(List<Linha> linhas) {
        int cabecalho = detectarCabecalho(linhas, null);
        if (cabecalho == 0) {
            return null;
        }
        List<String> titulos = linhas.stream().filter(l -> l.numero() == cabecalho).findFirst().orElseThrow().celulas().stream()
                .map(Celula::texto).toList();
        String melhor = null;
        int pontos = 1;
        boolean empate = false;
        for (String d : CAMPOS.keySet()) {
            int n = sugerir(d, titulos).size();
            if (n > pontos) {
                pontos = n;
                melhor = d;
                empate = false;
            } else if (n == pontos && melhor != null) {
                empate = true;
            }
        }
        return empate ? null : melhor;
    }

    private static int pontosDaLinha(Linha l, String destino) {
        int n = 0;
        for (Celula x : l.celulas()) {
            if (ReconhecimentoDeAbas.pareceNomeDeColuna(x) && ehNomeDeCampo(x.texto(), destino)) {
                n++;
            }
        }
        return n;
    }

    private static boolean ehNomeDeCampo(String texto, String destino) {
        if (destino == null && ReconhecimentoDeAbas.campoDoNome(texto).isPresent()) {
            return true;
        }
        for (var e : CAMPOS.entrySet()) {
            if (destino != null && !e.getKey().equals(destino)) {
                continue;
            }
            for (CampoDoDestino campo : e.getValue()) {
                Casamento m = campo.casar(texto);
                if (m != null && m.confianca() != Confianca.PARECIDA) {
                    return true;
                }
            }
        }
        return false;
    }

    private static Casamento melhorDe(Casamento a, Casamento b) {
        if (b == null) {
            return a;
        }
        return a == null || b.pontos() > a.pontos() ? b : a;
    }

    private static List<String> palavras(String texto) {
        List<String> p = new ArrayList<>(Normalizacao.palavras(texto));
        p.removeIf(SEM_SENTIDO::contains);
        return p;
    }

    private static boolean contemEmSequencia(List<String> palavras, List<String> trecho) {
        if (trecho.size() > palavras.size()) {
            return false;
        }
        for (int i = 0; i + trecho.size() <= palavras.size(); i++) {
            if (palavras.subList(i, i + trecho.size()).equals(trecho)) {
                return true;
            }
        }
        return false;
    }
}
