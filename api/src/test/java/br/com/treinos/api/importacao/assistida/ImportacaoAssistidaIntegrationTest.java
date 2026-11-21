package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Importação assistida de ponta a ponta (modo {@code regras}, sem provedor): isolamento por consultoria, permissões por
 * parte gravada (403 antes de qualquer efeito), aluno de outra consultoria, vários alunos numa sessão, erro isolado por
 * grupo, retenção e anonimização. Só dados fictícios; nomes únicos porque os testes dividem um Postgres.
 */
@AutoConfigureMockMvc
class ImportacaoAssistidaIntegrationTest extends AbstractIntegrationTest {

    private static final String BASE = "/importacoes/assistidas/sessoes";
    private static final String PLANO = "\nPeso: 82.5 kg\n\nTreino A - Peito e Tríceps\n1. Supino reto - 4x10 - 60s\n"
            + "2. Tríceps corda - 3x12 - 45s\n\nCafé da Manhã\n3 un Ovos inteiros\n50g Aveia em flocos\n";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate banco;
    @Autowired
    private ImportacaoAssistidaRetencao retencao;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    // ------------------------------------------------------------------------------------------------ ajudantes

    private static String nomeUnico() {
        StringBuilder b = new StringBuilder();
        for (char c : UUID.randomUUID().toString().replace("-", "").substring(0, 10).toCharArray()) {
            b.append(Character.isDigit(c) ? (char) ('k' + (c - '0')) : c);
        }
        return "Fulano " + Character.toUpperCase(b.charAt(0)) + b.substring(1);
    }

    private String novaSessao(JsonNode login) throws Exception {
        return api.post(BASE, login, Map.of("objetivo", "CADASTROS_E_PLANOS_ATUAIS"), 200).path("id").asString();
    }

    /** Sessão processada pelo modo {@code regras}, um arquivo de texto por conteúdo (um grupo por arquivo). */
    private String sessaoProcessada(JsonNode login, String... textos) throws Exception {
        String id = novaSessao(login);
        int n = 0;
        for (String texto : textos) {
            n++;
            api.post(BASE + "/" + id + "/textos", login, Map.of("titulo", "Texto " + n, "conteudo", texto), 200);
        }
        api.post(BASE + "/" + id + "/processar", login, null, 202);
        return aguardarProcessamento(login, id);
    }

