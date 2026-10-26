package br.com.treinos.api.importacao;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.importacao.ImportacaoDtos.Colunas;
import br.com.treinos.api.importacao.ImportacaoDtos.Detalhe;
import br.com.treinos.api.importacao.ImportacaoDtos.Erro;
import br.com.treinos.api.importacao.ImportacaoDtos.Item;
import br.com.treinos.api.importacao.ImportacaoDtos.Pagina;
import br.com.treinos.api.importacao.ImportacaoDtos.Previa;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Prévia não grava. A confirmação relê o arquivo, confere o hash e grava as linhas válidas numa transação. */
@Service
public class ImportacaoService {

    static final int PAGINA = 30;
    private static final int ERROS_NA_PREVIA = 200;
    private static final Set<String> SENSIVEIS = Set.of("objetivo", "observacoes", "cpf", "cep", "logradouro", "numero",
            "complemento", "bairro", "cidade", "uf");
    private static final Map<String, String> PERMISSAO = Map.of(
            "alunos", "ALUNO_ALTERAR",
            "pesos", "ALUNO_SENSIVEL_ALTERAR",
            "exercicios", "BIBLIOTECA_ALTERAR",
            "alimentos", "BIBLIOTECA_ALTERAR",
            "suplementos", "BIBLIOTECA_ALTERAR",
            "outros", "ERGOGENICO_ALTERAR");
    private static final Map<String, List<String>> CAMPOS = Map.of(
            "alunos", List.of("nome", "email", "telefone", "cpf", "objetivo", "observacoes", "cep", "logradouro",
                    "numero", "complemento", "bairro", "cidade", "uf", "responsavel", "dias", "situacao"),
            "pesos", List.of("aluno", "data", "peso", "observacao"),
            "exercicios", List.of("nome", "grupo", "equipamento", "modalidade", "video", "observacoes"),
            "alimentos", List.of("nome", "quantidade", "unidade", "kcal", "proteina", "carboidrato", "gordura",
                    "gramas", "fonte", "fc", "fcc"),
            "suplementos", List.of("nome", "marca", "categoria", "porcao", "porcoes", "sabores", "link"),
            "outros", List.of("nome", "categoria", "principio", "concentracao", "apresentacao", "observacao"));
    private static final Map<String, List<String>> OBRIGATORIOS = Map.of(
            "alunos", List.of("nome"),
            "pesos", List.of("aluno", "data", "peso"),
            "exercicios", List.of("nome"),
            "alimentos", List.of("nome", "quantidade", "unidade", "kcal", "proteina", "carboidrato", "gordura"),
            "suplementos", List.of("nome", "marca"),
            "outros", List.of("nome"));

    private static final Set<String> TRAVAM_A_CONSULTORIA = Set.of("alunos", "pesos");

    private static final TypeReference<List<Erro>> TIPO_ERROS = new TypeReference<>() { };
    private static final TypeReference<LinkedHashMap<String, Object>> TIPO_MAPA = new TypeReference<>() { };

    private final ImportacaoRepository importacoes;
    private final GravadorDaImportacao gravador;
    private final Auditoria auditoria;
    private final UsuarioRepository usuarios;
    private final JsonMapper json;
    private final ConsultoriaRepository consultorias;

    public ImportacaoService(ImportacaoRepository importacoes, GravadorDaImportacao gravador, Auditoria auditoria,
                             UsuarioRepository usuarios, JsonMapper json, ConsultoriaRepository consultorias) {
        this.consultorias = consultorias;
        this.importacoes = importacoes;
        this.gravador = gravador;
        this.auditoria = auditoria;
        this.usuarios = usuarios;
        this.json = json;
    }

    public Colunas colunas(String destino, String nome, byte[] bytes, int aba, boolean cabecalho) {
        exigir(destino);
        var planilha = LeitorDePlanilha.ler(nome, bytes, aba);
        List<String> colunas = new ArrayList<>();
        if (!planilha.linhas().isEmpty() && cabecalho) {
            for (int i = 0; i < planilha.linhas().get(0).celulas().size(); i++) {
                String texto = planilha.linhas().get(0).celulas().get(i).texto();
                colunas.add(texto == null || texto.isBlank() ? LeitorDePlanilha.letra(i) : texto);
            }
        } else {
            int largura = planilha.linhas().stream().mapToInt(l -> l.celulas().size()).max().orElse(0);
            for (int i = 0; i < largura; i++) {
                colunas.add(LeitorDePlanilha.letra(i));
            }
        }
        return new Colunas(planilha.abas(), planilha.aba(), colunas);
    }

