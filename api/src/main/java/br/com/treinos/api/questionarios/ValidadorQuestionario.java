package br.com.treinos.api.questionarios;

import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Opcao;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Pergunta;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Secao;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

import static br.com.treinos.api.questionarios.TipoPergunta.DATA_AUTOMATICA;
import static br.com.treinos.api.questionarios.TipoPergunta.FOTOS;
import static br.com.treinos.api.questionarios.TipoPergunta.NOTA;
import static br.com.treinos.api.questionarios.TipoPergunta.NOTAS_POR_DIA;
import static br.com.treinos.api.questionarios.TipoPergunta.NUMERO;
import static br.com.treinos.api.questionarios.TipoPergunta.PESO;
import static br.com.treinos.api.questionarios.TipoPergunta.SIM_NAO;
import static br.com.treinos.api.questionarios.TipoPergunta.TEXTO;
import static br.com.treinos.api.questionarios.TipoPergunta.TEXTO_LONGO;
import static br.com.treinos.api.questionarios.TipoPergunta.ESCOLHA_UNICA;
import static br.com.treinos.api.questionarios.TipoPergunta.ACEITE;
import static br.com.treinos.api.questionarios.TipoPergunta.DATA;
import static br.com.treinos.api.questionarios.TipoPergunta.GRADE;
import static br.com.treinos.api.questionarios.TipoPergunta.INFORMATIVO;

/**
 * Regras de publicação do questionário (atualização e anamnese). Confere só a forma; nunca avalia se uma pergunta é
 * adequada. Os caminhos
 * ({@code secoes[0].perguntas[1].opcoes[2].rotulo}) e as regras são os mesmos de {@code errosDoQuestionario} em
 * {@code app/src/dominio/questionario.ts}: mudou uma regra, muda a outra (o teste de paridade confere os caminhos).
 */
@Component
public class ValidadorQuestionario {

    private static final Pattern ID = Pattern.compile(LimitesQuestionario.ID_PADRAO);
    private static final Pattern IMAGEM = Pattern.compile(LimitesQuestionario.IMAGEM_PADRAO);
    private static final Set<String> SIM_NAO_VALORES = Set.of("sim", "nao");
    private static final Set<TipoPergunta> COM_DESTAQUE = EnumSet.of(NOTA, NUMERO, SIM_NAO, ESCOLHA_UNICA);
    private static final Set<TipoPergunta> COM_AJUDA_AUTOMATICA = EnumSet.of(TEXTO, NUMERO);
    private static final Set<TipoPergunta> UNICOS = EnumSet.of(PESO, DATA_AUTOMATICA, FOTOS);

    /** Questionário de atualização (o de sempre). */
    public ResultadoValidacao validar(ConteudoQuestionario conteudo) {
        return validar(conteudo, Finalidade.ATUALIZACAO);
    }

    public ResultadoValidacao validar(ConteudoQuestionario conteudo, Finalidade finalidade) {
        ResultadoValidacao.Coletor c = new ResultadoValidacao.Coletor();
        instrucoes(c, conteudo.instrucoes() == null ? List.of() : conteudo.instrucoes());
        List<Secao> secoes = conteudo.secoes() == null ? List.of() : conteudo.secoes();
        if (secoes.isEmpty()) {
            c.erro("secoes", "O questionário não tem nenhuma seção.");
        }
        if (secoes.size() > LimitesQuestionario.SECOES) {
            c.erro("secoes", "Seções demais.");
        }
        Estado estado = new Estado(finalidade == null ? Finalidade.ATUALIZACAO : finalidade);
        Set<String> uids = new HashSet<>();
        for (int i = 0; i < secoes.size(); i++) {
            secao(c, estado, uids, secoes.get(i), "secoes[" + i + "]");
        }
        if (estado.total > LimitesQuestionario.PERGUNTAS_TOTAL) {
            c.erro("secoes", "Perguntas demais.");
        }
        if (estado.capacidadeDeTexto > LimitesQuestionario.CAPACIDADE_DE_TEXTO_TOTAL) {
            c.erro("secoes", "Respostas de texto demais.");
        }
        if (estado.finalidade == Finalidade.ATUALIZACAO && estado.total > 0 && !estado.tipos.contains(PESO)) {
            c.aviso("secoes", "Sem pergunta de peso: o peso não será registrado.");
        }
        return c.resultado();
    }