    private String aguardarProcessamento(JsonNode login, String id) throws Exception {
        long fim = System.currentTimeMillis() + 10_000;
        while (System.currentTimeMillis() < fim) {
            JsonNode s = detalhe(login, id);
            if (!"PROCESSANDO".equals(s.path("estado").asString())) {
                return id;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("Processamento assíncrono não terminou no prazo.");
    }

    private JsonNode detalhe(JsonNode login, String sessaoId) throws Exception {
        return api.get(BASE + "/" + sessaoId, login, 200);
    }

    private JsonNode confirmar(JsonNode login, String sessaoId, int esperado) throws Exception {
        JsonNode det = detalhe(admin, sessaoId);
        int revisao = det.path("revisao").asInt();
        String hashPrevia = det.path("hashPrevia").asString("");
        List<String> gruposIds = new java.util.ArrayList<>();
        for (JsonNode g : det.path("grupos")) {
            if (!"IMPORTADO".equals(g.path("estado").asString()) && !"IGNORAR".equals(g.path("destino").asString())) {
                gruposIds.add(g.path("id").asString());
            }
        }
        return api.post(BASE + "/" + sessaoId + "/confirmar", login,
                Map.of("gruposIds", gruposIds, "revisaoEsperada", revisao,
                        "hashPrevia", hashPrevia, "chaveIdempotencia", UUID.randomUUID().toString()),
                esperado);
    }

    private long alunosComNome(String nome) {
        return banco.queryForObject("select count(*) from aluno where lower(nome) = lower(?)", Long.class, nome);
    }

    private UUID aluno(JsonNode login, String nome, String email) throws Exception {
        Map<String, Object> corpo = email == null ? Map.of("nome", nome) : Map.of("nome", nome, "email", email);
        return UUID.fromString(api.post("/alunos", login, corpo, 200).path("id").asString());
    }

    private void inativar(UUID aluno) throws Exception {
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
    }

    // ------------------------------------------------------------------------------------------------ isolamento

    @Test
    void sessaoDeOutraConsultoriaDa404EmTodasAsRotas() throws Exception {
        String sessao = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\n");
        JsonNode grupo = detalhe(admin, sessao).path("grupos").get(0);
        JsonNode outra = api.novoTreinador();

        api.get(BASE + "/" + sessao, outra, 404);
        api.post(BASE + "/" + sessao + "/textos", outra, Map.of("titulo", "x", "conteudo", "y"), 404);
        api.post(BASE + "/" + sessao + "/processar", outra, null, 404);
        api.put(BASE + "/" + sessao + "/grupos/" + grupo.path("id").asString(), outra, Map.of("destino", "IGNORAR"), 404);
        api.post(BASE + "/" + sessao + "/confirmar", outra, Map.of("gruposIds", List.of("grupo-1"),
                "revisaoEsperada", 1, "hashPrevia", "h", "chaveIdempotencia", "k"), 404);
        // O dono segue vendo a sua.
        assertThat(detalhe(admin, sessao).path("estado").asString()).isEqualTo("REVISANDO");
    }

    @Test
    void alunoDeOutraConsultoriaInativoOuAnonimizadoNaoVincula() throws Exception {
        String nomeGrupo = nomeUnico();
        String sessao = sessaoProcessada(admin, "Aluno: " + nomeGrupo + "\n");
        String grupo = detalhe(admin, sessao).path("grupos").get(0).path("id").asString();
        String rota = BASE + "/" + sessao + "/grupos/" + grupo;

        // Aluno de outra consultoria: 404, nunca vaza que existe.
        JsonNode outra = api.novoTreinador();
        UUID alheio = aluno(outra, nomeUnico(), null);
        api.put(rota, admin, Map.of("destino", "VINCULAR_EXISTENTE", "alunoExistenteId", alheio), 404);

        // Inativo: 409.
        UUID inativo = aluno(admin, nomeUnico(), null);
        inativar(inativo);
        JsonNode recusa = api.put(rota, admin, Map.of("destino", "VINCULAR_EXISTENTE", "alunoExistenteId", inativo), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_INATIVO");

        // Anonimizado: 409 (e a ficha dele deixa de ser candidata).
        String nomeAnonimizado = nomeUnico();
        UUID anonimizado = aluno(admin, nomeAnonimizado, null);
        inativar(anonimizado);
        api.post("/alunos/" + anonimizado + "/anonimizar", admin, Map.of("nomeConfirmado", nomeAnonimizado), 200);
        recusa = api.put(rota, admin, Map.of("destino", "VINCULAR_EXISTENTE", "alunoExistenteId", anonimizado), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");

        // Nada foi vinculado.
        assertThat(detalhe(admin, sessao).path("grupos").get(0).path("alunoExistenteId").isNull()
                || detalhe(admin, sessao).path("grupos").get(0).path("alunoExistenteId").isMissingNode()).isTrue();
    }

    // ------------------------------------------------------------------------------------------------ permissões

    @Test
    void membroSemAsPermissoesDoPlanoLevaDa403AntesDeQualquerEfeito() throws Exception {
        String nome = nomeUnico();
        String sessao = sessaoProcessada(admin, "Aluno: " + nome + PLANO);
        String nomeDetectado = detalhe(admin, sessao).path("grupos").get(0).path("nomeDetectado").asString();
        LimiteDoTreinadorDeTeste.Membro membro = new LimiteDoTreinadorDeTeste(api, admin, banco).membro();

        // ALUNO_LER + ALUNO_ALTERAR deixam ver e revisar, mas o grupo tem peso, treino e dieta: 403, nada gravado.
        confirmar(membro.login(), sessao, 403);
        assertThat(alunosComNome(nomeDetectado)).isZero();
        assertThat(detalhe(admin, sessao).path("estado").asString()).isEqualTo("REVISANDO");

        // O administrador confirma: o peso sem data é ignorado (a data nunca é inventada).
        JsonNode r = confirmar(admin, sessao, 200);
        assertThat(r.path("situacao").asString()).isEqualTo("CONCLUIDA");
        assertThat(r.path("alunosCriados").asInt()).isEqualTo(1);
        assertThat(r.path("treinosCriados").asInt()).isEqualTo(1);
        assertThat(r.path("dietasCriadas").asInt()).isEqualTo(1);
        assertThat(r.path("pesosGravados").asInt()).isZero();
        assertThat(r.path("pesosIgnorados").asInt()).isEqualTo(1);
        assertThat(alunosComNome(nomeDetectado)).isEqualTo(1);
    }

    @Test
    void soComPesoOMembroSemSensivelLevaDa403ENaoVeOPesoNoGet() throws Exception {
        String sessao = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\nPeso: 80 kg em 12/03/2026\n");
        LimiteDoTreinadorDeTeste.Membro membro = new LimiteDoTreinadorDeTeste(api, admin, banco).membro();

        JsonNode doAdmin = detalhe(admin, sessao).path("grupos").get(0);
        assertThat(doAdmin.path("pesos")).hasSize(1);
        JsonNode doMembro = detalhe(membro.login(), sessao).path("grupos").get(0);
        assertThat(doMembro.path("pesos")).isEmpty();

        confirmar(membro.login(), sessao, 403);
        assertThat(detalhe(admin, sessao).path("estado").asString()).isEqualTo("REVISANDO");
    }

    // ------------------------------------------------------------------------------------------------ gravação

    @Test
    void variosAlunosNumaSessaoSaemEsqueletoDepoisDeGravados() throws Exception {
        String sessao = sessaoProcessada(admin,
                "Aluno: " + nomeUnico() + "\nPeso: 80 kg em 12/03/2026\n",
                "Aluno: " + nomeUnico() + "\nPeso: 70 kg em 13/03/2026\n");
        JsonNode antes = detalhe(admin, sessao);
        assertThat(antes.path("grupos")).hasSize(2);
        String n1 = antes.path("grupos").get(0).path("nomeDetectado").asString();
        String n2 = antes.path("grupos").get(1).path("nomeDetectado").asString();
        // Bytes do arquivo ficam retidos durante a revisão.
        assertThat(banco.queryForObject("select count(*) from importacao_arquivo where sessao_id = ?::uuid "
                + "and conteudo_bytes is not null", Long.class, sessao)).isEqualTo(2);

        JsonNode r = confirmar(admin, sessao, 200);

        assertThat(r.path("situacao").asString()).isEqualTo("CONCLUIDA");
        // Após conclusão integral da sessão, os bytes dos arquivos são apagados.
        assertThat(banco.queryForObject("select count(*) from importacao_arquivo where sessao_id = ?::uuid "
                + "and conteudo_bytes is not null", Long.class, sessao)).isZero();
        assertThat(r.path("gruposImportados").asInt()).isEqualTo(2);
        assertThat(r.path("alunosCriados").asInt()).isEqualTo(2);
        assertThat(r.path("pesosGravados").asInt()).isEqualTo(2);
        assertThat(alunosComNome(n1)).isEqualTo(1);
        assertThat(alunosComNome(n2)).isEqualTo(1);
        JsonNode depois = detalhe(admin, sessao);
        assertThat(depois.path("estado").asString()).isEqualTo("CONCLUIDA");
        for (JsonNode g : depois.path("grupos")) {
            assertThat(g.path("estado").asString()).isEqualTo("IMPORTADO");
            assertThat(g.path("nomeDetectado").asString()).doesNotContain("Fulano");
            assertThat(g.path("pesos")).isEmpty();
            assertThat(g.path("cadastro").isNull()).isTrue();
        }
        // Reenviar depois de concluída: 409, sem gravar de novo.
        api.post(BASE + "/" + sessao + "/confirmar", admin, Map.of("gruposIds", List.of("grupo-1"),
                "revisaoEsperada", 1, "hashPrevia", "h", "chaveIdempotencia", "k-pos"), 409);
        assertThat(alunosComNome(n1)).isEqualTo(1);
        // Auditoria com resumo fixo (nunca nome, peso nem código do aluno).
        assertThat(banco.queryForObject("select count(*) from auditoria where acao = 'IMPORTACAO_ASSISTIDA_CONCLUIDA'",
                Long.class)).isGreaterThanOrEqualTo(1);
        assertThat(banco.queryForObject("select count(*) from auditoria where acao = 'IMPORTACAO_ASSISTIDA_CONCLUIDA' "
                + "and resumo <> 'Importou dados pela importação assistida.'", Long.class)).isZero();
    }

    @Test
    void erroDeUmGrupoNaoDerrubaOsOutrosNemVazaMensagem() throws Exception {
        String email = ApiDeTeste.emailUnico("ja-existe");
        UUID existente = aluno(admin, nomeUnico(), email);
        String bom = nomeUnico();
        String sessao = sessaoProcessada(admin,
                "Aluno: " + nomeUnico() + "\nE-mail: " + email + "\n",
                "Aluno: " + bom + "\n");
        JsonNode grupos = detalhe(admin, sessao).path("grupos");
        JsonNode comEmail = grupos.get(0);
        // Um único aluno ativo tem o e-mail: o servidor vincula sozinho (nunca por nome).
        assertThat(comEmail.path("destino").asString()).isEqualTo("VINCULAR_EXISTENTE");
        assertThat(comEmail.path("alunoExistenteId").asString()).isEqualTo(existente.toString());
        // O treinador força "criar": o e-mail repetido é 409 ALUNO_JA_EXISTE só nesse grupo.
        api.put(BASE + "/" + sessao + "/grupos/" + comEmail.path("id").asString(), admin,
                Map.of("destino", "CRIAR_ALUNO"), 200);

        JsonNode r = confirmar(admin, sessao, 200);

        assertThat(r.path("situacao").asString()).isEqualTo("CONCLUIDA_COM_ERROS");
        assertThat(r.path("gruposImportados").asInt()).isEqualTo(1);
        assertThat(r.path("gruposComErro").asInt()).isEqualTo(1);
        JsonNode depois = detalhe(admin, sessao);
        assertThat(depois.path("estado").asString()).isEqualTo("REVISANDO");
        assertThat(depois.path("grupos").get(0).path("estado").asString()).isEqualTo("ERRO");
        assertThat(depois.path("grupos").get(0).path("erroCodigo").asString()).isEqualTo("ALUNO_JA_EXISTE");
        assertThat(depois.path("grupos").get(1).path("estado").asString()).isEqualTo("IMPORTADO");
        assertThat(depois.toString()).doesNotContain("Já existe um aluno");
    }

    // ------------------------------------------------------------------------------------------------ retenção e anonimização

    @Test
    void retencaoApagaSessaoVencidaEMantemAsDemais() throws Exception {
        String vencida = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\n");
        String valida = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\n");
        banco.update("update importacao_sessao set expira_em = ? where id = ?::uuid",
                java.sql.Timestamp.from(Instant.now().minusSeconds(86_400)), vencida);

        assertThat(retencao.limpar(Instant.now())).isGreaterThanOrEqualTo(1);

        api.get(BASE + "/" + vencida, admin, 404);
        assertThat(banco.queryForObject("select count(*) from importacao_arquivo where sessao_id = ?::uuid", Long.class,
                vencida)).isZero();
        assertThat(detalhe(admin, valida).path("estado").asString()).isEqualTo("REVISANDO");
    }

    @Test
    void anonimizarOAlunoLimpaOGrupoLigadoAEleENaoOMantemComoCandidato() throws Exception {
        String nome = nomeUnico();
        UUID alvo = aluno(admin, nome, null);
        String sessao = sessaoProcessada(admin, "Aluno: " + nome + "\nPeso: 80 kg em 12/03/2026\n",
                "Aluno: " + nome + "\n");
        JsonNode grupos = detalhe(admin, sessao).path("grupos");
        // Mesmo nome só gera candidato: o treinador escolhe, o servidor não vincula sozinho.
        assertThat(grupos.get(0).path("destino").asString()).isEqualTo("CRIAR_ALUNO");
        assertThat(grupos.get(0).path("candidatos")).hasSize(1);
        assertThat(grupos.get(0).path("candidatos").get(0).path("motivo").asString()).isEqualTo("NOME");
        api.put(BASE + "/" + sessao + "/grupos/" + grupos.get(0).path("id").asString(), admin,
                Map.of("destino", "VINCULAR_EXISTENTE", "alunoExistenteId", alvo), 200);

        inativar(alvo);
        api.post("/alunos/" + alvo + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);

        JsonNode depois = detalhe(admin, sessao).path("grupos");
        assertThat(depois.get(0).path("estado").asString()).isEqualTo("IGNORADO");
        assertThat(depois.get(0).path("nomeDetectado").asString()).doesNotContain("Fulano");
        assertThat(depois.get(0).path("pesos")).isEmpty();
        assertThat(depois.get(1).path("candidatos")).isEmpty();
        assertThat(depois.toString()).doesNotContain(alvo.toString());
    }

    // ------------------------------------------------------------------------------------------------ blocos 2 e 3

    @Test
    void semSugestoesHardcodedECandidatosReaisDaBiblioteca() throws Exception {
        String nomeExercicio = "Puxada Neutra Barra Reta " + UUID.randomUUID().toString().substring(0, 6);
        String exId = api.post("/exercicios", admin, Map.of("nome", nomeExercicio, "modalidade", "MAQUINA"), 200)
                .path("id").asString();

        String sessao = sessaoProcessada(admin,
                "Aluno: " + nomeUnico() + "\nTreino A - Costas\n1. Puxada neutra 4x10\n");
        JsonNode det = detalhe(admin, sessao);
        JsonNode duvidas = det.path("duvidas");
        assertThat(duvidas).isNotEmpty();
        JsonNode primeira = duvidas.get(0);
        assertThat(primeira.path("ocorrenciaIds")).isNotEmpty();
        assertThat(det.toString()).doesNotContain("Puxada frontal pronada");
        assertThat(det.toString()).doesNotContain("Arroz branco cozido");

        boolean achouDaBiblioteca = false;
        for (JsonNode s : primeira.path("sugestoes")) {
            if (exId.equals(s.path("referenciaId").asString())) {
                achouDaBiblioteca = true;
                assertThat(s.path("origem").asString()).isEqualTo("BIBLIOTECA");
                assertThat(s.path("nota").isNull()).isTrue();
            }
        }
        assertThat(achouDaBiblioteca).isTrue();
    }

    @Test
    void responderABERevogarDecisaoReconstroiDoValorExtraido() throws Exception {
        String sessao = sessaoProcessada(admin,
                "Aluno: " + nomeUnico() + "\nTreino A\n1. Supino inclinado halteres 4x10\n");
        JsonNode det = detalhe(admin, sessao);
        String duvidaId = det.path("duvidas").get(0).path("id").asString();
        String valorExtraido = det.path("duvidas").get(0).path("termoOriginal").asString();

        // Resposta A -> B
        JsonNode aposB = api.post(BASE + "/" + sessao + "/respostas", admin,
                Map.of("duvidaId", duvidaId, "respostaEscolhida", "Supino Inclinado B", "salvarNoDicionario", false), 200);
        assertThat(aposB.path("grupos").get(0).path("treino").path("sessoes").get(0).path("exercicios").get(0)
                .path("nome").asString()).isEqualTo("Supino Inclinado B");
        assertThat(aposB.path("decisoes")).hasSize(1);
        assertThat(aposB.path("decisoes").get(0).path("ativa").asBoolean()).isTrue();

        // Re-responder B -> C
        JsonNode aposC = api.post(BASE + "/" + sessao + "/respostas", admin,
                Map.of("duvidaId", duvidaId, "respostaEscolhida", "Supino Inclinado C", "salvarNoDicionario", false), 200);
        assertThat(aposC.path("grupos").get(0).path("treino").path("sessoes").get(0).path("exercicios").get(0)
                .path("nome").asString()).isEqualTo("Supino Inclinado C");
        assertThat(aposC.path("decisoes")).hasSize(2);
        assertThat(aposC.path("decisoes").get(0).path("ativa").asBoolean()).isFalse();
        assertThat(aposC.path("decisoes").get(1).path("ativa").asBoolean()).isTrue();

        // Revogar com revisão desatualizada -> 409 CONFLITO_EDICAO
        String decisaoC = aposC.path("decisoes").get(1).path("decisaoId").asString();
        int rev = aposC.path("revisao").asInt();
        JsonNode conflitoRev = api.post(BASE + "/" + sessao + "/respostas/" + decisaoC + "/revogar", admin,
                Map.of("revisaoEsperada", rev - 1), 409);
        assertThat(conflitoRev.path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");

        // Revogar C -> volta exatamente para valorExtraido
        JsonNode aposRevogar = api.post(BASE + "/" + sessao + "/respostas/" + decisaoC + "/revogar", admin,
                Map.of("revisaoEsperada", rev), 200);
        assertThat(aposRevogar.path("grupos").get(0).path("treino").path("sessoes").get(0).path("exercicios").get(0)
                .path("nome").asString()).isEqualTo(valorExtraido);
        assertThat(aposRevogar.path("duvidas").get(0).path("resolvida").asBoolean()).isFalse();
    }

    @Test
    void confirmacaoTravadaValidacoesEIdempotencia() throws Exception {
        String sessao = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\n");
        JsonNode det = detalhe(admin, sessao);
        String grupoId = det.path("grupos").get(0).path("id").asString();
        int rev = det.path("revisao").asInt();
        String hash = det.path("hashPrevia").asString();

        // SELECAO_VAZIA -> 400
        JsonNode vazia = api.post(BASE + "/" + sessao + "/confirmar", admin,
                Map.of("gruposIds", List.of(), "revisaoEsperada", rev, "hashPrevia", hash, "chaveIdempotencia", "k1"), 400);
        assertThat(vazia.path("codigo").asString()).isEqualTo("SELECAO_VAZIA");

        // IDs duplicados -> 400 SELECAO_INVALIDA
        JsonNode duplicada = api.post(BASE + "/" + sessao + "/confirmar", admin,
                Map.of("gruposIds", List.of(grupoId, grupoId), "revisaoEsperada", rev, "hashPrevia", hash, "chaveIdempotencia", "k1b"), 400);
        assertThat(duplicada.path("codigo").asString()).isEqualTo("SELECAO_INVALIDA");

        // PREVIA_DESATUALIZADA -> 409
        JsonNode hashErrado = api.post(BASE + "/" + sessao + "/confirmar", admin,
                Map.of("gruposIds", List.of(grupoId), "revisaoEsperada", rev, "hashPrevia", "hash-velho", "chaveIdempotencia", "k2"), 409);
        assertThat(hashErrado.path("codigo").asString()).isEqualTo("PREVIA_DESATUALIZADA");

        // Confirmar com sucesso usando chaveIdempotencia
        String chave = "idem-" + UUID.randomUUID();
        JsonNode ok1 = api.post(BASE + "/" + sessao + "/confirmar", admin,
                Map.of("gruposIds", List.of(grupoId), "revisaoEsperada", rev, "hashPrevia", hash, "chaveIdempotencia", chave), 200);
        JsonNode ok2 = api.post(BASE + "/" + sessao + "/confirmar", admin,
                Map.of("gruposIds", List.of(grupoId), "revisaoEsperada", rev, "hashPrevia", hash, "chaveIdempotencia", chave), 200);
        assertThat(ok2).isEqualTo(ok1);

        // Mesma chave com payload diferente -> 409 IDEMPOTENCIA_CONFLITANTE
        JsonNode conflito = api.post(BASE + "/" + sessao + "/confirmar", admin,
                Map.of("gruposIds", List.of("outro-grupo"), "revisaoEsperada", rev, "hashPrevia", hash, "chaveIdempotencia", chave), 409);
        assertThat(conflito.path("codigo").asString()).isEqualTo("IDEMPOTENCIA_CONFLITANTE");
    }

    @Test
    void listarSessoesCancelarEConteudoDoArquivoComPermissoes() throws Exception {
        String sessao = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\n");
        JsonNode lista = api.get(BASE, admin, 200);
        assertThat(lista.toString()).contains(sessao);

        String arquivoId = detalhe(admin, sessao).path("arquivos").get(0).path("id").asString();
        String rotaConteudo = BASE + "/" + sessao + "/arquivos/" + arquivoId + "/conteudo";

        // Membro sem permissão sensível/treino/dieta -> 403
        LimiteDoTreinadorDeTeste.Membro membro = new LimiteDoTreinadorDeTeste(api, admin, banco).membro();
        api.get(rotaConteudo, membro.login(), 403);

        // Outro tenant -> 404
        JsonNode outra = api.novoTreinador();
        api.get(rotaConteudo, outra, 404);

        // Admin -> 200 com Cache-Control: no-store
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(rotaConteudo)
                        .header("Authorization", ApiDeTeste.bearer(admin)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));

        // Cancelar sessão -> limpa bytes; depois /conteudo dá 404 CONTEUDO_INDISPONIVEL
        JsonNode cancelada = api.post(BASE + "/" + sessao + "/cancelar", admin, null, 200);
        assertThat(cancelada.path("estado").asString()).isEqualTo("CANCELADA");
        JsonNode semConteudo = api.get(rotaConteudo, admin, 404);
        assertThat(semConteudo.path("codigo").asString()).isEqualTo("CONTEUDO_INDISPONIVEL");
    }
}
