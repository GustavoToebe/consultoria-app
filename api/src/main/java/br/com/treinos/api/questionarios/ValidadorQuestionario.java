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

/**
 * Regras de publicação do questionário. Confere só a forma; nunca avalia se uma pergunta é adequada. Os caminhos
 * ({@code secoes[0].perguntas[1].opcoes[2].rotulo}) e as regras são os mesmos de {@code errosDoQuestionario} em
 * {@code app/src/dominio/questionario.ts}: mudou uma regra, muda a outra (o teste de paridade confere os caminhos).
 */
@Component
public class ValidadorQuestionario {

    private static final Pattern ID = Pattern.compile(LimitesQuestionario.ID_PADRAO);
    private static final Set<TipoPergunta> COM_DESTAQUE = EnumSet.of(NOTA, NUMERO, SIM_NAO, ESCOLHA_UNICA);
    private static final Set<TipoPergunta> COM_AJUDA_AUTOMATICA = EnumSet.of(TEXTO, NUMERO);
    private static final Set<TipoPergunta> UNICOS = EnumSet.of(PESO, DATA_AUTOMATICA, FOTOS);

    public ResultadoValidacao validar(ConteudoQuestionario conteudo) {
        ResultadoValidacao.Coletor c = new ResultadoValidacao.Coletor();
        instrucoes(c, conteudo.instrucoes() == null ? List.of() : conteudo.instrucoes());
        List<Secao> secoes = conteudo.secoes() == null ? List.of() : conteudo.secoes();
        if (secoes.isEmpty()) {
            c.erro("secoes", "O questionário não tem nenhuma seção.");
        }
        if (secoes.size() > LimitesQuestionario.SECOES) {
            c.erro("secoes", "Seções demais.");
        }
        Estado estado = new Estado();
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
        if (estado.total > 0 && !estado.tipos.contains(PESO)) {
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
        int total;
        int destaques;
        int capacidadeDeTexto;
        final Set<String> ids = new HashSet<>();
        final Set<TipoPergunta> tipos = EnumSet.noneOf(TipoPergunta.class);
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
        TipoPergunta tipo = p.tipo();
        if (tipo == null) {
            c.erro(cp + ".tipo", "Falta o tipo.");
            return;
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
        }
    }

    private static void opcoes(ResultadoValidacao.Coletor c, Pergunta p, String cp) {
        List<Opcao> opcoes = p.opcoes();
        if (!p.tipo().temOpcoes()) {
            if (opcoes != null) {
                c.erro(cp + ".opcoes", "Este tipo não tem opções.");
            }
            return;
        }
        int n = opcoes == null ? 0 : opcoes.size();
        if (n < LimitesQuestionario.OPCOES_MINIMO || n > LimitesQuestionario.OPCOES_MAXIMO) {
            c.erro(cp + ".opcoes", "Use de " + LimitesQuestionario.OPCOES_MINIMO + " a " + LimitesQuestionario.OPCOES_MAXIMO + " opções.");
        }
        if (opcoes == null) {
            return;
        }
        Set<String> ids = new HashSet<>();
        Set<String> rotulos = new HashSet<>();
        for (int k = 0; k < opcoes.size(); k++) {
            Opcao o = opcoes.get(k);
            String co = cp + ".opcoes[" + k + "]";
            if (!idValido(o.id())) {
                c.erro(co + ".id", "Falta o identificador.");
            } else if (!ids.add(o.id())) {
                c.erro(co + ".id", "Identificador repetido.");
            }
            if (o.rotulo() == null || o.rotulo().isBlank()) {
                c.erro(co + ".rotulo", "Opção sem texto.");
            } else if (o.rotulo().length() > LimitesQuestionario.OPCAO_TAMANHO) {
                c.erro(co + ".rotulo", "Texto longo demais.");
            } else if (!rotulos.add(normalizar(o.rotulo()))) {
                c.erro(co + ".rotulo", "Opção repetida.");
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