    /** Ids cujo tipo difere do que já foi publicado: o tipo de um id não muda entre versões. */
    public static Set<String> tiposQueMudaram(ConteudoQuestionario atual, List<ConteudoQuestionario> publicadas) {
        Map<String, TipoPergunta> antigos = new HashMap<>();
        for (ConteudoQuestionario v : publicadas) {
            perguntas(v).forEach(p -> antigos.putIfAbsent(p.id(), p.tipo()));
        }
        Set<String> mudaram = new TreeSet<>();
        perguntas(atual).forEach(p -> {
            TipoPergunta antigo = antigos.get(p.id());
            if (antigo != null && antigo != p.tipo()) {
                mudaram.add(p.id());
            }
        });
        return mudaram;
    }

    public static boolean excedeTamanhoDoRascunho(String json) {
        return json.getBytes(StandardCharsets.UTF_8).length > LimitesQuestionario.RASCUNHO_BYTES;
    }

    private static List<Pergunta> perguntas(ConteudoQuestionario c) {
        if (c.secoes() == null) {
            return List.of();
        }
        return c.secoes().stream().filter(s -> s.perguntas() != null).flatMap(s -> s.perguntas().stream())
                .filter(p -> p.id() != null && p.tipo() != null).toList();
    }

    /** Contadores e registros que atravessam as seções. */
    private static final class Estado {
        final Finalidade finalidade;
        /** Perguntas já vistas, na ordem do formulário: a condição só aponta para uma delas. */
        final Map<String, Pergunta> anteriores = new HashMap<>();
        int total;
        int destaques;
        int capacidadeDeTexto;
        final Set<String> ids = new HashSet<>();
        final Set<TipoPergunta> tipos = EnumSet.noneOf(TipoPergunta.class);

        Estado(Finalidade finalidade) {
            this.finalidade = finalidade;
        }
    }

    private static void instrucoes(ResultadoValidacao.Coletor c, List<String> instrucoes) {
        if (instrucoes.size() > LimitesQuestionario.INSTRUCOES) {
            c.erro("instrucoes", "Instruções demais.");
        }
        for (int k = 0; k < instrucoes.size(); k++) {
            String texto = instrucoes.get(k);
            if (texto == null || texto.isBlank()) {
                c.erro("instrucoes[" + k + "]", "Instrução vazia.");
            } else if (texto.length() > LimitesQuestionario.INSTRUCAO_TAMANHO) {
                c.erro("instrucoes[" + k + "]", "Instrução longa demais.");
            }
        }
    }

    private static void secao(ResultadoValidacao.Coletor c, Estado estado, Set<String> uids, Secao s, String cs) {
        if (!idValido(s.uid())) {
            c.erro(cs + ".uid", "Falta o identificador.");
        } else if (!uids.add(s.uid())) {
            c.erro(cs + ".uid", "Identificador repetido.");
        }
        if (s.titulo() == null || s.titulo().isBlank()) {
            c.erro(cs + ".titulo", "Seção sem título.");
        } else if (s.titulo().length() > LimitesQuestionario.TITULO_TAMANHO) {
            c.erro(cs + ".titulo", "Título longo demais.");
        }
        condicao(c, estado, s.mostrarSe(), cs);
        List<Pergunta> perguntas = s.perguntas() == null ? List.of() : s.perguntas();
        if (perguntas.isEmpty()) {
            c.erro(cs + ".perguntas", "Seção sem pergunta.");
        }
        if (perguntas.size() > LimitesQuestionario.PERGUNTAS_POR_SECAO) {
            c.erro(cs + ".perguntas", "Perguntas demais na seção.");
        }
        for (int j = 0; j < perguntas.size(); j++) {
            pergunta(c, estado, perguntas.get(j), cs + ".perguntas[" + j + "]");
        }
    }

