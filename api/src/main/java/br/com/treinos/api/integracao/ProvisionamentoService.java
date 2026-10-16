package br.com.treinos.api.integracao;

import br.com.treinos.api.auth.CriacaoDeConta;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.Emails;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Provisionamento de instância (contrato 5.1), numa transação só: operação idempotente, consultoria (ou adoção da que já
 * existe), convite do administrador e direitos. Tudo por JDBC/entidades globais, sem {@code TenantContext}: a
 * consultoria nasce aqui e nenhuma requisição de usuário está em curso.
 *
 * <p>Decisão do Gustavo (13/10/2026): o administrador é procurado pelo <b>e-mail</b>. Se já é administrador ativo de uma
 * consultoria, a contratação adota essa consultoria ({@code VINCULADO}); senão cria consultoria nova e um convite de
 * primeiro acesso ({@code CONVIDADO}). O link do convite é um segredo: vai só na primeira resposta (campo aditivo
 * {@code administrador.convite}) e nunca é gravado; para ver de novo há {@link #reemitirConviteDoAdministrador}.</p>
 */
@Service
public class ProvisionamentoService {

    static final String TIPO = "PROVISIONAR";
    static final int VALIDADE_CONVITE_DIAS = 7;

    /** {@code consultoriaNova} só vem preenchida quando esta chamada criou a consultoria (não em repetição nem adoção). */
    public record Resultado(int status, JsonNode corpo, boolean repeticao, UUID consultoriaNova) { }

    public record ConviteEmitido(String link, Instant expiraEm) { }

    /** O e-mail do administrador acompanha o convite só por dentro da API: a resposta para a Central é o {@link ConviteEmitido}. */
    public record Reemissao(ConviteEmitido convite, String email) { }

    private final IntegracaoRepositorio repositorio;
    private final ContaLocalRepositorio contas;
    private final ConsultoriaRepository consultorias;
    private final CriacaoDeConta criacao;
    private final IntegracaoProperties propriedades;
    private final JsonMapper json;
    private final String appUrl;

    public ProvisionamentoService(IntegracaoRepositorio repositorio, ContaLocalRepositorio contas,
                                  ConsultoriaRepository consultorias, CriacaoDeConta criacao,
                                  IntegracaoProperties propriedades, JsonMapper json,
                                  @Value("${treinos.app-url}") String appUrl) {
        this.repositorio = repositorio;
        this.contas = contas;
        this.consultorias = consultorias;
        this.criacao = criacao;
        this.propriedades = propriedades;
        this.json = json;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    @Transactional
    public Resultado provisionar(UUID chave, String hashCorpo, ProvisionarRequest r) {
        var anterior = repositorio.operacao(chave);
        if (anterior.isPresent()) {
            if (!anterior.get().hashCorpo().equals(hashCorpo)) {
                throw new ConflictException("A mesma Idempotency-Key já foi usada com outro corpo.", "IDEMPOTENCY_KEY_CONFLITO");
            }
            return new Resultado(200, json.readTree(anterior.get().resposta()), true, null);
        }
        validar(chave, r);
        String email = Emails.normalizar(r.administrador().email());
        var existente = repositorio.treinadorPorEmail(email);

        UUID consultoriaId;
        UUID usuarioId;
        String situacao;
        ConviteEmitido convite = null;
        if (existente.isPresent()) {
            var treinador = existente.get();
            if (!treinador.ativo() || !treinador.administrador()) {
                throw new IntegracaoException(HttpStatus.UNPROCESSABLE_CONTENT,
                        "Este e-mail pertence a um usuário que não é administrador ativo de uma consultoria.",
                        "ADMINISTRADOR_INVALIDO");
            }
            consultoriaId = treinador.consultoriaId();
            usuarioId = treinador.usuarioId();
            situacao = "VINCULADO";
            var direitos = contas.direitos(consultoriaId);
            if (direitos.isPresent() && !direitos.get().contratacaoId().equals(r.contratacaoId())) {
                throw new ConflictException("Esta consultoria já está vinculada a outra contratação.", "CONSULTORIA_JA_VINCULADA");
            }
        } else {
            if (consultorias.existsBySlug(r.instancia().slug())) {
                throw new IntegracaoException(HttpStatus.UNPROCESSABLE_CONTENT, "Já existe uma consultoria com este slug.", "SLUG_EM_USO");
            }
            consultoriaId = criacao.criarConsultoria(r.instancia().nome(), r.instancia().slug()).getId();
            convite = emitirConvite(consultoriaId, r.administrador().nome().trim(), email);
            usuarioId = repositorio.convitePendenteDoAdministrador(consultoriaId).orElseThrow().id();
            situacao = "CONVIDADO";
        }

        Instant agora = Instant.now();
        contas.aplicarSeMaisNova(r.direitos().paraLocal(consultoriaId, agora));
        contas.confirmar(consultoriaId, agora);
        long versaoAplicada = contas.direitos(consultoriaId).map(DireitosLocais::versao).orElse(r.direitos().versao());

        Map<String, Object> administrador = new LinkedHashMap<>();
        administrador.put("usuarioId", usuarioId);
        administrador.put("situacao", situacao);
        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("contratacaoId", r.contratacaoId());
        resposta.put("tenantId", consultoriaId);
        resposta.put("administrador", administrador);
        resposta.put("versaoDireitosAplicada", versaoAplicada);
        resposta.put("criadoEm", agora);
        // Gravada sem o convite: o segredo não fica em repouso nem volta numa repetição.
        repositorio.gravarOperacao(chave, TIPO, hashCorpo, 201, json.writeValueAsString(resposta));
        if (convite != null) {
            administrador.put("convite", Map.of("link", convite.link(), "expiraEm", convite.expiraEm()));
        }
        return new Resultado(201, json.valueToTree(resposta), false, convite == null ? null : consultoriaId);
    }

    /**
     * Novo link para o administrador que ainda não aceitou o primeiro convite (o anterior deixa de valer). Só existe
     * enquanto o convite do sistema está pendente: depois do primeiro acesso, quem recupera a conta é o próprio
     * administrador.
     */
    @Transactional
    public Reemissao reemitirConviteDoAdministrador(UUID consultoriaId) {
        if (repositorio.consultoria(consultoriaId).isEmpty() || contas.direitos(consultoriaId).isEmpty()) {
            throw IntegracaoException.instanciaNaoEncontrada();
        }
        var pendente = repositorio.convitePendenteDoAdministrador(consultoriaId).orElseThrow(
                () -> new ConflictException("O administrador desta consultoria já tem acesso.", "ADMINISTRADOR_JA_ATIVO"));
        repositorio.apagarConvitesPendentesDoAdministrador(consultoriaId);
        return new Reemissao(emitirConvite(consultoriaId, pendente.nome(), pendente.email()), pendente.email());
    }

    private ConviteEmitido emitirConvite(UUID consultoriaId, String nome, String email) {
        String codigo = OpaqueTokenGenerator.gerar();
        Instant expira = Instant.now().plus(VALIDADE_CONVITE_DIAS, ChronoUnit.DAYS);
        repositorio.inserirConviteDoAdministrador(consultoriaId, nome, email, OpaqueTokenGenerator.hash(codigo), expira);
        return new ConviteEmitido(appUrl + "/convite-equipe#" + codigo, expira);
    }

    private void validar(UUID chave, ProvisionarRequest r) {
        if (!chave.equals(r.contratacaoId())) {
            throw new BadRequestException("A Idempotency-Key deve ser igual ao contratacaoId do corpo.");
        }
        if (!r.contratacaoId().equals(r.direitos().contratacaoId())) {
            throw new BadRequestException("A contratação dos direitos não é a do corpo.");
        }
        if (!propriedades.produto().equalsIgnoreCase(r.direitos().produto())) {
            throw new BadRequestException("Direitos de outro produto.");
        }
        if (r.direitos().tenantId() != null) {
            throw new BadRequestException("No provisionamento o tenantId dos direitos deve ser nulo.");
        }
    }
}
