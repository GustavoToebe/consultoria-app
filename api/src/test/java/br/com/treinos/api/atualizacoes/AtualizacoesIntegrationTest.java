package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.time.LocalDate;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

/** Dados fictícios: testa autorização, transação, contrato do formulário e revisão. */
@AutoConfigureMockMvc
class AtualizacoesIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private DataSource dataSource;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;
    private JsonNode loginAluno;
    private UUID aluno;
    private LocalDate hoje;

    @BeforeEach void preparar() throws Exception {
        api = new ApiDeTeste(mvc,json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador,"Aluno Fictício Check-in");
        loginAluno = api.convidarEEntrar(treinador,aluno);
        hoje = LocalDate.now(Fuso.BRASILIA);
    }
    private String publicarPasta(LocalDate fim) throws Exception {
        String pasta = api.post("/alunos/"+aluno+"/pastas",treinador,
                Map.of("titulo","Período fictício","inicio",fim.minusDays(27),"fim",fim),200).path("id").asString();
        JsonNode criado = api.post("/alunos/"+aluno+"/planos-treino",treinador,
                Map.of("titulo","Treino fictício","pastaId",pasta),200);
        String id = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/"+id+"/rascunho",treinador,
                ApiDeTeste.rascunho("Treino fictício",ApiDeTeste.treino().conteudo(),criado.path("plano").path("versao").asLong()),200);
        api.post("/planos-treino/"+id+"/publicar",treinador,
                Map.of("versao",salvo.path("plano").path("versao").asLong(),"confirmarAvisos",true),200);
        return pasta;
    }
    private Map<String,Object> respostas() {
        return new LinkedHashMap<>(Map.of("peso",80.5,"sono",7,"alim_desempenho",8,"treino_desempenho",6));
    }
    /** Pasta da atualização vigente (ou um id qualquer quando não há pasta). */
    private String pastaAtual() throws Exception {
        String pasta = api.get("/aluno/atualizacao",loginAluno,200).path("pastaId").asString();
        return pasta.isEmpty() ? UUID.randomUUID().toString() : pasta;
    }
    private JsonNode enviar(Map<String,Object> respostas,int status) throws Exception {
        return enviarNa(pastaAtual(),respostas,status);
    }
    /** Id da versão do questionário que o aluno está vendo (um qualquer quando não há pasta: o envio falha antes de conferir). */
    private String versaoAtual() throws Exception {
        String versao = api.get("/aluno/atualizacao",loginAluno,200).path("questionarioVersaoId").asString();
        return versao.isEmpty() ? UUID.randomUUID().toString() : versao;
    }
    private JsonNode enviarNa(String pasta,Map<String,Object> respostas,int status) throws Exception {
        return api.post("/aluno/atualizacao/enviar",loginAluno,Map.of("pastaId",pasta,"questionarioVersaoId",versaoAtual(),"respostas",respostas),status);
    }
    @Test void semPastaNaoExisteAtualizacaoENaoAceitaEnvio() throws Exception {
        assertThat(api.get("/aluno/atualizacao",loginAluno,200).path("fase").asString()).isEqualTo("NENHUMA");
        enviar(respostas(),404);
    }
    @Test void envioNaVesperaGravaPesoNaDataDaAtualizacaoSemDuplicar() throws Exception {
        publicarPasta(hoje.plusDays(1));
        assertThat(api.get("/aluno/atualizacao",loginAluno,200).path("fase").asString()).isEqualTo("ABERTA");
        JsonNode pacote = api.get("/aluno/painel",loginAluno,200).path("atualizacao");
        assertThat(pacote.path("dataAtualizacao").asString()).isEqualTo(hoje.plusDays(1).toString());
        assertThat(pacote.path("modelo").path("secoes")).hasSize(4);
        Map<String,Object> r = respostas(); r.put("campo_desconhecido","texto fictício");
        JsonNode enviada = enviar(r,200);
        assertThat(enviada.path("fase").asString()).isEqualTo("ENVIADA");
        assertThat(enviada.path("respostas").has("campo_desconhecido")).isFalse();
        // Reenvio (rede caiu depois de gravar) é idempotente: 200 com o estado atual, sem alterar nada.
        Map<String,Object> outra = respostas(); outra.put("peso",90);
        JsonNode gravada = api.get("/aluno/atualizacoes",loginAluno,200).get(0);
        JsonNode reenvio = enviar(outra,200);
        assertThat(reenvio.path("fase").asString()).isEqualTo("ENVIADA");
        assertThat(reenvio.path("enviadaEm").asString()).isEqualTo(gravada.path("enviadaEm").asString());
        assertThat(reenvio.path("versao").asLong()).isEqualTo(gravada.path("versao").asLong());
        assertThat(reenvio.path("respostas").path("peso").decimalValue()).isEqualByComparingTo("80.5");
        assertThat(api.get("/aluno/atualizacoes",loginAluno,200)).hasSize(1);
        JsonNode pesos = api.get("/alunos/"+aluno+"/pesos",treinador,200);
        assertThat(pesos).hasSize(1);
        assertThat(pesos.get(0).path("data").asString()).isEqualTo(hoje.plusDays(1).toString());
        assertThat(pesos.get(0).path("pesoKg").decimalValue()).isEqualByComparingTo("80.5");
        assertThat(api.get("/painel",treinador,200).path("atualizacoesParaRevisar").asLong()).isEqualTo(1);
    }
    @Test void envioAtualizaPesoExistenteENaoAbreAntesDaVespera() throws Exception {
        publicarPasta(hoje.plusDays(3));
        assertThat(enviar(respostas(),422).path("fieldErrors").get(0).path("field").asString()).isEqualTo("data");
        // Outra pasta publicada vira a vigente; as antigas continuam imutáveis.
        publicarPasta(hoje);
        api.post("/alunos/"+aluno+"/pesos",treinador,Map.of("data",hoje,"pesoKg",79.0),200);
        enviar(respostas(),200);
        JsonNode pesos = api.get("/alunos/"+aluno+"/pesos",treinador,200);
        assertThat(pesos).hasSize(1);
        assertThat(pesos.get(0).path("pesoKg").decimalValue()).isEqualByComparingTo("80.5");
    }
    @Test void envioMantemObservacaoDoPesoDoDia() throws Exception {
        publicarPasta(hoje);
        api.post("/alunos/"+aluno+"/pesos",treinador,Map.of("data",hoje,"pesoKg",79.0,"observacao","Observação fictícia"),200);
        enviar(respostas(),200);
        JsonNode pesos = api.get("/alunos/"+aluno+"/pesos",treinador,200);
        assertThat(pesos).hasSize(1);
        assertThat(pesos.get(0).path("pesoKg").decimalValue()).isEqualByComparingTo("80.5");
        assertThat(pesos.get(0).path("observacao").asString()).isEqualTo("Observação fictícia");
    }
    /** Outra transação grava o peso do mesmo dia entre a leitura e o insert do envio: 409, nunca 500, e nada fica gravado. */
    @Test void pesoDoMesmoDiaGravadoAoMesmoTempoDa409ENaoGravaOEnvio() throws Exception {
        publicarPasta(hoje);
        UUID consultoria = banco.queryForObject("select consultoria_id from aluno where id=?",UUID.class,aluno);
        UUID autor = UUID.fromString(treinador.path("usuario").path("id").asString());
        try (var executor = Executors.newVirtualThreadPerTaskExecutor(); var conexao = dataSource.getConnection()) {
            conexao.setAutoCommit(false);
            int pidDestaConexao;
            try (var st = conexao.createStatement(); var rs = st.executeQuery("select pg_backend_pid()")) {
                rs.next();
                pidDestaConexao = rs.getInt(1);
            }
            try (var insert = conexao.prepareStatement("insert into registro_peso (id,consultoria_id,aluno_id,data,peso_kg,registrado_por) "
                    + "values (gen_random_uuid(),?,?,?,79,?)")) {
                insert.setObject(1,consultoria); insert.setObject(2,aluno); insert.setObject(3,hoje); insert.setObject(4,autor);
                insert.executeUpdate();
            }
            var envio = executor.submit(() -> enviar(respostas(),409));
            long limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(20);
            // Só conta quem está barrado por ESTA conexão (não qualquer espera por lock no banco compartilhado).
            while (banco.queryForObject("select count(*) from pg_stat_activity where wait_event_type='Lock' and ? = any(pg_blocking_pids(pid))",Integer.class,pidDestaConexao) == 0) {
                assertThat(System.nanoTime()).as("o envio precisa esperar a outra transação").isLessThan(limite);
                Thread.sleep(50);
            }
            conexao.commit();
            assertThat(envio.get(30,TimeUnit.SECONDS).path("codigo").asString()).isEqualTo("PESO_JA_REGISTRADO");
        }
        assertThat(api.get("/aluno/atualizacao",loginAluno,200).path("fase").asString()).isEqualTo("ABERTA");
        assertThat(api.get("/alunos/"+aluno+"/pesos",treinador,200).get(0).path("pesoKg").decimalValue()).isEqualByComparingTo("79");
        enviar(respostas(),200);
        assertThat(api.get("/alunos/"+aluno+"/pesos",treinador,200).get(0).path("pesoKg").decimalValue()).isEqualByComparingTo("80.5");
    }
    @Test void validacaoApontaCampoSemGravarRespostasOuPeso() throws Exception {
        publicarPasta(hoje);
        Map<String,Object> r = respostas(); r.remove("peso"); conferirCampo(r,"peso");
        r = respostas(); r.put("sono",11); conferirCampo(r,"sono");
        r = respostas(); r.put("peso",0); conferirCampo(r,"peso");
        r = respostas(); r.put("alim_digestao","x".repeat(501)); conferirCampo(r,"alim_digestao");
        r = respostas(); r.put("fb_pos_treino",Map.of("7",5)); conferirCampo(r,"fb_pos_treino");
        api.post("/aluno/atualizacao/enviar",loginAluno,envioComVersao(pastaAtual(),UUID.randomUUID(),respostas()),409);
        assertThat(api.get("/aluno/atualizacoes",loginAluno,200)).isEmpty();
        assertThat(api.get("/alunos/"+aluno+"/pesos",treinador,200)).isEmpty();
    }
    private void conferirCampo(Map<String,Object> r,String campo) throws Exception {
        JsonNode erro = enviar(r,422);
        assertThat(erro.path("codigo").asString()).isEqualTo("ATUALIZACAO_INVALIDA");
        assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo(campo);
    }
    @Test void atrasoAlteraPrazoMasNaoBloqueiaAlunoNemAceitaForaDaFaixa() throws Exception {
        publicarPasta(hoje.minusDays(1));
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS",treinador,200)).hasSize(1);
        api.post("/aluno/atualizacao/atraso",loginAluno,Map.of("pastaId",pastaAtual(),"novaData",hoje.minusDays(1)),422);
        api.post("/aluno/atualizacao/atraso",loginAluno,Map.of("pastaId",pastaAtual(),"novaData",hoje.plusDays(15)),422);
        JsonNode aviso = api.post("/aluno/atualizacao/atraso",loginAluno,
                Map.of("pastaId",pastaAtual(),"novaData",hoje.plusDays(2),"motivo","Motivo fictício"),200);
        assertThat(aviso.path("fase").asString()).isEqualTo("ABERTA");
        assertThat(aviso.path("diasDeAtraso").asLong()).isZero();
        assertThat(api.get("/atualizacoes?situacao=AVISARAM_ATRASO",treinador,200)).hasSize(1);
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS",treinador,200)).isEmpty();
        assertThat(api.get("/atualizacoes?situacao=PROXIMAS",treinador,200)).hasSize(1);
        enviar(respostas(),200);
        api.post("/aluno/atualizacao/atraso",loginAluno,Map.of("pastaId",pastaAtual(),"novaData",hoje.plusDays(2)),409);
    }
    @Test void atrasoNaoAceitaDataAntesDaOriginalEMantemFormularioAberto() throws Exception {
        publicarPasta(hoje.plusDays(1));
        JsonNode erro = api.post("/aluno/atualizacao/atraso",loginAluno,Map.of("pastaId",pastaAtual(),"novaData",hoje),422);
        assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("novaData");
        assertThat(erro.path("fieldErrors").get(0).path("message").asString()).contains("até");
        JsonNode aviso = api.post("/aluno/atualizacao/atraso",loginAluno,Map.of("pastaId",pastaAtual(),"novaData",hoje.plusDays(5)),200);
        assertThat(aviso.path("fase").asString()).isEqualTo("ABERTA");
        assertThat(aviso.path("atrasoAte").asString()).isEqualTo(hoje.plusDays(5).toString());
        assertThat(enviar(respostas(),200).path("fase").asString()).isEqualTo("ENVIADA");
    }
    /** Atualização antiga aberta pelo histórico não grava respostas, peso nem aviso na pasta atual. */
    @Test void enviarOuAvisarAtrasoDePastaQueNaoEAAtualDa409() throws Exception {
        String antiga = publicarPasta(hoje);
        api.post("/aluno/atualizacao/atraso",loginAluno,Map.of("pastaId",antiga,"novaData",hoje.plusDays(2)),200);
        String atual = publicarPasta(hoje.plusDays(1));
        assertThat(pastaAtual()).isEqualTo(atual);
        assertThat(enviarNa(antiga,respostas(),409).path("codigo").asString()).isEqualTo("ATUALIZACAO_NAO_ATUAL");
        assertThat(api.post("/aluno/atualizacao/atraso",loginAluno,Map.of("pastaId",antiga,"novaData",hoje.plusDays(3)),409)
                .path("codigo").asString()).isEqualTo("ATUALIZACAO_NAO_ATUAL");
        JsonNode vigente = api.get("/aluno/atualizacao",loginAluno,200);
        assertThat(vigente.path("fase").asString()).isEqualTo("ABERTA");
        assertThat(vigente.path("atrasoAte").isNull()).isTrue();
        assertThat(api.get("/alunos/"+aluno+"/pesos",treinador,200)).isEmpty();
        assertThat(enviarNa(atual,respostas(),200).path("fase").asString()).isEqualTo("ENVIADA");
    }
    @Test void reenvioDeAtualizacaoRevisadaOuDePastaAnteriorDevolveOEstadoSemAlterar() throws Exception {
        String antiga = publicarPasta(hoje);
        JsonNode enviada = enviarNa(antiga,respostas(),200);
        String id = enviada.path("id").asString();
        api.put("/atualizacoes/"+id+"/feedback",treinador,Map.of("texto","Feedback fictício","versao",enviada.path("versao").asLong()),200);
        JsonNode revisada = enviarNa(antiga,respostas(),200);
        assertThat(revisada.path("fase").asString()).isEqualTo("REVISADA");
        assertThat(revisada.path("feedback").path("texto").asString()).isEqualTo("Feedback fictício");
        // Mesmo depois de a pasta mudar, o reenvio da que já foi enviada não vira 409.
        publicarPasta(hoje.plusDays(1));
        assertThat(enviarNa(antiga,respostas(),200).path("id").asString()).isEqualTo(id);
        assertThat(api.get("/aluno/atualizacoes",loginAluno,200)).hasSize(1);
        // Outro aluno não reaproveita a atualização alheia.
        JsonNode outroAluno = api.convidarEEntrar(treinador,api.criarAluno(treinador,"Outro aluno fictício"));
        api.post("/aluno/atualizacao/enviar",outroAluno,envioComVersao(antiga,UUID.randomUUID(),respostas()),404);
    }
    @Test void feedbackTemVersaoEditadoEVisto() throws Exception {
        publicarPasta(hoje);
        JsonNode enviada = enviar(respostas(),200);
        String id = enviada.path("id").asString();
        long primeiraVersao = enviada.path("versao").asLong();
        JsonNode revisada = api.put("/atualizacoes/"+id+"/feedback",treinador,
                Map.of("texto","Feedback fictício","versao",primeiraVersao),200);
        assertThat(revisada.path("fase").asString()).isEqualTo("REVISADA");
        assertThat(revisada.path("feedback").path("nomeAutor").asString()).isEqualTo("Treinador Teste");
        assertThat(revisada.path("feedback").path("naoLido").asBoolean()).isTrue();
        assertThat(revisada.path("feedback").path("editadoEm").isNull()).isTrue();
        api.put("/atualizacoes/"+id+"/feedback",treinador,Map.of("texto","Conflito fictício","versao",primeiraVersao),409);
        api.post("/aluno/atualizacoes/"+id+"/feedback-visto",loginAluno,null,204);
        JsonNode vista = api.get("/atualizacoes/"+id,treinador,200);
        assertThat(vista.path("feedback").path("naoLido").asBoolean()).isFalse();
        JsonNode editada = api.put("/atualizacoes/"+id+"/feedback",treinador,
                Map.of("texto","Feedback fictício editado","versao",vista.path("versao").asLong()),200);
        assertThat(editada.path("feedback").path("editadoEm").isNull()).isFalse();
        assertThat(editada.path("feedback").path("naoLido").asBoolean()).isTrue();
        assertThat(api.get("/atualizacoes?situacao=PARA_REVISAR",treinador,200)).isEmpty();
    }
    @Test void mudarOFimDaPastaMoveADataSoDaAtualizacaoAberta() throws Exception {
        String pasta = publicarPasta(hoje.plusDays(5));
        // "Vou atrasar" grava a linha, que fica ABERTA com a data da pasta.
        api.post("/aluno/atualizacao/atraso",loginAluno,Map.of("pastaId",pasta,"novaData",hoje.plusDays(7)),200);
        assertThat(dataDaAtualizacao()).isEqualTo(hoje.plusDays(5).toString());
        alterarFimDaPasta(pasta,hoje.plusDays(1));
        assertThat(dataDaAtualizacao()).isEqualTo(hoje.plusDays(1).toString());
        // Enviada fica como está, mesmo que a pasta mude depois.
        enviar(respostas(),200);
        alterarFimDaPasta(pasta,hoje.plusDays(9));
        assertThat(dataDaAtualizacao()).isEqualTo(hoje.plusDays(1).toString());
        assertThat(api.get("/alunos/"+aluno+"/atualizacoes",treinador,200).get(0).path("dataAtualizacao").asString())
                .isEqualTo(hoje.plusDays(1).toString());
    }
    private String dataDaAtualizacao() throws Exception {
        return api.get("/aluno/atualizacao",loginAluno,200).path("dataAtualizacao").asString();
    }
    private void alterarFimDaPasta(String pasta,LocalDate fim) throws Exception {
        api.put("/pastas/"+pasta,treinador,Map.of("titulo","Período fictício","inicio",fim.minusDays(27),"fim",fim),200);
    }
    @Test void alunoVerOFeedbackNaoInvalidaAVersaoDoTreinador() throws Exception {
        publicarPasta(hoje);
        String id = enviar(respostas(),200).path("id").asString();
        JsonNode revisada = api.put("/atualizacoes/"+id+"/feedback",treinador,
                Map.of("texto","Feedback fictício",
                        "versao",api.get("/atualizacoes/"+id,treinador,200).path("versao").asLong()),200);
        long versaoDoTreinador = revisada.path("versao").asLong();
        api.post("/aluno/atualizacoes/"+id+"/feedback-visto",loginAluno,null,204);
        assertThat(api.get("/atualizacoes/"+id,treinador,200).path("feedback").path("naoLido").asBoolean()).isFalse();
        JsonNode editada = api.put("/atualizacoes/"+id+"/feedback",treinador,
                Map.of("texto","Feedback fictício revisto","versao",versaoDoTreinador),200);
        assertThat(editada.path("feedback").path("texto").asString()).isEqualTo("Feedback fictício revisto");
    }
    @Test void outroAlunoEOutraConsultoriaRecebem404EmTodasAsLeiturasEEscritas() throws Exception {
        publicarPasta(hoje);
        JsonNode enviada = enviar(respostas(),200);
        String id = enviada.path("id").asString();
        JsonNode outroAluno = api.convidarEEntrar(treinador,api.criarAluno(treinador,"Outro aluno fictício"));
        api.get("/aluno/atualizacoes/"+id,outroAluno,404);
        api.post("/aluno/atualizacoes/"+id+"/feedback-visto",outroAluno,null,404);
        assertThat(api.get("/aluno/atualizacoes",outroAluno,200)).isEmpty();
        JsonNode outroTreinador = api.novoTreinador();
        api.get("/atualizacoes/"+id,outroTreinador,404);
        api.get("/alunos/"+aluno+"/atualizacoes",outroTreinador,404);
        api.get("/alunos/"+aluno+"/atualizacao",outroTreinador,404);
        api.put("/atualizacoes/"+id+"/feedback",outroTreinador,Map.of("texto","Fictício","versao",enviada.path("versao").asLong()),404);
        for (String filtro : new String[]{"PARA_REVISAR","ATRASADAS","AVISARAM_ATRASO","PROXIMAS"})
            assertThat(api.get("/atualizacoes?situacao="+filtro,outroTreinador,200)).isEmpty();
        api.get("/atualizacoes",loginAluno,403);
        api.get("/aluno/atualizacao",treinador,403);
        api.get("/atualizacoes?situacao=DESCONHECIDA",treinador,400);
    }

    // --- Questionário vigente: pasta, depois aluno, depois o padrão ---
    private static final String SEM_PESO = "{\"formato\":2,\"instrucoes\":[],\"secoes\":[{\"uid\":\"s1\",\"titulo\":\"Geral\","
            + "\"perguntas\":[{\"id\":\"sono\",\"tipo\":\"NOTA\",\"rotulo\":\"Sono\",\"obrigatoria\":true}]}]}";
    private UUID consultoria() { return banco.queryForObject("select consultoria_id from aluno where id=?",UUID.class,aluno); }
    /** Cria um questionário já publicado (v1) direto no banco; devolve {id do questionário, id da versão}. */
    private UUID[] novoQuestionario(String nome,String conteudo) {
        UUID q = UUID.randomUUID(), v = UUID.randomUUID();
        banco.update("insert into questionario(id,consultoria_id,nome,rascunho,versao_publicada,publicado_em) values (?,?,?,?::jsonb,1,now())",
                q,consultoria(),nome,conteudo);
        banco.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) values (?,?,?,1,?::jsonb)",
                v,consultoria(),q,conteudo);
        return new UUID[]{q,v};
    }
    private void escolherNoAluno(UUID questionario) { banco.update("update aluno set questionario_id=? where id=?",questionario,aluno); }
    private void escolherNaPasta(String pasta,UUID questionario) { banco.update("update pasta_plano set questionario_id=? where id=?",questionario,UUID.fromString(pasta)); }
    private String nomeDoQuestionario() throws Exception { return api.get("/alunos/"+aluno+"/atualizacao",treinador,200).path("questionarioNome").asString(); }
    private Map<String,Object> envioComVersao(String pasta,UUID versao,Map<String,Object> respostas) {
        return Map.of("pastaId",pasta,"questionarioVersaoId",versao.toString(),"respostas",respostas);
    }

    @Test void questionarioVigenteSegueAPastaDepoisOAlunoDepoisOPadrao() throws Exception {
        String pasta = publicarPasta(hoje);
        assertThat(nomeDoQuestionario()).isEqualTo("Padrão");
        UUID[] doAluno = novoQuestionario("Do aluno",SEM_PESO);
        UUID[] daPasta = novoQuestionario("Da pasta",SEM_PESO);
        escolherNoAluno(doAluno[0]);
        assertThat(nomeDoQuestionario()).isEqualTo("Do aluno");
        escolherNaPasta(pasta,daPasta[0]);
        assertThat(nomeDoQuestionario()).isEqualTo("Da pasta");
        // Arquivado é ignorado: cai para o próximo candidato e, por fim, para o padrão.
        banco.update("update questionario set arquivado=true where id=?",daPasta[0]);
        assertThat(nomeDoQuestionario()).isEqualTo("Do aluno");
        banco.update("update questionario set arquivado=true where id=?",doAluno[0]);
        assertThat(nomeDoQuestionario()).isEqualTo("Padrão");
        // Sem versão publicada também é ignorado.
        UUID[] rascunho = novoQuestionario("Só rascunho",SEM_PESO);
        banco.update("update questionario set versao_publicada=0 where id=?",rascunho[0]);
        escolherNaPasta(pasta,rascunho[0]);
        assertThat(nomeDoQuestionario()).isEqualTo("Padrão");
    }

    @Test void envioConfereOIdDaVersaoEAEnviadaMantemAVersaoQueRespondeu() throws Exception {
        String pasta = publicarPasta(hoje);
        UUID[] antigo = novoQuestionario("Respondido",SEM_PESO);
        escolherNoAluno(antigo[0]);
        UUID padrao = banco.queryForObject("select id from questionario_versao where consultoria_id=? and questionario_id in (select id from questionario where padrao and consultoria_id=?)",UUID.class,consultoria(),consultoria());
        // Versão que não é a vigente: 409 e nada é gravado.
        api.post("/aluno/atualizacao/enviar",loginAluno,envioComVersao(pasta,padrao,Map.of("sono",7)),409);
        assertThat(api.get("/aluno/atualizacao",loginAluno,200).path("fase").asString()).isEqualTo("ABERTA");
        JsonNode enviada = api.post("/aluno/atualizacao/enviar",loginAluno,envioComVersao(pasta,antigo[1],Map.of("sono",7)),200);
        assertThat(enviada.path("questionarioVersaoId").asString()).isEqualTo(antigo[1].toString());
        // Trocar a escolha ou arquivar depois do envio não muda o que o aluno respondeu.
        escolherNoAluno(null);
        banco.update("update questionario set arquivado=true where id=?",antigo[0]);
        JsonNode depois = api.get("/aluno/atualizacao",loginAluno,200);
        assertThat(depois.path("questionarioVersaoId").asString()).isEqualTo(antigo[1].toString());
        assertThat(depois.path("questionarioNome").isNull()).isTrue();
        assertThat(nomeDoQuestionario()).isEqualTo("Respondido");
        assertThat(banco.queryForObject("select questionario_versao_id from atualizacao where pasta_id=?",UUID.class,UUID.fromString(pasta))).isEqualTo(antigo[1]);
    }

    @Test void envioSemPerguntaDePesoNaoGravaPeso() throws Exception {
        String pasta = publicarPasta(hoje);
        UUID[] semPeso = novoQuestionario("Sem peso",SEM_PESO);
        escolherNoAluno(semPeso[0]);
        api.post("/aluno/atualizacao/enviar",loginAluno,envioComVersao(pasta,semPeso[1],Map.of("sono",7)),200);
        assertThat(api.get("/alunos/"+aluno+"/pesos",treinador,200)).isEmpty();
    }

    @Test void atualizacaoAbertaComAvisoDeAtrasoSegueOQuestionarioVigente() throws Exception {
        String pasta = publicarPasta(hoje.plusDays(5));
        api.post("/aluno/atualizacao/atraso",loginAluno,Map.of("pastaId",pasta,"novaData",hoje.plusDays(7)),200);
        UUID[] novo = novoQuestionario("Trocado depois do aviso",SEM_PESO);
        escolherNoAluno(novo[0]);
        assertThat(nomeDoQuestionario()).isEqualTo("Trocado depois do aviso");
        assertThat(banco.queryForObject("select questionario_versao_id from atualizacao where pasta_id=?",UUID.class,UUID.fromString(pasta))).isNull();
    }

    @Test void detalheDoTreinadorTrazQuestionarioDaVersaoRespondidaEResumoDoPeriodo() throws Exception {
        publicarPasta(hoje);
        api.post("/alunos/"+aluno+"/pesos",treinador,Map.of("data",hoje.minusDays(10).toString(),"pesoKg",82.0),200);
        JsonNode enviada = enviar(respostas(),200);
        JsonNode detalhe = api.get("/atualizacoes/"+enviada.path("id").asString(),treinador,200);
        assertThat(detalhe.path("questionarioNome").asString()).isEqualTo("Padrão");
        assertThat(detalhe.path("questionarioVersaoId").asString()).isEqualTo(enviada.path("questionarioVersaoId").asString());
        assertThat(detalhe.path("questionarioVersaoNumero").asInt()).isEqualTo(1);
        assertThat(detalhe.path("modelo").path("secoes")).hasSize(4);
        assertThat(detalhe.path("respostas").path("peso").decimalValue()).isEqualByComparingTo("80.5");
        // O resumo vem do sistema (registros do período), não do questionário: peso anterior = último registro antes do fim.
        assertThat(detalhe.path("resumo").path("pesoAnterior").decimalValue()).isEqualByComparingTo("82");
        assertThat(detalhe.path("resumo").path("diasComTreino").asInt()).isZero();
        assertThat(detalhe.path("resumo").path("mediaDiasPorSemana").asDouble()).isZero();
    }

    @Test void respostasFalseEZeroDosTiposNovosSobrevivemAoEnvioEApareceNoDetalhe() throws Exception {
        String pasta = publicarPasta(hoje);
        String conteudo = """
            {"formato":2,"instrucoes":[],"secoes":[{"uid":"s1","titulo":"Geral","perguntas":[
              {"id":"dor","tipo":"SIM_NAO","rotulo":"Sentiu dor?","obrigatoria":true,"destaque":true},
              {"id":"passos","tipo":"NUMERO","rotulo":"Passos","obrigatoria":true,"unidade":"mil","min":0,"max":50,"casas":1},
              {"id":"humor","tipo":"ESCOLHA_UNICA","rotulo":"Humor","obrigatoria":false,
               "opcoes":[{"id":"a","rotulo":"Ruim"},{"id":"b","rotulo":"Bom"}]},
              {"id":"extras","tipo":"MULTIPLA_ESCOLHA","rotulo":"Extras","obrigatoria":false,
               "opcoes":[{"id":"a","rotulo":"Água"},{"id":"b","rotulo":"Sono"}]}]}]}
            """;
        UUID[] novos = novoQuestionario("Tipos novos",conteudo);
        escolherNoAluno(novos[0]);
        // Texto no lugar de boolean e número fora da faixa são recusados, sem gravar nada.
        for (String campo : new String[]{"dor","passos"}) {
            Map<String,Object> ruim = new LinkedHashMap<>(Map.of("dor",false,"passos",1));
            ruim.put(campo,campo.equals("dor") ? "não" : 51);
            JsonNode erro = api.post("/aluno/atualizacao/enviar",loginAluno,envioComVersao(pasta,novos[1],ruim),422);
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo(campo);
        }
        assertThat(api.get("/aluno/atualizacoes",loginAluno,200)).isEmpty();
        Map<String,Object> r = new LinkedHashMap<>();
        r.put("dor",false); r.put("passos",0); r.put("humor","b"); r.put("extras",java.util.List.of("b","a"));
        JsonNode enviada = api.post("/aluno/atualizacao/enviar",loginAluno,envioComVersao(pasta,novos[1],r),200);
        JsonNode detalhe = api.get("/atualizacoes/"+enviada.path("id").asString(),treinador,200);
        JsonNode salvas = detalhe.path("respostas");
        assertThat(salvas.path("dor").isBoolean()).isTrue();
        assertThat(salvas.path("dor").asBoolean()).isFalse();
        assertThat(salvas.path("passos").decimalValue()).isEqualByComparingTo("0");
        assertThat(salvas.path("humor").asString()).isEqualTo("b");
        assertThat(salvas.path("extras")).hasSize(2);
        assertThat(detalhe.path("modelo").path("secoes").get(0).path("perguntas").get(0).path("destaque").asBoolean()).isTrue();
    }

    @Test void envioSemNenhumaVersaoInformadaDa400() throws Exception {
        String pasta = publicarPasta(hoje);
        api.post("/aluno/atualizacao/enviar",loginAluno,Map.of("pastaId",pasta,"respostas",respostas()),400);
    }
}