    private static void pergunta(ResultadoValidacao.Coletor c, Estado estado, Pergunta p, String cp) {
        estado.total++;
        if (!idValido(p.id())) {
            c.erro(cp + ".id", "Falta o identificador.");
        } else if (!estado.ids.add(p.id())) {
            c.erro(cp + ".id", "Identificador repetido.");
        }
        if (p.rotulo() == null || p.rotulo().isBlank()) {
            c.erro(cp + ".rotulo", "Pergunta sem texto.");
        } else if (p.rotulo().length() > LimitesQuestionario.ROTULO_TAMANHO) {
            c.erro(cp + ".rotulo", "Texto longo demais.");
        }
        if (p.ajuda() != null && p.ajuda().length() > LimitesQuestionario.AJUDA_TAMANHO) {
            c.erro(cp + ".ajuda", "Ajuda longa demais.");
        }
        if (p.imagemId() != null && !IMAGEM.matcher(p.imagemId()).matches()) {
            c.erro(cp + ".imagemId", "Imagem inválida.");
        }
        condicao(c, estado, p.mostrarSe(), cp);
        TipoPergunta tipo = p.tipo();
        if (tipo == null) {
            c.erro(cp + ".tipo", "Falta o tipo.");
            return;
        }
        if (p.id() != null) {
            estado.anteriores.putIfAbsent(p.id(), p);
        }
        if (estado.finalidade == Finalidade.ANAMNESE && tipo == DATA_AUTOMATICA) {
            c.erro(cp + ".tipo", "Este tipo só vale no questionário de atualização.");
        }
        if (UNICOS.contains(tipo) && !estado.tipos.add(tipo)) {
            c.erro(cp + ".tipo", "Este tipo só pode aparecer uma vez.");
        }
        estado.tipos.add(tipo);
        if (tipo == TEXTO) {
            estado.capacidadeDeTexto += LimitesQuestionario.TEXTO_CURTO_CAPACIDADE;
        } else if (tipo == TEXTO_LONGO) {
            estado.capacidadeDeTexto += LimitesQuestionario.TEXTO_LONGO_CAPACIDADE;
        }
        opcoes(c, p, cp);
        dias(c, p, cp);
        numero(c, p, cp);
        destaque(c, estado, p, cp);
        if (p.ajudaAutomatica() != null && !COM_AJUDA_AUTOMATICA.contains(tipo)) {
            c.erro(cp + ".ajudaAutomatica", "Este tipo não tem ajuda automática.");
        } else if (p.ajudaAutomatica() != null && estado.finalidade == Finalidade.ANAMNESE) {
            c.erro(cp + ".ajudaAutomatica", "Esta ajuda só vale no questionário de atualização.");
        }
        if (p.somentePassado() != null && tipo != DATA) {
            c.erro(cp + ".somentePassado", "Este tipo não tem esta opção.");
        }
        textos(c, p, cp);
        grade(c, p, cp);
    }

    /** {@code texto} do ACEITE (obrigatório) e do INFORMATIVO (opcional); {@code declaracao} só do ACEITE (obrigatória). */
    private static void textos(ResultadoValidacao.Coletor c, Pergunta p, String cp) {
        boolean temTexto = p.tipo() == ACEITE || p.tipo() == INFORMATIVO;
        if (!temTexto) {
            if (p.texto() != null) {
                c.erro(cp + ".texto", "Este tipo não tem texto.");
            }
        } else if (p.tipo() == ACEITE && (p.texto() == null || p.texto().isBlank())) {
            c.erro(cp + ".texto", "Falta o texto.");
        } else if (p.texto() != null && p.texto().length() > LimitesQuestionario.TEXTO_INFORMATIVO_TAMANHO) {
            c.erro(cp + ".texto", "Texto longo demais.");
        }
        if (p.tipo() != ACEITE) {
            if (p.declaracao() != null) {
                c.erro(cp + ".declaracao", "Este tipo não tem declaração.");
            }
        } else if (p.declaracao() == null || p.declaracao().isBlank()) {
            c.erro(cp + ".declaracao", "Falta a frase de declaração.");
        } else if (p.declaracao().length() > LimitesQuestionario.DECLARACAO_TAMANHO) {
            c.erro(cp + ".declaracao", "Frase longa demais.");
        }
    }