    public Previa previa(String destino, String nome, byte[] bytes, String configuracao) {
        exigir(destino);
        ConfiguracaoDaImportacao config = configuracao(destino, configuracao);
        var planilha = LeitorDePlanilha.ler(nome, bytes, config.aba());
        conferirTamanho(planilha, config);
        var resultado = gravador.processar(destino, planilha, config, null, false);
        int mostrados = Math.min(ERROS_NA_PREVIA, resultado.erros().size());
        return new Previa(hash(bytes, destino, config), resultado.linhas(), resultado.novos(), resultado.atualizados(),
                resultado.ignorados(), resultado.comErro(), resultado.erros().subList(0, mostrados),
                Math.max(0, resultado.comErro() - mostrados), resultado.amostra());
    }

    @Transactional
    public Detalhe confirmar(UsuarioAutenticado eu, String destino, String nome, byte[] bytes, String configuracao,
                             String hash) {
        exigir(destino);
        ConfiguracaoDaImportacao config = configuracao(destino, configuracao);
        var planilha = LeitorDePlanilha.ler(nome, bytes, config.aba());
        conferirTamanho(planilha, config);
        String calculado = hash(bytes, destino, config);
        if (hash == null || !MessageDigest.isEqual(calculado.getBytes(StandardCharsets.UTF_8),
                hash.getBytes(StandardCharsets.UTF_8))) {
            throw new ConflictException("Algo mudou desde a prévia. Gere a prévia de novo.", "PREVIA_DESATUALIZADA");
        }
        if (TRAVAM_A_CONSULTORIA.contains(destino)) {
            // Antes de ler alunos e contar vagas: duas confirmações na mesma consultoria não correm por CPF, e-mail ou vaga.
            // A prévia não passa por aqui (não tem transação e não grava).
            Exigir.existe(consultorias.travar(TenantContext.get()), () -> new NaoEncontradoException("Importação não encontrada."));
        }
        var resultado = gravador.processar(destino, planilha, config, eu.usuarioId(), true);
        String situacao = resultado.novos() + resultado.atualizados() + resultado.ignorados() == 0
                ? "FALHOU" : resultado.comErro() > 0 ? "CONCLUIDA_COM_ERROS" : "CONCLUIDA";
        Importacao gravada = importacoes.saveAndFlush(new Importacao(destino, nomeArquivo(nome, bytes), eu.usuarioId(),
                resultado.linhas(), resultado.novos(), resultado.atualizados(), resultado.ignorados(),
                resultado.comErro(), situacao, json.writeValueAsString(configJson(config)),
                json.writeValueAsString(resultado.erros())));
        auditoria.registrarEvento("IMPORTACAO_CONCLUIDA", "IMPORTACAO", gravada.getId(), resumo(destino));
        return detalhe(gravada, eu.usuarioId());
    }

    @Transactional(readOnly = true)
    public Pagina listar(String destino, String situacao, String busca, int pagina) {
        List<String> visiveis = visiveis();
        if (destino != null && !destino.isBlank()) {
            if (!PERMISSAO.containsKey(destino)) {
                throw new NaoEncontradoException("Importação não encontrada.");
            }
            if (!visiveis.contains(destino)) {
                throw new AccessDeniedException("Seu perfil não permite esta ação.");
            }
        }
        if (visiveis.isEmpty()) {
            return new Pagina(List.of(), 0, 0);
        }
        String situacaoFiltro = situacao == null || situacao.isBlank() ? null : situacao;
        if (situacaoFiltro != null && !Set.of("CONCLUIDA", "CONCLUIDA_COM_ERROS", "FALHOU").contains(situacaoFiltro)) {
            throw new ValidacaoException("Situação inválida.", "ARQUIVO_INVALIDO", List.of());
        }
        var paginaDados = importacoes.buscar(visiveis, destino == null || destino.isBlank() ? null : destino,
                situacaoFiltro, Buscas.padrao(busca), PageRequest.of(Math.max(0, pagina), PAGINA));
        List<Item> itens = paginaDados.getContent().stream().map(i -> new Item(i.getId(), i.getNomeArquivo(),
                i.getDestino(), nomeDe(i.getUsuarioId()), i.getCriadoEm(), i.getLinhas(), i.getSituacao())).toList();
        return new Pagina(itens, paginaDados.getTotalElements(), Math.max(0, pagina));
    }