    private static void grade(ResultadoValidacao.Coletor c, Pergunta p, String cp) {
        if (p.tipo() != GRADE) {
            if (p.linhas() != null) {
                c.erro(cp + ".linhas", "Este tipo não tem linhas.");
            }
            if (p.colunas() != null) {
                c.erro(cp + ".colunas", "Este tipo não tem colunas.");
            }
            return;
        }
        lista(c, p.linhas(), cp + ".linhas", LimitesQuestionario.LINHAS_MINIMO, LimitesQuestionario.LINHAS_MAXIMO, "linhas", false);
        lista(c, p.colunas(), cp + ".colunas", LimitesQuestionario.COLUNAS_MINIMO, LimitesQuestionario.COLUNAS_MAXIMO, "colunas", false);
    }

    /**
     * Condição simples: aponta para uma pergunta de escolha já vista (anterior na ordem do formulário) e lista respostas
     * que existem nela, sem repetir.
     */
    private static void condicao(ResultadoValidacao.Coletor c, Estado estado, ConteudoQuestionario.Condicao m, String base) {
        if (m == null) {
            return;
        }
        Pergunta alvo = m.perguntaId() == null ? null : estado.anteriores.get(m.perguntaId());
        if (alvo == null || alvo.tipo() == null || !alvo.tipo().controlaCondicao()) {
            c.erro(base + ".mostrarSe.perguntaId", "A condição precisa apontar para uma pergunta de escolha anterior.");
            return;
        }
        List<String> valores = m.valores() == null ? List.of() : m.valores();
        if (valores.isEmpty() || valores.size() > LimitesQuestionario.OPCOES_MAXIMO) {
            c.erro(base + ".mostrarSe.valores", "Escolha ao menos uma resposta para a condição.");
            return;
        }
        Set<String> validos = alvo.tipo() == TipoPergunta.SIM_NAO ? SIM_NAO_VALORES : new HashSet<>(
                alvo.opcoes() == null ? List.of() : alvo.opcoes().stream().map(Opcao::id).filter(java.util.Objects::nonNull).toList());
        Set<String> vistos = new HashSet<>();
        for (String v : valores) {
            if (v == null || !validos.contains(v) || !vistos.add(v)) {
                c.erro(base + ".mostrarSe.valores", "A condição tem uma resposta que não existe na pergunta.");
                return;
            }
        }
    }

    private static void opcoes(ResultadoValidacao.Coletor c, Pergunta p, String cp) {
        if (!p.tipo().temOpcoes()) {
            if (p.opcoes() != null) {
                c.erro(cp + ".opcoes", "Este tipo não tem opções.");
            }
            return;
        }
        lista(c, p.opcoes(), cp + ".opcoes", LimitesQuestionario.OPCOES_MINIMO, LimitesQuestionario.OPCOES_MAXIMO, "opções", true);
    }

    /** Opções de escolha, linhas e colunas da GRADE: mesma regra de quantidade, id e texto sem repetir. */
    private static void lista(ResultadoValidacao.Coletor c, List<Opcao> itens, String caminho, int minimo, int maximo,
                              String nome, boolean comImagem) {
        int n = itens == null ? 0 : itens.size();
        if (n < minimo || n > maximo) {
            c.erro(caminho, "Use de " + minimo + " a " + maximo + " " + nome + ".");
        }
        if (itens == null) {
            return;
        }
        Set<String> ids = new HashSet<>();
        Set<String> rotulos = new HashSet<>();
        for (int k = 0; k < itens.size(); k++) {
            Opcao o = itens.get(k);
            String co = caminho + "[" + k + "]";
            if (!idValido(o.id())) {
                c.erro(co + ".id", "Falta o identificador.");
            } else if (!ids.add(o.id())) {
                c.erro(co + ".id", "Identificador repetido.");
            }
            if (o.rotulo() == null || o.rotulo().isBlank()) {
                c.erro(co + ".rotulo", "Texto vazio.");
            } else if (o.rotulo().length() > LimitesQuestionario.OPCAO_TAMANHO) {
                c.erro(co + ".rotulo", "Texto longo demais.");
            } else if (!rotulos.add(normalizar(o.rotulo()))) {
                c.erro(co + ".rotulo", "Texto repetido.");
            }
            if (o.imagemId() != null && (!comImagem || !IMAGEM.matcher(o.imagemId()).matches())) {
                c.erro(co + ".imagemId", comImagem ? "Imagem inválida." : "Só opção de escolha tem imagem.");
            }
        }
    }