    @Transactional(readOnly = true)
    public Detalhe detalhe(UUID id) {
        return detalhe(buscarVisivel(id), null);
    }

    @Transactional(readOnly = true)
    public byte[] errosCsv(UUID id) {
        Importacao importacao = buscarVisivel(id);
        StringBuilder csv = new StringBuilder("\uFEFFLinha;Campo;Motivo\n");
        for (Erro erro : erros(importacao)) {
            csv.append(erro.linha()).append(';').append(celula(erro.campo())).append(';').append(celula(erro.motivo())).append('\n');
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private Detalhe detalhe(Importacao importacao, UUID usuarioConhecido) {
        Map<String, Object> config = json.readValue(importacao.getConfiguracao(), TIPO_MAPA);
        return new Detalhe(importacao.getId(), importacao.getNomeArquivo(), importacao.getDestino(),
                nomeDe(usuarioConhecido != null ? usuarioConhecido : importacao.getUsuarioId()),
                importacao.getCriadoEm(), importacao.getLinhas(), importacao.getNovos(), importacao.getAtualizados(),
                importacao.getIgnorados(), importacao.getComErro(), importacao.getSituacao(), config, erros(importacao));
    }

    private List<Erro> erros(Importacao importacao) {
        return json.readValue(importacao.getErros(), TIPO_ERROS);
    }

    private Importacao buscarVisivel(UUID id) {
        Importacao importacao = importacoes.findById(id)
                .orElseThrow(() -> new NaoEncontradoException("Importação não encontrada."));
        if (!visiveis().contains(importacao.getDestino())) {
            throw new NaoEncontradoException("Importação não encontrada.");
        }
        return importacao;
    }

    private void exigir(String destino) {
        String permissao = PERMISSAO.get(destino);
        if (permissao == null) {
            throw new NaoEncontradoException("Importação não encontrada.");
        }
        AcessoAtual.exigir(permissao);
    }

    private List<String> visiveis() {
        List<String> destinos = new ArrayList<>();
        PERMISSAO.forEach((destino, permissao) -> {
            if (AcessoAtual.pode(permissao) && !destinos.contains(destino)) {
                destinos.add(destino);
            }
        });
        return destinos;
    }

    private ConfiguracaoDaImportacao configuracao(String destino, String texto) {
        JsonNode no;
        try {
            no = json.readTree(texto == null ? "" : texto);
        } catch (RuntimeException e) {
            throw new ValidacaoException("A configuração da importação é inválida.", "ARQUIVO_INVALIDO", List.of());
        }
        if (no == null || !no.isObject()) {
            throw new ValidacaoException("A configuração da importação é inválida.", "ARQUIVO_INVALIDO", List.of());
        }
        int aba = no.path("aba").asInt(0);
        boolean cabecalho = !no.has("cabecalho") || no.path("cabecalho").asBoolean(true);
        String chave = no.path("chave").asString("");
        String existentes = no.path("existentes").asString("");
        if (!chaves(destino).contains(chave)) {
            throw new ValidacaoException("Escolha a chave da importação.", "ARQUIVO_INVALIDO", List.of());
        }
        if (!existentesDe(destino).contains(existentes)) {
            throw new ValidacaoException("Escolha o que fazer com o que já existe.", "ARQUIVO_INVALIDO", List.of());
        }
        Map<String, Integer> mapeamento = new LinkedHashMap<>();
        JsonNode mapa = no.path("mapeamento");
        if (mapa.isObject()) {
            for (var entrada : mapa.properties()) {
                String campo = entrada.getKey();
                if (!CAMPOS.get(destino).contains(campo)) {
                    throw new ValidacaoException("Campo desconhecido.", "ARQUIVO_INVALIDO", List.of());
                }
                JsonNode valor = entrada.getValue();
                if (valor == null || valor.isNull()) {
                    continue;
                }
                if (!valor.isNumber() || valor.asInt() < 0) {
                    throw new ValidacaoException("Coluna inválida.", "ARQUIVO_INVALIDO", List.of());
                }
                mapeamento.put(campo, valor.asInt());
            }
        }
        if (SENSIVEIS.stream().anyMatch(mapeamento::containsKey) && !AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR")) {
            throw new AccessDeniedException("Seu perfil não permite esta ação.");
        }
        List<String> obrigatorios = new ArrayList<>(OBRIGATORIOS.get(destino));
        if ("alunos".equals(destino) && !obrigatorios.contains(chave)) {
            obrigatorios.add(chave);
        }
        for (String campo : obrigatorios) {
            if (!mapeamento.containsKey(campo)) {
                throw new ValidacaoException("Informe a coluna do campo obrigatório.", "ARQUIVO_INVALIDO", List.of());
            }
        }
        return new ConfiguracaoDaImportacao(aba, cabecalho, chave, existentes, mapeamento);
    }

    private static void conferirTamanho(LeitorDePlanilha.Planilha planilha, ConfiguracaoDaImportacao config) {
        int dados = planilha.linhas().size() - (config.cabecalho() && !planilha.linhas().isEmpty() ? 1 : 0);
        if (dados <= 0) {
            throw new ValidacaoException("O arquivo não tem linhas para importar.", "ARQUIVO_INVALIDO", List.of());
        }
        if (dados > 5000) {
            throw new ValidacaoException("O arquivo passa de 5.000 linhas.", "ARQUIVO_INVALIDO", List.of());
        }
    }

    private static Set<String> chaves(String destino) {
        return switch (destino) {
            case "alunos", "pesos" -> Set.of("email", "cpf", "nome");
            case "suplementos" -> Set.of("nome_marca");
            default -> Set.of("nome");
        };
    }

    private static Set<String> existentesDe(String destino) {
        return "pesos".equals(destino) ? Set.of("IGNORAR", "SUBSTITUIR") : Set.of("IGNORAR", "COMPLETAR", "ATUALIZAR");
    }

    private static String hash(byte[] bytes, String destino, ConfiguracaoDaImportacao config) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(bytes);
            md.update(canonico(destino, config).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(md.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.", e);
        }
    }

    private static String canonico(String destino, ConfiguracaoDaImportacao config) {
        StringBuilder s = new StringBuilder();
        s.append(destino).append('\n').append(config.aba()).append('\n').append(config.cabecalho()).append('\n')
                .append(config.chave()).append('\n').append(config.existentes()).append('\n');
        config.mapeamento().entrySet().stream().sorted(Map.Entry.comparingByKey())
                .forEach(e -> s.append(e.getKey()).append('=').append(e.getValue()).append('\n'));
        return s.toString();
    }

    private static Map<String, Object> configJson(ConfiguracaoDaImportacao config) {
        Map<String, Object> mapa = new LinkedHashMap<>();
        mapa.put("aba", config.aba());
        mapa.put("cabecalho", config.cabecalho());
        mapa.put("chave", config.chave());
        mapa.put("existentes", config.existentes());
        mapa.put("mapeamento", config.mapeamento());
        return mapa;
    }

    /**
     * Só a extensão fica gravada: o nome do arquivo pode ter o nome de uma pessoa (LGPD). Segue a decisão do leitor:
     * ".xlsx" pela extensão ou pelo conteúdo zipado, ".csv" no resto.
     */
    private static String nomeArquivo(String nome, byte[] bytes) {
        String limpo = nome == null ? "" : nome.toLowerCase(java.util.Locale.ROOT).trim();
        boolean zip = bytes != null && bytes.length >= 2 && bytes[0] == 'P' && bytes[1] == 'K';
        return limpo.endsWith(".xlsx") || zip ? ".xlsx" : ".csv";
    }

    private String nomeDe(UUID usuarioId) {
        return usuarios.findById(usuarioId).map(u -> u.getNome()).orElse("—");
    }

    private static String resumo(String destino) {
        return switch (destino) {
            case "alunos" -> "Importou dados de alunos.";
            case "pesos" -> "Importou dados de pesos.";
            case "exercicios" -> "Importou dados de exercícios.";
            case "alimentos" -> "Importou dados de alimentos.";
            case "suplementos" -> "Importou dados de suplementos.";
            case "outros" -> "Importou dados de outros.";
            default -> "Importou dados.";
        };
    }

    private static String celula(String texto) {
        String t = texto == null ? "" : texto;
        if (!t.isEmpty() && "=+-@".indexOf(t.charAt(0)) >= 0) {
            t = "'" + t;
        }
        if (t.contains(";") || t.contains("\"") || t.contains("\n")) {
            return "\"" + t.replace("\"", "\"\"") + "\"";
        }
        return t;
    }
}