    private static void dias(ResultadoValidacao.Coletor c, Pergunta p, String cp) {
        List<Integer> dias = p.dias();
        if (p.tipo() != NOTAS_POR_DIA) {
            if (dias != null) {
                c.erro(cp + ".dias", "Este tipo não tem dias.");
            }
            return;
        }
        if (dias == null || dias.isEmpty() || dias.size() > LimitesQuestionario.DIAS_MAXIMO) {
            c.erro(cp + ".dias", "Use de 1 a " + LimitesQuestionario.DIAS_MAXIMO + " dias.");
        }
        if (dias == null) {
            return;
        }
        Set<Integer> vistos = new HashSet<>();
        for (int k = 0; k < dias.size(); k++) {
            Integer d = dias.get(k);
            if (d == null || d < 1 || d > LimitesQuestionario.DIA_VALOR_MAXIMO) {
                c.erro(cp + ".dias[" + k + "]", "Dia fora da faixa.");
            } else if (!vistos.add(d)) {
                c.erro(cp + ".dias[" + k + "]", "Dia repetido.");
            }
        }
    }

    private static void numero(ResultadoValidacao.Coletor c, Pergunta p, String cp) {
        if (p.tipo() != NUMERO) {
            if (p.min() != null) {
                c.erro(cp + ".min", "Este tipo não tem mínimo.");
            }
            if (p.max() != null) {
                c.erro(cp + ".max", "Este tipo não tem máximo.");
            }
            if (p.casas() != null) {
                c.erro(cp + ".casas", "Este tipo não tem casas decimais.");
            }
            if (p.unidade() != null) {
                c.erro(cp + ".unidade", "Este tipo não tem unidade.");
            }
            return;
        }
        if (p.casas() != null && (p.casas() < 0 || p.casas() > LimitesQuestionario.CASAS_MAXIMO)) {
            c.erro(cp + ".casas", "Use de 0 a " + LimitesQuestionario.CASAS_MAXIMO + " casas decimais.");
        }
        BigDecimal limite = BigDecimal.valueOf(LimitesQuestionario.NUMERO_ABSOLUTO);
        if (p.min() != null && p.min().abs().compareTo(limite) > 0) {
            c.erro(cp + ".min", "Use um mínimo entre -" + LimitesQuestionario.NUMERO_ABSOLUTO + " e " + LimitesQuestionario.NUMERO_ABSOLUTO + ".");
        }
        if (p.max() != null && p.max().abs().compareTo(limite) > 0) {
            c.erro(cp + ".max", "Use um máximo entre -" + LimitesQuestionario.NUMERO_ABSOLUTO + " e " + LimitesQuestionario.NUMERO_ABSOLUTO + ".");
        }
        if (p.min() != null && p.max() != null && p.min().compareTo(p.max()) > 0) {
            c.erro(cp + ".max", "O máximo é menor que o mínimo.");
        }
        if (p.unidade() != null && p.unidade().length() > LimitesQuestionario.UNIDADE_TAMANHO) {
            c.erro(cp + ".unidade", "Unidade longa demais.");
        }
    }

    private static void destaque(ResultadoValidacao.Coletor c, Estado estado, Pergunta p, String cp) {
        boolean destacada = Boolean.TRUE.equals(p.destaque());
        if (destacada) {
            if (!COM_DESTAQUE.contains(p.tipo())) {
                c.erro(cp + ".destaque", "Este tipo não pode ir para o resumo.");
            } else if (++estado.destaques > LimitesQuestionario.DESTAQUES_MAXIMO) {
                c.erro(cp + ".destaque", "No máximo " + LimitesQuestionario.DESTAQUES_MAXIMO + " perguntas no resumo.");
            }
        }
        if (p.rotuloCurto() != null && !p.rotuloCurto().isBlank()) {
            if (!destacada) {
                c.erro(cp + ".rotuloCurto", "O nome curto só vale para pergunta do resumo.");
            } else if (p.rotuloCurto().length() > LimitesQuestionario.ROTULO_CURTO_TAMANHO) {
                c.erro(cp + ".rotuloCurto", "Nome curto longo demais.");
            }
        }
    }

    private static boolean idValido(String id) {
        return id != null && ID.matcher(id).matches();
    }

    /** Minúsculas, sem acento e sem espaços nas pontas: "Sim" e " sim" são a mesma opção. */
    static String normalizar(String texto) {
        return Normalizer.normalize(texto.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
